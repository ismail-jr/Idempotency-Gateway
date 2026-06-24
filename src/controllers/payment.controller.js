class PaymentController {
  async processPayment(req, res) {
    const { amount, currency } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ error: "Missing amount or currency." });
    }

    console.log(
      `[Processor] Processing transaction for ${amount} ${currency}...`,
    );

    // Simulate the required 2-second processing lag
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Return the exact success string message required by User Story 1
    return res.status(200).json({
      status: "SUCCESS",
      message: `Charged ${amount} ${currency}`,
      processedAt: new Date().toISOString(),
    });
  }
}

module.exports = new PaymentController();
