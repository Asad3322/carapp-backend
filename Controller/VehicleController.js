const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");
const uploadFileToSupabase = require("../Utils/uploadFileToSupabase");

const normalizePlate = (value = "") => value.trim().toUpperCase();

const normalizeVehicle = (vehicle) => ({
  ...vehicle,
  vehicle_media: Array.isArray(vehicle?.vehicle_media)
    ? vehicle.vehicle_media
    : [],
  insurance_certificate: Array.isArray(vehicle?.insurance_certificate)
    ? vehicle.insurance_certificate
    : [],
  image:
    Array.isArray(vehicle?.vehicle_media) && vehicle.vehicle_media.length > 0
      ? vehicle.vehicle_media[0]
      : "",
});

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

const linkOldReportsToOwner = async ({ authUserId, profileId, vehicleId, licencePlate }) => {
  try {
    if (!authUserId || !profileId || !vehicleId || !licencePlate) return;

    const { error } = await supabase
      .from("reports")
      .update({
        receiver_id: profileId,
        vehicle_id: vehicleId,
        plate_registered: true,
        flow_type: "registered_plate",
        status: "reported",
        updated_at: new Date().toISOString(),
      })
      .eq("licence_plate", normalizePlate(licencePlate))
      .is("receiver_id", null);

    if (error) {
      console.error("Auto-link old reports error:", error);
    }
  } catch (error) {
    console.error("linkOldReportsToOwner error:", error);
  }
};

// ================= CREATE VEHICLE (ONBOARDING - PUBLIC) =================
const createVehicleOnboarding = async (req, res) => {
  try {
    const { vehicleName, licencePlate } = req.body;

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
      owner_id: null,
      is_claimed: false,
      registration_source: "onboarding",
    };

    const { data, error } = await supabase
      .from("vehicles")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      console.error("Supabase create onboarding vehicle error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(
      res,
      201,
      true,
      "Vehicle created successfully",
      normalizeVehicle({
        ...data,
        vehicleMediaUrls,
        insuranceUrls,
        next_step: "account_creation",
      })
    );
  } catch (error) {
    console.error("Create Vehicle Onboarding Error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to create vehicle"
    );
  }
};

// ================= CREATE VEHICLE (AUTH USER) =================
const createVehicle = async (req, res) => {
  try {
    const { vehicleName, licencePlate } = req.body;

    const ownerAuthId = req.user?.id || null;
    const ownerProfileId =
      req.user?.profileId || (await getProfileIdFromAuthUserId(ownerAuthId));

    if (!ownerAuthId) {
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
      owner_id: ownerAuthId,
      is_claimed: true,
      registration_source: "registered_user",
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

    await linkOldReportsToOwner({
      authUserId: ownerAuthId,
      profileId: ownerProfileId,
      vehicleId: data.id,
      licencePlate: normalizedPlate,
    });

    return sendResponse(
      res,
      201,
      true,
      "Vehicle created successfully",
      normalizeVehicle({
        ...data,
        vehicleMediaUrls,
        insuranceUrls,
      })
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

// ================= CLAIM VEHICLE WITH AUTH =================
const claimVehicle = async (req, res) => {
  try {
    const { licencePlate, vehicleId } = req.body;

    const ownerAuthId = req.user?.id || null;
    const ownerProfileId =
      req.user?.profileId || (await getProfileIdFromAuthUserId(ownerAuthId));

    if (!ownerAuthId) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    if (!licencePlate && !vehicleId) {
      return sendResponse(
        res,
        400,
        false,
        "Licence plate or vehicleId is required"
      );
    }

    let query = supabase
      .from("vehicles")
      .update({
        owner_id: ownerAuthId,
        is_claimed: true,
        registration_source: "claimed_after_onboarding",
        updated_at: new Date().toISOString(),
      })
      .select("*");

    if (vehicleId) {
      query = query.eq("id", vehicleId);
    } else {
      query = query.eq("licence_plate", normalizePlate(licencePlate));
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return sendResponse(
        res,
        404,
        false,
        error?.message || "Vehicle not found"
      );
    }

    await linkOldReportsToOwner({
      authUserId: ownerAuthId,
      profileId: ownerProfileId,
      vehicleId: data.id,
      licencePlate: data.licence_plate,
    });

    return sendResponse(
      res,
      200,
      true,
      "Vehicle claimed successfully",
      normalizeVehicle(data)
    );
  } catch (error) {
    console.error("Claim Vehicle Error:", error);
    return sendResponse(res, 500, false, "Failed to claim vehicle");
  }
};

// ================= GET ALL VEHICLES =================
const getAllVehicles = async (req, res) => {
  try {
    const ownerAuthId = req.user?.id || null;

    if (!ownerAuthId) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("owner_id", ownerAuthId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase get vehicles error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(
      res,
      200,
      true,
      "Vehicles fetched successfully",
      (data || []).map(normalizeVehicle)
    );
  } catch (error) {
    console.error("Get Vehicles Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch vehicles");
  }
};

// ================= GET SINGLE VEHICLE =================
const getSingleVehicle = async (req, res) => {
  try {
    const ownerAuthId = req.user?.id || null;

    if (!ownerAuthId) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", ownerAuthId)
      .maybeSingle();

    if (error || !data) {
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
  createVehicleOnboarding,
  createVehicle,
  claimVehicle,
  getAllVehicles,
  getSingleVehicle,
};