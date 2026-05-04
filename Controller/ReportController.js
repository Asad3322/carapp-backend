const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");
const uploadFileToSupabase = require("../Utils/uploadFileToSupabase");

const allowedUrgency = ["urgent", "medium", "not_urgent"];
const allowedStatuses = [
  "reported",
  "seen",
  "resolved",
  "pending_registration",
];

const normalizePlate = (value = "") =>
  String(value).replace(/\s+/g, "").trim().toUpperCase();

const normalizeMediaArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return [];

    if (trimmed.startsWith("http")) {
      return [trimmed];
    }

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }

      if (typeof parsed === "string" && parsed.trim()) {
        return [parsed.trim()];
      }
    } catch (err) {
      console.error("Media parse error:", err);
    }
  }

  return [];
};

const updateGamification = async (profileId) => {
  try {
    if (!profileId) {
      return {
        coins: 10,
        points: 10,
        reportsCount: 1,
        streak: 1,
        badge: "Rookie Reporter",
        badges: ["Rookie Reporter"],
        newlyUnlockedBadges: ["Rookie Reporter"],
        reward: "+10 Coins",
        isGuestReward: true,
      };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("coins, points, reports_count, streak, last_report_date, badges")
      .eq("id", profileId)
      .maybeSingle();

    if (error) {
      console.error("Gamification profile fetch error:", error);
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
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 0) {
        streak = streak || 1;
      } else if (diffDays === 1) {
        streak += 1;
      } else if (diffDays > 1) {
        streak = 1;
      }
    }

    const newlyUnlockedBadges = [];

    const unlockBadge = (badgeName, bonusCoins = 0) => {
      if (!badges.includes(badgeName)) {
        badges.push(badgeName);
        newlyUnlockedBadges.push(badgeName);
        coins += bonusCoins;
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
      badge: newlyUnlockedBadges[0] || badges[badges.length - 1] || null,
      badges,
      newlyUnlockedBadges,
      reward: newlyUnlockedBadges.length
        ? "+10 Coins + Badge Bonus"
        : "+10 Coins",
      isGuestReward: false,
    };
  } catch (error) {
    console.error("Gamification error:", error);
    return null;
  }
};

const createNotification = async ({
  userId,
  type,
  title,
  message,
  reportId = null,
}) => {
  try {
    if (!userId) return;

    const { error } = await supabase.from("notifications").insert([
      {
        user_id: userId,
        type,
        title,
        message,
        report_id: reportId,
        is_read: false,
      },
    ]);

    if (error) {
      console.error("Supabase create notification error:", error);
    }
  } catch (error) {
    console.error("Create Notification Error:", error);
  }
};

const getProfileIdFromAuthUserId = async (authUserId) => {
  if (!authUserId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("getProfileIdFromAuthUserId error:", error);
    return null;
  }

  return data?.id || null;
};

const createReport = async (req, res) => {
  try {
    const { licencePlate, urgency, description } = req.body;

    const reporterAuthId = req.user?.id || null;

    if (!reporterProfileId) {
      console.log("❌ NO PROFILE FOUND — BLOCKING REPORT");

      return sendResponse(
        res,
        403,
        false,
        "Complete profile first before submitting report",
      );
    }

    console.log("📝 CREATE REPORT USER:", {
      reporterAuthId,
      reporterProfileId,
      email: req.user?.email,
      role: req.user?.role,
    });

    if (!licencePlate || !urgency || !description) {
      return sendResponse(
        res,
        400,
        false,
        "licencePlate, urgency and description are required",
      );
    }

    if (!allowedUrgency.includes(urgency)) {
      return sendResponse(res, 400, false, "Invalid urgency value");
    }

    const normalizedPlate = normalizePlate(licencePlate);

    let vehicleId = null;
    let receiverId = null;
    let vehicleName = null;
    let ownerFound = false;

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, owner_id, vehicle_name, licence_plate, vehicle_media")
      .eq("licence_plate", normalizedPlate)
      .maybeSingle();

    if (vehicleError) {
      console.error("Supabase vehicle lookup error:", vehicleError);
      return sendResponse(res, 500, false, vehicleError.message);
    }

    if (vehicle) {
      vehicleId = vehicle.id;
      vehicleName = vehicle.vehicle_name || null;

      if (vehicle.owner_id) {
        const ownerProfileId = await getProfileIdFromAuthUserId(
          vehicle.owner_id,
        );

        if (ownerProfileId) {
          receiverId = ownerProfileId;
          ownerFound = true;
        }
      }
    }

    const mediaUrls = [];
    const insuranceUrls = [];

    if (req.files?.medias?.length) {
      for (const file of req.files.medias) {
        const url = await uploadFileToSupabase(file, "report-media", "reports");
        if (url) mediaUrls.push(url);
      }
    }

    if (req.files?.insuranceCertificate?.length) {
      for (const file of req.files.insuranceCertificate) {
        const url = await uploadFileToSupabase(
          file,
          "reports",
          "insurance-documents",
        );
        if (url) insuranceUrls.push(url);
      }
    }

    const payload = {
      licence_plate: normalizedPlate,
      urgency,
      description: description.trim(),
      insurance_certificate: insuranceUrls,
      medias: mediaUrls,

      reporter_id: reporterProfileId,
      receiver_id: receiverId,
      vehicle_id: ownerFound ? vehicleId : null,

      plate_registered: ownerFound,
      flow_type: ownerFound ? "registered_plate" : "unregistered_plate",
      status: ownerFound ? "reported" : "pending_registration",

      is_anonymous: !reporterProfileId,
    };

    console.log("📦 REPORT PAYLOAD:", payload);

    const { data, error } = await supabase
      .from("reports")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Supabase create report error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    const gamification = await updateGamification(reporterProfileId);

    if (ownerFound && receiverId) {
      await createNotification({
        userId: receiverId,
        type: "owner_report_received",
        title: "New report received",
        message: `A report was submitted for your plate ${normalizedPlate}`,
        reportId: data.id,
      });
    }

    const { data: admins, error: adminsError } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminsError) {
      console.error("Supabase admin fetch error:", adminsError);
    }

    if (admins?.length) {
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: ownerFound
            ? "admin_report_linked"
            : "admin_unregistered_plate_report",
          title: ownerFound ? "Plate matched" : "Unregistered plate reported",
          message: ownerFound
            ? `Plate ${normalizedPlate} matched with a registered owner`
            : `Plate ${normalizedPlate} was reported but no owner was found`,
          reportId: data.id,
        });
      }
    }

    return sendResponse(res, 201, true, "Report created successfully", {
      ...data,
      mediaUrls,
      insuranceUrls,
      vehicleName,
      ownerFound,
      gamification,
    });
  } catch (error) {
    console.error("Create Report Error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to create report",
    );
  }
};

const getAllReports = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase get reports error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(res, 200, true, "Reports fetched successfully", data);
  } catch (error) {
    console.error("Get Reports Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch reports");
  }
};

const getSingleReport = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error || !data) {
      console.error("Supabase get single report error:", error);
      return sendResponse(res, 404, false, "Report not found");
    }

    let vehicleImage = "";
    let vehicleName = null;

    if (data.vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .select("vehicle_name, vehicle_media")
        .eq("id", data.vehicle_id)
        .maybeSingle();

      if (!vehicleError && vehicle) {
        vehicleName = vehicle.vehicle_name || null;

        const vehicleMediaArray = normalizeMediaArray(vehicle.vehicle_media);
        vehicleImage = vehicleMediaArray[0] || "";
      }
    }

    const mediaArray = normalizeMediaArray(data.medias);
    const reportImage = mediaArray[0] || vehicleImage || "";

    return sendResponse(res, 200, true, "Report fetched successfully", {
      ...data,
      vehicleName,
      vehicleImage,
      medias: mediaArray,
      image: reportImage,
    });
  } catch (error) {
    console.error("Get Single Report Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch report");
  }
};

const getSentReports = async (req, res) => {
  try {
    const authUserId = req.user?.id || req.params.userId || req.query.userId;

    const reporterProfileId =
      req.user?.profileId || (await getProfileIdFromAuthUserId(authUserId));

    console.log("📤 GET SENT REPORTS:", {
      authUserId,
      reporterProfileId,
      email: req.user?.email,
    });

    if (!reporterProfileId) {
      return sendResponse(
        res,
        200,
        true,
        "Sent reports fetched successfully",
        [],
      );
    }

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("reporter_id", reporterProfileId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase get sent reports error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(
      res,
      200,
      true,
      "Sent reports fetched successfully",
      data,
    );
  } catch (error) {
    console.error("Get Sent Reports Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch sent reports");
  }
};

const getReceivedReports = async (req, res) => {
  try {
    const authUserId = req.user?.id || req.params.userId || req.query.userId;

    const receiverProfileId =
      req.user?.profileId || (await getProfileIdFromAuthUserId(authUserId));

    console.log("📥 GET RECEIVED REPORTS:", {
      authUserId,
      receiverProfileId,
      email: req.user?.email,
    });

    if (!receiverProfileId) {
      return sendResponse(
        res,
        200,
        true,
        "Received reports fetched successfully",
        [],
      );
    }

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("receiver_id", receiverProfileId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase get received reports error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(
      res,
      200,
      true,
      "Received reports fetched successfully",
      data,
    );
  } catch (error) {
    console.error("Get Received Reports Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch received reports");
  }
};

const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const authUserId = req.user?.id || req.body.userId || null;
    const currentProfileId =
      req.user?.profileId || (await getProfileIdFromAuthUserId(authUserId));

    const currentUserRole = req.user?.role || null;

    if (!status) {
      return sendResponse(res, 400, false, "Status is required");
    }

    if (!allowedStatuses.includes(status)) {
      return sendResponse(res, 400, false, "Invalid status value");
    }

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (reportError || !report) {
      console.error(
        "Supabase get report for status update error:",
        reportError,
      );
      return sendResponse(res, 404, false, "Report not found");
    }

    const isOwner =
      report.receiver_id &&
      currentProfileId &&
      report.receiver_id === currentProfileId;

    const isReporter =
      report.reporter_id &&
      currentProfileId &&
      report.reporter_id === currentProfileId;

    const isAdmin = currentUserRole === "admin";

    if (!isOwner && !isReporter && !isAdmin) {
      return sendResponse(
        res,
        403,
        false,
        "Only related user or admin can update report status",
      );
    }

    const { data, error } = await supabase
      .from("reports")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update report status error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(
      res,
      200,
      true,
      "Report status updated successfully",
      data,
    );
  } catch (error) {
    console.error("Update Report Status Error:", error);
    return sendResponse(res, 500, false, "Failed to update report status");
  }
};

module.exports = {
  createReport,
  getAllReports,
  getSingleReport,
  getSentReports,
  getReceivedReports,
  updateReportStatus,
};
