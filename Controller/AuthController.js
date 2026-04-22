const {
  sendVerificationService,
  getUserByContactService,
  verifyPhoneMagicLinkService,
} = require("../Service/AuthService");
const sendResponse = require("../Utils/sendResponse");
const supabase = require("../Config/supabaseClient");

const sendVerification = async (req, res) => {
  try {
    const { contact, role, vehicleId } = req.body;

    if (!contact) {
      return sendResponse(res, 400, false, "Contact is required");
    }

    const result = await sendVerificationService({
      contact,
      role: role || "reporter",
      vehicleId: vehicleId || null,
    });

    let verificationLink = null;

    // ✅ MOCK SMS / PHONE LINK FOR TESTING
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
    return sendResponse(res, 500, false, error.message);
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
    return sendResponse(res, 400, false, error.message);
  }
};

const createProfileAfterAuth = async (req, res) => {
  try {
    const authUser = req.user;
    const { role, verifiedPhone, vehicleId } = req.body;

    if (!authUser) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    const email = authUser.email || null;
    const phone = verifiedPhone || authUser.phone || null;

    const existingProfile = await getUserByContactService({ email, phone });

    if (existingProfile) {
      // If owner flow and vehicle is pending, link it even if profile exists
      if (role === "vehicle_owner" && vehicleId) {
        await supabase
          .from("vehicles")
          .update({
            owner_id: authUser.id,
            is_claimed: true,
            registration_source: "claimed_after_onboarding",
          })
          .eq("id", vehicleId)
          .is("owner_id", null);
      }

      return sendResponse(
        res,
        200,
        true,
        "Profile already exists",
        existingProfile
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
          role: role || "reporter",
          username,
          language: "French",
          primary_contact: role === "vehicle_owner" ? "SMS" : "Email",
        },
      ])
      .select()
      .single();

    if (error) {
      return sendResponse(res, 500, false, error.message);
    }

    // Link onboarding vehicle after owner verification
    if (role === "vehicle_owner" && vehicleId) {
      const { data: linkedVehicle } = await supabase
        .from("vehicles")
        .update({
          owner_id: authUser.id,
          is_claimed: true,
          registration_source: "claimed_after_onboarding",
        })
        .eq("id", vehicleId)
        .is("owner_id", null)
        .select("*")
        .maybeSingle();

      if (linkedVehicle) {
        await supabase
          .from("reports")
          .update({
            receiver_id: authUser.id,
            vehicle_id: linkedVehicle.id,
            plate_registered: true,
            flow_type: "registered_plate",
            status: "reported",
            updated_at: new Date().toISOString(),
          })
          .eq("licence_plate", linkedVehicle.licence_plate)
          .is("receiver_id", null);
      }
    }

    return sendResponse(res, 201, true, "Profile created successfully", data);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

module.exports = {
  sendVerification,
  verifyPhoneMagicLink,
  createProfileAfterAuth,
};