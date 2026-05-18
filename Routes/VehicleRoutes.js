const express = require("express");
const router = express.Router();

const upload = require("../Utils/multer");
const authMiddleware = require("../Middleware/authMiddleware");
const ownerAccessMiddleware = require("../Middleware/ownerAccessMiddleware");

const {
  createVehicleOnboarding,
  createVehicle,
  claimVehicle,
  getAllVehicles,
  getSingleVehicle,
  updateVehicle,
  deleteVehicle,
} = require("../Controller/VehicleController");

const flexibleVehicleAuth = (req, res, next) => {
  const ownerToken =
    req.headers["x-owner-access-token"] ||
    req.headers["owner-access-token"];

  if (ownerToken) {
    return ownerAccessMiddleware(req, res, next);
  }

  return authMiddleware(req, res, next);
};

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
  flexibleVehicleAuth,
  upload.fields([
    { name: "vehicleMedia", maxCount: 5 },
    { name: "insuranceDocument", maxCount: 2 },
  ]),
  createVehicle
);

router.post("/claim", flexibleVehicleAuth, claimVehicle);

router.get("/", flexibleVehicleAuth, getAllVehicles);
router.get("/:id", flexibleVehicleAuth, getSingleVehicle);

router.patch(
  "/:id",
  flexibleVehicleAuth,
  upload.fields([
    { name: "vehicleMedia", maxCount: 5 },
    { name: "insuranceDocument", maxCount: 2 },
  ]),
  updateVehicle
);

router.delete("/:id", flexibleVehicleAuth, deleteVehicle);

module.exports = router;