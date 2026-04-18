const express = require("express");
const router = express.Router();

const upload = require("../Utils/multer");
const authMiddleware = require("../Middleware/authMiddleware");

const {
  createVehicleOnboarding,
  createVehicle,
  claimVehicle,
  getAllVehicles,
  getSingleVehicle,
} = require("../Controller/VehicleController");

// ================= PUBLIC ROUTE (PRD FLOW) =================
// NO LOGIN REQUIRED
router.post(
  "/onboarding",
  upload.fields([
    { name: "vehicleMedia", maxCount: 5 },
    { name: "insuranceDocument", maxCount: 2 },
  ]),
  createVehicleOnboarding
);

// ================= AUTH ROUTE =================
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "vehicleMedia", maxCount: 5 },
    { name: "insuranceDocument", maxCount: 2 },
  ]),
  createVehicle
);

// ================= CLAIM =================
router.post("/claim", authMiddleware, claimVehicle);

// ================= GET =================
router.get("/", authMiddleware, getAllVehicles);
router.get("/:id", authMiddleware, getSingleVehicle);

module.exports = router;