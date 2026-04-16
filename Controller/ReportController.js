const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");
const uploadFileToSupabase = require("../Utils/uploadFileToSupabase");

const allowedUrgency = ["urgent", "medium", "not_urgent"];

const normalizePlate = (value = "") => value.trim().toUpperCase();

const createReport = async (req, res) => {
  try {
    const {
      licencePlate,
      urgency,
      description,
      reporterId = null,
    } = req.body;

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

    const mediaUrls = [];
    const insuranceUrls = [];

    if (req.files?.medias?.length) {
      for (const file of req.files.medias) {
        const url = await uploadFileToSupabase(
          file,
          "reports",
          "report-media"
        );
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
      licence_plate: normalizePlate(licencePlate),
      urgency,
      description: description.trim(),
      insurance_certificate: insuranceUrls,
      medias: mediaUrls,
      reporter_id: reporterId || null,
      is_anonymous: !reporterId,
      status: "submitted",
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

    return sendResponse(res, 201, true, "Report created successfully", {
      ...data,
      mediaUrls,
      insuranceUrls,
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

module.exports = {
  createReport,
  getAllReports,
  getSingleReport,
};