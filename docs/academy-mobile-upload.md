# Academy mobile upload handover

## Scope and findings

Only `academy-onboarding/index.html` changes application behavior. The management
view in `ptb-tree-map/frontend/automation-dashboard/ketso/ketso-shell.js` embeds this
same page in an iframe; its staff/admin navigation is deliberately not copied.
Root `index.html` / `app.js` contain separate student and staff flows, including
donor report sections. Those flows, shared course definitions, galleries, review,
enrollment lookup, Cloudflare upload function and receipt page remain unchanged.
The onboarding page already supports lesson-based photos, text, documents and
video; it does not have a caption or donor report-section field to migrate.

The original page omitted a mobile viewport declaration, let Cropper follow a
large image's rendered height, and displayed all fields and technical crop/upload
actions together. A constrained crop parent now uses 45dvh (45vh fallback), with
responsive Cropper coordinates, compact accessible zoom controls and normal page
scrolling. Existing image compression thresholds and aspect ratio are preserved.

Students choose their work, confirm the photo, enter existing assignment details,
and review before submitting. Text, video and documents skip the photo step.
Camera input uses direction-free native capture and the same photo processing
handler as gallery selection. Unsupported capture falls back to a file picker.
Back navigation retains file, course, lesson, student details, consent and answer.

## Reliability and limitations

Uploads show stage status and freeze controls while active. A failed file upload
keeps files and values in memory and offers **Try again**. Confirmed original or
document/video object responses are cached for that selection. No automatic
retry, offline storage, login, service worker, schema change or backend change.

The inspected `ptb-tree-map/api/savePhotoReview.js` only has idempotency for
`staff_upload` via `(staff_id, cropped_file_url)`. Student saves lack this
guarantee. Once the review POST starts, any unconfirmed outcome blocks further
submission and asks the student to have their tutor check receipt. Even a server
error is treated conservatively; no safe retry is assumed. This needs a backend
idempotency/receipt-recovery contract to improve in a later change. A lost R2
response may leave an orphan object if retried, but cannot duplicate the review
record in this page session. Refresh/closing the page loses in-memory recovery;
protection across reloads/devices is not provided.

Token lookup still passes the personal link unchanged to the existing endpoint,
which prioritizes enrollment tokens and supports legacy student tokens. Existing
course mapping and permission enforcement are retained. No live tokens or real
student data were used in tests. Real multi-enrollment and legacy links should
be checked in an approved test environment; mocked frontend tests are not proof
of production token/database behavior.

## Executed checks

- Node 24.19.0: `npm test`: **51 passed, 0 failed** (19 new Academy cases).
- `scripts/check-academy-mobile.cjs`: **8 passed, 0 failed** in headless Chrome,
  portrait/landscape 3000×4000 / 4000×3000 images at 320/360/390/430px widths,
  heights 740→580→740. Checks no horizontal overflow, 45dvh preview, scrolling,
  accessible zoom/confirm actions, both file-input pipelines, output max side
  600px, original preservation, back navigation, selected lesson and receipt.
- Browser API requests are intercepted. No production uploads or saves occur.
- Existing token-fallback and management-shell tests in `ptb-tree-map`:
  **3 passed, 0 failed** (source contract checks, no live database access).
- Native Android camera UI, lens switching, camera cancellation, actual mobile
  browser toolbars, low-memory hardware and real slow networks remain manual.
  VM tests cover cancellation and >8MB preparation; browser tests use large image
  dimensions, not a noisy >8MB camera file.

Run browser checks with Node 24, an existing Chrome installation, and Playwright
on `NODE_PATH`: `node scripts/check-academy-mobile.cjs`. Set `BROWSER_CHANNEL=msedge`
to use Edge. Playwright is a development-only prerequisite; no frontend dependency
was added. Existing pinned Cropper CDN assets need network access for this check.

## Android review checklist

Use an approved preview/test backend with test student links; do not test actual
submissions against production without approval.

1. Open an enrollment link and a legacy link; check name and course. Check a
   student enrolled in multiple courses with each course's personal link.
2. Choose photo: try rear camera, selfie, cancellation, then gallery fallback.
3. Try large portrait and landscape photos; scroll, rotate phone, hide/show the
   browser toolbar, zoom and move the frame. Confirm photo must remain reachable.
4. Fill course/lesson and consent, go back and forward, check retained values and
   preview, then submit once. Verify receipt and View my upload.
5. Interrupt a file upload, restore network and choose Try again. Check retained
   work. Double-tap submit; verify exactly one review record.
6. Lose the review response: verify the page blocks re-send and instructs receipt
   checking. Have the tutor confirm whether it arrived before another attempt.
7. Check text, MP4 video, PDF/document and course-specific lesson choices; verify
   they never enter the crop step. Check root donor report sections and staff
   flows as unchanged regression references.

## Deployment

Cloudflare Pages production settings live outside this repository, as documented
in README; no source-controlled Wrangler/Pages configuration was found. The
uploader remains independently deployable. No deployment command, merge,
production data mutation or environment change is part of this work. Any host
automation associated with publishing a branch/PR is managed externally; a PR is
not confirmation of what is deployed.
