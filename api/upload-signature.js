const cloudinary = require("../lib/cloudinary");
const { requireAuth } = require("../lib/cookieAuth");

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, process.env.SESSION_SECRET)) return;

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, tags: "koch-photo" };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  res.status(200).json({
    timestamp,
    signature,
    tags: paramsToSign.tags,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
};
