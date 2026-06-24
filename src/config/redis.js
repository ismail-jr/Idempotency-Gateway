const { createClient } = require("redis");

// Fallback to local Redis if no environment variable is provided (env implementation later)
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redisClient = createClient({
  url: redisUrl,

  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error(
          "Redis reconnection failed permanently. Max retries reached.",
        );
        return new Error("Redis connection lost");
      }
      // Exponential backoff: wait longer between each retry
      return Math.min(retries * 100, 3000);
    },
  },
});

// Event listeners for monitoring health
redisClient.on("connect", () => console.log("🔌 Connecting to Redis..."));
redisClient.on("ready", () => console.log("Redis client ready and connected!"));
redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.on("end", () => console.log("Redis connection closed."));

// Immediately-Invoked Function to handle the asynchronous connection initialization
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error(
      "Critical: Could not establish initial connection to Redis:",
      err,
    );
  }
})();

module.exports = redisClient;
