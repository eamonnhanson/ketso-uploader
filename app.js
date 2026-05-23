"use strict";

const SEARCH_API_BASE = "https://ptb-tree-map.onrender.com";
const UPLOADER_API_BASE = "https://ketso-uploader.pages.dev";
const UPLOAD_API_URLS = [`${UPLOADER_API_BASE}/upload`];
const REVIEW_API_URL = "https://ptb-tree-map.onrender.com/api/save-photo-review";
const R2_PUBLIC_BASE = "https://pub-146513161ecf43ebbf81dda0cf702fde.r2.dev/";

const STAFF_PASSWORD = "4234";
const MAX_CROPPED_BYTES = 500 * 1024;
const HARD_MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024;
const HARD_MAX_DIRECT_FILE_BYTES = 50 * 1024 * 1024;

let cropper = null;
let croppedBlob = null;
let selectedImageFile = null;
let selectedDirectFile = null;
let selectedUploadKind = null;
let staffUnlocked = false;
let selectedLink = null;
let searchTimeout = null;

const el = {
  staffPassword: document.getElementById("staffPassword"),
  staffUnlockBtn: document.getElementById("staffUnlockBtn"),
  staffMessage: document.getElementById("staffMessage"),
  staffOptions: document.getElementById("staffOptions"),
  category: document.getElementById("category"),
  forestHeroSection: document.getElementById("forestHeroSection"),
  forestHeroSearch: document.getElementById("forestHeroSearch"),
  searchResults: document.getElementById("searchResults"),
  selectedHero: document.getElementById("selectedHero"),
  selfieInput: document.getElementById("selfieInput"),
  backCameraInput: document.getElementById("backCameraInput"),
  fileInput: document.getElementById("fileInput"),
  textModeBtn: document.getElementById("textModeBtn"),
  textPanel: document.getElementById("textPanel"),
  textEntry: document.getElementById("textEntry"),
  selectedFileInfo: document.getElementById("selectedFileInfo"),
  fileSummary: document.getElementById("fileSummary"),
  cropSection: document.getElementById("cropSection"),
  image: document.getElementById("image"),
  zoomOut: document.getElementById("zoomOut"),
  zoomIn: document.getElementById("zoomIn"),
  adaptCropBtn: document.getElementById("adaptCropBtn"),
  uploadBtn: document.getElementById("uploadBtn"),
  directUploadBtn: document.getElementById("directUploadBtn"),
  textUploadBtn: document.getElementById("textUploadBtn"),
  status: document.getElementById("status")
};

function setStatus(lines) {
  el.status.textContent = Array.isArray(lines) ? lines.filter(Boolean).join("\n") : lines;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "unknown size";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeFileBaseName(name) {
  return String(name || "upload")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .toLowerCase();
}

function resetInputsExcept(activeInput) {
  [el.selfieInput, el.backCameraInput, el.fileInput].forEach((input) => {
    if (input !== activeInput) input.value = "";
  });
}

function resetSelection() {
  croppedBlob = null;
  selectedImageFile = null;
  selectedDirectFile = null;
  selectedUploadKind = null;
  el.selectedFileInfo.textContent = "";
  el.fileSummary.hidden = true;
  el.fileSummary.innerHTML = "";
  el.textPanel.hidden = true;
  el.textEntry.value = "";
  el.uploadBtn.disabled = true;
  el.directUploadBtn.disabled = true;
  el.textUploadBtn.disabled = true;
  el.uploadBtn.hidden = false;
  el.directUploadBtn.hidden = true;
  el.textUploadBtn.hidden = true;
  el.zoomIn.disabled = true;
  el.zoomOut.disabled = true;
  el.adaptCropBtn.disabled = true;

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  el.image.onload = null;
  el.image.onerror = null;
  el.image.removeAttribute("src");
  el.cropSection.hidden = true;
}

function isSupportedImage(file) {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/webp" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp");
}

function isSupportedDirectFile(file) {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const allowedExtensions = [".mp4", ".mov", ".webm", ".m4v", ".pdf", ".doc", ".docx", ".txt"];
  return type.startsWith("video/") || allowedExtensions.some((ext) => name.endsWith(ext));
}

function getFileKind(file) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  if (type.startsWith("video/")) return "video";
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "document";
  if (name.endsWith(".txt")) return "text";
  return "file";
}

function getStudentCategory() {
  if (selectedUploadKind === "selfie") return "student_selfie";
  if (selectedUploadKind === "photo") return "student_photo";
  if (selectedUploadKind === "video") return "student_video";
  if (selectedUploadKind === "text") return "student_text";
  if (selectedUploadKind === "document") return "student_document";
  return "student_upload";
}

function getActiveCategory() {
  return staffUnlocked ? el.category.value : getStudentCategory();
}

function getUploadContext() {
  if (!staffUnlocked) return "student_mobile_upload";
  return el.category.value === "academy_upload" ? "academy_upload" : "staff_upload";
}

function blobFromCanvas(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function compressCanvasToMaxBytes(canvas, maxBytes) {
  let quality = 0.86;
  let blob = await blobFromCanvas(canvas, "image/jpeg", quality);

  while (blob && blob.size > maxBytes && quality > 0.45) {
    quality -= 0.06;
    blob = await blobFromCanvas(canvas, "image/jpeg", quality);
  }

  return blob;
}

async function createCroppedBlob() {
  if (!cropper) return null;

  const canvas = cropper.getCroppedCanvas({
    width: 600,
    height: 600,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high"
  });

  if (!canvas) return null;

  const blob = await compressCanvasToMaxBytes(canvas, MAX_CROPPED_BYTES);
  if (!blob || blob.size > MAX_CROPPED_BYTES) return null;
  croppedBlob = blob;
  el.uploadBtn.disabled = false;
  return blob;
}

async function handleImageSelected(event, kind, label) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  resetInputsExcept(input);
  resetSelection();
  selectedUploadKind = kind;
  selectedImageFile = file;
  el.selectedFileInfo.textContent = `${label}: ${file.name || "camera photo"}`;
  setStatus("Preparing photo...");

  if (!isSupportedImage(file)) {
    input.value = "";
    setStatus("Please use JPG, PNG or WebP. HEIC is not reliable in browser crop.");
    return;
  }

  if (file.size > HARD_MAX_IMAGE_INPUT_BYTES) {
    input.value = "";
    setStatus("Image too large. Please use an image below 25 MB.");
    return;
  }

  const reader = new FileReader();

  reader.onerror = () => {
    setStatus("The image could not be read from this device. Please try a JPG, PNG or WebP image.");
  };

  reader.onload = () => {
    el.image.onload = async () => {
      try {
        if (cropper) cropper.destroy();

        el.cropSection.hidden = false;

        cropper = new Cropper(el.image, {
          viewMode: 1,
          dragMode: "move",
          autoCropArea: 0.82,
          responsive: true,
          restore: false,
          checkOrientation: true,
          background: false,
          zoomable: true,
          guides: true,
          center: true,
          highlight: true,
          ready: async () => {
            window.dispatchEvent(new Event("resize"));
            await createCroppedBlob();
            setStatus("Photo is ready. You can upload now, or adapt the crop first.");
          }
        });

        el.zoomIn.disabled = false;
        el.zoomOut.disabled = false;
        el.adaptCropBtn.disabled = false;
        el.uploadBtn.hidden = false;
        el.directUploadBtn.hidden = true;
        el.textUploadBtn.hidden = true;
        el.uploadBtn.textContent = kind === "selfie" ? "Upload selfie" : "Upload photo";
      } catch (err) {
        setStatus(`Cropper failed to load: ${err.message}`);
      }
    };

    el.image.onerror = () => {
      setStatus("Preview failed. Please choose a JPG, PNG or WebP image.");
    };

    el.image.src = reader.result;
  };

  reader.readAsDataURL(file);
}

function handleDirectFileSelected(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  resetInputsExcept(input);
  resetSelection();

  if (!isSupportedDirectFile(file)) {
    input.value = "";
    setStatus("Unsupported file type. Use MP4, MOV, WebM, PDF, DOC, DOCX or TXT.");
    return;
  }

  if (file.size > HARD_MAX_DIRECT_FILE_BYTES) {
    input.value = "";
    setStatus("File too large. Please use a file below 50 MB.");
    return;
  }

  const kind = getFileKind(file);
  selectedUploadKind = kind === "video" ? "video" : kind === "text" ? "text" : "document";
  selectedDirectFile = file;
  el.selectedFileInfo.textContent = `File selected: ${file.name || "uploaded file"}`;
  el.fileSummary.hidden = false;
  el.fileSummary.innerHTML = `
    <strong>Selected file</strong><br>
    Name: ${escapeHtml(file.name || "uploaded file")}<br>
    Type: ${escapeHtml(kind)}<br>
    Size: ${escapeHtml(formatBytes(file.size))}
  `;
  el.uploadBtn.hidden = true;
  el.directUploadBtn.hidden = false;
  el.textUploadBtn.hidden = true;
  el.directUploadBtn.disabled = false;
  el.directUploadBtn.textContent = kind === "video" ? "Upload video" : "Upload file";
  setStatus("File ready to upload.");
}

function openTextMode() {
  resetInputsExcept(null);
  resetSelection();
  selectedUploadKind = "text";
  el.textPanel.hidden = false;
  el.uploadBtn.hidden = true;
  el.directUploadBtn.hidden = true;
  el.textUploadBtn.hidden = false;
  el.textUploadBtn.disabled = true;
  el.textEntry.focus();
  setStatus("Type your text update, then upload.");
}

function validateBeforeUpload() {
  if (staffUnlocked && el.category.value === "forest_hero" && !selectedLink) {
    setStatus("Please select a Forest Hero before uploading.");
    return false;
  }

  return true;
}

async function uploadFileToR2AtUrl(file, label, uploadUrl) {
  const fd = new FormData();
  fd.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      body: fd,
      signal: controller.signal
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : null;

    if (!data) throw new Error(`${label} upload did not return JSON.`);
    if (!res.ok) throw new Error(`${label} upload failed: ${data.error || res.status}`);
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`${label} upload timed out.`);
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function uploadFileToR2(file, label) {
  const errors = [];

  for (const uploadUrl of UPLOAD_API_URLS) {
    try {
      return await uploadFileToR2AtUrl(file, label, uploadUrl);
    } catch (err) {
      errors.push(err.message);
    }
  }

  throw new Error(`${label} upload failed. Last error: ${errors[errors.length - 1]}`);
}

async function saveReview(payload) {
  const res = await fetch(REVIEW_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!data) throw new Error("Review save did not return JSON.");
  if (!res.ok) throw new Error(`Review save failed: ${data.error || res.status}`);
  return data;
}

function buildReviewPayload(fileUrl, size, fileType, extra = {}) {
  const category = getActiveCategory();

  return {
    category,
    file_url: fileUrl,
    cropped_file_url: fileType === "image" ? fileUrl : null,
    original_file_url: null,
    original_file_size_bytes: null,
    cropped_file_size_bytes: fileType === "image" ? size : null,
    user_id: selectedLink ? selectedLink.user_id : null,
    tree_id: selectedLink ? selectedLink.tree_id : null,
    linked_entity_type: staffUnlocked && category === "forest_hero" ? "forest_hero" : "general",
    linked_entity_name: selectedLink ? selectedLink.display_label : category,
    uploader_name: null,
    uploader_email: null,
    file_type: fileType,
    upload_context: getUploadContext(),
    uploader_role: staffUnlocked ? "staff" : "student",
    ...extra
  };
}

async function uploadImage() {
  if (!selectedImageFile) {
    setStatus("No photo selected.");
    return;
  }

  if (!validateBeforeUpload()) return;

  el.uploadBtn.disabled = true;

  try {
    if (!croppedBlob) {
      setStatus("Finalising crop...");
      await createCroppedBlob();
    }

    if (!croppedBlob) {
      setStatus("Could not create the cropped photo. Please adapt the crop and try again.");
      return;
    }

    setStatus("Uploading photo...");
    const croppedName = `${safeFileBaseName(selectedImageFile.name || selectedUploadKind)}_600px.jpg`;
    const croppedFile = new File([croppedBlob], croppedName, { type: "image/jpeg" });
    const uploaded = await uploadFileToR2(croppedFile, "Photo");
    const fileUrl = R2_PUBLIC_BASE + uploaded.key;

    const saved = await saveReview(buildReviewPayload(fileUrl, croppedBlob.size, "image", {
      upload_type: "image_cropped"
    }));

    setStatus([
      "Done.",
      `Category: ${getActiveCategory()}`,
      `Uploaded as: ${uploaded.key}`,
      `Saved for review (ID: ${saved.review_id})`
    ]);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  } finally {
    el.uploadBtn.disabled = false;
  }
}

async function uploadDirectFile() {
  if (!selectedDirectFile) {
    setStatus("No file selected.");
    return;
  }

  if (!validateBeforeUpload()) return;

  el.directUploadBtn.disabled = true;

  try {
    setStatus("Uploading file...");
    const uploaded = await uploadFileToR2(selectedDirectFile, "File");
    const fileUrl = R2_PUBLIC_BASE + uploaded.key;
    const fileKind = getFileKind(selectedDirectFile);
    const saved = await saveReview(buildReviewPayload(fileUrl, selectedDirectFile.size, fileKind, {
      upload_type: "direct_file"
    }));

    setStatus([
      "Done.",
      `Category: ${getActiveCategory()}`,
      `File type: ${fileKind}`,
      `Uploaded as: ${uploaded.key}`,
      `Saved for review (ID: ${saved.review_id})`
    ]);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  } finally {
    el.directUploadBtn.disabled = false;
  }
}

async function uploadTypedText() {
  const text = el.textEntry.value.trim();
  if (!text) {
    setStatus("Please type a text update first.");
    return;
  }

  if (!validateBeforeUpload()) return;

  el.textUploadBtn.disabled = true;

  try {
    setStatus("Uploading text...");
    const file = new File([text], `student_text_${Date.now()}.txt`, { type: "text/plain" });
    const uploaded = await uploadFileToR2(file, "Text");
    const fileUrl = R2_PUBLIC_BASE + uploaded.key;
    const saved = await saveReview(buildReviewPayload(fileUrl, file.size, "text", {
      upload_type: "typed_text"
    }));

    setStatus([
      "Done.",
      `Category: ${getActiveCategory()}`,
      `Uploaded as: ${uploaded.key}`,
      `Saved for review (ID: ${saved.review_id})`
    ]);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  } finally {
    el.textUploadBtn.disabled = false;
  }
}

function unlockStaff() {
  if (el.staffPassword.value !== STAFF_PASSWORD) {
    el.staffMessage.textContent = "Wrong password.";
    return;
  }

  staffUnlocked = true;
  el.staffMessage.textContent = "Staff options unlocked.";
  el.staffOptions.hidden = false;
  updateStaffCategory();
}

function updateStaffCategory() {
  selectedLink = null;
  el.selectedHero.hidden = true;
  el.selectedHero.innerHTML = "";
  el.searchResults.innerHTML = "";
  el.forestHeroSearch.value = "";
  el.forestHeroSection.hidden = !(staffUnlocked && el.category.value === "forest_hero");
}

async function runForestHeroSearch(q) {
  el.searchResults.textContent = "Searching...";

  try {
    const url = `${SEARCH_API_BASE}/api/forest-hero-search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url);

    if (!res.ok) {
      el.searchResults.textContent = "Search failed.";
      return;
    }

    const results = await res.json();

    if (!Array.isArray(results) || results.length === 0) {
      el.searchResults.textContent = "No matching Forest Heroes found.";
      return;
    }

    el.searchResults.innerHTML = "";
    results.forEach((item) => {
      const div = document.createElement("div");
      div.className = "result-item";
      div.textContent = item.display_label;
      div.addEventListener("click", () => {
        selectedLink = item;
        el.selectedHero.hidden = false;
        el.selectedHero.innerHTML = `
          <strong>Selected Forest Hero</strong><br>
          ${escapeHtml(item.display_label)}<br>
          <span class="small">user_id: ${escapeHtml(item.user_id)}, tree_id: ${escapeHtml(item.tree_id)}</span>
        `;
        el.searchResults.innerHTML = "";
      });
      el.searchResults.appendChild(div);
    });
  } catch (err) {
    el.searchResults.textContent = `Search error: ${err.message}`;
  }
}

el.staffUnlockBtn.addEventListener("click", unlockStaff);
el.staffPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockStaff();
});
el.category.addEventListener("change", updateStaffCategory);
el.forestHeroSearch.addEventListener("input", () => {
  const q = el.forestHeroSearch.value.trim();
  selectedLink = null;
  el.selectedHero.hidden = true;
  el.selectedHero.innerHTML = "";

  if (searchTimeout) clearTimeout(searchTimeout);

  if (q.length < 2) {
    el.searchResults.innerHTML = "";
    return;
  }

  searchTimeout = setTimeout(() => runForestHeroSearch(q), 300);
});

el.selfieInput.addEventListener("change", (event) => handleImageSelected(event, "selfie", "Selfie selected"));
el.backCameraInput.addEventListener("change", (event) => handleImageSelected(event, "photo", "Photo selected"));
el.fileInput.addEventListener("change", handleDirectFileSelected);
el.textModeBtn.addEventListener("click", openTextMode);
el.textEntry.addEventListener("input", () => {
  el.textUploadBtn.disabled = el.textEntry.value.trim().length === 0;
});
el.zoomIn.addEventListener("click", () => {
  if (cropper) cropper.zoom(0.18);
});
el.zoomOut.addEventListener("click", () => {
  if (cropper) cropper.zoom(-0.18);
});
el.adaptCropBtn.addEventListener("click", async () => {
  const blob = await createCroppedBlob();
  setStatus(blob ? "Crop updated. Ready to upload." : "Could not update crop. Please try a smaller crop.");
});
el.uploadBtn.addEventListener("click", uploadImage);
el.directUploadBtn.addEventListener("click", uploadDirectFile);
el.textUploadBtn.addEventListener("click", uploadTypedText);
