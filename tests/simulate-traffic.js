const http = require("http");
const crypto = require("crypto");

// 1. Generate a single base tracking key using native UUID
const TEST_KEY = crypto.randomUUID();

/**
 * Helper function to fire an HTTP POST request dynamically
 * @param {string} label - Name of the test request
 * @param {object} payloadObj - The specific JSON body data to send
 */
function sendPayment(label, payloadObj) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payloadObj);
    const startTime = Date.now();

    console.log(
      `\n [${label}] Dispatched at ${new Date(startTime).toISOString()}`,
    );

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: "/api/v1/process-payment",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          "Idempotency-Key": TEST_KEY, // Keeps the same key to verify idempotency handling
        },
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          console.log(` [${label}] Response Received`);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Duration: ${duration}ms`);
          console.log(`   Cache Hit: ${res.headers["x-cache-hit"] || "false"}`);

          try {
            console.log(`   Body:`, JSON.parse(data));
          } catch (e) {
            console.log(`   Body:`, data);
          }

          resolve(res.statusCode);
        });
      },
    );

    req.on("error", (err) => {
      console.error(` [${label}] Error:`, err.message);
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

async function runTestSuite() {
  console.log("==================================================");
  console.log("  FINSAFE IDEMPOTENCY PROTOCOL VERIFICATION SUITE");
  console.log(` Global Test Key: ${TEST_KEY}`);
  console.log("==================================================\n");

  // Define our regular standard payload
  const standardPayload = {
    accountNo: "ACC-98765-XYZ",
    amount: 250.0,
    currency: "GHS",
  };

  // Define a tampered payload (Same key, different amount!)
  const tamperedPayload = {
    accountNo: "ACC-98765-XYZ",
    amount: 999.0, //  Modified amount to test fraud detection
    currency: "GHS",
  };

  // ───────────────────────────────────────────────────────────
  // FLOW 1 & 2: CONCURRENT SPIKE & LOBBY POLLING
  // ───────────────────────────────────────────────────────────
  console.log("--- STAGE 1: Simulating Concurrent Traffic Spike ---");

  // Fire Request A (starts processing, takes 2 seconds)
  const requestA = sendPayment("Request A - Initial", standardPayload);

  // Wait 100 milliseconds and fire Request B while A is still running
  await new Promise((r) => setTimeout(r, 100));
  const requestB = sendPayment(
    "Request B - Concurrent Duplicate",
    standardPayload,
  );

  // Wait for both concurrent cycles to resolve
  await Promise.all([requestA, requestB]);

  // ───────────────────────────────────────────────────────────
  // FLOW 3: HISTORIC RETRY CHECK
  // ───────────────────────────────────────────────────────────
  console.log(
    "\n--- STAGE 2: Simulating Historic Retry (After Settlement) ---",
  );
  await sendPayment("Request C - Subsequent Retry", standardPayload);

  // ───────────────────────────────────────────────────────────
  // FLOW 4: FRAUD DETECTION / TAMPER GUARD
  // ───────────────────────────────────────────────────────────
  console.log("\n--- STAGE 3: Simulating Payload Tampering Attack ---");
  const finalStatus = await sendPayment(
    "Request D - Modified Payload",
    tamperedPayload,
  );

  console.log("\n==================================================");
  if (finalStatus === 422) {
    console.log(" VERIFICATION COMPLETE: ALL SECURITY RULES PASSED ");
  } else {
    console.log("VERIFICATION COMPLETE: FRAUD LAYER FAILING ");
  }
  console.log("==================================================\n");
}

runTestSuite();
