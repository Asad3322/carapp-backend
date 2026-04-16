const supabase = require("../Config/supabaseClient");

const sendVerificationService = async ({ contact, role }) => {
  const isEmail = contact.includes("@");

  if (!isEmail) {
    throw new Error("Only email verification is enabled right now in dev mode");
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email: contact.toLowerCase().trim(),
    options: {
      emailRedirectTo: `${process.env.CLIENT_URL}/verify`,
      data: {
        role: role || "reporter",
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    contact,
    role: role || "reporter",
    data,
  };
};

const getUserByEmailService = async (email) => {
  if (!email) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

module.exports = {
  sendVerificationService,
  getUserByEmailService,
};