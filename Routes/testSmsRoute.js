const express = require("express");
const router = express.Router();
const sendSMS = require("../Utils/sendSMS");

// POST /api/test-sms
router.post("/", async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required",
      });
    }

    const result = await sendSMS({
      to: phone,
      message: message || "Test SMS from CARAPP",
    });

    return res.status(200).json({
      success: true,
      message: "SMS sent successfully",
      data: result,
    });
  } catch (error) {
    console.error("SMS test error:", error);

    return res.status(500).json({
      success: false,
      message: "SMS test failed",
      error: error.message,
    });
  }
});

// Optional GET test also
router.get("/", async (req, res) => {
  try {
    const phone = req.query.phone;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone query is required",
      });
    }

    const result = await sendSMS({
      to: phone,
      message: "Test SMS from CARAPP",
    });

    return res.status(200).json({
      success: true,
      message: "SMS sent successfully",
      data: result,
    });
  } catch (error) {
    console.error("SMS test error:", error);

    return res.status(500).json({
      success: false,
      message: "SMS test failed",
      error: error.message,
    });
  }
});

module.exports = router;