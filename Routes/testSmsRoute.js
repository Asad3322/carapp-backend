const express = require("express");
const router = express.Router();
const sendSMS = require("../Utils/sendSMS");

router.get("/test-sms", async (req, res) => {
  try {
    const phone = req.query.phone;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required",
      });
    }

    const result = await sendSMS({
      to: phone,
      message: "CARAPP SMS Test Successful",
    });

    return res.status(200).json({
      success: true,
      message: "SMS test executed",
      result,
    });
  } catch (error) {
    console.error("❌ SMS test error:", error);

    return res.status(500).json({
      success: false,
      message: "SMS test failed",
      error: error.message || error,
    });
  }
});

module.exports = router;