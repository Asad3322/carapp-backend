const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");
const uploadFileToSupabase = require("../Utils/uploadFileToSupabase");

// ================= CREATE VEHICLE (ONBOARDING) =================
const createVehicleOnboarding = async (req, res) => {
  try {
    const { vehicleName, licencePlate } = req.body;

    if (!vehicleName || !licencePlate) {
      return sendResponse(res, 400, false, "vehicleName and licencePlate are required");
    }

    const normalizedPlate = licencePlate.trim().toUpperCase();

    let mediaUrls = [];
    let insuranceUrls = [];

    if (req.files?.vehicleMedia) {
      for (const file of req.files.vehicleMedia) {
        const url = await uploadFileToSupabase(file, "vehicles", "vehicle-media");
        mediaUrls.push(url);
      }
    }

    if (req.files?.insuranceDocument) {
      for (const file of req.files.insuranceDocument) {
        const url = await uploadFileToSupabase(file, "vehicles", "vehicle-media");
        insuranceUrls.push(url);
      }
    }

    const { data, error } = await supabase
      .from("vehicles")
      .insert([
        {
          vehicle_name: vehicleName,
          licence_plate: normalizedPlate,
          vehicle_media: mediaUrls,
          insurance_document: insuranceUrls,
          owner_id: null,
          is_claimed: false,
          registration_source: "onboarding",
        },
      ])
      .select()
      .single();

    if (error) {
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(res, 201, true, "Vehicle created successfully", data);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= CREATE VEHICLE (AUTH USER) =================
const createVehicle = async (req, res) => {
  try {
    const { vehicleName, licencePlate } = req.body;
    const userId = req.user.id;

    if (!vehicleName || !licencePlate) {
      return sendResponse(res, 400, false, "vehicleName and licencePlate are required");
    }

    const normalizedPlate = licencePlate.trim().toUpperCase();

    const { data, error } = await supabase
      .from("vehicles")
      .insert([
        {
          vehicle_name: vehicleName,
          licence_plate: normalizedPlate,
          owner_id: userId,
          is_claimed: true,
        },
      ])
      .select()
      .single();

    if (error) {
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(res, 201, true, "Vehicle created successfully", data);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= CLAIM VEHICLE =================
const claimVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("vehicles")
      .update({
        owner_id: userId,
        is_claimed: true,
      })
      .eq("id", vehicleId)
      .select()
      .single();

    if (error) {
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(res, 200, true, "Vehicle claimed successfully", data);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= GET ALL =================
const getAllVehicles = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("owner_id", userId);

    if (error) {
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(res, 200, true, "Vehicles fetched", data);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= GET SINGLE =================
const getSingleVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(res, 200, true, "Vehicle fetched", data);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

module.exports = {
  createVehicleOnboarding,
  createVehicle,
  claimVehicle,
  getAllVehicles,
  getSingleVehicle,
};