const express = require("express");
const idempotencyMiddleware = require("./middleware/idempotency.middleware");
const paymentController = require("./controllers/payment.controller");

const app = express();
app.use(express.json());

app.post(
  "/process-payment",
  idempotencyMiddleware,
  paymentController.processPayment,
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FinSafe Idempotency Gateway live on port ${PORT}`);
});
