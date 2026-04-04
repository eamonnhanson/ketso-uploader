export async function onRequestPost({ request, env }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return new Response(JSON.stringify({
        ok: false,
        error: "No file uploaded"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif"
    ];

    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".heic",
      ".heif"
    ];

    const originalName = file.name || "upload";
    const lowerName = originalName.toLowerCase();

    const hasAllowedExtension = allowedExtensions.some(ext => lowerName.endsWith(ext));
    const hasAllowedMimeType = allowedMimeTypes.includes(file.type);

    if (!hasAllowedExtension || !hasAllowedMimeType) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Only image files are allowed (jpg, jpeg, png, webp, gif, heic, heif)"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (originalName.includes("/") || originalName.includes("\\") || originalName.includes("..")) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid filename"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const extension = lowerName.substring(lowerName.lastIndexOf("."));

    const safeBaseName = originalName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "image";

    const key = `${Date.now()}_${safeBaseName}${extension}`;

    await env.KETSO_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream"
      }
    });

    return new Response(JSON.stringify({
      ok: true,
      key
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: err && err.message ? err.message : String(err)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
