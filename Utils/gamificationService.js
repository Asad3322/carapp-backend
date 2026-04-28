const supabase = require("../Config/supabaseClient");

const gamificationService = async ({ profileId }) => {
  try {
    if (!profileId) {
      return {
        coins: 10,
        points: 10,
        reportsCount: 1,
        streak: 1,
        badges: ["Rookie Reporter"],
        newlyUnlockedBadges: ["Rookie Reporter"],
        badge: "Rookie Reporter",
        reward: "+10 coins",
        isGuest: true,
      };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("coins, points, reports_count, streak, last_report_date, badges")
      .eq("id", profileId)
      .maybeSingle();

    if (error) {
      console.error("Gamification fetch error:", error);
      return null;
    }

    const today = new Date().toISOString().split("T")[0];

    let coins = Number(profile?.coins || 0);
    let points = Number(profile?.points || 0);
    let reportsCount = Number(profile?.reports_count || 0);
    let streak = Number(profile?.streak || 0);
    let badges = Array.isArray(profile?.badges) ? profile.badges : [];
    const lastReportDate = profile?.last_report_date || null;

    coins += 10;
    points += 10;
    reportsCount += 1;

    if (!lastReportDate) {
      streak = 1;
    } else {
      const todayDate = new Date(today);
      const lastDate = new Date(lastReportDate);

      const diffDays = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        streak = streak || 1;
      } else if (diffDays === 1) {
        streak += 1;
      } else {
        streak = 1;
      }
    }

    const newlyUnlockedBadges = [];

    const unlockBadge = (badgeName, rewardCoins = 0) => {
      if (!badges.includes(badgeName)) {
        badges.push(badgeName);
        newlyUnlockedBadges.push(badgeName);
        coins += rewardCoins;
      }
    };

    if (reportsCount >= 1) unlockBadge("Rookie Reporter", 20);
    if (reportsCount >= 5) unlockBadge("Street Helper", 50);
    if (reportsCount >= 10) unlockBadge("Active Reporter", 100);
    if (points >= 100) unlockBadge("100 Points Club", 50);
    if (streak >= 5) unlockBadge("Streak Master", 75);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        coins,
        points,
        reports_count: reportsCount,
        streak,
        badges,
        last_report_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (updateError) {
      console.error("Gamification update error:", updateError);
      return null;
    }

    return {
      coins,
      points,
      reportsCount,
      streak,
      badges,
      newlyUnlockedBadges,
      badge: newlyUnlockedBadges[0] || badges[badges.length - 1] || null,
      reward: newlyUnlockedBadges.length
        ? "+10 coins + badge reward"
        : "+10 coins",
      isGuest: false,
    };
  } catch (error) {
    console.error("Gamification error:", error);
    return null;
  }
};

module.exports = gamificationService;