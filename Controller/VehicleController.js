const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");
const uploadFileToSupabase = require("../Utils/uploadFileToSupabase");

const normalizePlate = (value = "") => value.trim().toUpperCase();

const normalizeVehicle = (vehicle) => ({
  ...vehicle,
  vehicle_media: Array.isArray(vehicle?.vehicle_media) ? vehicle.vehicle_media : [],
  insurance_certificate: Array.isArray(vehicle?.insurance_certificate)
    ? vehicle.insurance_certificate
    : [],
  image:
    Array.isArray(vehicle?.vehicle_media) && vehicle.vehicle_media.length > 0
      ? vehicle.vehicle_media[0]
      : "",
});

const createVehicle = async (req, res) => {
  try {
    const { vehicleName, licencePlate } = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    if (!vehicleName || !licencePlate) {
      return sendResponse(
        res,
        400,
        false,
        "vehicleName and licencePlate are required"
      );
    }

    const normalizedPlate = normalizePlate(licencePlate);

    const { data: existingVehicle, error: findError } = await supabase
      .from("vehicles")
      .select("id, licence_plate")
      .eq("licence_plate", normalizedPlate)
      .maybeSingle();

    if (findError) {
      console.error("Supabase vehicle lookup error:", findError);
      return sendResponse(res, 500, false, findError.message);
    }

    if (existingVehicle) {
      return sendResponse(res, 409, false, "Licence Plate already exists");
    }

    const vehicleMediaUrls = [];
    const insuranceUrls = [];

    if (req.files?.vehicleMedia?.length) {
      for (const file of req.files.vehicleMedia) {
        const url = await uploadFileToSupabase(
          file,
          "vehicles",
          "vehicle-media"
        );
        vehicleMediaUrls.push(url);
      }
    }

    if (req.files?.insuranceDocument?.length) {
      for (const file of req.files.insuranceDocument) {
        const url = await uploadFileToSupabase(
          file,
          "vehicles",
          "insurance-documents"
        );
        insuranceUrls.push(url);
      }
    }

    const payload = {
      vehicle_name: vehicleName.trim(),
      licence_plate: normalizedPlate,
      vehicle_media: vehicleMediaUrls,
      insurance_certificate: insuranceUrls,
      owner_id: ownerId,
    };

    const { data, error } = await supabase
      .from("vehicles")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      console.error("Supabase create vehicle error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    const responseData = normalizeVehicle({
      ...data,
      vehicle_media:
        Array.isArray(data?.vehicle_media) && data.vehicle_media.length
          ? data.vehicle_media
          : vehicleMediaUrls,
      insurance_certificate:
        Array.isArray(data?.insurance_certificate) &&
        data.insurance_certificate.length
          ? data.insurance_certificate
          : insuranceUrls,
      vehicleMediaUrls,
      insuranceUrls,
    });

    console.log("FINAL VEHICLE RESPONSE:", responseData);

    return sendResponse(
      res,
      201,
      true,
      "Vehicle created successfully",
      responseData
    );
  } catch (error) {
    console.error("Create Vehicle Error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to create vehicle"
    );
  }
};

const getAllVehicles = async (req, res) => {
  try {
    const ownerId = req.user?.id;

    if (!ownerId) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase get vehicles error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    const normalizedVehicles = (data || []).map(normalizeVehicle);

    return sendResponse(
      res,
      200,
      true,
      "Vehicles fetched successfully",
      normalizedVehicles
    );
  } catch (error) {
    console.error("Get Vehicles Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch vehicles");
  }
};

const getSingleVehicle = async (req, res) => {
  try {
    const ownerId = req.user?.id;

    if (!ownerId) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (error) {
      console.error("Supabase get single vehicle error:", error);
      return sendResponse(res, 404, false, "Vehicle not found");
    }

    if (!data) {
      return sendResponse(res, 404, false, "Vehicle not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Vehicle fetched successfully",
      normalizeVehicle(data)
    );
  } catch (error) {
    console.error("Get Single Vehicle Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch vehicle");
  }
};

module.exports = {
  createVehicle,
  getAllVehicles,
  getSingleVehicle,
};