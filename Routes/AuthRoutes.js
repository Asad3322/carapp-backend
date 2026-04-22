const express = require("express");
const router = express.Router();

const authMiddleware = require("../Middleware/authMiddleware");

const {
  sendVerification,
  verifyPhoneMagicLink,
  createProfileAfterAuth,
} = require("../Controller/AuthController");

const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");

router.post("/send-verification", sendVerification);
router.get("/verify-phone-link", verifyPhoneMagicLink);
router.post("/create-profile", authMiddleware, createProfileAfterAuth);

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", req.user.id)
      .maybeSingle();

    if (error) {
      return sendResponse(res, 400, false, error.message);
    }

    return sendResponse(res, 200, true, "User fetched successfully", {
      auth: req.user,
      profile,
    });
  } catch (err) {
    return sendResponse(res, 500, false, "Server error", err.message);
  }
});

module.exports = router;