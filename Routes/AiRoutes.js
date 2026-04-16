const express = require("express");
const router = express.Router();
const { generateIncidentDescription } = require("../Controller/AiController");

router.post("/generate-description", generateIncidentDescription);

module.exports = router;