let ovhClient = null;

try {
  ovhClient = require("../Config/ovhClient");
} catch (error) {
  console.warn("⚠️ OVH client not loaded. Falling back to mock SMS mode.");
}

const normalizePhone = (phone = "") => {
  let value = String(phone).replace(/[^\d+]/g, "");

  if (value.startsWith("+")) {
    value = "00" + value.slice(1);
  }

  return value;
};

const sendSmsWithOVH = async ({ to, message }) => {
  const serviceName = process.env.OVH_SMS_SERVICE_NAME;
  const appKey = process.env.OVH_APP_KEY;
  const appSecret = process.env.OVH_APP_SECRET;
  const consumerKey = process.env.OVH_CONSUMER_KEY;

  const hasOVHConfig =
    !!ovhClient && !!serviceName && !!appKey && !!appSecret && !!consumerKey;

  if (!hasOVHConfig) {
    console.log("📱 MOCK SMS MODE ENABLED");
    console.log("To:", normalizePhone(to));
    console.log("Message:", message);

    return {
      success: true,
      mode: "mock",
      to: normalizePhone(to),
      message,
    };
  }

  return new Promise((resolve, reject) => {
    ovhClient.request(
      "POST",
      `/sms/${serviceName}/jobs`,
      {
        message,
        senderForResponse: false,
        receivers: [normalizePhone(to)],
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }

        resolve({
          success: true,
          mode: "ovh",
          data: result,
        });
      }
    );
  });
};

module.exports = sendSmsWithOVH;