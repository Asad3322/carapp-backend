const {
  sendVerificationService,
  getUserByContactService,
  verifyPhoneMagicLinkService,
} = require("../Service/AuthService");
const sendResponse = require("../Utils/sendResponse");
const supabase = require("../Config/supabaseClient");

const resolveOwnerVehicleId = async ({ explicitVehicleId, verifiedPhone }) => {
  if (explicitVehicleId) {
    return explicitVehicleId;
  }

  if (!verifiedPhone) {
    return null;
  }

  const normalizedPhone = String(verifiedPhone).replace(/\s/g, "");

  const { data, error } = await supabase
    .from("phone_verifications")
    .select("vehicle_id, created_at")
    .eq("phone", normalizedPhone)
    .eq("role", "vehicle_owner")
    .not("vehicle_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("resolveOwnerVehicleId error:", error);
    return null;
  }

  return data?.vehicle_id || null;
};

const linkVehicleToOwner = async ({ authUserId, vehicleId }) => {
  if (!authUserId || !vehicleId) {
    return null;
  }

  const { data: linkedVehicle, error } = await supabase
    .from("vehicles")
    .update({
      owner_id: authUserId,
      is_claimed: true,
      registration_source: "claimed_after_onboarding",
    })
    .eq("id", vehicleId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("linkVehicleToOwner error:", error);
    throw new Error(error.message);
  }

  return linkedVehicle || null;
};

const relinkReportsToVehicle = async ({ authUserId, vehicle }) => {
  if (!authUserId || !vehicle?.id || !vehicle?.licence_plate) {
    return;
  }

  const { error } = await supabase
    .from("reports")
    .update({
      receiver_id: authUserId,
      vehicle_id: vehicle.id,
      plate_registered: true,
      flow_type: "registered_plate",
      status: "reported",
      updated_at: new Date().toISOString(),
    })
    .eq("licence_plate", vehicle.licence_plate)
    .is("receiver_id", null);

  if (error) {
    console.error("relinkReportsToVehicle error:", error);
  }
};

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

    const knownErrors = [
      "Contact is required",
      "Reporter verification requires an email address",
      "Vehicle owner verification requires a phone number",
      "Vehicle ID is required for owner verification",
    ];

    if (knownErrors.includes(error.message)) {
      return sendResponse(res, 400, false, error.message);
    }

    return sendResponse(
      res,
      500,
      false,
      error.message || "Internal server error"
    );
  }
};

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

const createProfileAfterAuth = async (req, res) => {
  try {
    const authUser = req.user;
    const { role, verifiedPhone, vehicleId } = req.body;

    if (!authUser) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    const normalizedRole = role || "reporter";
    const email = authUser.email || null;
    const phone = verifiedPhone || authUser.phone || null;

    const resolvedVehicleId =
      normalizedRole === "vehicle_owner"
        ? await resolveOwnerVehicleId({
            explicitVehicleId: vehicleId || null,
            verifiedPhone: phone,
          })
        : null;

    const existingProfile = await getUserByContactService({ email, phone });

    if (existingProfile) {
      let linkedVehicle = null;

      if (normalizedRole === "vehicle_owner" && resolvedVehicleId) {
        linkedVehicle = await linkVehicleToOwner({
          authUserId: authUser.id,
          vehicleId: resolvedVehicleId,
        });

        if (linkedVehicle) {
          await relinkReportsToVehicle({
            authUserId: authUser.id,
            vehicle: linkedVehicle,
          });
        }
      }

      return sendResponse(
        res,
        200,
        true,
        "Profile already exists",
        {
          ...existingProfile,
          linkedVehicle: linkedVehicle || null,
        }
      );
    }

    const username = `user_${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await supabase
      .from("profiles")
      .insert([
        {
          auth_user_id: authUser.id,
          name: authUser.user_metadata?.name || "",
          email,
          phone,
          role: normalizedRole,
          username,
          language: "French",
          primary_contact: normalizedRole === "vehicle_owner" ? "SMS" : "Email",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("create profile error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    let linkedVehicle = null;

    if (normalizedRole === "vehicle_owner" && resolvedVehicleId) {
      linkedVehicle = await linkVehicleToOwner({
        authUserId: authUser.id,
        vehicleId: resolvedVehicleId,
      });

      if (linkedVehicle) {
        await relinkReportsToVehicle({
          authUserId: authUser.id,
          vehicle: linkedVehicle,
        });
      }
    }

    return sendResponse(
      res,
      201,
      true,
      "Profile created successfully",
      {
        ...data,
        linkedVehicle: linkedVehicle || null,
      }
    );
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