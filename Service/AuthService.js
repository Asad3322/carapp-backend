const supabase = require("../Config/supabaseClient");
const crypto = require("crypto");

// ================= NORMALIZERS =================
const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizePhone = (phone = "") => phone.replace(/\s/g, "");

// ================= SEND VERIFICATION =================
const sendVerificationService = async ({ contact, role, vehicleId = null }) => {
  console.log("🔥 sendVerificationService hit");
  console.log("contact:", contact);
  console.log("role:", role);
  console.log("vehicleId:", vehicleId);

  const normalizedRole = role || "reporter";
  const cleanedContact = contact?.trim();

  if (!cleanedContact) {
    throw new Error("Contact is required");
  }

  const isEmail = cleanedContact.includes("@");

  // ====================================================
  // 🟦 REPORTER FLOW (EMAIL)
  // ====================================================
  if (normalizedRole === "reporter") {
    if (!isEmail) {
      throw new Error("Reporter verification requires an email address");
    }

    const email = normalizeEmail(cleanedContact);

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.CLIENT_URL}/verify`,
        data: {
          role: "reporter",
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      contact: email,
      role: "reporter",
      channel: "email",
      data,
    };
  }

  // ====================================================
  // 🟩 VEHICLE OWNER FLOW (PHONE)
  // ====================================================
  if (normalizedRole === "vehicle_owner") {
    if (!vehicleId) {
      throw new Error("Vehicle ID is required for owner verification");
    }

    if (isEmail) {
      throw new Error("Vehicle owner verification requires a phone number");
    }

    const phone = normalizePhone(cleanedContact);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("phone_verifications")
      .insert([
        {
          phone,
          token,
          role: "vehicle_owner",
          vehicle_id: vehicleId,
          expires_at: expiresAt,
          is_used: false,
        },
      ]);

    if (insertError) {
      throw new Error(insertError.message);
    }

    const magicLink = `${process.env.CLIENT_URL}/auth/callback?phone_token=${token}`;

    console.log("🔗 MOCK PHONE VERIFICATION LINK:", magicLink);

    return {
      contact: phone,
      role: "vehicle_owner",
      channel: "sms",
      expiresAt,
      phone_token: token,
      magicLink,
    };
  }

  // ====================================================
  // ❌ INVALID ROLE
  // ====================================================
  throw new Error("Invalid role provided");
};

// ================= GET USER =================
const getUserByContactService = async ({ email = null, phone = null }) => {
  if (!email && !phone) return null;

  let query = supabase.from("profiles").select("*");

  if (email) {
    query = query.eq("email", normalizeEmail(email));
  } else {
    query = query.eq("phone", normalizePhone(phone));
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// ================= VERIFY PHONE LINK =================
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

  // mark as used
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