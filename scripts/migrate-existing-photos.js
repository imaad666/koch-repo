require("dotenv").config();
const fs = require("fs");
const path = require("path");
const cloudinary = require("../lib/cloudinary");

const MONTH_MAP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const FILENAME_RE = /^(.+)_(\d{1,2})([a-zA-Z]+)(\d{4})\.\w+$/;

function humanizeName(raw) {
  const withSpaces = raw.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return withSpaces
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function parseFilename(filename) {
  const match = filename.match(FILENAME_RE);
  if (!match) return null;

  const [, namePart, dayStr, monthStr, yearStr] = match;
  const month = MONTH_MAP[monthStr.toLowerCase()];
  if (month === undefined) return null;

  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  const date = new Date(Date.UTC(year, month, day));
  return { title: humanizeName(namePart), date };
}

function parseManifest(manifestPath) {
  const text = fs.readFileSync(manifestPath, "utf8");
  const entries = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [filenamePart, notePart = ""] = line.split("|");
    entries.push({ filename: filenamePart.trim(), note: notePart.trim() });
  }
  return entries;
}

function escapeContextValue(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/=/g, "\\=");
}

function buildContextString(fields) {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${escapeContextValue(value)}`)
    .join("|");
}

async function main() {
  const picsDir = path.join(__dirname, "..", "pics");
  const manifestPath = path.join(picsDir, "manifest.txt");
  const entries = parseManifest(manifestPath);

  for (const { filename, note } of entries) {
    const filePath = path.join(picsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping "${filename}": file not found`);
      continue;
    }

    const parsed = parseFilename(filename);
    if (!parsed) {
      console.warn(`Skipping "${filename}": couldn't parse date from filename`);
      continue;
    }

    const context = buildContextString({
      title: parsed.title,
      date_taken: parsed.date.toISOString(),
      location: parsed.title,
      note,
    });

    console.log(`Uploading ${filename}...`);
    const result = await cloudinary.uploader.upload(filePath, {
      tags: "koch-photo",
      context,
    });
    console.log(`  -> ${result.public_id}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
