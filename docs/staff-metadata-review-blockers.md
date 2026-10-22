# Confirmed review blockers — 22 October 2026

This follow-up supersedes the original delivery status in staff-metadata-persistence.md.
Uploader PR #36 remains draft and depends on backend PR #65 plus the separate
proposal in backend-pr65-concurrency.patch. No production data was accessed.

## Contract and behavior

Names are preserved exactly, including repeated spaces, accents and leading/trailing
spaces. Non-string, blank-only and over-80-character supplied names are rejected;
names are never stripped, collapsed, transliterated or truncated during editing.
This applies only to metadata edits; new-upload functionality is unchanged.

Opening the editor captures both its displayed initial values and the raw persisted
values. Saving sends only modified staff_name/category/caption fields, immutable
staff_id and an expected object with the original raw values of those fields.
A no-change save sends nothing. Omitted fields stay omitted through the proxy and
backend; explicit empty/null captions still clear descriptions. Existing caption
trimming remains in place. Success confirmation checks only submitted fields,
allowing returned concurrent edits to unrelated fields to refresh the card/cache.

The proposed backend adds parameterized IS NOT DISTINCT FROM predicates to the
same UPDATE that writes the fields. This is an atomic field-level compare-and-swap,
not a separate read-before-write check. A stale value rejects the whole edit with
409; no automatic overwrite/retry occurs. The browser retains input and asks the
user to refresh and review. Different-field edits can both succeed without losing
one another. Missing/invalid expected values fail before SQL; no unguarded fallback.
A follow-up scoped read after a rejected UPDATE distinguishes a conflict from a
missing/inaccessible record; it never authorizes or performs a second write.
Authentication forwarding, original ownership and public/non-student scope remain.

## Backend PR #65 compatibility and separate proposal

Inspected exact head 2b087a4746cdc183662d184fc3dc700ee06f731c. It already preserves
omissions, but trims names and has no concurrency guard. It rejects expected as a
forbidden field, so the current uploader intentionally fails closed until #65 is
updated. Do not mark #36 ready against the unmodified #65.

backend-pr65-concurrency.patch applies cleanly to that head's handler and test files.
It proposes exact name validation, required expected values, atomic comparisons,
409 conflict responses, and updates existing backend unit/guarded PostgreSQL tests.
New PostgreSQL scenarios cover exact names, same-field rejection and different-field
preservation. No migration, production configuration or identity change is needed.
The older backend-staff-metadata.patch is historical; do not apply it over #65.
The new proposal is supplied separately to #65 for review, not pushed to its branch.

## Verification

- npm test: all 12 uploader test files passed. Individual execution: 102 tests
  passed, zero failures/skips, including 18 metadata runtime regressions.
- Chromium fixture browser scenarios: 3 passed at 360/390/1280px, with dialog
  height changes, Cancel/×, exact names after reload, omitted fields, explicit
  description clearing, concurrent unrelated edits, conflict input retention,
  authentication forwarding and safe failure behavior. All requests intercepted;
  no deployed service contacted. Required host permission for Chromium sockets.
- Proposed backend snapshot unit tests: 11 passed (2 existing, 5 regression,
  4 new concurrency). Actual #65 server route source was checked for the existing
  authentication gate; STAFF_SCOPE copied exactly from that head for this partial
  snapshot. Full backend suite was not run.
- Guarded PostgreSQL integration: 1 skipped; no approved disposable PostgreSQL
  service/URL available. SQL execution, lock behavior and durable reads remain
  unverified. Browser concurrency uses a compare-and-swap fixture, not PostgreSQL.
- New backend patch applicability and git diff --check passed.

Remaining blockers: apply/review the separate #65 proposal; run the full backend
suite and guarded disposable PostgreSQL acceptance (including the new simultaneous-connection cases); retain draft status until coordinated compatibility is verified.
No merge, deployment, migration or production access was performed.
