const express = require("express");
const router = express.Router();

const upload = require("../Utils/multer");
const validate = require("../Middleware/validate");
const authMiddleware = require("../Middleware/authMiddleware");
const optionalAuthMiddleware = require("../Middleware/optionalAuthMiddleware");

const { createReportSchema } = require("../Validations/reportValidation");

const ReportController = require("../Controller/ReportController");

router.post("/autosave", ReportController.autoSaveDraft);

router.post(
  "/",
  optionalAuthMiddleware,
  upload.fields([
    { name: "medias", maxCount: 5 },
    { name: "insuranceCertificate", maxCount: 1 },
  ]),
  validate(createReportSchema),
  ReportController.createReport
);

router.get("/", authMiddleware, ReportController.getAllReports);

router.get("/sent", authMiddleware, ReportController.getSentReports);

router.get("/received", authMiddleware, ReportController.getReceivedReports);

router.get("/:id", authMiddleware, ReportController.getSingleReport);

router.patch(
  "/:id/status",
  authMiddleware,
  ReportController.updateReportStatus
);

module.exports = router;
