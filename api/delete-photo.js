const cloudinary = require("../lib/cloudinary");
const { requireAuth } = require("../lib/cookieAuth");

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, process.env.SESSION_SECRET)) return;

  if (req.method !== "POST" && req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { publicId } = req.body || {};

  if (!publicId) {
    res.status(400).json({ error: "publicId is required" });
    return;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
    });

    if (result.result !== "ok" && result.result !== "not found") {
      res.status(500).json({ error: "Failed to delete photo", detail: result.result });
      return;
    }

    res.status(200).json({ ok: true, publicId, result: result.result });
  } catch (e) {
    console.error("Delete photo failed", e);
    res.status(500).json({ error: "Failed to delete photo" });
  }
};
