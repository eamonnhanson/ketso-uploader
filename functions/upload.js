export async function onRequestPost({ request, env }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return jsonResponse({
        ok: false,
        error: "No file uploaded"
      }, 400);
    }

    const allowedMimeTypes = [
      // images
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",

      // videos
      "video/mp4",
      "video/quicktime", // .mov
      "video/webm"
    ];

    const allowedExtensions = [
      // images
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".heic",
      ".heif",

      // videos
      ".mp4",
      ".mov",
      ".webm"
    ];

    const originalName = (file.name || "upload").trim();
    const lowerName = originalName.toLowerCase();

    const hasAllowedExtension = allowedExtensions.some(ext => lowerName.endsWith(ext));
    const hasAllowedMimeType = allowedMimeTypes.includes(file.type);

    if (!hasAllowedExtension || !hasAllowedMimeType) {
      return jsonResponse({
        ok: false,
        error: "Only image and video files are allowed (jpg, jpeg, png, webp, gif, heic, heif, mp4, mov, webm)"
      }, 400);
    }

    // block path tricks and weird names
    if (
      originalName.includes("/") ||
      originalName.includes("\\") ||
      originalName.includes("..")
    ) {
      return jsonResponse({
        ok: false,
        error: "Invalid filename"
      }, 400);
    }

    const isVideo = file.type.startsWith("video/");
    const maxImageSize = 10 * 1024 * 1024;   // 10 MB
    const maxVideoSize = 100 * 1024 * 1024;  // 100 MB

    if (!isVideo && file.size > maxImageSize) {
      return jsonResponse({
        ok: false,
        error: "Image too large. Maximum size is 10 MB."
      }, 400);
    }

    if (isVideo && file.size > maxVideoSize) {
      return jsonResponse({
        ok: false,
        error: "Video too large. Maximum size is 100 MB."
      }, 400);
    }

    const extension = lowerName.substring(lowerName.lastIndexOf("."));

    const safeBaseName = originalName
      .replace(/\.[^/.]+$/, "")          // remove extension
      .replace(/[^a-zA-Z0-9._-]/g, "_")  // only safe chars
      .replace(/_+/g, "_")               // collapse __
      .replace(/^_+|_+$/g, "")           // trim _
      .slice(0, 80) || "upload";

    const prefix = isVideo ? "video" : "image";
    const key = `${prefix}_${Date.now()}_${safeBaseName}${extension}`;

    await env.KETSO_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream"
      }
    });

    return jsonResponse({
      ok: true,
      key
    }, 200);

  } catch (err) {
    return jsonResponse({
      ok: false,
      error: err && err.message ? err.message : String(err)
    }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
