async function loadPhotos() {
  const res = await fetch(`/api/photos?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load photos: ${res.status}`);
  const { photos } = await res.json();

  return photos.map((p) => ({ ...p, date: new Date(p.date) }));
}

let photos = [];
let isAdmin = false;
let adminMode = null; // null | "add" | "edit"
let editingPhotoId = null;
let extractedGps = null;

const archiveEl = document.getElementById("archive");
const yearSelectEl = document.getElementById("yearSelect");
const adminDock = document.getElementById("adminDock");
const adminAddBtn = document.getElementById("adminAddBtn");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminSheet = document.getElementById("adminSheet");
const adminSheetBackdrop = document.getElementById("adminSheetBackdrop");
const adminSheetClose = document.getElementById("adminSheetClose");
const adminSheetTitle = document.getElementById("adminSheetTitle");
const adminForm = document.getElementById("adminForm");
const adminFileField = document.getElementById("adminFileField");
const adminFile = document.getElementById("adminFile");
const adminPreview = document.getElementById("adminPreview");
const adminTitle = document.getElementById("adminTitle");
const adminDate = document.getElementById("adminDate");
const adminLocation = document.getElementById("adminLocation");
const adminNote = document.getElementById("adminNote");
const adminSubmitBtn = document.getElementById("adminSubmitBtn");
const adminFormMessage = document.getElementById("adminFormMessage");

let openNoteFigure = null;
let openModalPhotoId = null;
let openSourceImg = null;
let lightboxAnimating = false;
let flyEl = null;

let modalEl = null;
let modalImg = null;
let modalTopTitleEl = null;
let modalTopMetaEl = null;
let modalNoteEl = null;
let modalErrorEl = null;

function uniqueYears() {
  return Array.from(new Set(photos.map((p) => p.year))).sort((a, b) => a - b);
}

function groupByYear() {
  const map = new Map();
  for (const p of photos) {
    if (!map.has(p.year)) map.set(p.year, []);
    map.get(p.year).push(p);
  }
  for (const yearPhotos of map.values()) {
    yearPhotos.sort((a, b) => a.date - b.date);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

function buildYearOptions() {
  const years = uniqueYears();
  const frag = document.createDocumentFragment();

  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "all";
  frag.appendChild(allOpt);

  for (const y of years) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    frag.appendChild(opt);
  }

  yearSelectEl.replaceChildren(frag);
  yearSelectEl.value = "all";
}

function closeAllNotes() {
  if (!openNoteFigure) return;
  openNoteFigure.classList.remove("openNote");
  openNoteFigure = null;
}

function ensureModal() {
  if (modalEl) return;

  modalEl = document.createElement("div");
  modalEl.className = "modalOverlay hidden";
  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "true");
  modalEl.setAttribute("aria-label", "Photo");

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });

  const panel = document.createElement("div");
  panel.className = "modalPanel";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "modalClose";
  closeBtn.textContent = "Close";
  closeBtn.setAttribute("aria-label", "Close photo");
  closeBtn.addEventListener("click", () => closeModal());

  const imageWrap = document.createElement("div");
  imageWrap.className = "modalImageWrap";

  modalImg = document.createElement("img");
  modalImg.loading = "eager";
  modalImg.decoding = "async";
  modalImg.alt = "";

  imageWrap.appendChild(modalImg);

  modalErrorEl = document.createElement("div");
  modalErrorEl.className = "imageError hidden";
  modalErrorEl.textContent = "This photo couldn't be decoded in your browser.";
  imageWrap.appendChild(modalErrorEl);

  const caption = document.createElement("div");
  caption.className = "modalCaption";

  modalTopTitleEl = document.createElement("div");
  modalTopTitleEl.className = "modalTitle";
  modalTopMetaEl = document.createElement("div");
  modalTopMetaEl.className = "captionDate";

  caption.appendChild(modalTopTitleEl);
  caption.appendChild(modalTopMetaEl);

  modalNoteEl = document.createElement("div");
  modalNoteEl.className = "modalNote hidden";

  panel.appendChild(closeBtn);
  panel.appendChild(imageWrap);
  panel.appendChild(caption);
  panel.appendChild(modalNoteEl);

  modalEl.appendChild(panel);
  document.body.appendChild(modalEl);
}


function updateModalNoteForPhoto(photo) {
  if (!modalEl || modalEl.classList.contains("hidden")) return;

  const shouldShow = openNoteFigure && openNoteFigure.dataset.photoId === photo.id;
  if (!shouldShow) {
    modalNoteEl.classList.add("hidden");
    return;
  }

  modalNoteEl.textContent = photo.note;
  modalNoteEl.classList.remove("hidden");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clearFly() {
  if (flyEl) {
    flyEl.remove();
    flyEl = null;
  }
}

function waitForImage(img) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
      resolve();
    };
    img.addEventListener("load", done);
    img.addEventListener("error", done);
  });
}

function copyRect(r) {
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function placeFly(rect, src, alt, { soft = true } = {}) {
  clearFly();
  flyEl = document.createElement("div");
  flyEl.className = "lightboxFly";
  if (!soft) flyEl.classList.add("is-full");

  const softImg = document.createElement("img");
  softImg.className = "lightboxFly-img lightboxFly-soft";
  softImg.src = src;
  softImg.alt = alt || "";
  softImg.decoding = "sync";
  softImg.draggable = false;

  const sharpImg = document.createElement("img");
  sharpImg.className = "lightboxFly-img lightboxFly-sharp";
  sharpImg.src = src;
  sharpImg.alt = "";
  sharpImg.decoding = "sync";
  sharpImg.draggable = false;
  sharpImg.setAttribute("aria-hidden", "true");

  flyEl.appendChild(sharpImg);
  flyEl.appendChild(softImg);

  Object.assign(flyEl.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  document.body.appendChild(flyEl);
  return flyEl;
}

function waitForSoftEdgeFade() {
  return new Promise((resolve) => {
    // Match CSS transition on .lightboxFly-soft / .lightboxFly-sharp
    setTimeout(resolve, prefersReducedMotion() ? 0 : 360);
  });
}

async function morphFly(fromRect, toRect, { revealFull = false } = {}) {
  if (!flyEl) return;

  Object.assign(flyEl.style, {
    left: `${fromRect.left}px`,
    top: `${fromRect.top}px`,
    width: `${fromRect.width}px`,
    height: `${fromRect.height}px`,
  });

  if (prefersReducedMotion()) {
    Object.assign(flyEl.style, {
      left: `${toRect.left}px`,
      top: `${toRect.top}px`,
      width: `${toRect.width}px`,
      height: `${toRect.height}px`,
    });
    flyEl.classList.toggle("is-full", revealFull);
    return;
  }

  await nextFrame();

  // Soft-edge fade runs in parallel with the size morph.
  if (revealFull) {
    flyEl.classList.add("is-full");
  } else {
    flyEl.classList.remove("is-full");
  }

  const anim = flyEl.animate(
    [
      {
        left: `${fromRect.left}px`,
        top: `${fromRect.top}px`,
        width: `${fromRect.width}px`,
        height: `${fromRect.height}px`,
      },
      {
        left: `${toRect.left}px`,
        top: `${toRect.top}px`,
        width: `${toRect.width}px`,
        height: `${toRect.height}px`,
      },
    ],
    {
      duration: 480,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      fill: "forwards",
    }
  );

  await Promise.all([anim.finished.catch(() => { }), waitForSoftEdgeFade()]);

  Object.assign(flyEl.style, {
    left: `${toRect.left}px`,
    top: `${toRect.top}px`,
    width: `${toRect.width}px`,
    height: `${toRect.height}px`,
  });
  anim.cancel();
}

async function openModalForPhoto(photo, sourceImg) {
  if (lightboxAnimating) return;
  ensureModal();

  lightboxAnimating = true;
  openModalPhotoId = photo.id;
  openSourceImg = sourceImg || null;

  const src = photo.src;
  const thumbSrc = openSourceImg?.currentSrc || openSourceImg?.src || src;

  modalTopTitleEl.textContent = photo.title;
  modalTopMetaEl.textContent = photo.dateLabel;
  modalImg.src = src;
  modalImg.alt = photo.alt;
  // Reset any previous forced size from an earlier open.
  modalImg.style.width = "";
  modalImg.style.height = "";
  modalImg.style.maxWidth = "";
  modalImg.style.maxHeight = "";
  updateModalNoteForPhoto(photo);

  if (modalErrorEl) modalErrorEl.classList.add("hidden");

  const fromRect = openSourceImg ? copyRect(openSourceImg.getBoundingClientRect()) : null;

  if (fromRect && openSourceImg) {
    // Soft flyer covers the soft thumbnail; original hides underneath.
    openSourceImg.classList.add("is-lightboxSource");
    placeFly(fromRect, thumbSrc, photo.alt, { soft: true });
  }

  modalEl.classList.remove("hidden", "is-closing");
  modalEl.classList.add("is-expanding");
  document.body.style.overflow = "hidden";

  await nextFrame();
  modalEl.classList.add("is-dimmed");

  try {
    await waitForImage(modalImg);

    // Lay out the real lightbox (image invisible) and morph INTO its actual box.
    // This avoids the end-of-animation jump from a guessed destination rect.
    modalEl.classList.add("is-open");
    await nextFrame();
    await nextFrame();

    const toRect = copyRect(modalImg.getBoundingClientRect());

    if (!fromRect || !flyEl || prefersReducedMotion() || toRect.width < 2) {
      modalEl.classList.remove("is-expanding");
      clearFly();
      lightboxAnimating = false;
      return;
    }

    await morphFly(fromRect, toRect, { revealFull: true });

    // Handoff: reveal real image under the flyer, then drop the flyer.
    modalEl.classList.remove("is-expanding");
    await nextFrame();
    clearFly();
  } catch (e) {
    console.error(e);
    modalEl.classList.add("is-open");
    modalEl.classList.remove("is-expanding");
    clearFly();
  }

  lightboxAnimating = false;
}

async function closeModal() {
  if (!modalEl || modalEl.classList.contains("hidden") || lightboxAnimating) return;

  const sourceImg = openSourceImg;
  openModalPhotoId = null;
  lightboxAnimating = true;

  const finish = () => {
    modalEl.classList.add("hidden");
    modalEl.classList.remove("is-open", "is-expanding", "is-dimmed", "is-closing");
    modalImg.style.width = "";
    modalImg.style.height = "";
    modalImg.style.maxWidth = "";
    modalImg.style.maxHeight = "";
    document.body.style.overflow = "";
    if (sourceImg) sourceImg.classList.remove("is-lightboxSource");
    // Drop focus so the browser doesn't draw a selection ring on the thumbnail.
    const focusEl = sourceImg?.closest("button") || document.activeElement;
    if (focusEl && typeof focusEl.blur === "function") focusEl.blur();
    openSourceImg = null;
    clearFly();
    lightboxAnimating = false;
  };

  if (!sourceImg || prefersReducedMotion()) {
    modalEl.classList.remove("is-open", "is-dimmed");
    finish();
    return;
  }

  const fromRect = copyRect(modalImg.getBoundingClientRect());
  const toRect = copyRect(sourceImg.getBoundingClientRect());
  const src = modalImg.currentSrc || modalImg.src;

  placeFly(fromRect, src, modalImg.alt, { soft: false });

  // Hide lightbox chrome immediately; dim fades out while photo returns.
  modalEl.classList.add("is-expanding", "is-closing");
  modalEl.classList.remove("is-open", "is-dimmed");

  try {
    // Shrink back + soft edges fade back in together.
    await morphFly(fromRect, toRect, { revealFull: false });
  } catch (e) {
    // ignore
  }
  finish();
}

function createPhotoFigure(photo) {
  const figure = document.createElement("figure");
  figure.className = "photoFigure";
  figure.dataset.photoId = photo.id;

  const thumbBtn = document.createElement("button");
  thumbBtn.type = "button";
  thumbBtn.className = "thumbnailButton";
  thumbBtn.setAttribute("aria-label", `Open ${photo.title} photo`);

  const imageWrap = document.createElement("div");
  imageWrap.className = "imageWrap";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = photo.src;
  img.alt = photo.alt;

  const overlay = document.createElement("div");
  overlay.className = "noteOverlay";

  const noteInner = document.createElement("div");
  noteInner.className = "noteInner";

  const noteText = document.createElement("p");
  noteText.className = "noteText";
  noteText.textContent = photo.note;

  const noteHint = document.createElement("span");
  noteHint.className = "noteHint";
  noteHint.textContent = "Click the title to hide note";

  noteInner.appendChild(noteText);
  noteInner.appendChild(noteHint);
  overlay.appendChild(noteInner);

  const errorOverlay = document.createElement("div");
  errorOverlay.className = "imageError hidden";
  errorOverlay.textContent = "This photo couldn't be decoded in your browser.";

  imageWrap.appendChild(img);
  imageWrap.appendChild(overlay);
  imageWrap.appendChild(errorOverlay);

  thumbBtn.appendChild(imageWrap);

  const caption = document.createElement("figcaption");
  caption.className = "caption";

  const titleBtn = document.createElement("button");
  titleBtn.type = "button";
  titleBtn.className = "titleButton";
  titleBtn.textContent = photo.title;
  titleBtn.setAttribute("aria-expanded", "false");

  const date = document.createElement("div");
  date.className = "captionDate";
  date.textContent = photo.dateLabel;

  caption.appendChild(titleBtn);
  caption.appendChild(date);

  figure.appendChild(thumbBtn);
  figure.appendChild(caption);

  if (isAdmin) {
    const actions = document.createElement("div");
    actions.className = "photoAdminActions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "photoAdminBtn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openAdminSheet("edit", photo);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "photoAdminBtn photoAdminBtnDanger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deletePhotoFromArchive(photo);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    figure.appendChild(actions);
  }

  thumbBtn.addEventListener("click", () => openModalForPhoto(photo, img));

  titleBtn.addEventListener("click", () => {
    const isOpen = figure.classList.contains("openNote");

    if (!isOpen && openNoteFigure && openNoteFigure !== figure) {
      openNoteFigure.classList.remove("openNote");
    }

    if (isOpen) {
      figure.classList.remove("openNote");
      if (openNoteFigure === figure) openNoteFigure = null;
      titleBtn.setAttribute("aria-expanded", "false");
    } else {
      figure.classList.add("openNote");
      openNoteFigure = figure;
      titleBtn.setAttribute("aria-expanded", "true");
    }

    // Keep modal note in sync if this photo is currently open.
    if (openModalPhotoId === photo.id) updateModalNoteForPhoto(photo);
  });

  titleBtn.addEventListener("keydown", (e) => {
    // Button handles Enter/Space by default; we keep this just to avoid surprise.
    if (e.key === "Escape") {
      closeAllNotes();
      if (openModalPhotoId === photo.id) closeModal();
    }
  });

  img.addEventListener("error", () => {
    errorOverlay.classList.remove("hidden");
    img.style.display = "none";
  });

  return figure;
}

function buildArchive() {
  const groups = groupByYear();
  const frag = document.createDocumentFragment();

  for (const [year, yearPhotos] of groups) {
    const group = document.createElement("section");
    group.className = "yearGroup";
    group.dataset.year = String(year);

    const heading = document.createElement("h2");
    heading.className = "yearHeading";
    heading.textContent = String(year);

    group.appendChild(heading);

    for (const p of yearPhotos) {
      const figure = createPhotoFigure(p);
      group.appendChild(figure);
    }

    frag.appendChild(group);
  }

  archiveEl.replaceChildren(frag);
}

function applyYearFilter(year) {
  const groups = archiveEl.querySelectorAll(".yearGroup");
  for (const g of groups) {
    const shouldShow = year === "all" || g.dataset.year === String(year);
    g.classList.toggle("hidden", !shouldShow);
  }
}

function closeUIForFilterChange() {
  closeAllNotes();
  closeModal();
}

yearSelectEl.addEventListener("change", () => {
  closeUIForFilterChange();
  applyYearFilter(yearSelectEl.value);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!adminSheet.classList.contains("hidden")) {
      closeAdminSheet();
      return;
    }
    if (openModalPhotoId) {
      closeModal();
      return;
    }
    closeAllNotes();
  }
});

function showArchiveStatus(message) {
  archiveEl.replaceChildren();
  const status = document.createElement("p");
  status.className = "archiveStatus";
  status.textContent = message;
  archiveEl.appendChild(status);
}

function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDateInput(iso) {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToIso(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function humanizeFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, "");
  return base
    .replace(/[_-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function setAdminFormMessage(text, kind = "") {
  adminFormMessage.textContent = text;
  adminFormMessage.className = "formMessage" + (kind ? ` ${kind}` : "");
}

function openAdminSheet(mode, photo = null) {
  if (openModalPhotoId) closeModal();
  closeAllNotes();

  adminMode = mode;
  editingPhotoId = photo?.id || null;
  extractedGps = null;
  setAdminFormMessage("");
  adminForm.reset();
  adminPreview.classList.add("hidden");
  adminPreview.removeAttribute("src");

  if (mode === "add") {
    adminSheetTitle.textContent = "Add photo";
    adminSubmitBtn.textContent = "Upload";
    adminFileField.classList.remove("hidden");
    adminFile.required = true;
  } else {
    adminSheetTitle.textContent = "Edit photo";
    adminSubmitBtn.textContent = "Save";
    adminFileField.classList.add("hidden");
    adminFile.required = false;
    adminTitle.value = photo.title || "";
    adminDate.value = isoToDateInput(photo.date);
    adminLocation.value = photo.location || "";
    adminNote.value = photo.note || "";
    if (photo.src) {
      adminPreview.src = photo.src;
      adminPreview.classList.remove("hidden");
    }
  }

  adminSheet.classList.remove("hidden");
  adminSheet.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeAdminSheet() {
  adminSheet.classList.add("hidden");
  adminSheet.setAttribute("aria-hidden", "true");
  adminMode = null;
  editingPhotoId = null;
  extractedGps = null;
  if (!openModalPhotoId) document.body.style.overflow = "";
}

async function refreshArchive() {
  const previousYear = yearSelectEl.value || "all";
  photos = await loadPhotos();
  if (!photos.length) {
    showArchiveStatus("No photos yet.");
    yearSelectEl.replaceChildren();
    return;
  }
  buildYearOptions();
  buildArchive();
  if ([...yearSelectEl.options].some((o) => o.value === previousYear)) {
    yearSelectEl.value = previousYear;
  }
  applyYearFilter(yearSelectEl.value);
}

async function deletePhotoFromArchive(photo) {
  if (!window.confirm(`Delete “${photo.title}”? This cannot be undone.`)) return;

  try {
    const res = await fetch("/api/delete-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId: photo.id }),
    });
    if (!res.ok) throw new Error("Delete failed");
    if (openModalPhotoId === photo.id) closeModal();
    await refreshArchive();
  } catch (e) {
    console.error(e);
    window.alert("Couldn't delete that photo.");
  }
}

async function checkAdminAuth() {
  try {
    const res = await fetch("/api/me");
    isAdmin = res.ok;
  } catch {
    isAdmin = false;
  }
  adminDock.classList.toggle("hidden", !isAdmin);
  document.body.classList.toggle("is-admin", isAdmin);
}

adminAddBtn?.addEventListener("click", () => openAdminSheet("add"));
adminSheetClose?.addEventListener("click", () => closeAdminSheet());
adminSheetBackdrop?.addEventListener("click", () => closeAdminSheet());

adminLogoutBtn?.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch (e) {
    // still leave admin mode
  }
  isAdmin = false;
  adminDock.classList.add("hidden");
  document.body.classList.remove("is-admin");
  closeAdminSheet();
  await refreshArchive();
});

adminFile?.addEventListener("change", async () => {
  const file = adminFile.files?.[0];
  if (!file) return;

  adminPreview.src = URL.createObjectURL(file);
  adminPreview.classList.remove("hidden");

  const guessedTitle = humanizeFilename(file.name);
  if (!adminTitle.value) adminTitle.value = guessedTitle;
  extractedGps = null;

  try {
    const mod = await import("https://esm.sh/exifr");
    const exifr = mod?.default || mod;
    const output = await exifr.parse(file, { gps: true });
    const dateTaken = output?.DateTimeOriginal || output?.CreateDate || output?.ModifyDate;
    if (dateTaken instanceof Date && !Number.isNaN(dateTaken.getTime())) {
      adminDate.value = toDateInputValue(dateTaken);
    }
    if (typeof output?.latitude === "number" && typeof output?.longitude === "number") {
      extractedGps = { lat: output.latitude, lon: output.longitude };

      // Resolve place name from GPS and use it for location + title.
      try {
        const geoRes = await fetch(
          `/api/geocode?lat=${encodeURIComponent(extractedGps.lat)}&lon=${encodeURIComponent(extractedGps.lon)}`
        );
        if (geoRes.ok) {
          const geo = await geoRes.json();
          const place = (geo.name || "").trim();
          if (place) {
            if (!adminLocation.value) adminLocation.value = place;
            // Prefer location as title when title is empty or still the filename guess.
            if (!adminTitle.value || adminTitle.value === guessedTitle) {
              adminTitle.value = place;
            }
          }
        }
      } catch (geoErr) {
        console.warn("Couldn't reverse-geocode photo GPS", geoErr);
      }
    }
  } catch (e) {
    console.warn("Couldn't read EXIF data from this photo", e);
  }
});

adminForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAdminFormMessage("");
  adminSubmitBtn.disabled = true;

  try {
    if (adminMode === "add") {
      const file = adminFile.files?.[0];
      if (!file) throw new Error("Choose a photo");

      setAdminFormMessage("Uploading…");

      const sigRes = await fetch("/api/upload-signature");
      if (!sigRes.ok) throw new Error("Could not get upload permission");
      const { timestamp, signature, tags, apiKey, cloudName } = await sigRes.json();

      const cloudinaryForm = new FormData();
      cloudinaryForm.append("file", file);
      cloudinaryForm.append("api_key", apiKey);
      cloudinaryForm.append("timestamp", timestamp);
      cloudinaryForm.append("signature", signature);
      cloudinaryForm.append("tags", tags);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: cloudinaryForm,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadResult = await uploadRes.json();

      const finalizeRes = await fetch("/api/finalize-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: uploadResult.public_id,
          title: adminTitle.value.trim(),
          dateTaken: dateInputToIso(adminDate.value),
          lat: extractedGps?.lat,
          lon: extractedGps?.lon,
          location: adminLocation.value.trim(),
          note: adminNote.value.trim(),
        }),
      });
      if (!finalizeRes.ok) throw new Error("Couldn't save photo details");
    } else if (adminMode === "edit" && editingPhotoId) {
      setAdminFormMessage("Saving…");
      const res = await fetch("/api/update-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: editingPhotoId,
          title: adminTitle.value.trim(),
          dateTaken: dateInputToIso(adminDate.value),
          location: adminLocation.value.trim(),
          note: adminNote.value.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't save changes");
    }

    closeAdminSheet();
    await refreshArchive();
  } catch (err) {
    console.error(err);
    setAdminFormMessage(err.message || "Something went wrong.", "error");
  } finally {
    adminSubmitBtn.disabled = false;
  }
});

async function init() {
  showArchiveStatus("Loading…");
  await checkAdminAuth();

  try {
    photos = await loadPhotos();
  } catch (e) {
    showArchiveStatus("Couldn't load photos. Please try reloading the page.");
    console.error(e);
    return;
  }

  if (!photos.length) {
    showArchiveStatus(isAdmin ? "No photos yet. Tap Add to upload one." : "No photos yet.");
    yearSelectEl.replaceChildren();
    return;
  }

  buildYearOptions();
  buildArchive();
  applyYearFilter("all");
}

init();

