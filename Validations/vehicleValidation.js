const Joi = require("joi");

const createVehicleSchema = Joi.object({
  vehicleName: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Name of the vehicle is required",
    "string.min": "Name of the vehicle must be at least 2 characters long",
    "any.required": "Name of the vehicle is required",
  }),

  licencePlate: Joi.string().trim().min(4).max(20).required().messages({
    "string.empty": "Licence Plate is required",
    "string.min": "Licence Plate must be at least 4 characters long",
    "any.required": "Licence Plate is required",
  }),

  ownerId: Joi.string().trim().optional(),
});

module.exports = {
  createVehicleSchema,
};