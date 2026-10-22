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
    const fields = ["staff_name", "category", "caption"];
    const supplied = fields.filter(key => Object.hasOwn(body, key));
    const allowed = new Set(["staff_id", "staff_name", "category", "caption", "expected"]);
    if (Object.keys(body).some(key => !allowed.has(key))) return json({ ok: false, error: "FORBIDDEN_METADATA_FIELD" }, 400);
    if (!/^\d+$/.test(reviewId) || !staffId || !supplied.length ||
        (Object.hasOwn(body, "staff_name") && (typeof body.staff_name !== "string" || !body.staff_name.trim() || body.staff_name.length > 80)) ||
        (Object.hasOwn(body, "category") && !isAllowedStaffCategory(body.category))) {
      return json({ ok: false, error: "INVALID_STAFF_METADATA" }, 400);
    }
    // Require field-level compare-and-swap; never fall back to an unguarded write.
    if (!body.expected || typeof body.expected !== "object" || Array.isArray(body.expected) ||
        Object.keys(body.expected).length !== supplied.length || supplied.some(key =>
          !Object.hasOwn(body.expected, key) || (body.expected[key] !== null && typeof body.expected[key] !== "string"))) {
      return json({ ok: false, error: "METADATA_PRECONDITION_REQUIRED" }, 400);
    }
    const metadata = { staff_id: staffId, expected: body.expected };
    for (const key of supplied) metadata[key] = key === "caption" && body[key] !== null ? body[key].trim() : body[key];
    const res = await fetch(REVIEW_API_URL + encodeURIComponent(reviewId), {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: request.headers.get("Authorization") || "" },
      body: JSON.stringify(metadata), signal: AbortSignal.timeout(25000)
    });
    const data = await safeJson(res);
    if (!res.ok || data?.ok !== true) {
      const diagnostics = new Set(["SCHEMA_MISMATCH", "DATABASE_PERMISSION_DENIED", "METADATA_CONFLICT", "DATABASE_TIMEOUT", "DATABASE_ERROR"]);
      return json({ ok: false, error: "STAFF_METADATA_UPDATE_FAILED",
        diagnostic: res.status === 409 ? "METADATA_CONFLICT" : diagnostics.has(data?.diagnostic) ? data.diagnostic :
          res.status === 401 || res.status === 403 ? "STAFF_LOGIN_REQUIRED" : "UPSTREAM_REJECTED",
        upstream_status: res.status }, res.ok ? 502 : res.status);
    }
    const upload = data.upload;
    if (String(upload?.id) !== reviewId || upload.staff_id !== staffId ||
        supplied.some(key => (key === "category" ? upload.staff_category : upload[key]) !== metadata[key])) {
      return json({ ok: false, error: "STAFF_METADATA_UPDATE_FAILED", diagnostic: "PERSISTENCE_UNCONFIRMED", upstream_status: res.status }, 502);
    }
    return json({ ok: true, review_id: upload.id, upload }, 200);
  } catch (err) {
    return json({ ok: false, error: "STAFF_METADATA_UPDATE_FAILED",
      diagnostic: err?.name === "TimeoutError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE" }, 502);
  }
}

function normalizeStaffId(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48); }
async function safeJson(res) { try { return (res.headers.get("content-type") || "").includes("application/json") ? await res.json() : null; } catch { return null; } }
function json(data, status) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
