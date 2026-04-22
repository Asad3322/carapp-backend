const supabase = require("../Config/supabaseClient");
const crypto = require("crypto");
// const sendSMS = require("./smsService"); // TEMP DISABLED FOR MOCK FLOW

const sendVerificationService = async ({ contact, role, vehicleId = null }) => {
  const normalizedRole = role || "reporter";
  const cleanedContact = contact?.trim();

  if (!cleanedContact) {
    throw new Error("Contact is required");
  }

  const isEmail = cleanedContact.includes("@");

  // =========================
  // REPORTER FLOW → EMAIL MAGIC LINK
  // =========================
  if (normalizedRole !== "vehicle_owner") {
    if (!isEmail) {
      throw new Error("Reporter verification requires an email address");
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      email: cleanedContact.toLowerCase(),
      options: {
        emailRedirectTo: `${process.env.CLIENT_URL}/verify`,
        data: {
          role: normalizedRole,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      contact: cleanedContact,
      role: normalizedRole,
      channel: "email",
      data,
    };
  }

  // =========================
  // VEHICLE OWNER FLOW → MOCK SMS MAGIC LINK
  // =========================
  if (isEmail) {
    throw new Error("Vehicle owner verification requires a phone number");
  }

  const phone = cleanedContact.replace(/\s/g, "");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("phone_verifications").insert([
    {
      phone,
      token,
      role: normalizedRole,
      vehicle_id: vehicleId,
      expires_at: expiresAt,
      is_used: false,
    },
  ]);

  if (insertError) {
    throw new Error(insertError.message);
  }

  // ✅ TEMP MOCK LINK INSTEAD OF REAL SMS
  const magicLink = `${process.env.CLIENT_URL}/auth/callback?phone_token=${token}`;

  console.log("🔗 MOCK PHONE VERIFICATION LINK:", magicLink);

  return {
    contact: phone,
    role: normalizedRole,
    channel: "sms",
    expiresAt,
    phone_token: token,
    magicLink,
  };
};

const getUserByContactService = async ({ email = null, phone = null }) => {
  if (!email && !phone) return null;

  let query = supabase.from("profiles").select("*");

  if (email) {
    query = query.eq("email", email);
  } else {
    query = query.eq("phone", phone);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

const verifyPhoneMagicLinkService = async (token) => {
  if (!token) {
    throw new Error("Verification token is required");
  }

  const { data: verification, error } = await supabase
    .from("phone_verifications")
    .select("*")
    .eq("token", token)
    .eq("is_used", false)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!verification) {
    throw new Error("Invalid or already used verification link");
  }

  if (new Date(verification.expires_at) < new Date()) {
    throw new Error("Verification link expired");
  }

  const { error: markUsedError } = await supabase
    .from("phone_verifications")
    .update({ is_used: true })
    .eq("id", verification.id);

  if (markUsedError) {
    throw new Error(markUsedError.message);
  }

  return verification;
};

module.exports = {
  sendVerificationService,
  getUserByContactService,
  verifyPhoneMagicLinkService,
};