const express = require("express");
const router = express.Router();
const supabase = require("../Config/supabaseClient");

// 🎯 EXISTING (keep it)
router.post("/reward", async (req, res) => {
  try {
    const { userId, action } = req.body;

    let reward = {
      coins: 10,
      points: 10,
      badge: "Rookie Reporter",
      streak: 1,
    };

    return res.json({
      success: true,
      data: reward,
    });
  } catch (e) {
    return res.status(500).json({ success: false });
  }
});


// 🚀 NEW: GET GAMIFICATION DATA (IMPORTANT)
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token",
      });
    }

    const token = authHeader.split(" ")[1];

    // get user from token
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // get profile data
    const { data: profile } = await supabase
      .from("profiles")
      .select("coins, points, reports_count, streak, badges")
      .eq("auth_user_id", user.id)
      .single();

    return res.json({
      success: true,
      data: {
        coins: profile?.coins || 0,
        points: profile?.points || 0,
        reportsCount: profile?.reports_count || 0,
        streak: profile?.streak || 0,
        badges: profile?.badges || [],
      },
    });
  } catch (err) {
    console.error("Gamification fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;