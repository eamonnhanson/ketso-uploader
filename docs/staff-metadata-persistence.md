# Staff metadata persistence investigation — 22 October 2026

Status: uploader fix implemented; companion backend change supplied as a patch.
Production acceptance and the exact deployed database failure remain unverified.
No production records, configuration, migrations, merges or deployments were changed.

## Evidence and limits

The browser sends staff_id, staff_name, category and caption from Edit details
to functions/api/staff-uploads/[id].js. That function forwards PATCH and the
existing staff session to ptb-tree-map /api/staff-uploads/:review_id.
server.js requires staff authentication before api/updateStaffUploadMetadata.js.
That handler uses api/db.js's PostgreSQL pool and updates photo_uploads_review
in one statement. It retains staff_id and requires the original staff owner,
staff upload context and public/non-student visibility scope.

STAFF_METADATA_UPDATE_FAILED is emitted by that handler's catch around pool
initialization and SQL execution. It does not identify the PostgreSQL error.
There is no deployed log, SQLSTATE, database connection, schema inspection
credential or Render deployment identity available in this session.
Consequently the exact cause of the reported production 500 is NOT confirmed.
No production PATCH was attempted to reproduce it.

Confirmed source defects, reproduced by local regression tests:

- The proxy accepted upstream HTTP 200 even with a failed or missing JSON body.
  The dialog accepted ok:true without a returned persisted row and could close
  without confirmation that its entered values had been written.
- Successful edits did not replace the cached upload receipt. Offline fallback
  could show an old description. Server rows already take precedence over cache
  when GET succeeds; this was not a server/cache merge-order bug.
- The 500-character edit textarea, proxy and backend limit conflicted with the
  management editor's 2,000-character captions. Editing a name could silently
  truncate an existing longer caption because every field is sent on Save.
- The original backend converts an omitted caption to NULL and writes it.
  A caller sending the required name/category but omitting caption erases it.
  The current dialog sends caption, so this alone does not explain its reported
  description loss.
- Ownership was taken from the current new-upload name rather than the record.
  The edited display name must never replace the immutable receipt staff_id.
  A mismatch ordinarily gives 404, not this backend 500.
- The category ESM file was loaded as a classic script, causing a browser syntax
  error. Existing fallback categories masked it; the page now declares the module.

The SQL sets name/category/caption together; a failed statement does not
partially commit a name change while clearing caption. The public gallery SELECT
explicitly includes caption and staff metadata. Its 300-row public feed and
visibility filters remain an existing limitation; absence from that feed does
not prove a deleted database record.

Unconfirmed causes of the production error include a schema mismatch, insufficient
UPDATE privileges, a database constraint or connectivity failure. In particular,
the previous PATCH RETURNING list unnecessarily required duration_seconds, which
only migration 025 adds, even for photos. The test baseline lacks that column.
This is a concrete schema dependency, NOT evidence that production lacks it.
The patch removes that unnecessary return dependency, but other gallery/video
queries still require their existing migrations.

Related PRs inspected: uploader #31/#32 (editor), #34 (session forwarding and
management), #35 (management editor usability); backend #61 (metadata SQL),
#64 (staff authentication/scope), and #55 (receipt persistence/schema baseline).
The original metadata SQL test mocked query results and did not execute PostgreSQL.

## Changes

The proxy now requires HTTP success, ok:true, a matching registry ID/staff ID,
and matching persisted name/category/caption. Invalid success responses become
502, never HTTP 200. Failures preserve upstream HTTP status and expose only fixed
diagnostic codes; raw upstream errors and exception messages are suppressed.
The browser independently checks the returned row before refreshing cards,
updating its offline cache and closing. Cache-write errors cannot turn an
already confirmed database write into a failed save.

The dialog has a labelled, 44px × button with the same discard handler as Cancel.
Failure retains inputs, displays HTTP status/diagnostic and permits retry.
An earlier save finishing after Cancel cannot close a newly opened editor.
The 2,000-character edit limit avoids truncating management captions; excessive
proxy input is rejected. Staff GET responses and browser refresh requests bypass
caches. Dynamic viewport sizing accommodates mobile browser/keyboard height.

The companion backend patch keeps one atomic UPDATE and the original authorization
scope. Omitted display fields retain their database values, while an explicitly
empty caption clears it. It supports 2,000-character captions and rejects longer
or non-string captions. Database exceptions remain HTTP 500 and log/return only
bounded diagnostic classes, without SQL, metadata, credentials or driver messages.

## Backend delivery blocker and review

The connected GitHub identity can read eamonnhanson/ptb-tree-map but branch
creation returned HTTP 403 Resource not accessible by integration. No backend
branch or PR was created. The uploader PR therefore includes
docs/backend-staff-metadata.patch, containing the actual backend handler change,
unit regressions and a guarded PostgreSQL integration test.

The patch was checked with git apply --check against the fetched handler source.
In an authorized ptb-tree-map checkout, create a separate branch, review/apply
that patch and run:

    node --test test/staffUploadMetadata.test.js test/staffUploadMetadataRegression.test.js
    node --test test/staffMetadataPostgresIntegration.test.js

The latter uses existing test/helpers/staffManagementDatabase.js and requires
PTB_STAFF_MANAGEMENT_POSTGRES_TEST_URL pointing to its disposable loopback
ketso_test role/database allowlist. It intentionally resets only that guarded
test database through the existing fixture. Never point it at production.
The full backend suite was not run in this partial source snapshot.

## Verification

- Node 24.19.0 npm test: all 12 uploader test files passed. Running the files
  individually reports 96 tests passed, zero failures/skips.
- New runtime regressions cover description, name, category, combined edits,
  long captions, unchanged identity/unrelated metadata, returned-row confirmation,
  reopen/cache reload, Cancel/×, successful closure, failures, safe diagnostics,
  authorization forwarding and late-response dialog isolation.
- Backend existing/new unit tests: 5 passed. PostgreSQL integration: 1 skipped
  because a dedicated local PostgreSQL service/URL is unavailable. SQL execution
  and durable PostgreSQL persistence have NOT been verified here.
- node scripts/check-staff-metadata.cjs: 3 fixture browser scenarios passed on
  Chromium at 360px, 390px and 1280px. Each checks close/discard, combined Save,
  page reload, error input retention and dialog fit at 740/480/740px heights.
  Playwright uses the environment tooling; no project dependency was added.
  All browser network requests are intercepted and use synthetic records.
- git diff --check and backend patch applicability check passed.

The reload checks above use fixture responses/cache. They do not establish
production database durability. Native Android keyboard, Chrome toolbar changes,
device rotation and interrupted mobile connections still require device testing.

## Configuration and remaining acceptance

No new environment variables or migration are introduced. Preserve the existing
STAFF_UPLOAD_KEY session configuration and PostgreSQL connection configuration.
Confirm the deployed backend revision, intended database/schema, existing receipt
columns (migration 022), and existing gallery/video migrations including 024/025.
Migration 026 belongs to the existing management feature, not this fix. Do not
apply migrations based only on the schema-mismatch hypothesis.

Before declaring resolution:

1. Publish/review the backend patch with an identity authorized for that repository.
2. Check read-only deployed error logs/schema evidence to identify the actual
   SQLSTATE/diagnostic and confirm whether configuration or a reviewed migration
   is needed. SCHEMA_MISMATCH, DATABASE_PERMISSION_DENIED, METADATA_CONFLICT,
   DATABASE_TIMEOUT and DATABASE_ERROR distinguish failure classes without secrets.
3. Run the new PostgreSQL test against the guarded disposable database, plus the
   relevant existing backend tests. Check name-only edits retain long captions.
4. After a separately authorized release, use an approved test record to change
   name/category/description together. Confirm PATCH returns matching persisted
   values, fresh GET returns them, and refresh/logout/login retains them.
   Repeat single-field, Cancel/× and forced-failure cases on Android.

The deployed acceptance criterion is still outstanding. This PR must not be
treated as proof that production persistence is fixed.
