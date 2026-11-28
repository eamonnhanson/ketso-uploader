# Academy portal coordinated release candidate

Draft PR #38, feature/academy-portal; companion backend feature/academy-portal-backend.
No merge, deployment, production SQL, email activation or Zapier/Zoho changes authorized.
This candidate extends the existing infrastructure; it does not introduce a second student registry.

## Ownership and registration

PostgreSQL academy_students.id is the canonical Academy identity; its existing enrolments,
points, progress and historical uploads remain authoritative. D1 IDs identify authentication
and private workspaces only. academy_portal_accounts binds one verified issuer/subject to
one canonical student, with unique student and verified-email constraints. The D1
legacy_student_id must agree. No public name search or unverified email establishes identity.

Central registration saves a private D1 intent and cropped photograph in private R2. Email
verification still uses the existing expiring single-use flow. After signing in, the student
reviews pending courses/photo and explicitly confirms enrolment and public consent again.
Pre-verification consent cannot publish anything. Existing Academy records require both
verified mailbox ownership and a matching personal upload/enrolment token. Ambiguous
historical email matches fail for staff resolution. No synthetic Zoho IDs are created.
Existing account-only users can save private registration choices in My Academy profile.

PostgreSQL serializes by normalized email and issuer/subject; an idempotency key and payload
hash protect retry. The existing enroll_academy_student function is reused. A selected course
with any existing enrolment retains its original status, including withdrawn/completed;
new course keys receive one active enrolment. The response reports actual statuses.
The CRM bridge keeps the existing process_academy_student_from_crm signature and links a
later Zoho contact to a portal-created record instead of inserting another identity.
It preserves a linked student's centrally managed full name. Existing tokens remain valid.

The repository confirms arboriculture_1 is Arboriculture I, with ten arb1 modules. No key
is renamed. Management must confirm that the new display label “Distance Certificate
Course Agroforestry” accurately describes that existing course before release.
No additional prerequisite is invented; confirm any operational prerequisites before enablement.

## Profile, privacy and compatibility

Authenticated profile updates use revision checks. Name lives in academy_students; photo
key and explicit public-profile consent live in its portal linkage. Photographs use immutable
private R2 keys and no-store authenticated/public-consent gateways. Course pages share the
same canonical name/photo projection. Withdrawal makes subsequent public photo requests
return 404 and removes the course projection; previously downloaded copies cannot be recalled.
Individual writing/question publication permissions remain separate and unchanged.

Portal identities are excluded from the legacy public student search, gallery representative
list and legacy profile endpoint, which otherwise expose contact details or old photographs.
Historical non-portal students retain those routes. Existing individually published uploads
retain their separate permissions. The new public projection contains only ID and name plus
the consent-checked image gateway, never contact details or enrolment tokens.

My Academy profile provides private enrolment tokens as existing authorised onboarding links,
plus available approved-lesson/points aggregates. It does not replace the existing course
modules or invent achievements. Staff authentication remains separate. Existing uploader,
tutor, metadata, course and points handlers are retained. Root token/programme links still
redirect to /uploader/ with query and fragment compatibility. Exactly five destinations use
shared/portal-registry.js; root is home, not a sixth tab. Additional enrolment uses the existing
Zoho “Enrol in another course” link unchanged. AI and staff corrections are unchanged.

## Exact migrations and configuration

Candidate scripts (none executed against production):
- ptb-tree-map/docs/sql/027_academy_portal.sql: linkage, idempotency ledger, transactional registration.
- ptb-tree-map/docs/sql/028_academy_portal_crm_bridge.sql: compatible CRM function update.
- ketso-uploader/docs/sql/003_student_registration_intents.sql: retryable private D1 intent.

Existing PostgreSQL migrations 007, 022_donor_investor_academy_course and
023_donor_investor_enrollment_function must already be installed. Do not blindly rerun old
backfills. Existing D1 migrations 001 and 002 remain unchanged.

Before approving SQL, inspect production schema read-only, especially nullable zoho_contact_id,
student ID types/defaults and other mandatory academy_students columns. The repository has no
complete CREATE TABLE snapshot for this legacy table. Synthetic tests use documented columns;
they cannot prove the live schema accepts portal-created records. Do not fabricate a Zoho ID
or silently remove a production constraint to bypass this check.

Read-only schema inspection:
```sql
SELECT column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='academy_students'
ORDER BY ordinal_position;
SELECT pg_get_functiondef('public.enroll_academy_student(bigint,text,text,text,text)'::regprocedure);
```

Render and Pages production, server-side only:
- ACADEMY_PORTAL_ENABLED=false initially; true only after coordinated acceptance approval.
- ACADEMY_PORTAL_ISSUER=https://ketso-uploader.pages.dev (must match exactly).
- ACADEMY_PORTAL_SECRET: a new independent random shared secret, at least 32 characters.
  Never reuse email, staff, Zoho or staging credentials. Do not expose it to browser bundles.

Retain STUDENT_DB=ketso-student-production, STUDENT_PRIVATE_FILES=ketso-student-private-production,
KETSO_BUCKET and existing AI binding/knowledge. STUDENT_EMAIL_ENABLED=false throughout this task.
The service URL is fixed to the existing Render backend; redirects are never followed.
Preview/staging portal integration fails closed and cannot call production registration APIs.
Do not copy the production service secret into shared Preview configuration.

HMAC-SHA256 signs timestamp, method, exact route and exact JSON body; backend accepts a 60-second
clock window with constant-time signature comparison. Register writes are idempotent; profile
updates require a matching revision. A captured request cannot replay a second profile change.
TLS is required. No personal data, raw errors, tokens or signatures are logged. No live secrets
were generated or configured. The separate unsigned Zapier email-hook risk remains unresolved;
email must stay disabled until its authenticated first-step guard is separately approved.

## Coordinated deployment sequence — future approval required

1. Review both draft PRs, confirm the live legacy schema/course mapping/prerequisites and database
   role privileges. Confirm managed-account exclusion is acceptable for legacy public profiles.
2. Back up existing Academy tables/functions. Record current Render and Pages rollback SHAs.
3. Manually apply PostgreSQL 027 then 028, and D1 003 to the intended resources only.
4. Deploy reviewed backend with portal flag false. Verify legacy token/upload/tutor/Zoho paths.
5. Configure independent service issuer/secret on Render and Pages; do not expose to Preview.
6. Deploy reviewed uploader with portal flag false and email false. Check all five destinations.
7. Only after separate approval, enable portal service and complete controlled verified synthetic
   account acceptance. Email activation remains a distinct blocked approval step.
8. Validate actual AI inference, staff corrections, consent withdrawal/direct photo URLs, retries,
   cross-account rejection, multi-course statuses, concurrent requests and unchanged historical points.

Rollback: disable ACADEMY_PORTAL_ENABLED on both services; retain private data and schema. Before
any registrations, previous frontend/backend revisions can be restored. After portal identities
exist, do not blindly roll back to a backend without consent filters or the CRM bridge: that could
re-expose private identities or duplicate Zoho records. Keep those guards while disabling new
operations. Never drop linkage/intent tables or delete student records as rollback.

## Brand-compliance review

Read docs/brand/KETSO_Short_Brand_Book_and_AI_Prompting_Guide.docx. Use the supplied
assets/brand/ketso_logo_transparent_clean.png unchanged on Warm Paper, width 180px/minimum
140px, with clear padding. No CSS filters, recolouring, stretching or generated substitute.
Forest-green headings; charcoal body; white/Warm Paper dominant; five matching accent colours;
Book Antiqua with local Palatino/Georgia fallbacks. No remote font service or new illustration.
Respectful practical language, contextual photo guidance and 600px crop controls, native labelled
forms and optional unchecked consent. Shared CSS/navigation apply to landing and all five tabs.

Screenshots regenerated at 360/390/1280 under artifacts/portal-review (ignored), including landing,
registration, all tabs, photo crop, lockout and signed-in workspace. They use synthetic/mock data.
Logo/palette/headings and overflow inspected; no claim of a native Android device test. Supplied
logo remains approximately 967 KB: a separately approved optimized derivative could improve
first-load bandwidth, but this candidate preserves the approved original exactly.

## Remaining acceptance limits

Synthetic PGlite tests execute real PostgreSQL functions, but are single-process: a real multi-
connection race test and live schema/privilege check remain mandatory before activation. No new
production database credentials were accessed. Unverified abandoned intent/photo cleanup needs
an operator retention policy; failed or ambiguous photo-update responses may leave private orphan
objects, never public objects. No automatic deletion is introduced.
The complete npm backend suite includes an ops-console-only branch isolation assertion that
rejects authorised changes outside apps/ops-console. It is not weakened or skipped here.
The draft must not be described as fully green until that repository test ownership is resolved.

## Lockout root cause and corrected policy

Previously all register/login/forgot/resend requests shared auth-email:<digest>
(10/15 min) and auth-ip:<digest> (30/15 min), including successful actions.
Repeated production acceptance across those actions exhausted the same budget.
429 had neither Retry-After nor a useful retry time. Prior windows were fixed;
indefinite extension was not demonstrated.

New login-failed:<SHA256(normalized email)> counts failures for existing AND
nonexistent accounts equally. First four failures return 401 plus remaining_attempts;
the fifth returns 429 with Retry-After/retry_after and locks for one hour from that
failure. Atomic capped update prevents concurrent failures extending that lock.
Blocked login requests do not mutate this counter. Success deletes it; successful
verified reset/verification also deletes that account's failed-login counter and
preserves session/token revocation. Expired counters restart at one.

Separate action-specific IP budgets: login 100/hour; other auth actions 60/hour.
These broader abuse budgets include successes and remain independent by action.
Registration, forgot and resend each have distinct email budgets of six/hour and
a one-minute cooldown. Cooldown rejections do not consume the six-request hourly
budget. Fixed windows do not slide on blocked requests. Recovery is not blocked by
login lockout. Broad IP abuse limits can still restrict traffic from that address;
this is separate from the account failure lock.

EmailReady is checked BEFORE counters for register/forgot/resend: email disabled
returns a clear 503 without consuming attempts. Existing login and previously
issued verification/reset links continue to work. Opaque receipt retry retains its
existing cooldown/expiry/attempt policy. D1 bindings retain environment separation.
UI explains the five-attempt limit and displays remaining attempts and a countdown.
Unknown and known-account failures use the same messages/counter policy.

## Safe targeted production test-account recovery (NOT executed)

Prefer the independent password recovery once email is separately authorized.
Email remains disabled now. If the owner explicitly authorizes an administrative
reset, confirm the exact test-account owner and select ketso-student-production.
Do NOT delete all rate limits, change passwords/verified status, rotate tokens,
or clear unrelated users' IP limits.

Generate the normalized email hash LOCALLY (never paste email/secret here):
PowerShell:
$email = (Read-Host 'Exact verified test-account email').Trim().ToLowerInvariant()
$sha = [System.Security.Cryptography.SHA256]::Create()
try {
  $hash = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($email)))).Replace('-','').ToLowerInvariant()
  $hash
} finally { $sha.Dispose(); Remove-Variable email }

Use only that hash in read-only inspection:
SELECT key,hits,expires,datetime(expires,'unixepoch') AS expires_utc
FROM student_rate_limits
WHERE key IN ('auth-email:<HASH>', 'login-failed:<HASH>');

If explicitly authorized, clear ONLY those inspected test-account rows:
DELETE FROM student_rate_limits
WHERE key IN ('auth-email:<HASH>', 'login-failed:<HASH>');

auth-email is the old deployed shared counter; login-failed is this candidate's
replacement. Do not execute both blindly in unrelated databases. An existing
shared-IP block on the old release must expire (15-minute window); do not globally
clear it to bypass the account check. New email-action budgets are intentionally
not cleared by this procedure. Keep an operator audit record without secret values.

## AI and unsigned webhook

Gemma @cf/google/gemma-4-26b-a4b-it and KETSO_APPROVED_INFORMATION unchanged.
Educational boundaries, labelled hypothetical figures, refusal/failure messages,
private question snapshots and staff corrections preserved. Actual application
inference remains a mandatory public-launch gate.

Minimal proposed authenticated webhook improvement (NOT implemented/activated):
HMAC-SHA256 over an exact serialized payload with version, request_id, attempt_id,
timestamp and body digest, using a dedicated shared secret distinct from callback
and AES secrets. The first guarded Zap step verifies signature with a constant-time
comparison, timestamp freshness and request/attempt deduplication BEFORE Zoho.
A timestamp alone does not prevent replay. Verify Next Gen Zap exposes the exact
signed bytes or define a canonical serialization explicitly; reject malformed/
missing signatures. No send/error path may bypass this guard. Callback stays
authenticated independently. If this cannot be implemented in the existing Zap,
use an authenticated inbound trigger supported by that platform, with approval;
do not add a proxy service speculatively. Requires separately approved Zap/backend
adapter changes and replay/forgery testing. Production email stays disabled.

## Validation record (28 November 2026)

Uploader: 154/154 automated tests pass. All five offline browser scripts pass, including
360/390/1280 portal navigation, enabled synthetic multi-course registration, optional consent,
photo crop, workspace, staging safeguards, staff metadata and ten Academy mobile scenarios.
Backend functional directory: 242 pass, zero failures, five existing environment-dependent skips.
Full backend npm test: 304 pass, one ops-console branch/working-tree isolation failure, five skips.
The new signed-API/PGlite tests pass, including public-photo withdrawal, stale revisions and
cross-account denial. No tests used real students, production SQL, email or external writes.
