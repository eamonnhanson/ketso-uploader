export async function onRequestPost(context) {
  const { request, env } = context;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return new Response(JSON.stringify({ error: "No file uploaded" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const key = file.name;

  await env.KETSO_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type
    }
  });

  return new Response(JSON.stringify({ ok: true, key }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
