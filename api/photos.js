const cloudinary = require("../lib/cloudinary");

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDateLabel(date) {
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

module.exports = async function handler(req, res) {
  try {
    const result = await cloudinary.api.resources_by_tag("koch-photo", {
      context: true,
      max_results: 500,
    });

    const photos = (result.resources || [])
      .map((resource) => {
        const context = (resource.context && resource.context.custom) || {};
        if (!context.date_taken) return null;

        const date = new Date(context.date_taken);
        if (Number.isNaN(date.getTime())) return null;

        const title = context.title || resource.public_id;

        return {
          id: resource.public_id,
          year: date.getUTCFullYear(),
          src: resource.secure_url,
          alt: `${title}, ${formatDateLabel(date)}`,
          title,
          location: context.location || "",
          dateLabel: formatDateLabel(date),
          date: date.toISOString(),
          note: context.note || "",
        };
      })
      .filter(Boolean);

    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).json({ photos });
  } catch (e) {
    console.error("Failed to list photos", e);
    res.status(500).json({ error: "Failed to load photos" });
  }
};
