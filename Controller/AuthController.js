const {
  sendVerificationService,
  getUserByContactService,
  verifyPhoneMagicLinkService,
} = require("../Service/AuthService");
const sendResponse = require("../Utils/sendResponse");
const supabase = require("../Config/supabaseClient");

const normalizePlate = (value = "") =>
  String(value).replace(/\s+/g, "").trim().toUpperCase();

// ================= SEND VERIFICATION =================
const sendVerification = async (req, res) => {
  try {
    console.log("🔥 sendVerification controller hit");
    console.log("📦 req.body:", req.body);

    const { contact, role, vehicleId } = req.body;

    if (!contact || !contact.trim()) {
      return sendResponse(res, 400, false, "Contact is required");
    }

    const result = await sendVerificationService({
      contact,
      role: role || "reporter",
      vehicleId: vehicleId || null,
    });

    let verificationLink = null;

    if (result?.phone_token) {
      verificationLink = `${process.env.CLIENT_URL}/auth/callback?phone_token=${result.phone_token}`;
      console.log("🔗 MOCK PHONE VERIFICATION LINK:", verificationLink);
    }

    return sendResponse(
      res,
      200,
      true,
      verificationLink
        ? "Verification generated successfully"
        : "Verification sent successfully",
      {
        ...result,
        verificationLink,
      }
    );
  } catch (error) {
    console.error("❌ sendVerification error:", error.message);

    return sendResponse(
      res,
      500,
      false,
      error.message || "Internal server error"
    );
  }
};

// ================= VERIFY PHONE LINK =================
const verifyPhoneMagicLink = async (req, res) => {
  try {
    const { phone_token } = req.query;

    const verification = await verifyPhoneMagicLinkService(phone_token);

    return sendResponse(res, 200, true, "Phone verified successfully", {
      phone: verification.phone,
      role: verification.role,
      vehicleId: verification.vehicle_id,
    });
  } catch (error) {
    console.error("verifyPhoneMagicLink error:", error);
    return sendResponse(
      res,
      400,
      false,
      error.message || "Invalid verification link"
    );
  }
};

const linkOldReportsToOwner = async ({ profileId, vehicleId, licencePlate }) => {
  try {
    if (!profileId || !vehicleId || !licencePlate) return;

    const { error } = await supabase
      .from("reports")
      .update({
        receiver_id: profileId,
        vehicle_id: vehicleId,
        plate_registered: true,
        flow_type: "registered_plate",
        status: "reported",
        updated_at: new Date().toISOString(),
      })
      .eq("licence_plate", normalizePlate(licencePlate))
      .is("receiver_id", null);

    if (error) {
      console.error("Auto-link reports after profile create error:", error);
    }
  } catch (error) {
    console.error("linkOldReportsToOwner error:", error);
  }
};

const claimVehicleForOwner = async ({ authUserId, profileId, vehicleId }) => {
  if (!authUserId || !profileId || !vehicleId) return null;

  const { data: claimedVehicle, error: claimError } = await supabase
    .from("vehicles")
    .update({
      owner_id: authUserId,
      is_claimed: true,
      registration_source: "claimed_after_onboarding",
      updated_at: new Date().toISOString(),
    })
    .eq("id", vehicleId)
    .select("*")
    .maybeSingle();

  console.log("🚗 CLAIM VEHICLE RESULT:", {
    vehicleId,
    authUserId,
    claimedVehicle,
    claimError,
  });

  if (claimError) {
    throw new Error(claimError.message || "Failed to claim vehicle");
  }

  if (claimedVehicle) {
    await linkOldReportsToOwner({
      profileId,
      vehicleId: claimedVehicle.id,
      licencePlate: claimedVehicle.licence_plate,
    });
  }

  return claimedVehicle;
};

// ================= CREATE PROFILE AFTER AUTH =================
const createProfileAfterAuth = async (req, res) => {
  try {
    const authUser = req.user;

    const {
      role,
      verifiedPhone,
      vehicleId,
      username: bodyUsername,
      name: bodyName,
      profileImage,
      avatar_url,
    } = req.body;

    if (!authUser) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    const finalRole = role === "vehicle_owner" ? "vehicle_owner" : "reporter";
    const email = authUser.email || req.body.email || null;
    const phone = verifiedPhone || req.body.phone || authUser.phone || null;

    const existingProfile = await getUserByContactService({ email, phone });

    // ================= EXISTING PROFILE =================
    if (existingProfile) {
      let updatedProfile = existingProfile;

      if (finalRole === "vehicle_owner") {
        const { data: profileUpdate, error: profileUpdateError } = await supabase
          .from("profiles")
          .update({
            role: "vehicle_owner",
            phone: phone || existingProfile.phone,
            primary_contact: "SMS",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProfile.id)
          .select("*")
          .maybeSingle();

        if (profileUpdateError) {
          return sendResponse(res, 500, false, profileUpdateError.message);
        }

        updatedProfile = profileUpdate || existingProfile;

        if (vehicleId) {
          await claimVehicleForOwner({
            authUserId: authUser.id,
            profileId: existingProfile.id,
            vehicleId,
          });
        }
      }

      return sendResponse(
        res,
        200,
        true,
        "Profile already exists",
        updatedProfile
      );
    }

    // ================= CREATE NEW PROFILE =================
    const requestedUsername =
      bodyUsername ||
      bodyName ||
      authUser.user_metadata?.name ||
      `user_${Math.random().toString(36).slice(2, 8)}`;

    const requestedName = bodyName || requestedUsername;

    const { data, error } = await supabase
      .from("profiles")
      .insert([
        {
          auth_user_id: authUser.id,
          name: requestedName,
          email,
          phone,
          role: finalRole,
          username: requestedUsername,
          avatar_url: avatar_url || profileImage || null,
          language: "French",
          primary_contact: finalRole === "vehicle_owner" ? "SMS" : "Email",
        },
      ])
      .select("*")
      .single();

    if (error) {
      return sendResponse(res, 500, false, error.message);
    }

    if (finalRole === "vehicle_owner" && vehicleId) {
      await claimVehicleForOwner({
        authUserId: authUser.id,
        profileId: data.id,
        vehicleId,
      });
    }

    return sendResponse(res, 201, true, "Profile created successfully", data);
  } catch (error) {
    console.error("createProfileAfterAuth error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Something went wrong"
    );
  }
};

module.exports = {
  sendVerification,
  verifyPhoneMagicLink,
  createProfileAfterAuth,
};