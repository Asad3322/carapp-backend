const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");
const uploadFileToSupabase = require("../Utils/uploadFileToSupabase");

const normalizePlate = (value = "") => value.trim().toUpperCase();
const normalizePhone = (value = "") => String(value).replace(/\s/g, "");

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

    const responseData = normalizeVehicle({
      ...data,
      vehicle_media: data?.vehicle_media?.length
        ? data.vehicle_media
        : vehicleMediaUrls,
      insurance_certificate: data?.insurance_certificate?.length
        ? data.insurance_certificate
        : insuranceUrls,
      vehicleMediaUrls,
      insuranceUrls,
      next_step: "account_creation",
    });

    return sendResponse(
      res,
      201,
      true,
      "Vehicle created successfully",
      responseData
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

// ================= CREATE VEHICLE (POST-ONBOARDING - AUTH) =================
const createVehicle = async (req, res) => {
  try {
    const { vehicleName, licencePlate } = req.body;
    const ownerId = req.user?.id || null;

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

    try {
      await supabase
        .from("reports")
        .update({
          receiver_id: ownerId,
          vehicle_id: data.id,
          plate_registered: true,
          flow_type: "registered_plate",
          status: "reported",
          updated_at: new Date().toISOString(),
        })
        .eq("licence_plate", normalizedPlate)
        .is("receiver_id", null);
    } catch (linkError) {
      console.error("Auto-link old reports error:", linkError);
    }

    const responseData = normalizeVehicle({
      ...data,
      vehicle_media: data?.vehicle_media?.length
        ? data.vehicle_media
        : vehicleMediaUrls,
      insurance_certificate: data?.insurance_certificate?.length
        ? data.insurance_certificate
        : insuranceUrls,
      vehicleMediaUrls,
      insuranceUrls,
    });

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

// ================= CLAIM VEHICLE WITH AUTH =================
const claimVehicle = async (req, res) => {
  try {
    const { licencePlate } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 401, false, "Unauthorized");
    }

    if (!licencePlate) {
      return sendResponse(res, 400, false, "Licence plate is required");
    }

    const normalizedPlate = normalizePlate(licencePlate);

    const { data, error } = await supabase
      .from("vehicles")
      .update({
        owner_id: userId,
        is_claimed: true,
        registration_source: "claimed_after_onboarding",
        updated_at: new Date().toISOString(),
      })
      .eq("licence_plate", normalizedPlate)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return sendResponse(
        res,
        404,
        false,
        error?.message || "Vehicle not found"
      );
    }

    try {
      await supabase
        .from("reports")
        .update({
          receiver_id: userId,
          vehicle_id: data.id,
          plate_registered: true,
          flow_type: "registered_plate",
          status: "reported",
          updated_at: new Date().toISOString(),
        })
        .eq("licence_plate", normalizedPlate)
        .is("receiver_id", null);
    } catch (linkError) {
      console.error("Auto-link claimed vehicle reports error:", linkError);
    }

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

// ================= CLAIM VEHICLE BY OWNER PHONE (PUBLIC OWNER FLOW) =================
const claimVehicleByOwnerPhone = async (req, res) => {
  try {
    const { vehicleId, phone, username, name, profileImage } = req.body;

    if (!vehicleId || !phone) {
      return sendResponse(res, 400, false, "vehicleId and phone are required");
    }

    const cleanPhone = normalizePhone(phone);
    const safeUsername =
      username?.trim()?.toLowerCase() || `owner_${Date.now()}`;
    const safeName = name?.trim() || safeUsername;

    let { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (profileFetchError) {
      return sendResponse(res, 500, false, profileFetchError.message);
    }

    if (!profile) {
      const { data: createdProfile, error: createProfileError } = await supabase
        .from("profiles")
        .insert([
          {
            auth_user_id: null,
            name: safeName,
            username: safeUsername,
            phone: cleanPhone,
            email: null,
            role: "vehicle_owner",
            primary_contact: "SMS",
            avatar_url: profileImage || null,
            language: "French",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select("*")
        .single();

      if (createProfileError) {
        return sendResponse(res, 500, false, createProfileError.message);
      }

      profile = createdProfile;
    } else {
      await supabase
        .from("profiles")
        .update({
          name: safeName,
          username: safeUsername,
          role: "vehicle_owner",
          primary_contact: "SMS",
          avatar_url: profileImage || profile.avatar_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .update({
        owner_id: profile.id,
        is_claimed: true,
        registration_source: "claimed_by_phone_owner",
        updated_at: new Date().toISOString(),
      })
      .eq("id", vehicleId)
      .select("*")
      .maybeSingle();

    if (vehicleError || !vehicle) {
      return sendResponse(
        res,
        404,
        false,
        vehicleError?.message || "Vehicle not found"
      );
    }

    await supabase
      .from("reports")
      .update({
        receiver_id: profile.id,
        vehicle_id: vehicle.id,
        plate_registered: true,
        flow_type: "registered_plate",
        status: "reported",
        updated_at: new Date().toISOString(),
      })
      .eq("licence_plate", vehicle.licence_plate)
      .is("receiver_id", null);

    return sendResponse(res, 200, true, "Vehicle claimed by phone", {
      profile,
      vehicle: normalizeVehicle(vehicle),
    });
  } catch (error) {
    console.error("claimVehicleByOwnerPhone error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to claim vehicle"
    );
  }
};

// ================= GET VEHICLES BY OWNER PHONE (PUBLIC OWNER FLOW) =================
const getVehiclesByOwnerPhone = async (req, res) => {
  try {
    const phone = req.query.phone;

    if (!phone) {
      return sendResponse(res, 400, false, "phone is required");
    }

    const cleanPhone = normalizePhone(phone);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, phone")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (profileError) {
      return sendResponse(res, 500, false, profileError.message);
    }

    if (!profile) {
      return sendResponse(res, 200, true, "Vehicles fetched successfully", []);
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
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
    console.error("getVehiclesByOwnerPhone error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to fetch vehicles"
    );
  }
};

// ================= GET ALL VEHICLES =================
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

// ================= GET SINGLE VEHICLE =================
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
  claimVehicleByOwnerPhone,
  getVehiclesByOwnerPhone,
  getAllVehicles,
  getSingleVehicle,
};