export async function onRequestPatch() {
  return new Response(JSON.stringify({
    ok: false,
    error: "TODO: implement small staff upload edits here when the metadata API supports PATCH updates."
  }), {
    status: 501,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
