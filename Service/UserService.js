const supabase = require("../Config/supabaseClient");

const getProfileService = async (authUserId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Profile not found");
  }

  return data;
};

const updateProfileService = async (authUserId, payload) => {
  const { data: currentProfile, error: currentError } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }

  if (!currentProfile) {
    throw new Error("Profile not found");
  }

  if (payload.username && payload.username !== currentProfile.username) {
    const { data: usernameExists, error: usernameError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", payload.username)
      .neq("auth_user_id", authUserId)
      .maybeSingle();

    if (usernameError) {
      throw new Error(usernameError.message);
    }

    if (usernameExists) {
      throw new Error("Username already taken");
    }
  }

  if (payload.email && payload.email !== currentProfile.email) {
    const normalizedEmail = payload.email.toLowerCase().trim();

    const { data: emailExists, error: emailError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .neq("auth_user_id", authUserId)
      .maybeSingle();

    if (emailError) {
      throw new Error(emailError.message);
    }

    if (emailExists) {
      throw new Error("Email already taken");
    }

    payload.email = normalizedEmail;
  }

  if (payload.phone && payload.phone !== currentProfile.phone) {
    const { data: phoneExists, error: phoneError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", payload.phone)
      .neq("auth_user_id", authUserId)
      .maybeSingle();

    if (phoneError) {
      throw new Error(phoneError.message);
    }

    if (phoneExists) {
      throw new Error("Phone already taken");
    }
  }

  const updatePayload = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("auth_user_id", authUserId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

const checkUsernameService = async (username) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return { available: !data };
};

const checkEmailService = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return { available: !data };
};

const checkPhoneService = async (phone) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return { available: !data };
};

module.exports = {
  getProfileService,
  updateProfileService,
  checkUsernameService,
  checkEmailService,
  checkPhoneService,
};