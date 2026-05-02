const express = require("express");
const router = express.Router();
const sendSMS = require("../Utils/sendSMS");

// ================= POST =================
router.post("/", async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required",
      });
    }

    console.log("📩 Sending SMS:", { phone, message });

    const result = await sendSMS({
      to: phone,
      message: message || "Test SMS from CARAPP 🚀",
    });

    return res.status(200).json({
      success: true,
      message: "SMS sent successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ SMS test error FULL:", error);

    return res.status(500).json({
      success: false,
      message: "SMS test failed",
      error: error?.message || "Unknown error",
      details: error,
    });
  }
});

// ================= GET =================
router.get("/", async (req, res) => {
  try {
    const phone = req.query.phone;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone query is required",
      });
    }

    console.log("📩 Sending SMS (GET):", phone);

    const result = await sendSMS({
      to: phone,
      message: "Test SMS from CARAPP 🚀",
    });

    return res.status(200).json({
      success: true,
      message: "SMS sent successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ SMS test error FULL:", error);

    return res.status(500).json({
      success: false,
      message: "SMS test failed",
      error: error?.message || "Unknown error",
      details: error,
    });
  }
});

module.exports = router;