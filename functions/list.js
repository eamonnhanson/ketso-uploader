export async function onRequestGet({ env }) {
  const objects = await env.KETSO_BUCKET.list();

  const files = objects.objects.map(obj => ({
    key: obj.key
  }));

  return new Response(JSON.stringify(files), {
    headers: { "Content-Type": "application/json" }
  });
}
