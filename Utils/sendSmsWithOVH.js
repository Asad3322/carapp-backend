const ovhClient = require('../Config/ovhClient');

const normalizePhone = (phone = '') => {
  let value = String(phone).replace(/[^\d+]/g, '');

  if (value.startsWith('+')) {
    value = '00' + value.slice(1);
  }

  return value;
};

const sendSmsWithOVH = async ({ to, message }) => {
  return new Promise((resolve, reject) => {
    const serviceName = process.env.OVH_SMS_SERVICE_NAME;

    if (!serviceName) {
      return reject(new Error('OVH_SMS_SERVICE_NAME is missing'));
    }

    ovhClient.request(
      'POST',
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

        resolve(result);
      }
    );
  });
};

module.exports = sendSmsWithOVH;