package com.auditflow;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.Map;

/**
 * Utility class for JSON serialization and deserialization.
 * Uses Jackson with configured settings for robust JSON handling.
 */
public final class JsonUtil {
    private static final Logger logger = LoggerFactory.getLogger(JsonUtil.class);
    
    private static final ObjectMapper objectMapper;
    
    static {
        objectMapper = new ObjectMapper();
        
        // Configure for flexibility
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        objectMapper.configure(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY, true);
        objectMapper.configure(DeserializationFeature.ACCEPT_EMPTY_STRING_AS_NULL_OBJECT, true);
        objectMapper.configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);
        
        // Register Java 8 date/time module
        objectMapper.registerModule(new JavaTimeModule());
    }
    
    private JsonUtil() {
        // Utility class - prevent instantiation
    }

    /**
     * Parse a JSON string into a Map.
     * 
     * @param json  The JSON string to parse
     * @return      Map containing the parsed data, or empty map on error
     */
    public static Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyMap();
        }
        
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            logger.error("Failed to parse JSON: {}", e.getMessage());
            logger.debug("Invalid JSON: {}", truncate(json, 200));
            return Collections.emptyMap();
        }
    }

    /**
     * Convert an object to JSON string.
     * 
     * @param obj   The object to serialize
     * @return      JSON string, or null on error
     */
    public static String toJson(Object obj) {
        if (obj == null) {
            return null;
        }
        
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            logger.error("Failed to serialize to JSON: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Convert an object to pretty-printed JSON string.
     * 
     * @param obj   The object to serialize
     * @return      Pretty-printed JSON string, or null on error
     */
    public static String toPrettyJson(Object obj) {
        if (obj == null) {
            return null;
        }
        
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            logger.error("Failed to serialize to pretty JSON: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Deserialize JSON to a specific type.
     * 
     * @param json   The JSON string
     * @param clazz  The target class
     * @param <T>    The target type
     * @return       Deserialized object, or null on error
     */
    public static <T> T fromJson(String json, Class<T> clazz) {
        if (json == null || json.isBlank()) {
            return null;
        }
        
        try {
            return objectMapper.readValue(json, clazz);
        } catch (JsonProcessingException e) {
            logger.error("Failed to deserialize JSON to {}: {}", clazz.getSimpleName(), e.getMessage());
            return null;
        }
    }

    /**
     * Get the shared ObjectMapper instance for advanced operations.
     * 
     * @return The configured ObjectMapper
     */
    public static ObjectMapper getObjectMapper() {
        return objectMapper;
    }

    /**
     * Safely extract a string value from a map.
     * 
     * @param map   The map to extract from
     * @param key   The key to look up
     * @return      String value or null
     */
    public static String getString(Map<String, Object> map, String key) {
        if (map == null || key == null) {
            return null;
        }
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }

    /**
     * Safely extract an integer value from a map.
     * 
     * @param map          The map to extract from
     * @param key          The key to look up
     * @param defaultValue Default value if key not found or not a number
     * @return             Integer value
     */
    public static int getInt(Map<String, Object> map, String key, int defaultValue) {
        if (map == null || key == null) {
            return defaultValue;
        }
        Object value = map.get(key);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String string) {
            try {
                return Integer.parseInt(string);
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    /**
     * Safely extract a long value from a map.
     * 
     * @param map          The map to extract from
     * @param key          The key to look up
     * @param defaultValue Default value if key not found or not a number
     * @return             Long value
     */
    public static long getLong(Map<String, Object> map, String key, long defaultValue) {
        if (map == null || key == null) {
            return defaultValue;
        }
        Object value = map.get(key);
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String string) {
            try {
                return Long.parseLong(string);
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    /**
     * Safely extract a boolean value from a map.
     * 
     * @param map          The map to extract from
     * @param key          The key to look up
     * @param defaultValue Default value if key not found
     * @return             Boolean value
     */
    public static boolean getBoolean(Map<String, Object> map, String key, boolean defaultValue) {
        if (map == null || key == null) {
            return defaultValue;
        }
        Object value = map.get(key);
        if (value instanceof Boolean boolean1) {
            return boolean1;
        }
        if (value instanceof String string) {
            return Boolean.parseBoolean(string);
        }
        return defaultValue;
    }

    private static String truncate(String str, int maxLength) {
        if (str == null) {
            return "";
        }
        if (str.length() <= maxLength) {
            return str;
        }
        return str.substring(0, maxLength - 3) + "...";
    }
}
