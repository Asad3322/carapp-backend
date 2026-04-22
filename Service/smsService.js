const ovh = require("ovh");

const ovhClient = ovh({
  endpoint: "ovh-eu",
  appKey: process.env.OVH_APP_KEY,
  appSecret: process.env.OVH_APP_SECRET,
  consumerKey: process.env.OVH_CONSUMER_KEY,
});

const sendSMS = async (phone, message) => {
  try {
    const response = await ovhClient.requestPromised(
      "POST",
      `/sms/${process.env.OVH_SERVICE_NAME}/jobs`,
      {
        message,
        sender: process.env.OVH_SENDER || "CARAPP",
        receivers: [phone.replace(/\s/g, "")],
      }
    );

    return response;
  } catch (error) {
    console.error("OVH SMS error:", error);
    throw new Error("SMS sending failed");
  }
};

module.exports = sendSMS;