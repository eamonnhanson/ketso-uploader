import { isAllowedStaffCategory } from "../_shared/staff-categories.js";

const REVIEW_API_URL = "https://ptb-tree-map.onrender.com/api/save-photo-review";
const GALLERY_API_URL = "https://ptb-tree-map.onrender.com/api/photo-review-gallery";
const R2_PUBLIC_BASE = "https://pub-146513161ecf43ebbf81dda0cf702fde.r2.dev/";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const staffId = normalizeStaffId(url.searchParams.get("staff_id") || "ketso_staff");

  if (!staffId) {
    return jsonResponse({ ok: false, error: "Invalid staff_id" }, 400);
  }

  const limit = clampLimit(url.searchParams.get("limit"));
  const galleryUrl = new URL(GALLERY_API_URL);
  galleryUrl.searchParams.set("upload_context", "staff_upload");

  try {
    const res = await fetch(galleryUrl.toString());
    const data = await safeJson(res);

    if (!res.ok || !data || data.ok === false) {
      return jsonResponse({
        ok: false,
        error: data?.error || "Could not load staff uploads"
      }, res.status || 502);
    }

    const uploads = (data.photos || data.uploads || [])
      .filter((upload) => isStaffUploadFor(upload, staffId))
      .sort((a, b) => Date.parse(b.created_at_utc || b.created_at || 0) - Date.parse(a.created_at_utc || a.created_at || 0))
      .slice(0, limit);

    return jsonResponse({ ok: true, uploads }, 200);
  } catch (err) {
    return jsonResponse({ ok: false, error: messageFromError(err) }, 500);
  }
}

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const staffId = normalizeStaffId(body.staff_id || body.uploaded_by || "ketso_staff");
    const category = String(body.category || "").trim();

    if (!staffId) {
      return jsonResponse({ ok: false, error: "Invalid staff_id" }, 400);
    }

    if (!isAllowedStaffCategory(category)) {
      return jsonResponse({ ok: false, error: "Invalid staff category" }, 400);
    }

    const fileUrl = validateR2Url(body.file_url, staffId);
    const originalFileUrl = body.original_file_url
      ? validateR2Url(body.original_file_url, staffId)
      : null;

    if (!fileUrl) {
      return jsonResponse({ ok: false, error: "Invalid file_url" }, 400);
    }

    if (body.original_file_url && !originalFileUrl) {
      return jsonResponse({ ok: false, error: "Invalid original_file_url" }, 400);
    }

    const caption = cleanCaption(body.caption);
    const now = new Date().toISOString();

    const payload = {
      category,
      caption,
      file_url: fileUrl,
      cropped_file_url: fileUrl,
      original_file_url: originalFileUrl,
      original_file_size_bytes: numberOrNull(body.original_file_size_bytes),
      cropped_file_size_bytes: numberOrNull(body.cropped_file_size_bytes),
      user_id: null,
      tree_id: null,
      linked_entity_type: "staff",
      linked_entity_name: staffId,
      uploader_name: staffId,
      uploader_email: null,
      file_type: "image",
      upload_type: "staff_photo",
      uploader_role: "staff",
      upload_context: "staff_upload",
      verification_status: "not_required",
      review_status: "not_required",
      public_gallery_status: "private",
      uploaded_by: staffId,
      staff_id: staffId,
      created_at: now,
      staff_created_at: now
    };

    const res = await fetch(REVIEW_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await safeJson(res);

    if (!res.ok || !data) {
      return jsonResponse({
        ok: false,
        error: data?.error || "Could not save staff upload metadata"
      }, res.status || 502);
    }

    return jsonResponse({
      ok: true,
      review_id: data.review_id || data.id || null,
      upload: {
        ...payload,
        id: data.review_id || data.id || null
      }
    }, 200);
  } catch (err) {
    return jsonResponse({ ok: false, error: messageFromError(err) }, 500);
  }
}

export async function onRequestPatch() {
  return jsonResponse({
    ok: false,
    error: "PATCH /api/staff-uploads/:id is reserved for later staff upload edits."
  }, 501);
}

function isStaffUploadFor(upload, staffId) {
  if (!upload) return false;
  if (upload.upload_context !== "staff_upload") return false;

  const uploadStaffId = normalizeStaffId(upload.staff_id || upload.uploaded_by || upload.uploader_name || "");
  return uploadStaffId === staffId;
}

function normalizeStaffId(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return /^[a-z0-9][a-z0-9_-]{1,47}$/.test(normalized) ? normalized : "";
}

function validateR2Url(value, staffId) {
  if (!value || typeof value !== "string") return "";

  try {
    const url = new URL(value);
    const base = new URL(R2_PUBLIC_BASE);
    const expectedPrefix = `/staff_uploads/${staffId}/`;

    if (url.origin !== base.origin) return "";
    if (!url.pathname.startsWith(expectedPrefix)) return "";

    return url.toString();
  } catch {
    return "";
  }
}

function cleanCaption(value) {
  return String(value || "").trim().slice(0, 500);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function clampLimit(value) {
  const limit = Number(value || 20);
  if (!Number.isFinite(limit)) return 20;
  return Math.min(Math.max(Math.round(limit), 1), 50);
}

async function safeJson(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return res.json();
}

function messageFromError(err) {
  return err && err.message ? err.message : String(err);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
