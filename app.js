// Photos array - ready for Kochi pictures
const photos = [
  // Add Kochi photos here when ready
  // Example format:
  // {
  //   id: "location-name-date",
  //   year: 2024,
  //   src: "./pics/filename.jpeg",
  //   alt: "Location Name, Date",
  //   title: "Location Name",
  //   location: "Area",
  //   dateLabel: "DD Mon YYYY",
  //   note: "",
  // },
];

const archiveEl = document.getElementById("archive");
const yearSelectEl = document.getElementById("yearSelect");

let openNoteFigure = null;
let openModalPhotoId = null;

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

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });

  const panel = document.createElement("div");
  panel.className = "modalPanel";

  const topbar = document.createElement("div");
  topbar.className = "modalTopbar";

  const titleBlock = document.createElement("div");
  modalTopTitleEl = document.createElement("div");
  modalTopTitleEl.className = "modalTitle";
  modalTopMetaEl = document.createElement("div");
  modalTopMetaEl.className = "captionDate";

  titleBlock.appendChild(modalTopTitleEl);
  titleBlock.appendChild(modalTopMetaEl);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "modalClose";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => closeModal());

  topbar.appendChild(titleBlock);
  topbar.appendChild(closeBtn);

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

  modalNoteEl = document.createElement("div");
  modalNoteEl.className = "modalNote hidden";

  panel.appendChild(topbar);
  panel.appendChild(imageWrap);
  panel.appendChild(modalNoteEl);

  modalEl.appendChild(panel);
  document.body.appendChild(modalEl);
}

function getPhotoDisplaySrc(photo) {
  if (photo._convertedObjectUrl) return photo._convertedObjectUrl;
  return photo.src;
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

function openModalForPhoto(photo) {
  ensureModal();
  openModalPhotoId = photo.id;

  modalTopTitleEl.textContent = `${photo.title} / ${photo.location}`;
  modalTopMetaEl.textContent = photo.dateLabel;
  modalImg.src = getPhotoDisplaySrc(photo);
  modalImg.alt = photo.alt;
  updateModalNoteForPhoto(photo);

  const isHeic = photo.src.toLowerCase().endsWith(".heic");
  if (isHeic && !photo._convertedObjectUrl) {
    if (modalErrorEl) modalErrorEl.classList.remove("hidden");
    tryConvertHeicToJpeg(modalImg, photo, modalErrorEl);
  } else if (modalErrorEl) {
    modalErrorEl.classList.add("hidden");
  }

  modalEl.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!modalEl) return;
  modalEl.classList.add("hidden");
  openModalPhotoId = null;
  document.body.style.overflow = "";
}

async function tryConvertHeicToJpeg(img, photo, errorOverlay) {
  if (photo._heicConversionAttempted) return;
  photo._heicConversionAttempted = true;

  // If conversion library can't be loaded, we just show an error overlay.
  try {
    const mod = await import("https://esm.sh/heic2any");
    const heic2any = mod?.default || mod;

    const res = await fetch(photo.src);
    const blob = await res.blob();

    const converted = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
    const outBlob = Array.isArray(converted) ? converted[0] : converted;

    const url = URL.createObjectURL(outBlob);
    photo._convertedObjectUrl = url;

    if (errorOverlay) errorOverlay.classList.add("hidden");
    img.style.display = "block";
    img.src = url;
  } catch (e) {
    if (errorOverlay) errorOverlay.classList.remove("hidden");
    img.style.display = "none";
  }
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
  titleBtn.textContent = `${photo.title} / ${photo.location}`;
  titleBtn.setAttribute("aria-expanded", "false");

  const date = document.createElement("div");
  date.className = "captionDate";
  date.textContent = photo.dateLabel;

  caption.appendChild(titleBtn);
  caption.appendChild(date);

  figure.appendChild(thumbBtn);
  figure.appendChild(caption);

  thumbBtn.addEventListener("click", () => openModalForPhoto(photo));

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
    const isHeic = photo.src.toLowerCase().endsWith(".heic");
    if (!isHeic) {
      errorOverlay.classList.remove("hidden");
      img.style.display = "none";
      return;
    }
    tryConvertHeicToJpeg(img, photo, errorOverlay);
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
    if (openModalPhotoId) {
      closeModal();
      return;
    }
    closeAllNotes();
  }
});

buildYearOptions();
buildArchive();
applyYearFilter("all");