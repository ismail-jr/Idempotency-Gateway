const express = require("express");
const paymentRouter = require("./routes/payment.routes");
const app = express();
app.use(express.json());

app.use("/api/v1", paymentRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FinSafe Idempotency Gateway live on port ${PORT}`);
});
