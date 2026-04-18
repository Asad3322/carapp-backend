const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");
const uploadFileToSupabase = require("../Utils/uploadFileToSupabase");

const allowedUrgency = ["urgent", "medium", "not_urgent"];
const allowedStatuses = ["reported", "seen", "resolved", "pending_registration"];

const normalizePlate = (value = "") => value.trim().toUpperCase();

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

const createReport = async (req, res) => {
  try {
    const { licencePlate, urgency, description } = req.body;

    const reporterId = req.user?.id || req.body.reporterId || null;

    if (!licencePlate || !urgency || !description) {
      return sendResponse(
        res,
        400,
        false,
        "licencePlate, urgency and description are required"
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
      .select("id, owner_id, vehicle_name, licence_plate")
      .eq("licence_plate", normalizedPlate)
      .maybeSingle();

    if (vehicleError) {
      console.error("Supabase vehicle lookup error:", vehicleError);
      return sendResponse(res, 500, false, vehicleError.message);
    }

    if (vehicle) {
      vehicleId = vehicle.id;
      receiverId = vehicle.owner_id || null;
      vehicleName = vehicle.vehicle_name || null;
      ownerFound = !!vehicle.owner_id;
    }

    const mediaUrls = [];
    const insuranceUrls = [];

    if (req.files?.medias?.length) {
      for (const file of req.files.medias) {
        const url = await uploadFileToSupabase(file, "reports", "report-media");
        mediaUrls.push(url);
      }
    }

    if (req.files?.insuranceCertificate?.length) {
      for (const file of req.files.insuranceCertificate) {
        const url = await uploadFileToSupabase(
          file,
          "reports",
          "insurance-documents"
        );
        insuranceUrls.push(url);
      }
    }

    const payload = {
      licence_plate: normalizedPlate,
      urgency,
      description: description.trim(),
      insurance_certificate: insuranceUrls,
      medias: mediaUrls,

      reporter_id: reporterId,
      receiver_id: ownerFound ? receiverId : null,
      vehicle_id: ownerFound ? vehicleId : null,

      plate_registered: !!vehicleId,
      flow_type: ownerFound ? "registered_plate" : "unregistered_plate",
      status: ownerFound ? "reported" : "pending_registration",

      is_anonymous: !reporterId,
    };

    const { data, error } = await supabase
      .from("reports")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Supabase create report error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    // Notify owner ONLY if owner actually exists on matched vehicle
    if (ownerFound && receiverId) {
      await createNotification({
        userId: receiverId,
        type: "owner_report_received",
        title: "New report received",
        message: `A report was submitted for your plate ${normalizedPlate}`,
        reportId: data.id,
      });
    }

    // Notify admin ALWAYS
    // Change "profiles" to your actual users table if needed
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
    });
  } catch (error) {
    console.error("Create Report Error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to create report"
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
      .single();

    if (error) {
      console.error("Supabase get single report error:", error);
      return sendResponse(res, 404, false, "Report not found");
    }

    return sendResponse(res, 200, true, "Report fetched successfully", data);
  } catch (error) {
    console.error("Get Single Report Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch report");
  }
};

const getSentReports = async (req, res) => {
  try {
    const reporterId = req.user?.id || req.params.userId || req.query.userId;

    if (!reporterId) {
      return sendResponse(res, 400, false, "Reporter id is required");
    }

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("reporter_id", reporterId)
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
      data
    );
  } catch (error) {
    console.error("Get Sent Reports Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch sent reports");
  }
};

const getReceivedReports = async (req, res) => {
  try {
    const receiverId = req.user?.id || req.params.userId || req.query.userId;

    if (!receiverId) {
      return sendResponse(res, 400, false, "Receiver id is required");
    }

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("receiver_id", receiverId)
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
      data
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
    const currentUserId = req.user?.id || req.body.userId || null;
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
      .single();

    if (reportError || !report) {
      console.error("Supabase get report for status update error:", reportError);
      return sendResponse(res, 404, false, "Report not found");
    }

    const isOwner = report.receiver_id && currentUserId && report.receiver_id === currentUserId;
    const isAdmin = currentUserRole === "admin";

    if (!isOwner && !isAdmin) {
      return sendResponse(
        res,
        403,
        false,
        "Only owner or admin can update report status"
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
      data
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