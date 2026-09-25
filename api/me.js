const { isAuthenticated } = require("../lib/cookieAuth");

module.exports = async function handler(req, res) {
  const authed = isAuthenticated(req, process.env.SESSION_SECRET);
  if (!authed) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.status(200).json({ authenticated: true });
};
