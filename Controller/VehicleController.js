const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");
const uploadFileToSupabase = require("../Utils/uploadFileToSupabase");

// "ABC 123" and "ABC123" become same plate
const normalizePlate = (value = "") =>
  String(value).replace(/\s+/g, "").trim().toUpperCase();

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

const getOwnerContext = async (req) => {
  const ownerAuthId = req.user?.id || null;
  const ownerProfileId =
    req.user?.profileId || (await getProfileIdFromAuthUserId(ownerAuthId));

  return {
    ownerAuthId,
    ownerProfileId,
    isOwnerAccess: Boolean(req.user?.isOwnerAccess),
  };
};

const uploadVehicleFiles = async (files) => {
  const vehicleMediaUrls = [];
  const insuranceUrls = [];

  if (files?.vehicleMedia?.length) {
    for (const file of files.vehicleMedia) {
      const url = await uploadFileToSupabase(file, "vehicle-media", "vehicles");
      if (url) vehicleMediaUrls.push(url);
    }
  }

  if (files?.insuranceDocument?.length) {
    for (const file of files.insuranceDocument) {
      const url = await uploadFileToSupabase(
        file,
        "insurance-documents",
        "vehicles",
      );
      if (url) insuranceUrls.push(url);
    }
  }

  return { vehicleMediaUrls, insuranceUrls };
};

const findVehicleByPlate = async (normalizedPlate) => {
  let result = await supabase
    .from("vehicles")
    .select("*")
    .eq("normalized_plate", normalizedPlate)
    .maybeSingle();

  if (result.error && result.error.message?.includes("normalized_plate")) {
    console.warn(
      "normalized_plate column missing, falling back to licence_plate lookup",
    );

    result = await supabase
      .from("vehicles")
      .select("*")
      .eq("licence_plate", normalizedPlate)
      .maybeSingle();
  }

  return result;
};

const linkOldReportsToOwner = async ({ profileId, vehicleId, licencePlate }) => {
  try {
    if (!profileId || !vehicleId || !licencePlate) return;

    const normalizedPlate = normalizePlate(licencePlate);

    const { data, error } = await supabase
      .from("reports")
      .update({
        receiver_id: profileId,
        vehicle_id: vehicleId,
        plate_registered: true,
        flow_type: "registered_plate",
        status: "reported",
        updated_at: new Date().toISOString(),
      })
      .eq("normalized_plate", normalizedPlate)
      .is("receiver_id", null)
      .select("*");

    if (error) {
      console.error("Auto-link old reports error:", error);
      return;
    }

    console.log("Old reports linked:", data?.length || 0);
  } catch (error) {
    console.error("linkOldReportsToOwner error:", error);
  }
};

// ================= CREATE VEHICLE ONBOARDING PUBLIC =================
const createVehicleOnboarding = async (req, res) => {
  try {
    const { vehicleName, licencePlate } = req.body;

    if (!vehicleName || !licencePlate) {
      return sendResponse(
        res,
        400,
        false,
        "vehicleName and licencePlate are required",
      );
    }

    const normalizedPlate = normalizePlate(licencePlate);

    const { data: existingVehicle, error: findError } =
      await findVehicleByPlate(normalizedPlate);

    if (findError) {
      console.error("Supabase vehicle lookup error:", findError);
      return sendResponse(res, 500, false, findError.message);
    }

    if (existingVehicle) {
      return sendResponse(res, 409, false, "Licence Plate already exists");
    }

    const { vehicleMediaUrls, insuranceUrls } = await uploadVehicleFiles(
      req.files,
    );

    const payload = {
      vehicle_name: vehicleName.trim(),
      licence_plate: normalizedPlate,
      normalized_plate: normalizedPlate,
      vehicle_media: vehicleMediaUrls,
      insurance_certificate: insuranceUrls,
      owner_id: null,
      is_claimed: false,
      registration_source: "onboarding",
      updated_at: new Date().toISOString(),
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
      }),
    );
  } catch (error) {
    console.error("Create Vehicle Onboarding Error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to create vehicle",
    );
  }
};

// ================= CREATE VEHICLE AUTH / OWNER ACCESS =================
const createVehicle = async (req, res) => {
  try {
    const { vehicleName, licencePlate } = req.body;
    const { ownerAuthId, ownerProfileId, isOwnerAccess } =
      await getOwnerContext(req);

    if (!ownerAuthId && !isOwnerAccess) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    if (!ownerProfileId) {
      return sendResponse(res, 404, false, "Owner profile not found");
    }

    if (!vehicleName || !licencePlate) {
      return sendResponse(
        res,
        400,
        false,
        "vehicleName and licencePlate are required",
      );
    }

    const normalizedPlate = normalizePlate(licencePlate);

    const { data: existingVehicle, error: findError } =
      await findVehicleByPlate(normalizedPlate);

    if (findError) {
      console.error("Supabase vehicle lookup error:", findError);
      return sendResponse(res, 500, false, findError.message);
    }

    if (existingVehicle) {
      return sendResponse(res, 409, false, "Licence Plate already exists");
    }

    const { vehicleMediaUrls, insuranceUrls } = await uploadVehicleFiles(
      req.files,
    );

    const payload = {
      vehicle_name: vehicleName.trim(),
      licence_plate: normalizedPlate,
      normalized_plate: normalizedPlate,
      vehicle_media: vehicleMediaUrls,
      insurance_certificate: insuranceUrls,
      owner_id: ownerProfileId,
      is_claimed: true,
      registration_source: "registered_user",
      updated_at: new Date().toISOString(),
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
      }),
    );
  } catch (error) {
    console.error("Create Vehicle Error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to create vehicle",
    );
  }
};

// ================= CLAIM VEHICLE =================
const claimVehicle = async (req, res) => {
  try {
    const { licencePlate, vehicleId } = req.body;
    const { ownerAuthId, ownerProfileId, isOwnerAccess } =
      await getOwnerContext(req);

    if (!ownerAuthId && !isOwnerAccess) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    if (!ownerProfileId) {
      return sendResponse(res, 404, false, "Owner profile not found");
    }

    if (!licencePlate && !vehicleId) {
      return sendResponse(
        res,
        400,
        false,
        "Licence plate or vehicleId is required",
      );
    }

    let vehicle = null;
    let findError = null;

    if (vehicleId) {
      const result = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .maybeSingle();

      vehicle = result.data;
      findError = result.error;
    } else {
      const normalizedPlate = normalizePlate(licencePlate);
      const result = await findVehicleByPlate(normalizedPlate);

      vehicle = result.data;
      findError = result.error;
    }

    if (findError) {
      console.error("Find vehicle before claim error:", findError);
      return sendResponse(res, 500, false, findError.message);
    }

    if (!vehicle) {
      return sendResponse(res, 404, false, "Vehicle not found");
    }

    if (vehicle.owner_id && vehicle.owner_id !== ownerProfileId) {
      return sendResponse(
        res,
        409,
        false,
        "This vehicle is already claimed by another owner",
      );
    }

    const normalizedPlate = normalizePlate(vehicle.licence_plate);

    const { data, error } = await supabase
      .from("vehicles")
      .update({
        owner_id: ownerProfileId,
        normalized_plate: normalizedPlate,
        is_claimed: true,
        registration_source: "claimed_after_onboarding",
        updated_at: new Date().toISOString(),
      })
      .eq("id", vehicle.id)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return sendResponse(
        res,
        404,
        false,
        error?.message || "Vehicle not found",
      );
    }

    await linkOldReportsToOwner({
      profileId: ownerProfileId,
      vehicleId: data.id,
      licencePlate: data.licence_plate,
    });

    return sendResponse(
      res,
      200,
      true,
      "Vehicle claimed successfully",
      normalizeVehicle(data),
    );
  } catch (error) {
    console.error("Claim Vehicle Error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to claim vehicle",
    );
  }
};

// ================= GET ALL VEHICLES =================
const getAllVehicles = async (req, res) => {
  try {
    const { ownerAuthId, ownerProfileId, isOwnerAccess } =
      await getOwnerContext(req);

    if (!ownerAuthId && !isOwnerAccess) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    if (!ownerProfileId) {
      return sendResponse(res, 404, false, "Owner profile not found");
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("owner_id", ownerProfileId)
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
      (data || []).map(normalizeVehicle),
    );
  } catch (error) {
    console.error("Get Vehicles Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch vehicles");
  }
};

// ================= GET SINGLE VEHICLE =================
const getSingleVehicle = async (req, res) => {
  try {
    const { ownerAuthId, ownerProfileId, isOwnerAccess } =
      await getOwnerContext(req);

    if (!ownerAuthId && !isOwnerAccess) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    if (!ownerProfileId) {
      return sendResponse(res, 404, false, "Owner profile not found");
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", ownerProfileId)
      .maybeSingle();

    if (error || !data) {
      return sendResponse(res, 404, false, "Vehicle not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Vehicle fetched successfully",
      normalizeVehicle(data),
    );
  } catch (error) {
    console.error("Get Single Vehicle Error:", error);
    return sendResponse(res, 500, false, "Failed to fetch vehicle");
  }
};

// ================= UPDATE VEHICLE =================
const updateVehicle = async (req, res) => {
  try {
    const { ownerAuthId, ownerProfileId, isOwnerAccess } =
      await getOwnerContext(req);

    if (!ownerAuthId && !isOwnerAccess) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    if (!ownerProfileId) {
      return sendResponse(res, 404, false, "Owner profile not found");
    }

    const { vehicleName, licencePlate } = req.body;

    const { data: existingVehicle, error: existingError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", ownerProfileId)
      .maybeSingle();

    if (existingError || !existingVehicle) {
      return sendResponse(res, 404, false, "Vehicle not found");
    }

    const { vehicleMediaUrls, insuranceUrls } = await uploadVehicleFiles(
      req.files,
    );

    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (vehicleName) updatePayload.vehicle_name = vehicleName.trim();

    if (licencePlate) {
      const normalizedPlate = normalizePlate(licencePlate);

      let duplicateResult = await supabase
        .from("vehicles")
        .select("id")
        .eq("normalized_plate", normalizedPlate)
        .neq("id", req.params.id)
        .maybeSingle();

      if (
        duplicateResult.error &&
        duplicateResult.error.message?.includes("normalized_plate")
      ) {
        duplicateResult = await supabase
          .from("vehicles")
          .select("id")
          .eq("licence_plate", normalizedPlate)
          .neq("id", req.params.id)
          .maybeSingle();
      }

      if (duplicateResult.error) {
        return sendResponse(res, 500, false, duplicateResult.error.message);
      }

      if (duplicateResult.data) {
        return sendResponse(res, 409, false, "Licence Plate already exists");
      }

      updatePayload.licence_plate = normalizedPlate;
      updatePayload.normalized_plate = normalizedPlate;
    }

    if (vehicleMediaUrls.length > 0) {
      updatePayload.vehicle_media = vehicleMediaUrls;
    }

    if (insuranceUrls.length > 0) {
      updatePayload.insurance_certificate = insuranceUrls;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update(updatePayload)
      .eq("id", req.params.id)
      .eq("owner_id", ownerProfileId)
      .select("*")
      .single();

    if (error) {
      console.error("Update vehicle error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    if (updatePayload.licence_plate) {
      await linkOldReportsToOwner({
        profileId: ownerProfileId,
        vehicleId: data.id,
        licencePlate: updatePayload.licence_plate,
      });
    }

    return sendResponse(
      res,
      200,
      true,
      "Vehicle updated successfully",
      normalizeVehicle(data),
    );
  } catch (error) {
    console.error("Update Vehicle Error:", error);
    return sendResponse(res, 500, false, "Failed to update vehicle");
  }
};

// ================= DELETE VEHICLE =================
const deleteVehicle = async (req, res) => {
  try {
    const { ownerAuthId, ownerProfileId, isOwnerAccess } =
      await getOwnerContext(req);

    if (!ownerAuthId && !isOwnerAccess) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    if (!ownerProfileId) {
      return sendResponse(res, 404, false, "Owner profile not found");
    }

    const { data: vehicle, error: findError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", ownerProfileId)
      .maybeSingle();

    if (findError || !vehicle) {
      return sendResponse(res, 404, false, "Vehicle not found");
    }

    await supabase
      .from("reports")
      .update({
        receiver_id: null,
        vehicle_id: null,
        plate_registered: false,
        flow_type: "unregistered_plate",
        status: "pending_registration",
        updated_at: new Date().toISOString(),
      })
      .eq("vehicle_id", req.params.id);

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", req.params.id)
      .eq("owner_id", ownerProfileId);

    if (error) {
      console.error("Delete vehicle error:", error);
      return sendResponse(res, 500, false, error.message);
    }

    return sendResponse(
      res,
      200,
      true,
      "Vehicle deleted successfully",
      vehicle,
    );
  } catch (error) {
    console.error("Delete Vehicle Error:", error);
    return sendResponse(res, 500, false, "Failed to delete vehicle");
  }
};

module.exports = {
  createVehicleOnboarding,
  createVehicle,
  claimVehicle,
  getAllVehicles,
  getSingleVehicle,
  updateVehicle,
  deleteVehicle,
};