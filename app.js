"use strict";

const SEARCH_API_BASE = "https://ptb-tree-map.onrender.com";
const UPLOADER_API_BASE = "https://ketso-uploader.pages.dev";
const UPLOAD_API_URLS = [`${UPLOADER_API_BASE}/upload`];
const REVIEW_API_URL = "https://ptb-tree-map.onrender.com/api/save-photo-review";
const ACADEMY_STUDENT_API_URL = "https://ptb-tree-map.onrender.com/api/academy-student";
const ACADEMY_STUDENT_SEARCH_API_URL = "/api/academy-student-search";
const R2_PUBLIC_BASE = "https://pub-146513161ecf43ebbf81dda0cf702fde.r2.dev/";
const ONBOARDING_FORM_URL = "https://forms.zohopublic.eu/greenmakombeh/form/KETSOacademy/formperma/Qt8SERehFwXmL4fYledPgJO-1QOC9wurOwpZydf68LA";
const ONBOARDING_HELP_VIDEO_URL = "https://www.tiktok.com/@plantatreenow/video/7638751146852633878?is_from_webapp=1&sender_device=pc&web_id=7548932980812826144";

const STAFF_PASSWORD = "4234";
const MAX_CROPPED_BYTES = 500 * 1024;
const HARD_MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024;
const HARD_MAX_DIRECT_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024;

let cropper = null;
let croppedBlob = null;
let selectedImageFile = null;
let selectedDirectFile = null;
let selectedUploadKind = null;
let staffUnlocked = false;
let academyToken = null;
let academyStudent = null;
let recentUploadStatusSyncRunning = false;
let selectedStudent = null;
let selectedLink = null;
let searchTimeout = null;
let studentSearchTimeout = null;
let activeCourseKey = window.KETSO_DEFAULT_COURSE || "online_tree_planting";

const STUDENT_PURPOSES = {
  onboarding: {
    label: "Selfie or photo to complete onboarding",
    category: "academy_onboarding",
    studentCategory: "student_onboarding",
    uploadContext: "academy_onboarding",
    lessonKey: "onboarding",
    primaryAction: "selfie"
  },
  lesson_1_child_protection: {
    label: "Lesson 1: Child Protection",
    category: "academy_lesson_1_child_protection",
    studentCategory: "student_lesson_1_child_protection",
    uploadContext: "academy_lesson_upload",
    lessonKey: "lesson_1_child_protection",
    primaryAction: "photo"
  },
  lesson_2_climate_change: {
    label: "Lesson 2: Climate Change",
    category: "academy_lesson_2_climate_change",
    studentCategory: "student_lesson_2_climate_change",
    uploadContext: "academy_lesson_upload",
    lessonKey: "lesson_2_climate_change",
    primaryAction: "photo"
  },
  lesson_3_tree_health: {
    label: "Lesson 3: Tree Health",
    category: "academy_lesson_3_tree_health",
    studentCategory: "student_lesson_3_tree_health",
    uploadContext: "academy_lesson_upload",
    lessonKey: "lesson_3_tree_health",
    primaryAction: "photo"
  },
  lesson_4_tree_planting: {
    label: "Lesson 4: Tree Planting",
    category: "academy_lesson_4_tree_planting",
    studentCategory: "student_lesson_4_tree_planting",
    uploadContext: "academy_lesson_upload",
    lessonKey: "lesson_4_tree_planting",
    primaryAction: "photo"
  },
  lesson_5_carbon_dioxide_increase: {
    label: "Lesson 5: Carbon Dioxide Increase",
    category: "academy_lesson_5_carbon_dioxide_increase",
    studentCategory: "student_lesson_5_carbon_dioxide_increase",
    uploadContext: "academy_lesson_upload",
    lessonKey: "lesson_5_carbon_dioxide_increase",
    primaryAction: "photo"
  },
  lesson_6_soil_condition: {
    label: "Lesson 6: Soil Condition",
    category: "academy_lesson_6_soil_condition",
    studentCategory: "student_lesson_6_soil_condition",
    uploadContext: "academy_lesson_upload",
    lessonKey: "lesson_6_soil_condition",
    primaryAction: "photo"
  },
  lesson_7_mulching: {
    label: "Lesson 7: Mulching",
    category: "academy_lesson_7_mulching",
    studentCategory: "student_lesson_7_mulching",
    uploadContext: "academy_lesson_upload",
    lessonKey: "lesson_7_mulching",
    primaryAction: "photo"
  },
  lesson_8_erosion_control: {
    label: "Lesson 8: Erosion Control",
    category: "academy_lesson_8_erosion_control",
    studentCategory: "student_lesson_8_erosion_control",
    uploadContext: "academy_lesson_upload",
    lessonKey: "lesson_8_erosion_control",
    primaryAction: "photo"
  },
  tutor_question: {
    label: "A question to the tutor",
    category: "academy_tutor_question",
    studentCategory: "student_tutor_question",
    uploadContext: "academy_tutor_question",
    lessonKey: "tutor_question",
    primaryAction: "text"
  }
};

const ARBORICULTURE_PURPOSES = Object.fromEntries(
  (window.KETSO_ACADEMY_COURSES?.arboriculture_1?.lessons || []).map(([lessonKey, label]) => [
    lessonKey,
    {
      label,
      category: lessonKey === "onboarding" ? "academy_onboarding" : "academy_upload",
      studentCategory: lessonKey === "onboarding" ? "student_onboarding" : "academy_upload",
      uploadContext: lessonKey === "onboarding" ? "academy_onboarding" : "academy_lesson_upload",
      lessonKey,
      primaryAction: lessonKey === "tutor_question" ? "text" : lessonKey === "onboarding" ? "selfie" : "photo"
    }
  ])
);

const el = {
  studentBanner: document.getElementById("studentBanner"),
  staffPassword: document.getElementById("staffPassword"),
  staffUnlockBtn: document.getElementById("staffUnlockBtn"),
  staffMessage: document.getElementById("staffMessage"),
  staffOptions: document.getElementById("staffOptions"),
  category: document.getElementById("category"),
  studentPurposePanel: document.getElementById("studentPurposePanel"),
  studentPurpose: document.getElementById("studentPurpose"),
  studentIdentityPanel: document.getElementById("studentIdentityPanel"),
  studentNameSearch: document.getElementById("studentNameSearch"),
  studentEmail: document.getElementById("studentEmail"),
  studentSearchResults: document.getElementById("studentSearchResults"),
  selectedStudent: document.getElementById("selectedStudent"),
  forestHeroSection: document.getElementById("forestHeroSection"),
  forestHeroSearch: document.getElementById("forestHeroSearch"),
  searchResults: document.getElementById("searchResults"),
  selectedHero: document.getElementById("selectedHero"),
  devicePhotoAction: document.getElementById("devicePhotoAction"),
  selfieAction: document.getElementById("selfieAction"),
  cameraAction: document.getElementById("cameraAction"),
  fileAction: document.querySelector('label[for="fileInput"]'),
  devicePhotoInput: document.getElementById("devicePhotoInput"),
  selfieInput: document.getElementById("selfieInput"),
  backCameraInput: document.getElementById("backCameraInput"),
  fileInput: document.getElementById("fileInput"),
  textModeBtn: document.getElementById("textModeBtn"),
  textPanel: document.getElementById("textPanel"),
  textEntry: document.getElementById("textEntry"),
  selectedFileInfo: document.getElementById("selectedFileInfo"),
  fileSummary: document.getElementById("fileSummary"),
  recentUploadsPanel: document.getElementById("recentUploadsPanel"),
  recentUploadsList: document.getElementById("recentUploadsList"),
  cropSection: document.getElementById("cropSection"),
  image: document.getElementById("image"),
  zoomOut: document.getElementById("zoomOut"),
  zoomIn: document.getElementById("zoomIn"),
  adaptCropBtn: document.getElementById("adaptCropBtn"),
  uploadBtn: document.getElementById("uploadBtn"),
  directUploadBtn: document.getElementById("directUploadBtn"),
  textUploadBtn: document.getElementById("textUploadBtn"),
  uploadSuccessPanel: document.getElementById("uploadSuccessPanel"),
  status: document.getElementById("status")
};

function setStatus(lines) {
  el.status.textContent = Array.isArray(lines) ? lines.filter(Boolean).join("\n") : lines;
}

function showUploadSuccess(saved) {
  const reviewLink = saved?.review_id
    ? `/academy-my-upload/?review_id=${encodeURIComponent(saved.review_id)}`
    : "";

  if (el.uploadSuccessPanel) {
    el.uploadSuccessPanel.hidden = false;
    el.uploadSuccessPanel.innerHTML = `
      <strong>Upload sent to tutor</strong>
      <p>Your work has been sent to the tutor for review.</p>
      <p>It can take up to 24 hours before it appears in the student gallery.</p>
      <p>You can already see your own upload below under <strong>My recent uploads</strong>.</p>
      ${reviewLink ? `<p><a href="${escapeHtml(reviewLink)}">View my upload</a></p>` : ""}
    `;

    el.uploadSuccessPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  setStatus(saved?.review_id ? `Saved for review (ID: ${saved.review_id})` : "Saved for review.");
}

function renderOnboardingPrompt(target, message) {
  target.innerHTML = `
    <div class="onboarding-prompt">
      <strong>${escapeHtml(message)}</strong>
      <p>Please complete your KETSO Academy onboarding first. After onboarding, come back here and search your name again.</p>
      <div class="prompt-actions">
        <a href="${escapeHtml(ONBOARDING_FORM_URL)}" target="_blank" rel="noopener">Complete onboarding</a>
        <a href="${escapeHtml(ONBOARDING_HELP_VIDEO_URL)}" target="_blank" rel="noopener">Watch help video</a>
      </div>
    </div>
  `;
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
  [el.devicePhotoInput, el.selfieInput, el.backCameraInput, el.fileInput].forEach((input) => {
    if (input !== activeInput) input.value = "";
  });
}

function getUrlToken() {
  return new URLSearchParams(window.location.search).get("token");
}

function getStudentPurpose() {
  const value = el.studentPurpose?.value || "onboarding";
  const purposes = activeCourseKey === "arboriculture_1" ? ARBORICULTURE_PURPOSES : STUDENT_PURPOSES;
  return purposes[value] || purposes.onboarding || STUDENT_PURPOSES.onboarding;
}

function renderCoursePurposes() {
  const course = window.KETSO_ACADEMY_COURSES?.[activeCourseKey];
  if (!course || !el.studentPurpose) return;
  el.studentPurpose.innerHTML = course.lessons
    .filter(([key]) => key !== "evaluation")
    .map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`)
    .join("");
}

function getActiveStudent() {
  return academyStudent || selectedStudent;
}

function getTypedStudentIdentity() {
  if (staffUnlocked || !el.studentIdentityPanel || el.studentIdentityPanel.hidden) {
    return null;
  }

  const fullName = String(el.studentNameSearch?.value || "").trim().replace(/\s+/g, " ");
  const email = normalizeEmail(el.studentEmail?.value || "");

  if (!fullName && !email) return null;

  return {
    id: null,
    ketso_student_id: null,
    full_name: fullName,
    first_name: fullName.split(" ")[0] || "",
    last_name: fullName.split(" ").slice(1).join(" "),
    email
  };
}

function getUploadStudentIdentity() {
  return getActiveStudent();
}

function isOnboardingPurpose() {
  return getStudentPurpose().lessonKey === "onboarding";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function emailsMatch(left, right) {
  return normalizeEmail(left) === normalizeEmail(right);
}

function getRecentUploadKey() {
  const activeStudent = getActiveStudent();
  const studentId = activeStudent?.id || activeStudent?.ketso_student_id || "this_device";
  return `ketso_recent_student_uploads_${studentId}`;
}

function saveRecentStudentUpload(upload) {
  if (staffUnlocked || !upload) return;

  const key = getRecentUploadKey();
  const uploads = getRecentStudentUploads()
    .filter((item) => String(item.review_id || item.file_url) !== String(upload.review_id || upload.file_url));

  uploads.unshift(upload);
  localStorage.setItem(key, JSON.stringify(uploads.slice(0, 8)));
  renderRecentStudentUploads();
}

function getRecentStudentUploads() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getRecentUploadKey()) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatRecentUploadStatus(remoteUpload, localUpload = {}) {
  const statuses = [
    remoteUpload?.verification_status,
    remoteUpload?.review_status,
    remoteUpload?.public_gallery_status,
    localUpload?.status
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase().trim());

  if (statuses.includes("rejected")) return "Rejected";
  if (statuses.includes("approved") || statuses.includes("public")) return "Approved";

  if (
    statuses.includes("submitted_for_review") ||
    statuses.includes("submitted for review") ||
    statuses.includes("pending")
  ) {
    return "Waiting for approval";
  }

  return localUpload?.status || "Waiting for approval";
}

async function syncRecentStudentUploadStatuses() {
  if (staffUnlocked || recentUploadStatusSyncRunning) return;

  const uploads = getRecentStudentUploads();
  const uploadsWithReviewId = uploads.filter((upload) => upload.review_id);

  if (!uploadsWithReviewId.length) return;

  recentUploadStatusSyncRunning = true;

  try {
    let changed = false;

    const updated = await Promise.all(uploads.map(async (upload) => {
      if (!upload.review_id) return upload;

      try {
        const res = await fetch(`${SEARCH_API_BASE}/api/academy-upload-review?review_id=${encodeURIComponent(upload.review_id)}`);
        const data = await res.json();

        if (!res.ok || !data.ok || !data.upload) return upload;

        const remoteUpload = data.upload;
        const nextUpload = {
          ...upload,
          status: formatRecentUploadStatus(remoteUpload, upload),
          verification_status: remoteUpload.verification_status || upload.verification_status,
          review_status: remoteUpload.review_status || upload.review_status,
          public_gallery_status: remoteUpload.public_gallery_status || upload.public_gallery_status
        };

        if (JSON.stringify(nextUpload) !== JSON.stringify(upload)) changed = true;
        return nextUpload;
      } catch {
        return upload;
      }
    }));

    if (changed) {
      localStorage.setItem(getRecentUploadKey(), JSON.stringify(updated.slice(0, 8)));
      renderRecentStudentUploads({ sync: false });
    }
  } finally {
    recentUploadStatusSyncRunning = false;
  }
}

function renderRecentStudentUploads(options = {}) {
  if (!el.recentUploadsPanel || staffUnlocked) return;

  const uploads = getRecentStudentUploads();
  el.recentUploadsPanel.hidden = uploads.length === 0;

  if (!uploads.length) {
    el.recentUploadsList.innerHTML = "";
    return;
  }

  el.recentUploadsList.innerHTML = uploads.map((upload) => {
    const imageUrl = upload.preview_url || upload.file_url || "";
    const reviewLink = upload.review_id
      ? `/academy-my-upload/?review_id=${encodeURIComponent(upload.review_id)}`
      : "";

    return `
      <article class="recent-upload-card">
        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Recent upload">` : "<div></div>"}
        <div class="recent-upload-meta">
          <strong>${escapeHtml(upload.reason_label || "Upload")}</strong><br>
          ${escapeHtml(upload.created_at || "")}<br>
          <span class="status-badge">${escapeHtml(upload.status || "Waiting for approval")}</span><br>
          ${reviewLink ? `<a href="${escapeHtml(reviewLink)}">View my upload</a>` : ""}
        </div>
      </article>
    `;
  }).join("");

  if (options.sync !== false) {
    syncRecentStudentUploadStatuses();
  }
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
  const purpose = getStudentPurpose();
  if (getUploadStudentIdentity()) return purpose.category;
  if (purpose) return purpose.studentCategory;
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
  if (getUploadStudentIdentity()) return getStudentPurpose().uploadContext;
  if (!staffUnlocked) return "student_mobile_upload";
  return "staff_upload";
}

function blobFromCanvas(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };

    img.src = url;
  });
}

async function resizeOriginalIfNeeded(file) {
  if (file.size <= MAX_ORIGINAL_BYTES) {
    return file;
  }

  const img = await loadImageFromFile(file);
  let scale = 0.9;
  let blob = null;

  while (scale > 0.25) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    blob = await compressCanvasToMaxBytes(canvas, MAX_ORIGINAL_BYTES);

    if (blob && blob.size <= MAX_ORIGINAL_BYTES) {
      break;
    }

    scale -= 0.1;
  }

  if (!blob || blob.size > MAX_ORIGINAL_BYTES) {
    throw new Error("Could not reduce original image below 8 MB.");
  }

  const newName = `${safeFileBaseName(file.name || "photo")}_original.jpg`;
  return new File([blob], newName, { type: "image/jpeg" });
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

  if (!staffUnlocked && !getActiveStudent()) {
    const typedIdentity = getTypedStudentIdentity();

    if (!typedIdentity?.full_name || !typedIdentity?.email) {
      setStatus("Please enter your student name and email before uploading.");
      return false;
    }

    if (typedIdentity.full_name.length < 3 || !typedIdentity.full_name.includes(" ")) {
      setStatus("Please enter your first and last name before uploading.");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedIdentity.email)) {
      setStatus("Please enter a valid student email before uploading.");
      return false;
    }

    setStatus([
      "Please choose your name from the student search results before uploading.",
      "If your name does not appear, complete onboarding first:",
      ONBOARDING_FORM_URL,
      "Help video:",
      ONBOARDING_HELP_VIDEO_URL
    ]);
    return false;
  }

  if (!staffUnlocked && !academyStudent && selectedStudent?.email && !emailsMatch(el.studentEmail.value, selectedStudent.email)) {
    setStatus("The email does not match the selected student. Please check your email or choose the correct name.");
    return false;
  }

  if (!staffUnlocked && !academyStudent && selectedStudent && !selectedStudent.email) {
    setStatus([
      "This student record has no email, so it cannot be verified here.",
      "Please complete onboarding first or ask KETSO to update your student record:",
      ONBOARDING_FORM_URL
    ]);
    return false;
  }

  return true;
}

async function uploadFileToR2AtUrl(file, label, uploadUrl) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", getUploadFolder());

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
  const purpose = getStudentPurpose();
  const activeStudent = getUploadStudentIdentity();
  const studentName = activeStudent?.full_name ||
    [activeStudent?.first_name, activeStudent?.last_name].filter(Boolean).join(" ") ||
    null;
  const academyTrack = activeStudent?.track || activeStudent?.primary_stream || null;

  return {
    category,
    file_url: fileUrl,
    cropped_file_url: fileType === "image" ? fileUrl : null,
    original_file_url: extra.original_file_url || null,
    original_file_size_bytes: extra.original_file_size_bytes || null,
    cropped_file_size_bytes: fileType === "image" ? size : null,
    user_id: selectedLink ? selectedLink.user_id : null,
    tree_id: selectedLink ? selectedLink.tree_id : null,
    linked_entity_type: activeStudent ? "student" : staffUnlocked && category === "forest_hero" ? "forest_hero" : staffUnlocked ? "staff" : "general",
    linked_entity_name: selectedLink ? selectedLink.display_label : studentName || category,
    uploader_name: studentName,
    uploader_email: activeStudent?.email || null,
    academy_student_id: activeStudent?.id || null,
    academy_cohort: activeStudent?.cohort || null,
    course_key: activeCourseKey,
    academy_track: academyTrack,
    academy_whatsapp: activeStudent?.whatsapp || null,
    lesson_key: activeStudent || !staffUnlocked ? purpose.lessonKey : null,
    upload_reason: activeStudent || !staffUnlocked ? el.studentPurpose.value : null,
    upload_reason_label: activeStudent || !staffUnlocked ? purpose.label : null,
    interest_area: academyTrack,
    consent_given: Boolean(activeStudent),
    file_type: fileType,
    upload_context: getUploadContext(),
    uploader_role: staffUnlocked ? "staff" : "student",
    ...extra
  };
}

function getUploadFolder() {
  const activeStudent = getUploadStudentIdentity();

  if (activeStudent) {
    const studentId = activeStudent.ketso_student_id || activeStudent.id || activeStudent.email || activeStudent.full_name || "student";
    return `academy/${safeFileBaseName(activeCourseKey)}/${safeFileBaseName(getStudentPurpose().lessonKey)}/${safeFileBaseName(String(studentId))}`;
  }

  if (staffUnlocked) {
    return `staff/${safeFileBaseName(el.category.value || "upload")}`;
  }

  return `student/${safeFileBaseName(getStudentCategory())}`;
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

    setStatus("Uploading original photo...");
    const originalFile = await resizeOriginalIfNeeded(selectedImageFile);
    const originalName = `${safeFileBaseName(selectedImageFile.name || selectedUploadKind)}_original.jpg`;
    const originalUploadFile = originalFile.name ? originalFile : new File([originalFile], originalName, { type: originalFile.type || "image/jpeg" });
    const originalUploaded = await uploadFileToR2(originalUploadFile, "Original photo");
    const originalUrl = R2_PUBLIC_BASE + originalUploaded.key;

    setStatus("Uploading cropped 600 px photo...");
    const croppedName = `${safeFileBaseName(selectedImageFile.name || selectedUploadKind)}_600px.jpg`;
    const croppedFile = new File([croppedBlob], croppedName, { type: "image/jpeg" });
    const uploaded = await uploadFileToR2(croppedFile, "Photo");
    const fileUrl = R2_PUBLIC_BASE + uploaded.key;

    const payload = buildReviewPayload(fileUrl, croppedBlob.size, "image", {
      upload_type: getActiveStudent() ? "image_photo" : "image_cropped",
      original_file_url: originalUrl,
      original_file_size_bytes: originalUploadFile.size
    });
    const saved = await saveReview(payload);
    saveRecentStudentUpload({
      review_id: saved.review_id,
      file_url: fileUrl,
      preview_url: fileUrl,
      reason_label: payload.upload_reason_label || payload.category,
      status: "Waiting for approval",
      created_at: new Date().toLocaleString()
    });

    showUploadSuccess(saved);
  } catch (err) {
    setStatus(`Photo upload failed before the review could be saved: ${err.message}`);
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
    const payload = buildReviewPayload(fileUrl, selectedDirectFile.size, fileKind, {
      upload_type: fileKind === "pdf" ? "document" : fileKind
    });
    const saved = await saveReview(payload);
    saveRecentStudentUpload({
      review_id: saved.review_id,
      file_url: fileUrl,
      preview_url: fileKind === "video" ? "" : fileUrl,
      reason_label: payload.upload_reason_label || payload.category,
      status: "Waiting for approval",
      created_at: new Date().toLocaleString()
    });

    showUploadSuccess(saved);
  } catch (err) {
    setStatus(`File upload failed before the review could be saved: ${err.message}`);
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
    const payload = buildReviewPayload(fileUrl, file.size, "text", {
      upload_type: "text"
    });
    const saved = await saveReview(payload);
    saveRecentStudentUpload({
      review_id: saved.review_id,
      file_url: fileUrl,
      preview_url: "",
      reason_label: payload.upload_reason_label || payload.category,
      status: "Waiting for approval",
      created_at: new Date().toLocaleString()
    });

    showUploadSuccess(saved);
  } catch (err) {
    setStatus(`Text upload failed before the review could be saved: ${err.message}`);
  } finally {
    el.textUploadBtn.disabled = false;
  }
}

function unlockStaff() {
  const password = (el.staffPassword.value || "").trim();

  if (password !== STAFF_PASSWORD) {
    el.staffMessage.textContent = "Wrong password.";
    return;
  }

  el.staffMessage.textContent = "Opening staff upload dashboard...";
  window.location.href = "/staff-upload-dashboard/";
}

function updateStaffCategory() {
  selectedLink = null;
  el.selectedHero.hidden = true;
  el.selectedHero.innerHTML = "";
  el.searchResults.innerHTML = "";
  el.forestHeroSearch.value = "";
  el.forestHeroSection.hidden = !(staffUnlocked && el.category.value === "forest_hero");
}

function updateStudentIdentityPanel() {
  if (!el.studentIdentityPanel) return;

  const shouldIdentify = !staffUnlocked && !academyStudent;
  el.studentIdentityPanel.hidden = !shouldIdentify;

  if (!shouldIdentify) {
    selectedStudent = academyStudent || null;
    el.studentSearchResults.innerHTML = "";
    el.selectedStudent.hidden = true;
    el.selectedStudent.innerHTML = "";
  }
}

function clearSelectedStudent() {
  selectedStudent = null;
  el.selectedStudent.hidden = true;
  el.selectedStudent.innerHTML = "";
}

function handleStudentSearchInput() {
  clearSelectedStudent();
  const q = el.studentNameSearch.value.trim();

  if (studentSearchTimeout) clearTimeout(studentSearchTimeout);

  if (q.length < 2) {
    el.studentSearchResults.innerHTML = "";
    return;
  }

  studentSearchTimeout = setTimeout(() => runStudentSearch(q), 250);
}

async function runStudentSearch(q) {
  el.studentSearchResults.textContent = "Searching students...";

  try {
    const url = `${ACADEMY_STUDENT_SEARCH_API_URL}?q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      renderOnboardingPrompt(
        el.studentSearchResults,
        data.error || "Student search is not available yet."
      );
      return;
    }

    const students = data.students || [];

    if (!students.length) {
      renderOnboardingPrompt(
        el.studentSearchResults,
        "No matching student record found."
      );
      return;
    }

    el.studentSearchResults.innerHTML = "";
    students.slice(0, 12).forEach((student) => {
      const div = document.createElement("div");
      div.className = "result-item";
      div.textContent = `${student.full_name || [student.first_name, student.last_name].filter(Boolean).join(" ") || "Student"}${student.email ? ` (${student.email})` : ""}`;
      div.addEventListener("click", () => selectStudent(student));
      el.studentSearchResults.appendChild(div);
    });
  } catch (err) {
    renderOnboardingPrompt(
      el.studentSearchResults,
      "Student search is not available yet."
    );
  }
}

function selectStudent(student) {
  selectedStudent = student;
  el.studentNameSearch.value = student.full_name || [student.first_name, student.last_name].filter(Boolean).join(" ");
  if (student.email && !el.studentEmail.value.trim()) {
    el.studentEmail.value = student.email;
  }
  el.studentSearchResults.innerHTML = "";
  el.selectedStudent.hidden = false;
  el.selectedStudent.innerHTML = `
    <strong>Selected student</strong><br>
    ${escapeHtml(student.full_name || el.studentNameSearch.value)}<br>
    <span class="small">${escapeHtml(student.email || "")}</span>
  `;
}

function updateUploadActionsForContext() {
  const purpose = getStudentPurpose();
  const isOnboarding = purpose.primaryAction === "selfie";
  const isTutorQuestion = purpose.primaryAction === "text";

  if (academyStudent && isOnboarding) {
    el.selfieAction.style.order = "1";
    el.selfieAction.textContent = "Take onboarding selfie";
    el.devicePhotoAction.style.order = "2";
    el.cameraAction.style.order = "3";
    el.fileAction.style.order = "4";
    el.textModeBtn.style.order = "5";
    return;
  }

  if (!staffUnlocked && isTutorQuestion) {
    el.textModeBtn.style.order = "1";
    el.devicePhotoAction.style.order = "2";
    el.fileAction.style.order = "3";
    el.selfieAction.style.order = "4";
    el.cameraAction.style.order = "5";
    el.selfieAction.textContent = "Take selfie";
    el.devicePhotoAction.textContent = "I want to upload a photo";
    return;
  }

  el.devicePhotoAction.style.order = "1";
  el.devicePhotoAction.textContent = "I want to upload a photo";
  el.selfieAction.style.order = "2";
  el.selfieAction.textContent = "Take selfie";
  el.cameraAction.style.order = "3";
  el.fileAction.style.order = "4";
  el.textModeBtn.style.order = "5";
  updateStudentIdentityPanel();
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
el.studentPurpose.addEventListener("change", () => {
  clearSelectedStudent();
  updateUploadActionsForContext();
});
el.studentNameSearch.addEventListener("input", handleStudentSearchInput);
el.studentEmail.addEventListener("input", () => {
  if (selectedStudent?.email && !emailsMatch(el.studentEmail.value, selectedStudent.email)) {
    el.selectedStudent.innerHTML = `
      <strong>Selected student</strong><br>
      ${escapeHtml(selectedStudent.full_name || "")}<br>
      <span class="small">Email does not match yet.</span>
    `;
  } else if (selectedStudent) {
    selectStudent(selectedStudent);
  }
});
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

el.devicePhotoInput.addEventListener("change", (event) => handleImageSelected(event, "photo", "Photo selected"));
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

async function initAcademyToken() {
  academyToken = getUrlToken();
  if (!academyToken) return;

  setStatus("Loading academy student...");

  try {
    const url = `${ACADEMY_STUDENT_API_URL}?token=${encodeURIComponent(academyToken)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.ok || !data.student) {
      setStatus(data.error || "Academy token could not be loaded.");
      return;
    }

    academyStudent = data.student;
    activeCourseKey = data.enrollment?.course_key || window.KETSO_DEFAULT_COURSE || "online_tree_planting";
    renderCoursePurposes();
    selectedStudent = academyStudent;
    const name = academyStudent.full_name ||
      [academyStudent.first_name, academyStudent.last_name].filter(Boolean).join(" ") ||
      "Academy student";

    el.studentBanner.hidden = false;
    const courseName = window.KETSO_ACADEMY_COURSES?.[activeCourseKey]?.name || "Online tree planting";
    el.studentBanner.textContent = `${courseName} uploads for ${name}`;
    updateUploadActionsForContext();
    updateStudentIdentityPanel();
    renderRecentStudentUploads();
    setStatus("Student loaded. Choose a selfie, photo, video, document or text update.");
  } catch (err) {
    setStatus(`Academy token lookup failed: ${err.message}`);
  }
}

updateUploadActionsForContext();
updateStudentIdentityPanel();
renderRecentStudentUploads();
renderCoursePurposes();
initAcademyToken();
