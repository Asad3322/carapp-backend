const express = require("express");
const router = express.Router();

const upload = require("../Utils/multer");
const validate = require("../Middleware/validate");
const authMiddleware = require("../Middleware/authMiddleware");
const { createReportSchema } = require("../Validations/reportValidation");

const {
  createReport,
  getAllReports,
  getSingleReport,
  getSentReports,
  getReceivedReports,
  updateReportStatus,
} = require("../Controller/ReportController");

router.post(
  "/",
  upload.fields([
    { name: "medias", maxCount: 5 },
    { name: "insuranceCertificate", maxCount: 1 },
  ]),
  validate(createReportSchema),
  createReport
);

router.get("/", authMiddleware, getAllReports);
router.get("/sent", authMiddleware, getSentReports);
router.get("/received", authMiddleware, getReceivedReports);
router.get("/:id", authMiddleware, getSingleReport);
router.patch("/:id/status", authMiddleware, updateReportStatus);

module.exports = router;