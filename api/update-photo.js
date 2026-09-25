const cloudinary = require("../lib/cloudinary");
const { requireAuth } = require("../lib/cookieAuth");

function escapeContextValue(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/=/g, "\\=");
}

function buildContextString(fields) {
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${escapeContextValue(value ?? "")}`)
    .join("|");
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, process.env.SESSION_SECRET)) return;

  if (req.method !== "POST" && req.method !== "PATCH") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { publicId, title, dateTaken, location, note } = req.body || {};

  if (!publicId || !title || !dateTaken) {
    res.status(400).json({ error: "publicId, title, and dateTaken are required" });
    return;
  }

  const context = buildContextString({
    title,
    date_taken: dateTaken,
    location: location || "",
    note: note || "",
  });

  try {
    const result = await cloudinary.uploader.explicit(publicId, {
      type: "upload",
      context,
      tags: "koch-photo",
      invalidate: true,
    });
    res.status(200).json({ ok: true, publicId: result.public_id });
  } catch (e) {
    console.error("Update photo failed", e);
    res.status(500).json({ error: "Failed to update photo" });
  }
};
