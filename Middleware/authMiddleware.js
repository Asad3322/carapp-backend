const supabase = require("../Config/supabaseClient");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No token",
      });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid token",
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, auth_user_id, email, phone, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return res.status(500).json({
        success: false,
        message: "Profile fetch failed",
      });
    }

    if (!profile?.id) {
      return res.status(404).json({
        success: false,
        message: "Profile not found for this authenticated user",
      });
    }

    req.user = {
      ...user,
      id: user.id,
      email: user.email,
      profileId: profile.id,
      profileRole: profile.role,
      profileEmail: profile.email,
      profilePhone: profile.phone,
    };

    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = authMiddleware;