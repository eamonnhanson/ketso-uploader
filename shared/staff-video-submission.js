(function (root) {
  "use strict";

  // One immutable stored video per attempt. A video never enters image crop logic.
  function createSubmission({ file, metadata, folder, upload, save, recover, onStatus = () => {} }) {
    const details = JSON.parse(JSON.stringify(metadata));
    let objectKey = null;
    let receipt = null;
    let inFlight = null;
    let saveAttempted = false;

    async function send() {
      if (!objectKey) {
        onStatus("Uploading video… Keep this page open.");
        objectKey = await upload(file, folder, "video");
        if (!objectKey) throw new Error("missing_object_key");
      }

      if (saveAttempted) {
        onStatus("Checking whether your video was received…");
        const recovered = recover ? await recover({ ...details }, { objectKey }) : null;
        if (recovered?.ok === true && /^[1-9]\d*$/.test(String(recovered.review_id || ""))) {
          receipt = recovered;
          return receipt;
        }
        if (recovered?.retry_safe !== true) throw new Error("receipt_unknown");
      }

      onStatus("Saving your video receipt…");
      saveAttempted = true;
      const result = await save({ ...details }, { objectKey });
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
      get filesUploaded() { return Boolean(objectKey); },
      get saveAttempted() { return saveAttempted; }
    };
  }

  const api = { createSubmission };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KetsoStaffVideoSubmission = api;
})(typeof window !== "undefined" ? window : globalThis);
