const { requireAuth } = require("../lib/cookieAuth");

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, process.env.SESSION_SECRET)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");

  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    res.status(400).json({ error: "lat and lon are required" });
    return;
  }

  try {
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=14`;
    const geoRes = await fetch(geoUrl, {
      headers: { "User-Agent": "koch-repo-photo-site/1.0" },
    });
    if (!geoRes.ok) {
      res.status(502).json({ error: "Geocode failed" });
      return;
    }

    const data = await geoRes.json();
    const addr = data.address || {};
    const name =
      addr.neighbourhood ||
      addr.suburb ||
      addr.village ||
      addr.town ||
      addr.city ||
      addr.hamlet ||
      addr.county ||
      data.name ||
      "";

    res.status(200).json({ name, displayName: data.display_name || name });
  } catch (e) {
    console.error("Geocode failed", e);
    res.status(500).json({ error: "Geocode failed" });
  }
};
