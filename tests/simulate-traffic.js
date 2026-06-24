// tests/simulate-traffic.js
const http = require("http");

const crypto = require("crypto");

const TEST_KEY = crypto.randomUUID();

const paymentPayload = JSON.stringify({
  accountNo: "ACC-98765-XYZ",
  amount: 250.0,
  currency: "GHS",
});

const commonHeaders = {
  "Content-Type": "application/json",
  "Content-Length": Buffer.byteLength(paymentPayload),
  "Idempotency-Key": TEST_KEY,
};

/**
 * Helper function to fire an HTTP POST request
 * @param {string} label - Name of the test request
 */
function sendPayment(label) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    console.log(
      `[${label}] Dispatched at ${new Date(startTime).toISOString()}`,
    );

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: "/api/v1/process-payment",
        method: "POST",
        headers: commonHeaders,
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          console.log(`\n[${label}] Response Received`);
          console.log(`Status: ${res.statusCode}`);
          console.log(`Duration: ${duration}ms`);
          console.log(`Cache Hit: ${res.headers["x-cache-hit"] || "false"}`);
          console.log(`Finished At: ${new Date(endTime).toISOString()}`);
          console.log(JSON.parse(data));

          resolve();
        });
      },
    );

    req.on("error", (err) => {
      console.error(`[${label}] Error:`, err.message);
      resolve();
    });

    req.write(paymentPayload);
    req.end();
  });
}
// Orchestrate the simultaneous and subsequent traffic flow
async function runTestSuite() {
  console.log(" Starting Idempotency Validation Suite...\n");

  // 1. Fire the initial long-running request
  const requestA = sendPayment("Request A - Initial");

  // 2. Wait 100 milliseconds and fire an identical request while A is still running
  await new Promise((r) => setTimeout(r, 100));
  const requestB = sendPayment("Request B - Concurrent Duplicate");

  // Wait for both in-flight requests to complete their cycles
  await Promise.all([requestA, requestB]);

  console.log(
    "\n Waiting 3 seconds for Request A to fully settle and cache...",
  );
  await new Promise((r) => setTimeout(r, 3000));

  // 3. Fire a final request with the exact same key to see if it gets the cached response
  await sendPayment("Request C - Subsequent Retry");

  console.log("\n Test suite finished evaluation.");
}

runTestSuite();
