const { buildClearCookie } = require("../lib/cookieAuth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("Set-Cookie", buildClearCookie());
  res.status(200).json({ ok: true });
};
