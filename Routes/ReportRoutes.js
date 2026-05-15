const express = require("express");
const router = express.Router();

const upload = require("../Utils/multer");
const validate = require("../Middleware/validate");
const authMiddleware = require("../Middleware/authMiddleware");
const optionalAuthMiddleware = require("../Middleware/optionalAuthMiddleware");
const ownerAccessMiddleware = require("../Middleware/ownerAccessMiddleware");

const { createReportSchema } = require("../Validations/reportValidation");
const ReportController = require("../Controller/ReportController");

const flexibleReportAuth = (req, res, next) => {
  const ownerToken =
    req.headers["x-owner-access-token"] ||
    req.headers["owner-access-token"];

  if (ownerToken) {
    return ownerAccessMiddleware(req, res, next);
  }

  return authMiddleware(req, res, next);
};

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

router.get("/sent", flexibleReportAuth, ReportController.getSentReports);

router.get("/received", flexibleReportAuth, ReportController.getReceivedReports);

router.patch(
  "/:id/thank",
  flexibleReportAuth,
  ReportController.thankReporter
);

router.patch(
  "/:id/bad-report",
  flexibleReportAuth,
  ReportController.reportBadReport
);

router.get("/:id", flexibleReportAuth, ReportController.getSingleReport);

router.patch(
  "/:id/status",
  flexibleReportAuth,
  ReportController.updateReportStatus
);

module.exports = router;