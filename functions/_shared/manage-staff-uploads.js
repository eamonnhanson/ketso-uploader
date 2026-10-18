export async function forward({ request, params }) {
  const id = params?.id;
  if (id && !/^[1-9]\d*$/.test(id)) return Response.json({ ok: false, error: 'Invalid upload ID' }, { status: 400 });
  const url = new URL('https://ptb-tree-map.onrender.com/api/staff-managed-uploads' + (id ? '/' + id : ''));
  url.search = new URL(request.url).search;
  try {
    const response = await fetch(url, { method: request.method,
      headers: { 'Content-Type': 'application/json', Authorization: request.headers.get('Authorization') || '' },
      body: request.method === 'PATCH' ? await request.text() : undefined, signal: AbortSignal.timeout(25000) });
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ ok: false, error: 'Staff service unavailable. Please try again.' }, { status: 502 }); }
}
