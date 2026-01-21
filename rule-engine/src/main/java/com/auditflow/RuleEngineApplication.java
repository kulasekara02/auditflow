package com.auditflow;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import spark.Spark;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Main entry point for the AuditFlow Rule Engine.
 * Consumes events from Redis Streams and generates alerts based on configurable rules.
 */
public class RuleEngineApplication {
    private static final Logger logger = LoggerFactory.getLogger(RuleEngineApplication.class);
    private static final AtomicBoolean running = new AtomicBoolean(true);
    private static final CountDownLatch shutdownLatch = new CountDownLatch(1);

    public static void main(String[] args) {
        logger.info("Starting AuditFlow Rule Engine...");

        // Configuration from environment
        String redisHost = getEnv("REDIS_HOST", "localhost");
        int redisPort = Integer.parseInt(getEnv("REDIS_PORT", "6379"));
        String dbUrl = getEnv("DATABASE_URL", "jdbc:postgresql://localhost:5432/auditflow");
        String dbUser = getEnv("DB_USER", "auditflow");
        String dbPassword = getEnv("DB_PASSWORD", "auditflow_secret");
        int healthPort = Integer.parseInt(getEnv("HEALTH_PORT", "8081"));

        // Initialise components
        Db db = null;
        RedisStreamConsumer consumer = null;

        try {
            // Set up health endpoint
            setupHealthEndpoint(healthPort);

            // Initialise database connection pool
            db = new Db(dbUrl, dbUser, dbPassword);
            logger.info("Database connection pool initialised");

            // Initialise alert service
            AlertService alertService = new AlertService(db);
            logger.info("Alert service initialised");

            // Initialise and start Redis stream consumer
            consumer = new RedisStreamConsumer(redisHost, redisPort, alertService);
            logger.info("Redis stream consumer initialised");

            // Register shutdown hook
            final Db finalDb = db;
            final RedisStreamConsumer finalConsumer = consumer;
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                logger.info("Shutdown signal received");
                running.set(false);
                if (finalConsumer != null) {
                    finalConsumer.stop();
                }
                if (finalDb != null) {
                    finalDb.close();
                }
                Spark.stop();
                shutdownLatch.countDown();
            }));

            // Start consuming events
            logger.info("Rule Engine started successfully. Consuming from Redis stream...");
            consumer.start();

            // Wait for shutdown
            shutdownLatch.await();
            logger.info("Rule Engine shut down gracefully");

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.warn("Rule Engine interrupted");
        } catch (Exception e) {
            logger.error("Fatal error in Rule Engine", e);
            System.exit(1);
        } finally {
            if (consumer != null) consumer.stop();
            if (db != null) db.close();
        }
    }

    private static void setupHealthEndpoint(int port) {
        Spark.port(port);
        Spark.get("/health", (req, res) -> {
            res.type("application/json");
            if (running.get()) {
                return "{\"status\": \"healthy\", \"service\": \"rule-engine\"}";
            } else {
                res.status(503);
                return "{\"status\": \"shutting_down\", \"service\": \"rule-engine\"}";
            }
        });
        Spark.awaitInitialization();
        logger.info("Health endpoint listening on port {}", port);
    }

    private static String getEnv(String key, String defaultValue) {
        String value = System.getenv(key);
        return value != null ? value : defaultValue;
    }

    public static boolean isRunning() {
        return running.get();
    }
}
