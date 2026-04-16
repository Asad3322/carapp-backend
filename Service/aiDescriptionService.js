const axios = require("axios");

const generateDescriptionWithAI = async ({
  mode = "generic_generation",
  language = "fr",
  description = "",
  title = "",
  type = "",
  location = "",
  extraDetails = "",
}) => {
  try {
    let systemPrompt = "";
    let userPrompt = "";

    // ✅ PRD-based incident optimization mode
    if (mode === "incident_optimization") {
      systemPrompt =
        'You are helping rewrite incident reports submitted by users in a vehicle incident reporting app. Rewrite the following user input into a clear, concise, and factual description. Keep it under 3 sentences. Do not add information that was not in the original input. Preserve the original meaning. Output the rewritten text in French only. Output only the rewritten text, nothing else.';

      userPrompt = description.trim();
    } else {
      // ✅ Generic generation mode
      systemPrompt =
        "You are a professional assistant that writes concise app-ready descriptions.";

      userPrompt = `
Write a short, clear, user-friendly incident description for a vehicle reporting app.

Rules:
- Keep it between 40 and 80 words
- Make it natural and professional
- Do not use bullet points
- Focus only on the incident
- If information is missing, still write the best possible description
- Return only the final description text
- Write the result in ${language === "fr" ? "French" : "English"} only

Incident title: ${title}
Incident type: ${type}
Location: ${location}
Extra details: ${extraDetails}
      `.trim();
    }

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: mode === "incident_optimization" ? 0.2 : 0.7,
        max_tokens: mode === "incident_optimization" ? 120 : 150,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.SITE_URL || "http://localhost:5000",
          "X-OpenRouter-Title": process.env.SITE_NAME || "CARAPP",
        },
      }
    );

    const content =
      response?.data?.choices?.[0]?.message?.content?.trim() || "";

    if (!content) {
      throw new Error("No description returned from AI");
    }

    return content;
  } catch (error) {
    console.error(
      "OpenRouter AI Error:",
      error?.response?.data || error.message
    );

    throw new Error(
      error?.response?.data?.error?.message ||
        "Failed to generate AI description"
    );
  }
};

module.exports = generateDescriptionWithAI;