const supabase = require("../Config/supabaseClient");

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      req.user = null;
      return next();
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, auth_user_id, role, username, phone, email")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Optional auth profile fetch error:", profileError);
      req.user = null;
      return next();
    }

    req.user = {
      id: user.id,
      email: user.email || null,
      phone: user.phone || null,
      role: profile?.role || "user",
      profileId: profile?.id || null,
      username: profile?.username || null,
    };

    return next();
  } catch (err) {
    console.error("Optional auth middleware error:", err);
    req.user = null;
    return next();
  }
};

module.exports = optionalAuthMiddleware;