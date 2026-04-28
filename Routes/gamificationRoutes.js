const express = require("express");
const router = express.Router();
const supabase = require("../Config/supabaseClient");

const getUserFromToken = async (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "No token" };
  }

  const token = authHeader.split(" ")[1];

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: "Invalid token" };
  }

  return { user, error: null };
};

router.get("/me", async (req, res) => {
  try {
    const { user, error } = await getUserFromToken(req);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: error || "Unauthorized",
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, username, email, phone, role, coins, points, reports_count, streak, badges, last_report_date"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Gamification profile fetch error:", profileError);
      return res.status(500).json({
        success: false,
        message: "Error fetching gamification profile",
      });
    }

    return res.json({
      success: true,
      data: {
        profileId: profile?.id || null,
        username: profile?.username || null,
        email: profile?.email || user.email || null,
        phone: profile?.phone || user.phone || null,
        role: profile?.role || null,
        coins: Number(profile?.coins || 0),
        points: Number(profile?.points || 0),
        reportsCount: Number(profile?.reports_count || 0),
        streak: Number(profile?.streak || 0),
        badges: Array.isArray(profile?.badges) ? profile.badges : [],
        lastReportDate: profile?.last_report_date || null,
      },
    });
  } catch (err) {
    console.error("Gamification /me error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, email, phone, role, coins, points, reports_count, streak, badges")
      .order("points", { ascending: false })
      .order("coins", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Leaderboard fetch error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching leaderboard",
      });
    }

    const leaderboard = (data || []).map((profile, index) => {
      const badges = Array.isArray(profile.badges) ? profile.badges : [];

      return {
        rank: index + 1,
        profileId: profile.id,
        username:
          profile.username ||
          profile.email?.split("@")[0] ||
          profile.phone ||
          "User",
        role: profile.role,
        coins: Number(profile.coins || 0),
        points: Number(profile.points || 0),
        reportsCount: Number(profile.reports_count || 0),
        streak: Number(profile.streak || 0),
        badges,
        currentBadge: badges[badges.length - 1] || "Rookie Reporter",
      };
    });

    return res.json({
      success: true,
      data: leaderboard,
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/reward", async (req, res) => {
  return res.json({
    success: true,
    message:
      "Reward is now handled automatically when a report is submitted.",
  });
});

module.exports = router;