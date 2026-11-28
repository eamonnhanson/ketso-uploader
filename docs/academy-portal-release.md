# Academy portal coordinated release candidate

Draft PR #38, feature/academy-portal; companion backend feature/academy-portal-backend.
No merge, deployment, production SQL, email activation or Zapier/Zoho changes authorized.
This candidate extends the existing infrastructure; it does not introduce a second student registry.

## Production state confirmed by management — 28 November 2026

PostgreSQL 027, 028, 029 and Cloudflare D1 003 were manually executed and verified.
Do not rerun them as part of this deployment. PostgreSQL is 16.16. Pre/post counts match:
778 students; 328 online_tree_planting; 322 arboriculture_1; 10 donor_investor_funding;
660 enrolments total; reported SUM(total_points)=0. These are owner-reported production
results, not a fresh remote database inspection by this task.

Render and Pages Production have ACADEMY_PORTAL_ENABLED=false,
ACADEMY_PORTAL_ISSUER=https://ketso-uploader.pages.dev and an independently generated shared
ACADEMY_PORTAL_SECRET. STUDENT_EMAIL_ENABLED remains false. Values were not read or exposed.
Render redeployed existing main 21159eac successfully and database connectivity was confirmed.
The runtime role is web_ro; its name alone does not establish effective privileges.

Management relies on Aiven backups. Recoverability has not been independently verified.
No additional manual backup is requested; this accepted limitation remains recorded.
Keep data/schema and corrected enrolment function during rollback; do not restore a whole
backup over newer activity or reintroduce the donor-excluding function.

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
hash protect retry. The existing enroll_academy_student function is reused. The target cohort comes from the canonical academy_students.cohort field. A matching
(student, course, COALESCE(cohort, '')) enrolment is returned unchanged, including withdrawn/
completed status and existing token. Other genuine cohorts remain separate enrolments. No
cohort is trimmed, relabelled or backfilled. Responses and private course links include cohort.
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

Source-controlled scripts (now executed and verified in production by management; retained for reference):
- ptb-tree-map/docs/sql/027_academy_portal.sql: linkage, idempotency ledger, transactional registration.
- ptb-tree-map/docs/sql/028_academy_portal_crm_bridge.sql: compatible CRM function update.
- ptb-tree-map/docs/sql/029_academy_enrollment_concurrency.sql: function-only three-course correction; concurrent, cohort-aware idempotence.
- ketso-uploader/docs/sql/003_student_registration_intents.sql: retryable private D1 intent.

Existing course schema from 007/022 must be installed. The owner confirmed the live function
excludes donor_investor_funding even though 10 donor enrolments exist. Do not assume migration
023 matches production or rerun historical backfills: use corrective migration 029. Existing D1 migrations 001 and 002 remain unchanged.

The original schema gate covered nullable zoho_contact_id,
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

## Remaining coordinated deployment sequence — explicit approval required

1. Run the read-only `ptb-tree-map/docs/sql/academy_portal_web_ro_access.sql` in production.
   It reports access and generates only missing narrow GRANT statements; it executes none.
   Check the actual web_ro connection reports transaction_read_only=off and
   default_transaction_read_only=off. If RLS applies, review policies rather than grant BYPASSRLS.
2. An owner may apply only the generated missing grants after approval, then rerun the checks.
   Do not grant ALL, DELETE, CREATE, superuser, role membership, blanket sequence rights or
   write access to points. The enrolment id UPDATE column privilege is needed for FOR UPDATE;
   the application never updates enrolment IDs. Preserve existing legacy permissions.
   The SECURITY DEFINER CRM owner's SELECT(academy_student_id) privilege is checked separately.
3. Review the refreshed PR heads and checks. Main rechecked at backend
   21159eac5aed95a7db070049705a2ecc4587c283 and uploader
   87edd041942fe83838ed78ea7b79f3fae0304833; both are ancestors of their candidate branches.
4. After explicit merge/deploy approval, merge backend PR #69 first, including patched lockfile
   and qs override. Verify Render deploys the actual merge SHA; confirm installed body-parser
   1.20.9, proxy-addr 2.0.8 and qs 6.16.2. Keep portal/email false. Smoke-test health, legacy
   token/course reads, staff/tutor access, gallery and normal request parsing without real writes.
5. Only after backend acceptance, merge uploader PR #38 with approval and verify Pages deploys
   its actual merge SHA. Confirm legacy uploader routes and the five portal destinations.
   Keep both portal flags false and email false. No migrations or secret regeneration are needed.
6. Portal enablement is a separate explicit approval. Complete controlled acceptance with
   verified synthetic users before public launch, including profile linkage, true cohorts,
   consent withdrawal, private attachments, staff corrections and actual application AI.
   Email remains disabled until its separate webhook-security and activation gates pass.

Before any merge record the deployment actually serving each application for rollback. Rollback
must retain consent/CRM protections after any portal use. With no portal identities, previous
application SHAs can be restored after approval while keeping additive schema and 029. An older
backend rollback also reintroduces its npm advisories; prefer a corrective deployment when possible.

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

Real PostgreSQL 16.16 multi-connection and minimal-role testing now passes in a Docker container with networking
explicitly disabled, no published ports and synthetic data only. Live legacy student-column
nullability, role/function privileges and operational course prerequisites remain acceptance
checks; the owner-confirmed enrolment indexes do not need to be re-requested. No production
credentials were accessed. Abandoned private intents/photo objects still need a retention policy.

The ops-console test-scope conflict is resolved: general tests validate the isolation policy in a
synthetic Git repository. The identical strict branch/working-tree release enforcement is now
`npm --prefix apps/ops-console run check:isolation`, also mandatory at the start of its `npm run
check`. It correctly rejects this coordinated backend branch; no ops-only release is attempted.
Missing comparison history also fails the release guard. Read-only SQL and deployment-root
safeguards remain in the normal tests.

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

Backend npm test after dependency fixes: 306 passed, zero failures, five existing external-integration skips.
Uploader npm test: 154 passed, zero failures. Affected portal/workspace browser checks pass.
The earlier five browser scripts passed; this correction changes no uploader/auth/upload routes.
Real PostgreSQL concurrency command: `npm run test:academy-concurrency`.
The harness requires a fresh `ketso-portal-concurrency` Docker container, image postgres:16.16 (postgres:17 also supported),
network mode none, database ketso_synthetic. It refuses an existing populated test database.
Run it after:
```sh
docker run -d --name ketso-portal-concurrency --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=ketso_synthetic postgres:16.16
docker exec ketso-portal-concurrency pg_isready -U postgres
npm run test:academy-concurrency
```
Local trust authentication is confined to this network-isolated disposable container. It is not
production configuration. Stop/remove this named test container after reviewing the results.

Passed: 16 distinct PostgreSQL connections return one ID/token for the same identity; concurrent
requests for different cohorts produce separate rows; NULL and empty cohort resolve to one
identity; another student's token collision fails without a new enrolment; direct concurrent
writers commit or roll back safely; 12 separate portal requests produce one canonical linkage
and three enrolments in the student's genuine cohort. A 660-row synthetic baseline (including
10 donor enrolments and all four statuses) retains identical full-row fingerprints, points and
all five index definitions after migrations and attempted enrolment retries. Production's 660
rows were not queried or modified by these tests.

## Owner-confirmed production indexes and corrective semantics

Confirmed by management: primary key(id); UNIQUE(enrollment_token); unique expression index
academy_course_enrollments_identity_idx on (academy_student_id, course_key, COALESCE(cohort,
''::text)); ordinary indexes on academy_student_id and enrollment_token. Preserve all five.
029 creates/replaces only enroll_academy_student with its existing signature. There is no
student/course-only uniqueness constraint, table backfill, token regeneration or status update.

The function locks the canonical student, reads the exact cohort identity, and inserts using
ON CONFLICT with the EXISTING expression index. It re-reads a concurrent winner at READ
COMMITTED; token uniqueness violations are not swallowed or treated as identity matches.
At REPEATABLE READ/SERIALIZABLE, retry the entire transaction on SQLSTATE 40001, using the
same idempotency key. Deadlock 40P01 likewise requires bounded transaction retry. Never
retry a 23505 token collision by assigning the token to a different student.

An existing enrolment is not a status-edit API: calling with active must not reactivate a
withdrawn/completed record. Any intentional status transition requires a separately reviewed
staff operation. NULL and empty cohorts remain equivalent solely as already defined by the
index; two nonempty cohort strings remain distinct. Existing cohort history is never rewritten.

Management has completed migration verification and elected to rely on Aiven backups. Do not
repeat migrations or request a new manual backup. The unverified recoverability limitation is
recorded above. Keep the supplied production baseline as a dated observation, not a fixed future
count; legitimate business activity may add records.
Rollback preserves all enrolment rows/indexes; do not restore the known donor-excluding function
as a routine rollback. Disable new portal operations while retaining the corrected function and
consent/CRM guards after any portal identity has been created.

## Production npm security review

The current main lockfile reproduces the three Render findings in production dependencies:
- body-parser 1.20.5, high: GHSA-27r3-jxmh-p828 (compressed-body trailing-byte DoS), plus
  low-severity invalid-limit advisory GHSA-v422-hmwv-36x6. Global Express parsers run before
  route authentication; the compressed-body path is reachable even with the portal disabled.
  No invalid limit configuration was found. Update to 1.20.9.
- proxy-addr 2.0.7, critical: GHSA-jqcg-44mw-7w3h (IPv4-mapped IPv6 trust-subnet spoofing).
  No trust-proxy setting or req.ip/req.ips authorization was found in server.js/api; Express
  defaults to not trusting proxies. The vulnerable package is shipped, but the advisory's
  trust-subnet authorization prerequisite was not demonstrated here. Update to 2.0.8.
- qs 6.15.2, moderate: GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g and GHSA-6pq8-jhm2-2vcw.
  Extended URL-encoded parsing is reachable. No comma mode or application qs.stringify use
  was found, so not every advisory's specific prerequisite is demonstrated. Pin the transitive
  qs override to 6.16.2; Express's existing ~6.15 range otherwise retains vulnerable versions.

Express stays at 4.22.2; no major framework or application-route redesign. Compatible qs support
packages object-inspect and side-channel move with the dependency resolution. A clean npm ci
passes; production-only and full npm audits both report zero advisories at review time. This
is registry evidence, not a guarantee against unknown vulnerabilities. Both complete backend
regressions and new HTTP tests pass (normal JSON/form parsing, oversized-body rejection,
malformed compressed-body rejection, process health afterward and default proxy behaviour).

Pre-existing api/db.js TLS configuration disables certificate verification in production. It
was not changed: repository instructions require a separate certificate/TLS review, and Aiven
CA/connection settings were not inspected. This is distinct from the npm advisories.

PostgreSQL 16.16 role test: generated narrow grants permit registration, profile updates and
row locks. Deletion, account-email rewrites, enrolment-status rewrites, point writes, sequence
resets and schema creation are denied to the otherwise unprivileged synthetic web_ro. No
production GRANT was executed. Live effective web_ro privileges remain to be checked.
