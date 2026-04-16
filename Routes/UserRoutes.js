const express = require("express");
const router = express.Router();

const authMiddleware = require("../Middleware/authMiddleware");

const {
  getProfile,
  updateProfile,
  checkUsername,
  checkEmail,
  checkPhone,
} = require("../Controller/UserController");

router.get("/profile", authMiddleware, getProfile);

// ❌ removed validation for now
router.patch("/profile", authMiddleware, updateProfile);

router.get("/check-username", checkUsername);
router.get("/check-email", checkEmail);
router.get("/check-phone", checkPhone);

module.exports = router;