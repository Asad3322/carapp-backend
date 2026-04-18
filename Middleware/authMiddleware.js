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

    // 🔥 GET USER ROLE FROM YOUR DB (profiles table)
    const { data: profile, error: profileError } = await supabase
      .from("profiles") // ⚠️ change to "users" if you use users table
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return sendResponse(res, 500, false, "Error fetching user profile");
    }

    // ✅ FINAL USER OBJECT FOR BACKEND
    req.user = {
      id: user.id,
      email: user.email,
      role: profile?.role || "user", // fallback if role not set
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return sendResponse(res, 500, false, "Authentication failed", err.message);
  }
};

module.exports = authMiddleware;