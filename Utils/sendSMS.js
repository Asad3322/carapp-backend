const ovh = require("ovh");

const client = ovh({
  endpoint: "ovh-eu",
  appKey: process.env.OVH_APP_KEY,
  appSecret: process.env.OVH_APP_SECRET,
  consumerKey: process.env.OVH_CONSUMER_KEY,
});

const sendSMS = async ({ to, message }) => {
  if (!to) {
    throw new Error("Phone number is required");
  }

  if (!message) {
    throw new Error("SMS message is required");
  }

  if (
    !process.env.OVH_APP_KEY ||
    !process.env.OVH_APP_SECRET ||
    !process.env.OVH_CONSUMER_KEY ||
    !process.env.OVH_SMS_SERVICE_NAME
  ) {
    throw new Error("OVH SMS configuration is missing");
  }

  const response = await client.requestPromised(
    "POST",
    `/sms/${process.env.OVH_SMS_SERVICE_NAME}/jobs`,
    {
      receivers: [to],
      message,
      sender: process.env.OVH_SMS_SENDER || undefined,
      noStopClause: true,
    }
  );

  return {
    success: true,
    mode: "ovh-http-api",
    to,
    response,
  };
};

module.exports = sendSMS;