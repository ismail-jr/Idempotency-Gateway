const crypto = require("crypto");

/**
 * Generates a SHA-256 hash of an object or string to fingerprint the request body.
 * @param {object|string} data
 * @returns {string} hex hash
 */
function generateHash(data) {
  if (!data) return "";

  const stringData = typeof data === "object" ? JSON.stringify(data) : data;
  return crypto.createHash("sha256").update(stringData).digest("hex");
}

module.exports = { generateHash };
