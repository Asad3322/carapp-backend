const express = require('express');
const router = express.Router();
const sendSmsWithOVH = require('../Utils/sendSmsWithOVH');

router.post('/test-sms', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    const result = await sendSmsWithOVH({
      to: phone,
      message: message || 'Test SMS from CARAPP',
    });

    res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      data: result,
    });
  } catch (error) {
    console.error('OVH SMS error full:', error);

    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to send SMS',
      error: error || null,
    });
  }
});

module.exports = router;