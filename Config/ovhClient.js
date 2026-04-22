const ovh = require('ovh');

const ovhClient = ovh({
  endpoint: 'ovh-eu', // use the endpoint that matches your OVH region/account
  appKey: process.env.OVH_APP_KEY,
  appSecret: process.env.OVH_APP_SECRET,
  consumerKey: process.env.OVH_CONSUMER_KEY,
});

module.exports = ovhClient;