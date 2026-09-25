const { buildSessionCookie } = require("../lib/cookieAuth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { password } = req.body || {};

  if (!password || password !== process.env.UPLOAD_PASSWORD) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  res.setHeader("Set-Cookie", buildSessionCookie(process.env.SESSION_SECRET));
  res.status(200).json({ ok: true });
};
