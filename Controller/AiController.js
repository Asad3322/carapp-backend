const sendResponse = require("../Utils/sendResponse");
const generateDescriptionWithAI = require("../Service/aiDescriptionService");

const generateIncidentDescription = async (req, res) => {
  try {
    const {
      description = "",
      mode = "",
      language = "auto",
      title = "",
      type = "",
      location = "",
      extraDetails = "",
    } = req.body;

    if (mode === "incident_optimization") {
      if (!description.trim()) {
        return sendResponse(
          res,
          400,
          false,
          "Incident description is required for AI optimization"
        );
      }

      const optimizedDescription = await generateDescriptionWithAI({
        mode: "incident_optimization",
        description: description.trim(),
        language,
      });

      return sendResponse(
        res,
        200,
        true,
        "Description optimized successfully",
        {
          description: optimizedDescription,
          originalDescription: description.trim(),
        }
      );
    }

    if (
      !description.trim() &&
      !title.trim() &&
      !type.trim() &&
      !location.trim() &&
      !extraDetails.trim()
    ) {
      return sendResponse(
        res,
        400,
        false,
        "At least one field is required to generate description"
      );
    }

    const generatedDescription = await generateDescriptionWithAI({
      mode: "generic_generation",
      description: description.trim(),
      title: title.trim(),
      type: type.trim(),
      location: location.trim(),
      extraDetails: extraDetails.trim(),
      language,
    });

    return sendResponse(
      res,
      200,
      true,
      "Description generated successfully",
      { description: generatedDescription }
    );
  } catch (error) {
    console.error("AI Controller Error:", error);

    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to generate description"
    );
  }
};

module.exports = {
  generateIncidentDescription,
};