(function (root) {
  "use strict";

  // One immutable attempt per photo. Keep confirmed object keys until receipt.
  // This deliberately does not persist files or claim to support offline uploads.
  function createSubmission({ original, cropped, metadata, folder, upload, save, recover, onStatus = () => {} }) {
    const details = JSON.parse(JSON.stringify(metadata));
    let originalKey = null;
    let croppedKey = null;
    let receipt = null;
    let inFlight = null;
    let saveAttempted = false;

    async function send() {
      if (!originalKey) {
        onStatus("Uploading original photo… Keep this page open.");
        originalKey = await upload(original, folder, "original");
        if (!originalKey) throw new Error("missing_object_key");
      }
      if (!croppedKey) {
        onStatus("Uploading photo preview… Keep this page open.");
        croppedKey = await upload(cropped, folder, "preview");
        if (!croppedKey) throw new Error("missing_object_key");
      }
      const keys = { originalKey, croppedKey };
      if (saveAttempted) {
        onStatus("Checking whether your submission was received…");
        // A missing gallery item cannot prove a timed-out save did not commit.
        // Recovery must confirm receipt or explicitly guarantee idempotent retry.
        const recovered = recover ? await recover({ ...details }, keys) : null;
        if (recovered?.ok === true && /^[1-9]\d*$/.test(String(recovered.review_id || ""))) {
          receipt = recovered;
          return receipt;
        }
        if (recovered?.retry_safe !== true) throw new Error("receipt_unknown");
      }
      onStatus("Saving your submission…");
      saveAttempted = true;
      const result = await save({ ...details }, keys);
      if (!result || result.ok !== true || !/^[1-9]\d*$/.test(String(result.review_id || ""))) {
        throw new Error("unconfirmed_receipt");
      }
      receipt = result;
      return receipt;
    }

    return {
      run() {
        if (receipt) return Promise.resolve(receipt);
        if (inFlight) return inFlight;
        inFlight = send().finally(() => { inFlight = null; });
        return inFlight;
      },
      get received() { return Boolean(receipt); },
      get filesUploaded() { return Boolean(originalKey && croppedKey); },
      get saveAttempted() { return saveAttempted; }
    };
  }

  const api = { createSubmission };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KetsoStaffPhotoSubmission = api;
})(typeof window !== "undefined" ? window : globalThis);
