import { isAllowedStaffCategory } from "../../_shared/staff-categories.js";

const REVIEW_API_URL = "https://ptb-tree-map.onrender.com/api/staff-uploads/";

export async function onRequestPatch({ request, params }) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        (body.caption != null && (typeof body.caption !== "string" || body.caption.length > 2000))) {
      return json({ ok: false, error: "INVALID_STAFF_METADATA" }, 400);
    }
    const reviewId = String(params?.id || "").trim();
    const staffId = normalizeStaffId(body.staff_id);
    const staffName = normalizeStaffName(body.staff_name);
    const category = String(body.category || "").trim();
    const caption = cleanCaption(body.caption);
    const allowed = new Set(["staff_id", "staff_name", "category", "caption"]);
    if (!/^\d+$/.test(reviewId) || !staffId || !staffName || !isAllowedStaffCategory(category)) {
      return json({ ok: false, error: "INVALID_STAFF_METADATA" }, 400);
    }
    if (Object.keys(body).some(key => !allowed.has(key))) return json({ ok: false, error: "FORBIDDEN_METADATA_FIELD" }, 400);
    const res = await fetch(REVIEW_API_URL + encodeURIComponent(reviewId), {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: request.headers.get("Authorization") || "" },
      body: JSON.stringify({ staff_id: staffId, staff_name: staffName, category, caption }), signal: AbortSignal.timeout(25000)
    });
    const data = await safeJson(res);
    if (!res.ok || data?.ok !== true) {
      const diagnostics = new Set(["SCHEMA_MISMATCH", "DATABASE_PERMISSION_DENIED", "METADATA_CONFLICT", "DATABASE_TIMEOUT", "DATABASE_ERROR"]);
      return json({ ok: false, error: "STAFF_METADATA_UPDATE_FAILED",
        diagnostic: diagnostics.has(data?.diagnostic) ? data.diagnostic :
          res.status === 401 || res.status === 403 ? "STAFF_LOGIN_REQUIRED" : "UPSTREAM_REJECTED",
        upstream_status: res.status }, res.ok ? 502 : res.status);
    }
    const upload = data.upload;
    if (String(upload?.id) !== reviewId || upload.staff_id !== staffId ||
        upload.staff_name !== staffName || upload.staff_category !== category ||
        (upload.caption || "") !== caption) {
      return json({ ok: false, error: "STAFF_METADATA_UPDATE_FAILED", diagnostic: "PERSISTENCE_UNCONFIRMED", upstream_status: res.status }, 502);
    }
    return json({ ok: true, review_id: upload.id, upload }, 200);
  } catch (err) {
    return json({ ok: false, error: "STAFF_METADATA_UPDATE_FAILED",
      diagnostic: err?.name === "TimeoutError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE" }, 502);
  }
}

function normalizeStaffId(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48); }
function normalizeStaffName(value) { return String(value || "").trim().replace(/\s+/g, " ").replace(/[^a-zA-Z0-9 .'-]/g, "").slice(0, 80); }
function cleanCaption(value) { return String(value || "").trim().slice(0, 2000); }
async function safeJson(res) { try { return (res.headers.get("content-type") || "").includes("application/json") ? await res.json() : null; } catch { return null; } }
function json(data, status) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
