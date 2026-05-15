const express = require("express");
const router = express.Router();

const authMiddleware = require("../Middleware/authMiddleware");
const ownerAccessMiddleware = require("../Middleware/ownerAccessMiddleware");

const {
  sendVerification,
  verifyPhoneMagicLink,
  createProfileAfterAuth,
  updateOwnerProfile,
} = require("../Controller/AuthController");

const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");

const flexibleAuth = (req, res, next) => {
  const bearerToken = req.headers.authorization?.split(" ")[1];

  if (bearerToken) {
    return authMiddleware(req, res, next);
  }

  const ownerToken =
    req.headers["x-owner-access-token"] || req.headers["owner-access-token"];

  if (ownerToken) {
    return ownerAccessMiddleware(req, res, next);
  }

  return authMiddleware(req, res, next);
};

router.post("/send-verification", sendVerification);
router.get("/verify-phone-link", verifyPhoneMagicLink);
router.post("/create-profile", authMiddleware, createProfileAfterAuth);
router.patch("/owner-profile", ownerAccessMiddleware, updateOwnerProfile);

router.get("/me", flexibleAuth, async (req, res) => {
  try {
    let query = supabase.from("profiles").select("*");

    if (req.user?.isOwnerAccess && req.user?.profileId) {
      query = query.eq("id", req.user.profileId);
    } else {
      query = query.eq("auth_user_id", req.user.id);
    }

    const { data: profile, error } = await query.maybeSingle();

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
