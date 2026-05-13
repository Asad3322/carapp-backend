const {
  sendVerificationService,
  verifyPhoneMagicLinkService,
} = require("../Service/AuthService");

const sendResponse = require("../Utils/sendResponse");
const supabase = require("../Config/supabaseClient");
const crypto = require("crypto");

const FRONTEND_URL =
  process.env.CLIENT_URL && process.env.CLIENT_URL !== "http://localhost:5173"
    ? process.env.CLIENT_URL
    : "https://car-app-french.vercel.app";

const OWNER_ACCESS_SECRET =
  process.env.OWNER_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

const normalizePlate = (value = "") =>
  String(value).replace(/\s+/g, "").trim().toUpperCase();

const createOwnerAccessToken = ({ profileId, phone }) => {
  const payload = {
    profileId,
    phone,
    role: "vehicle_owner",
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );

  const signature = crypto
    .createHmac("sha256", OWNER_ACCESS_SECRET)
    .update(payloadBase64)
    .digest("hex");

  return `${payloadBase64}.${signature}`;
};

// ================= SEND VERIFICATION =================
const sendVerification = async (req, res) => {
  try {
    console.log("🔥 sendVerification controller hit");
    console.log("📦 req.body:", req.body);

    const { contact, role, vehicleId } = req.body;

    if (!contact || !contact.trim()) {
      return sendResponse(res, 400, false, "Contact is required");
    }

    const finalRole = role === "vehicle_owner" ? "vehicle_owner" : "reporter";

    const result = await sendVerificationService({
      contact: contact.trim(),
      role: finalRole,
      vehicleId: vehicleId || null,
    });

    let verificationLink = null;

    if (result?.phone_token) {
      verificationLink = `${FRONTEND_URL}/auth/callback?phone_token=${result.phone_token}`;
      console.log("🔗 PHONE VERIFICATION LINK:", verificationLink);
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
    console.error("❌ sendVerification error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Internal server error"
    );
  }
};

// ================= LINK OLD REPORTS TO OWNER =================
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
      console.error("Auto-link reports error:", error);
    }
  } catch (error) {
    console.error("linkOldReportsToOwner error:", error);
  }
};

// ================= LINK PENDING REPORTS TO REPORTER =================
const linkPendingReportsToReporter = async ({
  profileId,
  pendingReportId,
  pendingReportIds,
}) => {
  try {
    if (!profileId) return [];

    const ids = [];

    if (pendingReportId) ids.push(pendingReportId);

    if (Array.isArray(pendingReportIds)) {
      pendingReportIds.forEach((id) => {
        if (id) ids.push(id);
      });
    }

    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) return [];

    const { data, error } = await supabase
      .from("reports")
      .update({
        reporter_id: profileId,
        is_anonymous: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", uniqueIds)
      .is("reporter_id", null)
      .select("id");

    if (error) {
      console.error("Link pending reports error:", error);
      throw new Error(error.message || "Failed to link pending report");
    }

    return data || [];
  } catch (error) {
    console.error("linkPendingReportsToReporter error:", error);
    throw error;
  }
};

// ================= CLAIM VEHICLE FOR OWNER =================
const claimVehicleForOwner = async ({ profileId, vehicleId }) => {
  if (!profileId || !vehicleId) return null;

  const { data: vehicle, error: findError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  if (vehicle.owner_id && vehicle.owner_id !== profileId) {
    throw new Error("This vehicle is already claimed by another owner");
  }

  const { data: claimedVehicle, error: claimError } = await supabase
    .from("vehicles")
    .update({
      owner_id: profileId,
      is_claimed: true,
      registration_source: "claimed_after_onboarding",
      updated_at: new Date().toISOString(),
    })
    .eq("id", vehicleId)
    .select("*")
    .maybeSingle();

  if (claimError) {
    throw new Error(claimError.message || "Failed to claim vehicle");
  }

  console.log("✅ VEHICLE CLAIMED:", claimedVehicle);

  if (claimedVehicle) {
    await linkOldReportsToOwner({
      profileId,
      vehicleId: claimedVehicle.id,
      licencePlate: claimedVehicle.licence_plate,
    });
  }

  return claimedVehicle;
};

// ================= VERIFY PHONE LINK =================
const verifyPhoneMagicLink = async (req, res) => {
  try {
    const { phone_token } = req.query;

    if (!phone_token) {
      return sendResponse(res, 400, false, "Phone token is required");
    }

    const verification = await verifyPhoneMagicLinkService(phone_token);

    const phone = verification.phone;
    const vehicleId = verification.vehicle_id;

    let { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (profileError) {
      return sendResponse(res, 500, false, profileError.message);
    }

    let profile = existingProfile;

    if (!profile) {
      const username = `owner_${phone.replace(/\D/g, "").slice(-6)}`;

      const { data: createdProfile, error: createError } = await supabase
        .from("profiles")
        .insert([
          {
            name: username,
            username,
            phone,
            email: null,
            role: "vehicle_owner",
            language: "fr",
            primary_contact: "SMS",
            updated_at: new Date().toISOString(),
          },
        ])
        .select("*")
        .single();

      if (createError) {
        return sendResponse(res, 500, false, createError.message);
      }

      profile = createdProfile;
    } else {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          role: "vehicle_owner",
          phone,
          primary_contact: "SMS",
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .select("*")
        .maybeSingle();

      if (updateError) {
        return sendResponse(res, 500, false, updateError.message);
      }

      profile = updatedProfile;
    }

    let claimedVehicle = null;

    if (vehicleId) {
      claimedVehicle = await claimVehicleForOwner({
        profileId: profile.id,
        vehicleId,
      });
    }

    const ownerAccessToken = createOwnerAccessToken({
      profileId: profile.id,
      phone,
    });

    return sendResponse(res, 200, true, "Phone verified successfully", {
      phone,
      role: "vehicle_owner",
      vehicleId,
      profile,
      vehicle: claimedVehicle,
      ownerAccessToken,
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

// ================= CREATE PROFILE AFTER AUTH =================
const createProfileAfterAuth = async (req, res) => {
  try {
    const authUser = req.user;

    if (!authUser?.id) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    const {
      role,
      verifiedPhone,
      vehicleId,
      username,
      name,
      email: bodyEmail,
      phone: bodyPhone,
      profileImage,
      avatar_url,
      pendingReportId,
      pendingReportIds,
    } = req.body;

    const finalRole = role === "vehicle_owner" ? "vehicle_owner" : "reporter";
    const finalEmail = authUser.email || bodyEmail || null;
    const finalPhone = verifiedPhone || bodyPhone || authUser.phone || null;

    const { data: existingProfile, error: profileFindError } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (profileFindError) {
      return sendResponse(res, 500, false, profileFindError.message);
    }

    if (existingProfile) {
      const upgradedRole =
        finalRole === "vehicle_owner"
          ? "vehicle_owner"
          : existingProfile.role || "reporter";

      const updatePayload = {
        role: upgradedRole,
        email: finalEmail || existingProfile.email,
        phone: finalPhone || existingProfile.phone,
        primary_contact: upgradedRole === "vehicle_owner" ? "SMS" : "Email",
        updated_at: new Date().toISOString(),
      };

      if (username) updatePayload.username = username;
      if (name) updatePayload.name = name;
      if (avatar_url || profileImage) {
        updatePayload.avatar_url = avatar_url || profileImage;
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", existingProfile.id)
        .select("*")
        .maybeSingle();

      if (updateError) {
        return sendResponse(res, 500, false, updateError.message);
      }

      let linkedReports = [];

      if (finalRole === "reporter") {
        linkedReports = await linkPendingReportsToReporter({
          profileId: existingProfile.id,
          pendingReportId,
          pendingReportIds,
        });
      }

      let claimedVehicle = null;

      if (finalRole === "vehicle_owner" && vehicleId) {
        claimedVehicle = await claimVehicleForOwner({
          profileId: existingProfile.id,
          vehicleId,
        });
      }

      return sendResponse(res, 200, true, "Profile updated successfully", {
        profile: updatedProfile,
        vehicle: claimedVehicle,
        linkedReports,
      });
    }

    const finalUsername =
      username ||
      name ||
      authUser.user_metadata?.name ||
      `user_${Math.random().toString(36).slice(2, 8)}`;

    const { data: createdProfile, error: createError } = await supabase
      .from("profiles")
      .insert([
        {
          auth_user_id: authUser.id,
          name: name || finalUsername,
          username: finalUsername,
          email: finalEmail,
          phone: finalPhone,
          role: finalRole,
          avatar_url: avatar_url || profileImage || null,
          language: "fr",
          primary_contact: finalRole === "vehicle_owner" ? "SMS" : "Email",
          updated_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    if (createError) {
      return sendResponse(res, 500, false, createError.message);
    }

    let linkedReports = [];

    if (finalRole === "reporter") {
      linkedReports = await linkPendingReportsToReporter({
        profileId: createdProfile.id,
        pendingReportId,
        pendingReportIds,
      });
    }

    let claimedVehicle = null;

    if (finalRole === "vehicle_owner" && vehicleId) {
      claimedVehicle = await claimVehicleForOwner({
        profileId: createdProfile.id,
        vehicleId,
      });
    }

    return sendResponse(res, 201, true, "Profile created successfully", {
      profile: createdProfile,
      vehicle: claimedVehicle,
      linkedReports,
    });
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