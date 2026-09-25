const crypto = require("crypto");

const COOKIE_NAME = "koch_session";
const PAYLOAD = "authenticated";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sign(secret) {
  return crypto.createHmac("sha256", secret).update(PAYLOAD).digest("hex");
}

function buildSessionCookie(secret) {
  const value = `${PAYLOAD}.${sign(secret)}`;
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

function buildClearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

function isAuthenticated(req, secret) {
  const cookies = parseCookies(req);
  const value = cookies[COOKIE_NAME];
  if (!value) return false;

  const [payload, signature] = value.split(".");
  if (payload !== PAYLOAD || !signature) return false;

  const expected = sign(secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAuth(req, res, secret) {
  if (isAuthenticated(req, secret)) return true;
  res.status(401).json({ error: "Not authenticated" });
  return false;
}

module.exports = {
  buildSessionCookie,
  buildClearCookie,
  isAuthenticated,
  requireAuth,
};
