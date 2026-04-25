const {
  sendVerificationService,
  getUserByContactService,
  verifyPhoneMagicLinkService,
} = require("../Service/AuthService");
const sendResponse = require("../Utils/sendResponse");
const supabase = require("../Config/supabaseClient");

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
      .eq("licence_plate", licencePlate)
      .is("receiver_id", null);

    if (error) {
      console.error("Auto-link reports after profile create error:", error);
    }
  } catch (error) {
    console.error("linkOldReportsToOwner error:", error);
  }
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

    const email = authUser.email || req.body.email || null;
    const phone = verifiedPhone || req.body.phone || authUser.phone || null;

    const existingProfile = await getUserByContactService({ email, phone });

    // ================= EXISTING PROFILE =================
    if (existingProfile) {
      if (role === "vehicle_owner" && vehicleId) {
        const { data: claimedVehicle, error: claimError } = await supabase
          .from("vehicles")
          .update({
            owner_id: authUser.id,
            is_claimed: true,
            registration_source: "claimed_after_onboarding",
            updated_at: new Date().toISOString(),
          })
          .eq("id", vehicleId)
          .select("*")
          .maybeSingle();

        console.log("🚗 CLAIM RESULT (existingProfile):", {
          vehicleId,
          userId: authUser.id,
          claimedVehicle,
          claimError,
        });

        if (claimedVehicle) {
          await linkOldReportsToOwner({
            profileId: existingProfile.id,
            vehicleId: claimedVehicle.id,
            licencePlate: claimedVehicle.licence_plate,
          });
        }
      }

      return sendResponse(
        res,
        200,
        true,
        "Profile already exists",
        existingProfile
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
          role: role || "reporter",
          username: requestedUsername,
          avatar_url: avatar_url || profileImage || null,
          language: "French",
          primary_contact: role === "vehicle_owner" ? "SMS" : "Email",
        },
      ])
      .select()
      .single();

    if (error) {
      return sendResponse(res, 500, false, error.message);
    }

    // ================= CLAIM VEHICLE AFTER PROFILE CREATE =================
    if (role === "vehicle_owner" && vehicleId) {
      const { data: linkedVehicle, error: claimError } = await supabase
        .from("vehicles")
        .update({
          owner_id: authUser.id,
          is_claimed: true,
          registration_source: "claimed_after_onboarding",
          updated_at: new Date().toISOString(),
        })
        .eq("id", vehicleId)
        .select("*")
        .maybeSingle();

      console.log("🚗 CLAIM RESULT (newProfile):", {
        vehicleId,
        userId: authUser.id,
        linkedVehicle,
        claimError,
      });

      if (linkedVehicle) {
        await linkOldReportsToOwner({
          profileId: data.id,
          vehicleId: linkedVehicle.id,
          licencePlate: linkedVehicle.licence_plate,
        });
      }
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