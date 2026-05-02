const ovh = require("ovh");

const client = ovh({
  endpoint: "ovh-eu",
  appKey: process.env.OVH_APP_KEY,
  appSecret: process.env.OVH_APP_SECRET,
  consumerKey: process.env.OVH_CONSUMER_KEY,
});

const sendSMS = async ({ to, message }) => {
  if (!to) throw new Error("Phone required");
  if (!message) throw new Error("Message required");

  const serviceName = process.env.OVH_SMS_SERVICE_NAME;

  return new Promise((resolve, reject) => {
    client.request(
      "POST",
      `/sms/${serviceName}/jobs`,
      {
        message,
        receivers: [to],
        sender: process.env.OVH_SMS_SENDER,
        senderForResponse: true,
      },
      (error, result) => {
        if (error) {
          console.error("❌ OVH Error:", error);
          return reject(error);
        }

        console.log("✅ SMS Sent:", result);
        resolve(result);
      }
    );
  });
};

module.exports = sendSMS;