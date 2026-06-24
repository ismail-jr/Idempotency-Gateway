const express = require("express");
const idempotencyMiddleware = require("../middleware/idempotency.middleware");
const paymentController = require("../controllers/payment.controller");

const router = express.Router();

router.post(
  "/process-payment",
  idempotencyMiddleware,
  paymentController.processPayment,
);

module.exports = router;
