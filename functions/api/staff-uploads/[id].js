import { isAllowedStaffCategory } from "../../_shared/staff-categories.js";

const REVIEW_API_URL = "https://ptb-tree-map.onrender.com/api/staff-uploads/";

export async function onRequestPatch({ request, params }) {
  try {
    const body = await request.json();
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
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, staff_name: staffName, category, caption }), signal: AbortSignal.timeout(25000)
    });
    const data = await safeJson(res);
    return json(data || { ok: false, error: "STAFF_METADATA_UPDATE_FAILED" }, res.ok ? 200 : res.status);
  } catch (err) { return json({ ok: false, error: err.message || "STAFF_METADATA_UPDATE_FAILED" }, 500); }
}

function normalizeStaffId(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48); }
function normalizeStaffName(value) { return String(value || "").trim().replace(/\s+/g, " ").replace(/[^a-zA-Z0-9 .'-]/g, "").slice(0, 80); }
function cleanCaption(value) { return String(value || "").trim().slice(0, 500); }
async function safeJson(res) { return (res.headers.get("content-type") || "").includes("application/json") ? res.json() : null; }
function json(data, status) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
