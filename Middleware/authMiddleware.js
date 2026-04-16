const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendResponse(res, 401, false, "Authorization token is required");
    }

    const token = authHeader.split(" ")[1];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return sendResponse(res, 401, false, "Invalid or expired token");
    }

    req.user = user;
    next();
  } catch (err) {
    return sendResponse(res, 500, false, "Authentication failed", err.message);
  }
};

module.exports = authMiddleware;