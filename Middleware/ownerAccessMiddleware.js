const supabase = require("../Config/supabaseClient");
const crypto = require("crypto");

const OWNER_ACCESS_SECRET =
  process.env.OWNER_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

const verifyOwnerToken = (token) => {
  if (!token || !OWNER_ACCESS_SECRET) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", OWNER_ACCESS_SECRET)
    .update(payloadBase64)
    .digest("hex");

  if (signature !== expectedSignature) return null;

  const payload = JSON.parse(
    Buffer.from(payloadBase64, "base64url").toString("utf8")
  );

  if (payload.exp && Date.now() > payload.exp) return null;

  return payload;
};

const ownerAccessMiddleware = async (req, res, next) => {
  try {
    const token =
      req.headers["x-owner-access-token"] ||
      req.headers["owner-access-token"];

    const payload = verifyOwnerToken(token);

    if (!payload?.profileId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid owner access",
      });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, phone, role")
      .eq("id", payload.profileId)
      .eq("role", "vehicle_owner")
      .maybeSingle();

    if (error || !profile) {
      return res.status(401).json({
        success: false,
        message: "Owner profile not found",
      });
    }

    req.user = {
      id: null,
      email: null,
      phone: profile.phone,
      profileId: profile.id,
      profileRole: "vehicle_owner",
      profilePhone: profile.phone,
      isOwnerAccess: true,
    };

    next();
  } catch (err) {
    console.error("Owner Access Middleware Error:", err);
    return res.status(401).json({
      success: false,
      message: "Unauthorized owner access",
    });
  }
};

module.exports = ownerAccessMiddleware;