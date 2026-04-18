const Joi = require("joi");

const createReportSchema = Joi.object({
  licencePlate: Joi.string()
    .trim()
    .min(1)
    .max(30)
    .required()
    .messages({
      "string.empty": "Licence Plate is required",
      "any.required": "Licence Plate is required",
    }),

  urgency: Joi.string()
    .valid("urgent", "medium", "not_urgent")
    .required()
    .messages({
      "any.only": "Urgency must be one of: urgent, medium, not_urgent",
      "any.required": "Urgency is required",
    }),

  description: Joi.string()
    .trim()
    .min(5)
    .max(1000)
    .required()
    .messages({
      "string.empty": "Incident Description is required",
      "string.min": "Incident Description must be at least 5 characters long",
      "any.required": "Incident Description is required",
    }),

  reporterId: Joi.string()
    .trim()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .optional()
    .allow(null, "")
    .messages({
      "string.guid": "reporterId must be a valid UUID",
    }),
});

module.exports = {
  createReportSchema,
};