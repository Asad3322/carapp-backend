const express = require("express");
const router = express.Router();

const upload = require("../Utils/multer");
const validate = require("../Middleware/validate");
const authMiddleware = require("../Middleware/authMiddleware");
const { createVehicleSchema } = require("../Validations/vehicleValidation");
const {
  createVehicle,
  getAllVehicles,
  getSingleVehicle,
} = require("../Controller/VehicleController");

router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "vehicleMedia", maxCount: 5 },
    { name: "insuranceDocument", maxCount: 5 },
  ]),
  validate(createVehicleSchema),
  createVehicle
);

router.get("/", authMiddleware, getAllVehicles);
router.get("/:id", authMiddleware, getSingleVehicle);

module.exports = router;