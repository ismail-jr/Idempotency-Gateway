const idempotencyService = require("../services/idempotency.service");
const { generateHash } = require("../utils/hash");
const redisClient = require("../config/redis");

async function idempotencyMiddleware(req, res, next) {
  if (req.method !== "POST" && req.method !== "PUT") {
    return next();
  }

  const idempotencyKey = req.headers["idempotency-key"];

  if (!idempotencyKey) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Idempotency-Key header is missing.",
    });
  }

  const currentBodyHash = generateHash(req.body);

  try {
    // 1. Check if the key has been used before
    const lookupKey = `meta:${idempotencyKey}`;
    const existingHash = await redisClient.get(lookupKey);

    if (existingHash && existingHash !== currentBodyHash) {
      // Same key, different body
      return res.status(422).json({
        error: "Unprocessable Entity",
        message: "Idempotency key already used for a different request body.",
      });
    }

    // Save the link between key and body hash if not already tracked
    if (!existingHash) {
      await redisClient.set(lookupKey, currentBodyHash, { EX: 86400 });
    }

    const uniqueTrackingKey = `${idempotencyKey}:${currentBodyHash}`;

    // 2. Poll/Wait Loop Strategy
    const maxRetries = 15;
    let retries = 0;

    while (retries < maxRetries) {
      // Check for cached final response
      const cachedResponse =
        await idempotencyService.getCachedResponse(uniqueTrackingKey);
      if (cachedResponse) {
        res.setHeader("X-Cache-Hit", "true");
        return res.status(cachedResponse.status).json(cachedResponse.body);
      }

      // Try to acquire lock
      const lockAcquired =
        await idempotencyService.acquireLock(uniqueTrackingKey);
      if (lockAcquired) {
        // We got the lock! Break out and process the request normally
        break;
      }

      // If lock failed, Request A is currently processing. Wait 200ms and check again
      retries++;
      await new Promise((resolve) => setTimeout(resolve, 2000 / 10));
    }

    // If we exhausted retries and Request A still hasn't finished, safe fail-closed timeout
    if (retries === maxRetries) {
      return res.status(504).json({
        error: "Gateway Timeout",
        message:
          "The original transaction is taking longer than expected. Please retry later.",
      });
    }

    // 3. Capture the final response payload
    const originalJson = res.json;
    res.json = function (body) {
      res.json = originalJson;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        idempotencyService
          .saveResponseAndReleaseLock(uniqueTrackingKey, {
            status: res.statusCode,
            body: body,
          })
          .catch((err) => console.error("Cache save error:", err));
      } else {
        idempotencyService
          .releaseLock(uniqueTrackingKey)
          .catch((err) => console.error("Lock release error:", err));
      }

      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    console.error("Idempotency layer error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = idempotencyMiddleware;
