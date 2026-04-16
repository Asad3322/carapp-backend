const path = require("path");
const crypto = require("crypto");
const supabase = require("../Config/supabaseClient");

const uploadFileToSupabase = async (
  file,
  folder = "uploads",
  bucket = "reports"
) => {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    const ext = path.extname(file.originalname);
    const fileName = `${folder}/${Date.now()}-${crypto.randomUUID()}${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);

    if (!data?.publicUrl) {
      throw new Error("Failed to generate public URL");
    }

    return data.publicUrl;
  } catch (error) {
    console.error("uploadFileToSupabase error:", error);
    throw error;
  }
};

module.exports = uploadFileToSupabase;