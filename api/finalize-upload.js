const cloudinary = require("../lib/cloudinary");
const { requireAuth } = require("../lib/cookieAuth");

function escapeContextValue(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/=/g, "\\=");
}

function buildContextString(fields) {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${escapeContextValue(value)}`)
    .join("|");
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=14`;
    const res = await fetch(url, {
      headers: { "User-Agent": "koch-repo-photo-site/1.0" },
    });
    if (!res.ok) return "";
    const data = await res.json();
    const addr = data.address || {};
    return (
      addr.neighbourhood ||
      addr.suburb ||
      addr.village ||
      addr.town ||
      addr.city ||
      data.name ||
      ""
    );
  } catch (e) {
    console.error("Reverse geocode failed", e);
    return "";
  }
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, process.env.SESSION_SECRET)) return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { publicId, title, dateTaken, lat, lon, note, location: manualLocation } = req.body || {};

  if (!publicId || !title || !dateTaken) {
    res.status(400).json({ error: "publicId, title, and dateTaken are required" });
    return;
  }

  let location = manualLocation || "";
  if (!location && lat != null && lon != null) {
    location = await reverseGeocode(lat, lon);
  }

  // If title wasn't customized, prefer the resolved place name as the title.
  let resolvedTitle = title;
  if (location && (!title || title === publicId)) {
    resolvedTitle = location;
  }

  const context = buildContextString({
    title: resolvedTitle,
    date_taken: dateTaken,
    location,
    note: note || "",
  });

  try {
    const result = await cloudinary.uploader.explicit(publicId, {
      type: "upload",
      context,
      tags: "koch-photo",
      invalidate: true,
    });
    res.status(200).json({ ok: true, publicId: result.public_id, location, title: resolvedTitle });
  } catch (e) {
    console.error("Finalize upload failed", e);
    res.status(500).json({ error: "Failed to finalize upload" });
  }
};
