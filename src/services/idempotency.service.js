const redisClient = require("../config/redis");

class IdempotencyService {
  /**
   * Tries to acquire an exclusive lock for a request key.
   * Uses Redis SET with NX (Not Exists) and EX (Expiration).
   * @param {string} key
   * @param {number} ttlInSeconds - Time-to-live for the lock (e.g., 30 seconds)
   * @returns {Promise<boolean>} True if lock acquired, false if request is already in progress
   */
  async acquireLock(key, ttlInSeconds = 30) {
    const lockKey = `lock:${key}`;
    // Status value indicates the request is currently executing
    const result = await redisClient.set(lockKey, "IN_PROGRESS", {
      NX: true,
      EX: ttlInSeconds,
    });

    //  returns 'OK' if the set was successful, null if key already existed
    return result === "OK";
  }

  /**
   * Retrieves a cached response payload for a given key.
   * @param {string} key
   * @returns {Promise<object|null>} The parsed response payload or null
   */
  async getCachedResponse(key) {
    const cacheKey = `response:${key}`;
    const cachedData = await redisClient.get(cacheKey);

    if (!cachedData) return null;
    return JSON.parse(cachedData);
  }

  /**
   * Caches the final response payload and removes the temporary in-progress lock.
   * @param {string} key
   * @param {object} responseBody - The payload to cache
   * @param {number} ttlInSeconds - How long to remember this response (e.g., 24 hours = 86400)
   */
  async saveResponseAndReleaseLock(key, responseBody, ttlInSeconds = 86400) {
    const lockKey = `lock:${key}`;
    const cacheKey = `response:${key}`;

    // Store the final response payload in Redis
    await redisClient.set(cacheKey, JSON.stringify(responseBody), {
      EX: ttlInSeconds,
    });

    // Clean up the temporary execution lock
    await redisClient.del(lockKey);
  }

  /**
   * Explicitly releases a lock if a downstream payment processing completely fails/crashes,
   * allowing the client to safely retry immediately.
   * @param {string} key
   */
  async releaseLock(key) {
    const lockKey = `lock:${key}`;
    await redisClient.del(lockKey);
  }
}

module.exports = new IdempotencyService();
