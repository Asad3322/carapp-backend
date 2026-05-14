const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const authMiddleware = require("../Middleware/authMiddleware");

const {sendVerification, verifyPhoneMagicLink, createProfileAfterAuth} = require("../Controller/AuthController");

const supabase = require("../Config/supabaseClient");
const sendResponse = require("../Utils/sendResponse");

const OWNER_ACCESS_SECRET = process.env.OWNER_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

const verifyOwnerAccessToken = (token) => {
    if (!token || !OWNER_ACCESS_SECRET) return null;

    const [payloadBase64, signature] = token.split(".");
    if (!payloadBase64 || !signature) return null;

    const expectedSignature = crypto.createHmac("sha256", OWNER_ACCESS_SECRET).update(payloadBase64).digest("hex");

    if (signature !== expectedSignature) return null;

    let payload;

    try {
        payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString());
    } catch {
        return null;
    }

    if (!payload?.profileId || payload?.role !== "vehicle_owner") return null;
    if (payload?.exp && Date.now() > payload.exp) return null;

    return payload;
};

const flexibleMeAuth = async (req, res, next) => {
    const bearerToken = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;

    if (bearerToken) {
        return authMiddleware(req, res, next);
    }

    const ownerAccessToken = req.headers["x-owner-access-token"] || req.headers["owner-access-token"];

    const ownerPayload = verifyOwnerAccessToken(ownerAccessToken);

    if (!ownerPayload) {
        return sendResponse(res, 401, false, "Unauthorized");
    }

    req.ownerAccess = ownerPayload;
    return next();
};

router.post("/send-verification", sendVerification);
router.get("/verify-phone-link", verifyPhoneMagicLink);
router.post("/create-profile", async (req, res, next) => {
    const bearerToken = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;

    if (bearerToken) {
        return authMiddleware(req, res, () => createProfileAfterAuth(req, res));
    }

    const ownerAccessToken = req.headers["x-owner-access-token"] || req.headers["owner-access-token"];

    const ownerPayload = verifyOwnerAccessToken(ownerAccessToken);

    if (!ownerPayload?.profileId) {
        return sendResponse(res, 401, false, "Unauthorized");
    }

    try {
        const {username, name, email, phone, profileImage, avatar_url} = req.body;

        const updatePayload = {
            updated_at: new Date().toISOString(),
        };

        if (username) updatePayload.username = username;
        if (name) updatePayload.name = name;
        if (email) updatePayload.email = email;
        if (phone) updatePayload.phone = phone;
        if (profileImage || avatar_url) {
            updatePayload.avatar_url = avatar_url || profileImage;
        }

        const {data: profile, error} = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", ownerPayload.profileId)
        .select("*")
        .maybeSingle();

        if (error) {
            return sendResponse(res, 400, false, error.message);
        }

        return sendResponse(res, 200, true, "Owner profile updated successfully", {
            profile,
        });
    } catch (error) {
        return sendResponse(res, 500, false, error.message || "Owner profile update failed");
    }
});

router.get("/me", flexibleMeAuth, async (req, res) => {
    try {
        if (req.ownerAccess?.profileId) {
            const {data: profile, error} = await supabase
            .from("profiles")
            .select("*")
            .eq("id", req.ownerAccess.profileId)
            .maybeSingle();

            if (error) {
                return sendResponse(res, 400, false, error.message);
            }

            if (!profile) {
                return sendResponse(res, 404, false, "Owner profile not found");
            }

            return sendResponse(res, 200, true, "Owner fetched successfully", {
                auth: {
                    id: profile.auth_user_id || profile.id,
                    phone: profile.phone || req.ownerAccess.phone || null,
                    email: profile.email || null,
                    role: "vehicle_owner",
                    isOwnerAccess: true,
                },
                profile,
            });
        }

        const {data: profile, error} = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", req.user.id)
        .maybeSingle();

        if (error) {
            return sendResponse(res, 400, false, error.message);
        }

        return sendResponse(res, 200, true, "User fetched successfully", {
            auth: req.user,
            profile,
        });
    } catch (err) {
        return sendResponse(res, 500, false, "Server error", err.message);
    }
});

module.exports = router;
