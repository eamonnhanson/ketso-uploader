const DEFAULT_SEARCH_API_URL = "https://ptb-tree-map.onrender.com/api/academy-student-search";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return jsonResponse({ ok: true, students: [] });
  }

  const target = new URL(env.ACADEMY_STUDENT_SEARCH_API_URL || DEFAULT_SEARCH_API_URL);
  target.searchParams.set("q", q);

  try {
    const res = await fetch(target.toString(), {
      headers: env.ACADEMY_STUDENT_SEARCH_TOKEN
        ? { "x-api-key": env.ACADEMY_STUDENT_SEARCH_TOKEN }
        : {}
    });

    const data = await safeJson(res);

    if (!res.ok || !data) {
      return jsonResponse({
        ok: false,
        error: "Student search backend is not available yet."
      }, res.status || 502);
    }

    return jsonResponse({
      ok: true,
      students: normalizeStudents(data.students || data.results || [])
    });
  } catch {
    return jsonResponse({
      ok: false,
      error: "Student search backend is not available yet."
    }, 502);
  }
}

function normalizeStudents(students) {
  return students.slice(0, 20).map((student) => ({
    id: student.id,
    ketso_student_id: student.ketso_student_id,
    full_name: student.full_name ||
      [student.first_name, student.last_name].filter(Boolean).join(" "),
    first_name: student.first_name,
    last_name: student.last_name,
    email: student.email,
    whatsapp: student.whatsapp,
    cohort: student.cohort,
    track: student.track,
    primary_stream: student.primary_stream
  })).filter((student) => student.id && student.full_name);
}

async function safeJson(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return res.json();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
