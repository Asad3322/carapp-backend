const {
  sendVerificationService,
  getUserByEmailService,
} = require("../Service/AuthService");
const sendResponse = require("../Utils/sendResponse");
const supabase = require("../Config/supabaseClient");

const sendVerification = async (req, res) => {
  try {
    const { contact, role } = req.body;

    if (!contact) {
      return sendResponse(res, 400, false, "Contact is required");
    }

    const result = await sendVerificationService({
      contact,
      role: role || "reporter",
    });

    return sendResponse(
      res,
      200,
      true,
      "Verification link sent successfully",
      result
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

const createProfileAfterAuth = async (req, res) => {
  try {
    const authUser = req.user;
    const { role } = req.body;

    if (!authUser) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    const email = authUser.email || null;
    const phone = authUser.phone || null;

    const existingProfile = await getUserByEmailService(email);

    if (existingProfile) {
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

    return sendResponse(res, 201, true, "Profile created successfully", data);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

module.exports = {
  sendVerification,
  createProfileAfterAuth,
};