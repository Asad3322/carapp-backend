const express = require("express");
const router = express.Router();

const upload = require("../Utils/multer");
const validate = require("../Middleware/validate");
const { createReportSchema } = require("../Validations/reportValidation");
const {
  createReport,
  getAllReports,
  getSingleReport,
} = require("../Controller/ReportController");

router.post(
  "/",
  upload.fields([
    { name: "medias", maxCount: 10 },
    { name: "insuranceCertificate", maxCount: 5 },
  ]),
  validate(createReportSchema),
  createReport
);

router.get("/", getAllReports);
router.get("/:id", getSingleReport);

module.exports = router;