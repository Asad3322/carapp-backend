const { Vonage } = require("@vonage/server-sdk");

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

const normalizePhoneNumber = (phone = "") => {
  let cleaned = String(phone).replace(/\s+/g, "").trim();

  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  }

  return cleaned;
};

const sendSMS = async ({ to, message }) => {
  try {
    if (!to) throw new Error("Phone required");
    if (!message) throw new Error("Message required");

    const formattedPhone = normalizePhoneNumber(to);

    console.log("📲 Sending Vonage SMS to:", formattedPhone);

    const response = await vonage.sms.send({
      to: formattedPhone,
      from: "Vonage",
      text: message,
    });

    console.log("✅ Vonage SMS Sent:", response);

    return response;
  } catch (error) {
    console.error("❌ Vonage SMS Error:", error);
    throw new Error(error?.message || "Failed to send SMS using Vonage");
  }
};

module.exports = sendSMS;