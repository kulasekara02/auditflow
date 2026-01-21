package com.auditflow;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;

/**
 * Database access layer using HikariCP connection pooling.
 */
public class Db {
    private static final Logger logger = LoggerFactory.getLogger(Db.class);
    private final HikariDataSource dataSource;

    public Db(String jdbcUrl, String username, String password) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setIdleTimeout(300000);
        config.setConnectionTimeout(30000);
        config.setMaxLifetime(1800000);
        config.setPoolName("AuditFlowPool");
        config.addDataSourceProperty("cachePrepStmts", "true");
        config.addDataSourceProperty("prepStmtCacheSize", "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");

        this.dataSource = new HikariDataSource(config);
        logger.info("Database connection pool initialised: {}", jdbcUrl);

        // Verify connection and ensure schema exists
        verifyConnection();
    }

    private void verifyConnection() {
        try (Connection conn = getConnection()) {
            logger.info("Database connection verified");
            ensureAlertsTable(conn);
        } catch (SQLException e) {
            logger.error("Failed to verify database connection", e);
            throw new RuntimeException("Database connection failed", e);
        }
    }

    private void ensureAlertsTable(Connection conn) throws SQLException {
        // Check if alerts table exists, create if not
        String checkSql = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alerts')";
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(checkSql)) {
            if (rs.next() && !rs.getBoolean(1)) {
                createAlertsTable(conn);
            }
        }
    }

    private void createAlertsTable(Connection conn) throws SQLException {
        String createSql = """
            CREATE TABLE IF NOT EXISTS alerts (
                id SERIAL PRIMARY KEY,
                rule_name VARCHAR(255) NOT NULL,
                level VARCHAR(50) NOT NULL DEFAULT 'medium',
                message TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'new',
                event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """;
        
        try (Statement stmt = conn.createStatement()) {
            stmt.execute(createSql);
            logger.info("Created alerts table");
        }

        // Create indexes
        String[] indexes = {
            "CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level)",
            "CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)",
            "CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_alerts_event_id ON alerts(event_id)"
        };

        for (String indexSql : indexes) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute(indexSql);
            }
        }
    }

    public Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }

    /**
     * Insert a new alert into the database.
     * 
     * @param ruleName  The name of the rule that triggered the alert
     * @param level     Alert level: low, medium, high, critical
     * @param message   Alert message
     * @param eventId   Optional event ID that triggered this alert
     * @return          The generated alert ID, or -1 if insertion failed
     */
    public long insertAlert(String ruleName, String level, String message, Long eventId) {
        String sql = """
            INSERT INTO alerts (rule_name, level, message, event_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id
            """;

        Timestamp now = Timestamp.from(Instant.now());

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            
            pstmt.setString(1, ruleName);
            pstmt.setString(2, level);
            pstmt.setString(3, message);
            if (eventId != null) {
                pstmt.setLong(4, eventId);
            } else {
                pstmt.setNull(4, java.sql.Types.INTEGER);
            }
            pstmt.setTimestamp(5, now);
            pstmt.setTimestamp(6, now);

            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        } catch (SQLException e) {
            logger.error("Failed to insert alert: {} - {}", ruleName, e.getMessage());
        }

        return -1;
    }

    /**
     * Update alert status.
     * 
     * @param alertId  The alert ID
     * @param status   New status: new, acknowledged, resolved
     * @return         True if update succeeded
     */
    public boolean updateAlertStatus(long alertId, String status) {
        String sql = "UPDATE alerts SET status = ?, updated_at = ? WHERE id = ?";
        Timestamp now = Timestamp.from(Instant.now());

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            
            pstmt.setString(1, status);
            pstmt.setTimestamp(2, now);
            pstmt.setLong(3, alertId);

            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            logger.error("Failed to update alert status: {} - {}", alertId, e.getMessage());
            return false;
        }
    }

    /**
     * Check if an alert already exists for a given event to prevent duplicates.
     * 
     * @param eventId   The event ID
     * @param ruleName  The rule name
     * @return          True if alert already exists
     */
    public boolean alertExists(Long eventId, String ruleName) {
        if (eventId == null) {
            return false;
        }

        String sql = "SELECT EXISTS(SELECT 1 FROM alerts WHERE event_id = ? AND rule_name = ?)";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            
            pstmt.setLong(1, eventId);
            pstmt.setString(2, ruleName);

            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getBoolean(1);
                }
            }
        } catch (SQLException e) {
            logger.error("Failed to check alert existence: {}", e.getMessage());
        }

        return false;
    }

    public void close() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
            logger.info("Database connection pool closed");
        }
    }
}
