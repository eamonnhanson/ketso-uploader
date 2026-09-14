# Reliable staff photo upload — handover

Scope: `staff-upload-dashboard/`, its existing Cloudflare staff wrapper, and a small vanilla-JS attempt controller. No deployment or merge is part of this change. Tree Map, student flows, authentication, galleries, video and location collection are not implemented by this package.

## Behaviour

- Before selection: explicit JPG/PNG/WebP and 25 MiB input limit; existing full-photo resizing to 8 MiB and preview compression remain. Full image is selected initially; optional crop controls remain.
- During preparation/upload: one immutable set of photo, crop, name, category, note and tree. Fields cannot change while their previous values are being sent. Double clicks share/guard the same attempt.
- File-stage failure: keep confirmed object keys. `Try again` uploads only the missing file. Removing a photo before metadata save preserves the entered note.
- Metadata-stage error, timeout, malformed JSON, HTTP-200 application error or missing review ID: show **unconfirmed receipt**, not success and not a claim of non-receipt. `Check receipt` performs a read-only lookup; it does not repeat the POST.
- Receipt: require `ok: true` and a positive review ID. The received attempt cannot post again. Browser cache errors cannot turn confirmed server receipt into an upload failure. Start another photo explicitly.
- Staff gallery entries from the server take precedence over cached copies. Local history remains optional and incomplete.
- Current-tab state only. Files/notes are not persisted as drafts and uploads do not resume by byte range. A best-effort unload prompt is not an Android background-lifecycle guarantee.

## Critical backend limitations

This is a conservative uploader-only package. **It does not complete the end-to-end backend reliability work identified in the UX review.**

1. The existing public gallery is a bounded feed (300 rows in the reviewed backend). A positive exact-file/staff match is evidence of receipt; no match cannot prove that an in-flight save failed. Hidden/older uploads may not be found. The UI remains blocked on unconfirmed receipt rather than duplicating the record; KETSO must check the displayed file reference. The wrapper never returns `retry_safe: true`.
2. Fully automatic metadata retry requires backend idempotency and an authoritative exact receipt lookup. Do not enable retries just because an item is missing from the gallery. The controller's explicit `retry_safe` extension is covered by a unit test but is not enabled by the current wrapper.
3. The reviewed `ptb-tree-map/api/savePhotoReview.js` does not INSERT staff caption, subcategory or dedicated staff ID. This wrapper continues forwarding these existing fields, but cannot guarantee their persistence. A successful row receipt does not prove those fields are retained. Cached fields must not be used as evidence of database persistence.
4. Staff names and their normalized IDs are existing routing/filter values, not authentication. This change adds no access-control guarantee. Existing backend public/staff rules and R2 policy remain unchanged.
5. If the response to an R2 write is lost, the unknown file must be resent under the current timestamp-based key scheme; a duplicate/orphan object is possible. Known successful keys are never resent. The new request folder uses a random UUID to avoid cross-attempt collisions; this is not server idempotency.

An abandoned partial attempt may also leave an R2 object. This PR does not delete files or add an automatic cleanup workflow.

These are separate backend follow-ups requiring their own review and authorization. No schema, SQL, backend implementation, production data or existing Tree Map registry has been changed here.

## API contract changes

`GET /api/staff-uploads?staff_id=…&file_url=…` reuses the existing endpoint and existing upstream gallery request. It validates that the file belongs to the R2 host and the requested staff folder. A match requires the exact URL, matching staff, `staff_upload` context and positive ID.

```json
{ "ok": true, "received": true, "review_id": 123, "upload": {} }
```

When no matching entry is found:

```json
{ "ok": true, "received": false, "retry_safe": false }
```

`received: false` here means **not confirmed from this feed**, not confirmed absent from the database. Network/HTTP errors remain errors. Ordinary list responses are unchanged. POST now rejects an upstream application failure or missing/invalid receipt ID, even with HTTP 200. Timeouts: upstream list 25 seconds, upstream metadata 50 seconds; browser metadata 60 seconds, individual files 180 seconds. These are bounded waits, not promises that files of every size will finish on every network.

## Verification

Use Node 24 LTS (Node 22.7+ supports module detection). No new runtime libraries or npm install needed.

```sh
npm test
node scripts/preview-staff-upload.cjs
```

Open `http://localhost:8767/?staff_name=Test%20Staff`. The yellow bar is test-only. Choose Nursery, add a note and press `Use test photo`. Test:

1. `success`: send once, verify receipt, try a second click, then Send another photo.
2. `preview-fail-once`: first preview request fails; retry sends one file, not both.
3. `save-response-lost`: fixture saves a row but returns 503; Check receipt finds it without another POST.
4. `save-not-received`: no row; repeated Check receipt never POSTs again or claims success.

The fixture serves local source and blocks external API requests with CSP. Only existing CropperJS assets load from the CDN. All images, names and receipts are fictitious; no R2/database/email access. The fixture's metadata echo is not evidence of production persistence. `/__evidence` shows local calls only. Stop with Ctrl+C.

Automated tests cover the controller, actual inline page handlers with DOM/service doubles, and the actual Cloudflare wrapper with mocked fetch. No production integration tests. Real Android camera/picker, GPS, TalkBack, tab discard and constrained field networks still require device testing.

Validation on 14 September 2026: `npm test` passed all 21 tests on Node 24.19.0. Node emits a module-detection warning for existing ES-module Functions under the mixed-format repository; tests still pass. Browser fixtures at 360 and 412 CSS pixels reproduced partial-file recovery, lost-save-response receipt recovery and an unknown receipt that never resubmits. These are desktop browser viewports, not physical Android tests. Screenshots: [received at 360 px](staff-photo-received-360.png), [unconfirmed at 412 px](staff-photo-unconfirmed-412.png). Yellow controls are test-only.

## Continue on another computer

```sh
git clone --branch feature/reliable-staff-photo-upload https://github.com/eamonnhanson/ketso-uploader.git
cd ketso-uploader
git status --short --branch
npm test
node scripts/preview-staff-upload.cjs
```

Existing checkout instead:

```sh
git status --short
git fetch origin
git switch --track origin/feature/reliable-staff-photo-upload
npm test
```

Keep existing uncommitted work safe before switching. If the branch already exists locally, use `git switch feature/reliable-staff-photo-upload` followed by `git pull --ff-only`.

No deployment commands are included. Verify actual Cloudflare Pages build/preview settings and backend release compatibility before any future deployment. Revert this PR to roll back source changes; no migration rollback is needed. See `workflow-registry.csv` and `ux-review-conclusions.nl.md`.
