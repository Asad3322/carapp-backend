const smpp = require("smpp");

const normalizePhone = (phone = "") => {
  const value = String(phone).replace(/[^\d+]/g, "");

  if (value.startsWith("+")) return value.slice(1);
  if (value.startsWith("00")) return value.slice(2);

  return value;
};

const sendSMS = ({ to, message }) => {
  return new Promise((resolve, reject) => {
    const hasSmppConfig =
      process.env.SMPP_HOST &&
      process.env.SMPP_PORT &&
      process.env.SMPP_SYSTEM_ID &&
      process.env.SMPP_PASSWORD &&
      process.env.SMPP_SOURCE_ADDR;

    if (!hasSmppConfig) {
      console.log("📱 MOCK SMPP SMS MODE");
      return resolve({
        success: true,
        mode: "mock",
        to: normalizePhone(to),
        message,
      });
    }

    let isDone = false;

    const finish = (callback, data) => {
      if (isDone) return;
      isDone = true;

      try {
        if (session) session.close();
      } catch (e) {}

      callback(data);
    };

    console.log("📡 Connecting to SMPP...");
    console.log("Host:", process.env.SMPP_HOST);
    console.log("Port:", process.env.SMPP_PORT);
    console.log("To:", normalizePhone(to));

    const session = smpp.connect({
      host: process.env.SMPP_HOST,
      port: Number(process.env.SMPP_PORT),
    });

    const timeout = setTimeout(() => {
      finish(reject, new Error("SMPP request timeout after 20 seconds"));
    }, 20000);

    session.on("connect", () => {
      console.log("✅ SMPP Connected");

      session.bind_transceiver(
        {
          system_id: process.env.SMPP_SYSTEM_ID,
          password: process.env.SMPP_PASSWORD,
        },
        (bindPdu) => {
          console.log("Bind response:", bindPdu.command_status);

          if (bindPdu.command_status !== 0) {
            clearTimeout(timeout);
            return finish(
              reject,
              new Error(`SMPP bind failed: ${bindPdu.command_status}`)
            );
          }

          console.log("✅ SMPP Bound");

          session.submit_sm(
            {
              source_addr: process.env.SMPP_SOURCE_ADDR,
              destination_addr: normalizePhone(to),
              short_message: message,
            },
            (submitPdu) => {
              clearTimeout(timeout);

              console.log("Submit response:", submitPdu.command_status);

              if (submitPdu.command_status !== 0) {
                return finish(
                  reject,
                  new Error(`SMS submit failed: ${submitPdu.command_status}`)
                );
              }

              return finish(resolve, {
                success: true,
                mode: "smpp",
                messageId: submitPdu.message_id,
              });
            }
          );
        }
      );
    });

    session.on("error", (error) => {
      clearTimeout(timeout);
      console.error("❌ SMPP error:", error.message);
      finish(reject, error);
    });

    session.on("close", () => {
      console.log("🔌 SMPP connection closed");
    });
  });
};

module.exports = sendSMS;