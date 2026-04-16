const axios = require("axios");

const generateDescriptionWithAI = async ({
  mode = "generic_generation",
  language = "auto",
  description = "",
  title = "",
  type = "",
  location = "",
  extraDetails = "",
}) => {
  try {
    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "incident_optimization") {
      systemPrompt = `
You are helping users improve vehicle incident reports in a reporting app.

Rules:
- Rewrite the user's input into a clear, concise, and factual description
- Keep the output in the SAME language as the user's input
- Do NOT translate unless the user explicitly asks for translation
- Improve grammar, clarity, and readability
- Keep it under 3 short sentences
- Do not add facts that are not present in the original input
- Preserve the original meaning
- Return only the rewritten description text
      `.trim();

      userPrompt = `
User input:
${description.trim()}
      `.trim();
    } else {
      systemPrompt = `
You are a professional assistant that writes concise, natural, app-ready vehicle incident descriptions.

Rules:
- Write the output in the SAME language as the user's provided content
- Do NOT translate unless explicitly requested
- Keep the description natural, clear, and user-friendly
- Keep it between 40 and 80 words when enough detail is available
- Do not use bullet points
- Focus only on the incident
- If information is limited, still write the best possible natural description
- Do not invent specific facts that were not provided
- Return only the final description text
      `.trim();

      userPrompt = `
Write a short, clear, user-friendly incident description for a vehicle reporting app using the same language as the user's content.

User-provided content:
- Description: ${description}
- Incident title: ${title}
- Incident type: ${type}
- Location: ${location}
- Extra details: ${extraDetails}
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
        temperature: mode === "incident_optimization" ? 0.2 : 0.6,
        max_tokens: mode === "incident_optimization" ? 120 : 160,
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