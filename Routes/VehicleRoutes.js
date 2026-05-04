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
  updateVehicle,
  deleteVehicle,
} = require("../Controller/VehicleController");

router.post(
  "/onboarding",
  upload.fields([
    { name: "vehicleMedia", maxCount: 5 },
    { name: "insuranceDocument", maxCount: 2 },
  ]),
  createVehicleOnboarding
);

router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "vehicleMedia", maxCount: 5 },
    { name: "insuranceDocument", maxCount: 2 },
  ]),
  createVehicle
);

router.post("/claim", authMiddleware, claimVehicle);

router.get("/", authMiddleware, getAllVehicles);
router.get("/:id", authMiddleware, getSingleVehicle);

router.patch(
  "/:id",
  authMiddleware,
  upload.fields([
    { name: "vehicleMedia", maxCount: 5 },
    { name: "insuranceDocument", maxCount: 2 },
  ]),
  updateVehicle
);

router.delete("/:id", authMiddleware, deleteVehicle);

module.exports = router;