const validate = (schema) => (req, res, next) => {
  console.log("REQ BODY IN VALIDATE:", req.body);

  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map((item) => item.message),
    });
  }

  req.body = value;
  next();
};

module.exports = validate;