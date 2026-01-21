package com.auditflow;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service for creating and managing alerts.
 * Includes deduplication logic to prevent duplicate alerts for the same event.
 */
public class AlertService {
    private static final Logger logger = LoggerFactory.getLogger(AlertService.class);
    
    private final Db db;
    private final AtomicLong alertsCreated = new AtomicLong(0);
    private final AtomicLong alertsDeduplicated = new AtomicLong(0);
    
    // Simple in-memory cache for recent alerts to avoid duplicate DB lookups
    // Key: eventId-ruleName, Value: timestamp
    private final ConcurrentHashMap<String, Long> recentAlerts = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 60000; // 1 minute

    public AlertService(Db db) {
        this.db = db;
        
        // Start cache cleanup thread
        Thread cleanupThread = new Thread(this::cleanupCache, "alert-cache-cleanup");
        cleanupThread.setDaemon(true);
        cleanupThread.start();
    }

    /**
     * Create a new alert if one doesn't already exist for the same event and rule.
     * 
     * @param ruleName  Name of the rule that triggered this alert
     * @param level     Alert level: low, medium, high, critical
     * @param message   Human-readable alert message
     * @param eventId   Optional ID of the triggering event
     * @return          The alert ID if created, -1 if deduplicated or failed
     */
    public long createAlert(String ruleName, String level, String message, Long eventId) {
        // Check cache first for deduplication
        String cacheKey = buildCacheKey(eventId, ruleName);
        if (cacheKey != null && recentAlerts.containsKey(cacheKey)) {
            logger.debug("Alert deduplicated (cache): {} for event {}", ruleName, eventId);
            alertsDeduplicated.incrementAndGet();
            return -1;
        }

        // Check database for existing alert
        if (db.alertExists(eventId, ruleName)) {
            logger.debug("Alert deduplicated (db): {} for event {}", ruleName, eventId);
            alertsDeduplicated.incrementAndGet();
            if (cacheKey != null) {
                recentAlerts.put(cacheKey, System.currentTimeMillis());
            }
            return -1;
        }

        // Create the alert
        long alertId = db.insertAlert(ruleName, level, message, eventId);
        
        if (alertId > 0) {
            logger.info("Created alert #{}: {} [{}] - {}", alertId, ruleName, level, 
                truncateMessage(message, 100));
            alertsCreated.incrementAndGet();
            
            // Add to cache
            if (cacheKey != null) {
                recentAlerts.put(cacheKey, System.currentTimeMillis());
            }
        } else {
            logger.warn("Failed to create alert: {}", ruleName);
        }

        return alertId;
    }

    /**
     * Update the status of an existing alert.
     * 
     * @param alertId  The alert ID
     * @param status   New status: new, acknowledged, resolved
     * @return         True if update succeeded
     */
    public boolean updateStatus(long alertId, String status) {
        boolean success = db.updateAlertStatus(alertId, status);
        if (success) {
            logger.info("Updated alert #{} status to: {}", alertId, status);
        }
        return success;
    }

    /**
     * Get statistics about alert processing.
     * 
     * @return Formatted statistics string
     */
    public String getStats() {
        return String.format("Alerts created: %d, Deduplicated: %d, Cache size: %d",
            alertsCreated.get(), alertsDeduplicated.get(), recentAlerts.size());
    }

    public long getAlertsCreated() {
        return alertsCreated.get();
    }

    public long getAlertsDeduplicated() {
        return alertsDeduplicated.get();
    }

    private String buildCacheKey(Long eventId, String ruleName) {
        if (eventId == null) {
            return null;
        }
        return eventId + "-" + ruleName;
    }

    private String truncateMessage(String message, int maxLength) {
        if (message == null) {
            return "";
        }
        if (message.length() <= maxLength) {
            return message;
        }
        return message.substring(0, maxLength - 3) + "...";
    }

    private void cleanupCache() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                Thread.sleep(30000); // Run every 30 seconds
                
                long now = System.currentTimeMillis();
                int removed = 0;
                
                for (String key : recentAlerts.keySet()) {
                    Long timestamp = recentAlerts.get(key);
                    if (timestamp != null && (now - timestamp) > CACHE_TTL_MS) {
                        recentAlerts.remove(key);
                        removed++;
                    }
                }
                
                if (removed > 0) {
                    logger.debug("Cleaned up {} expired cache entries", removed);
                }
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }
}
