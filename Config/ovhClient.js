const ovh = require("ovh");

const hasOVHConfig =
  !!process.env.OVH_APP_KEY &&
  !!process.env.OVH_APP_SECRET &&
  !!process.env.OVH_CONSUMER_KEY;

let ovhClient = null;

if (hasOVHConfig) {
  ovhClient = ovh({
    endpoint: "ovh-eu",
    appKey: process.env.OVH_APP_KEY,
    appSecret: process.env.OVH_APP_SECRET,
    consumerKey: process.env.OVH_CONSUMER_KEY,
  });

  console.log("✅ OVH client loaded");
} else {
  console.warn("⚠️ OVH credentials missing. OVH client disabled.");
}

module.exports = ovhClient;