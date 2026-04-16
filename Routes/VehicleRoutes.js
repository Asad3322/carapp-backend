const express = require("express");
const router = express.Router();

const upload = require("../Utils/multer");
const validate = require("../Middleware/validate");
const { createVehicleSchema } = require("../Validations/vehicleValidation");
const {
  createVehicle,
  getAllVehicles,
  getSingleVehicle,
} = require("../Controller/VehicleController");

router.post(
  "/",
  upload.fields([
    { name: "vehicleMedia", maxCount: 5 },
    { name: "insuranceDocument", maxCount: 5 },
  ]),
  validate(createVehicleSchema),
  createVehicle
);

router.get("/", getAllVehicles);
router.get("/:id", getSingleVehicle);

module.exports = router;