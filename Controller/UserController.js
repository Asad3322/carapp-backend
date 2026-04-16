const sendResponse = require("../Utils/sendResponse");
const {
  getProfileService,
  updateProfileService,
  checkUsernameService,
  checkEmailService,
  checkPhoneService,
} = require("../Service/UserService");

const getProfile = async (req, res) => {
  try {
    const profile = await getProfileService(req.user.id);

    return sendResponse(res, 200, true, "Profile fetched successfully", profile);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

const updateProfile = async (req, res) => {
  try {
    const updatedProfile = await updateProfileService(req.user.id, req.body);

    return sendResponse(
      res,
      200,
      true,
      "Profile updated successfully",
      updatedProfile
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

const checkUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return sendResponse(res, 400, false, "username query is required");
    }

    const result = await checkUsernameService(username);
    return sendResponse(res, 200, true, "Username check completed", result);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

const checkEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return sendResponse(res, 400, false, "email query is required");
    }

    const result = await checkEmailService(email);
    return sendResponse(res, 200, true, "Email check completed", result);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

const checkPhone = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return sendResponse(res, 400, false, "phone query is required");
    }

    const result = await checkPhoneService(phone);
    return sendResponse(res, 200, true, "Phone check completed", result);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  checkUsername,
  checkEmail,
  checkPhone,
};