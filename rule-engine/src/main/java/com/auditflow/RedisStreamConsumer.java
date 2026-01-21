package com.auditflow;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisPoolConfig;
import redis.clients.jedis.StreamEntryID;
import redis.clients.jedis.resps.StreamEntry;
import redis.clients.jedis.params.XReadParams;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Consumes audit events from Redis Streams and processes them through the rule engine.
 */
public class RedisStreamConsumer {
    private static final Logger logger = LoggerFactory.getLogger(RedisStreamConsumer.class);
    
    private static final String STREAM_KEY = "audit:events";
    private static final String CONSUMER_GROUP = "rule-engine-group";
    private static final String CONSUMER_NAME = "rule-engine-" + System.currentTimeMillis();
    private static final int BLOCK_TIMEOUT_MS = 5000;
    private static final int BATCH_SIZE = 100;

    private final JedisPool jedisPool;
    private final AlertService alertService;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread consumerThread;

    public RedisStreamConsumer(String host, int port, AlertService alertService) {
        JedisPoolConfig poolConfig = new JedisPoolConfig();
        poolConfig.setMaxTotal(10);
        poolConfig.setMaxIdle(5);
        poolConfig.setMinIdle(1);
        poolConfig.setTestOnBorrow(true);
        poolConfig.setTestOnReturn(true);
        poolConfig.setBlockWhenExhausted(true);
        poolConfig.setMaxWait(Duration.ofSeconds(30));

        this.jedisPool = new JedisPool(poolConfig, host, port);
        this.alertService = alertService;

        // Create consumer group if it doesn't exist
        createConsumerGroup();
    }

    private void createConsumerGroup() {
        try (Jedis jedis = jedisPool.getResource()) {
            try {
                jedis.xgroupCreate(STREAM_KEY, CONSUMER_GROUP, StreamEntryID.LAST_ENTRY, true);
                logger.info("Created consumer group: {}", CONSUMER_GROUP);
            } catch (Exception e) {
                // Group already exists - this is fine
                if (!e.getMessage().contains("BUSYGROUP")) {
                    logger.warn("Error creating consumer group: {}", e.getMessage());
                }
            }
        }
    }

    public void start() {
        if (running.compareAndSet(false, true)) {
            consumerThread = new Thread(this::consumeLoop, "redis-consumer");
            consumerThread.start();
            logger.info("Consumer started");
        }
    }

    public void stop() {
        if (running.compareAndSet(true, false)) {
            if (consumerThread != null) {
                consumerThread.interrupt();
                try {
                    consumerThread.join(10000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            jedisPool.close();
            logger.info("Consumer stopped");
        }
    }

    private void consumeLoop() {
        logger.info("Starting consumer loop for stream: {}", STREAM_KEY);

        while (running.get() && !Thread.currentThread().isInterrupted()) {
            try (Jedis jedis = jedisPool.getResource()) {
                // Read from consumer group
                Map<String, StreamEntryID> streams = new HashMap<>();
                streams.put(STREAM_KEY, StreamEntryID.UNRECEIVED_ENTRY);

                XReadParams params = new XReadParams()
                        .count(BATCH_SIZE)
                        .block(BLOCK_TIMEOUT_MS);

                @SuppressWarnings("unchecked")
                List<Map.Entry<String, List<StreamEntry>>> results = 
                    jedis.xreadGroup(CONSUMER_GROUP, CONSUMER_NAME, params, streams);

                if (results != null && !results.isEmpty()) {
                    for (Map.Entry<String, List<StreamEntry>> streamResult : results) {
                        for (StreamEntry entry : streamResult.getValue()) {
                            processEntry(jedis, entry);
                        }
                    }
                }

            } catch (Exception e) {
                if (running.get()) {
                    logger.error("Error in consumer loop", e);
                    // Back off on error
                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }

        logger.info("Consumer loop ended");
    }

    private void processEntry(Jedis jedis, StreamEntry entry) {
        try {
            Map<String, String> fields = entry.getFields();
            logger.debug("Processing event: {}", entry.getID());

            // Parse event data
            String eventJson = fields.get("data");
            if (eventJson == null) {
                logger.warn("Event {} has no data field", entry.getID());
                acknowledgeEntry(jedis, entry);
                return;
            }

            Map<String, Object> event = JsonUtil.parseJson(eventJson);
            
            // Apply rules and generate alerts
            applyRules(event);

            // Acknowledge successful processing
            acknowledgeEntry(jedis, entry);
            logger.debug("Successfully processed event: {}", entry.getID());

        } catch (Exception e) {
            logger.error("Failed to process event: {}", entry.getID(), e);
            // Don't acknowledge - will be reprocessed
        }
    }

    private void acknowledgeEntry(Jedis jedis, StreamEntry entry) {
        jedis.xack(STREAM_KEY, CONSUMER_GROUP, entry.getID());
    }

    /**
     * Apply business rules to the event and generate alerts as needed.
     */
    private void applyRules(Map<String, Object> event) {
        String eventType = getString(event, "event_type");
        String severity = getString(event, "severity");
        String source = getString(event, "source");
        String message = getString(event, "message");
        Number eventId = (Number) event.get("id");

        // Rule 1: Critical errors always generate high-priority alerts
        if ("critical".equalsIgnoreCase(severity)) {
            alertService.createAlert(
                "Critical Event Detected",
                "critical",
                String.format("Critical %s event from %s: %s", eventType, source, message),
                eventId != null ? eventId.longValue() : null
            );
        }

        // Rule 2: Payment failures generate high-priority alerts
        if ("payment".equalsIgnoreCase(eventType) && 
            ("error".equalsIgnoreCase(severity) || "critical".equalsIgnoreCase(severity))) {
            alertService.createAlert(
                "Payment Failure",
                "high",
                String.format("Payment failure from %s: %s", source, message),
                eventId != null ? eventId.longValue() : null
            );
        }

        // Rule 3: Multiple failed logins (detected by message content)
        if ("login".equalsIgnoreCase(eventType) && 
            message != null && message.toLowerCase().contains("failed")) {
            alertService.createAlert(
                "Failed Login Attempt",
                "medium",
                String.format("Failed login from %s: %s", source, message),
                eventId != null ? eventId.longValue() : null
            );
        }

        // Rule 4: Error events generate medium-priority alerts
        if ("error".equalsIgnoreCase(severity) && !"payment".equalsIgnoreCase(eventType)) {
            alertService.createAlert(
                "Error Event",
                "medium",
                String.format("Error in %s from %s: %s", eventType, source, message),
                eventId != null ? eventId.longValue() : null
            );
        }

        // Rule 5: Security-related events
        if (eventType != null && 
            (eventType.toLowerCase().contains("security") || 
             eventType.toLowerCase().contains("auth"))) {
            String level = "warning".equalsIgnoreCase(severity) || 
                          "error".equalsIgnoreCase(severity) ||
                          "critical".equalsIgnoreCase(severity) ? "high" : "low";
            alertService.createAlert(
                "Security Event",
                level,
                String.format("Security event %s from %s: %s", eventType, source, message),
                eventId != null ? eventId.longValue() : null
            );
        }

        // Rule 6: Data access events with warning or higher severity
        if ("data_access".equalsIgnoreCase(eventType) && 
            ("warning".equalsIgnoreCase(severity) || 
             "error".equalsIgnoreCase(severity) || 
             "critical".equalsIgnoreCase(severity))) {
            alertService.createAlert(
                "Suspicious Data Access",
                "high",
                String.format("Data access alert from %s: %s", source, message),
                eventId != null ? eventId.longValue() : null
            );
        }
    }

    private String getString(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }
}
