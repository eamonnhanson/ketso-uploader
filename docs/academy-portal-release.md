# Academy portal and authentication candidate

Feature branch: feature/academy-portal. Draft PR only; no merge/deployment/email
activation, real email, Zapier/Zoho/Render/PostgreSQL writes or public announcement.
Base main: 87edd041942fe83838ed78ea7b79f3fae0304833.
The prior uncommitted deployment result notes are preserved in this change.

## Delivered and blocked scope

Delivered: shared five-destination navigation, brand palette/font fallbacks,
mobile course outlines without sign-in, root registration design with multiple
course choices/optional unchecked public-profile consent, transient 600px photo
preview/crop, separate staff entry, preserved private workspace and auth fixes.
Central form submission is disabled and server registration capability returns
unavailable: no canonical profile or course enrolment is falsely reported.
Direct POST /api/student/portal/register returns 503 with no writes. Sending new
course/photo/profile-consent fields to the old account-only register handler is
also rejected rather than silently creating an unenrolled account.

Not implemented because canonical backend capabilities are unavailable here:
verified multi-course enrolment, canonical photo/name updates and propagation,
central progress/achievement read API, and public profile consent/withdrawal across
existing course pages. No new public-profile listing was enabled. The new checkbox
is a design only, unchecked/optional and never persisted while gated.
Existing document/question publication permissions are unchanged. The existing
account-only D1 registration route remains for compatibility; it is not described
as canonical Academy registration and does not enrol a student.

## Registry audit and authoritative identity

Inspected uploader source, Academy course registry, student D1 SQL, profile-link
handler, public search proxy, token-based onboarding, uploads, tutor and points/
profile display paths. No production PostgreSQL connection/schema inspection was
available or performed. Do not claim PostgreSQL constraints were verified.
Known course keys stay unchanged:
online_tree_planting -> Online Agroforestry Training;
arboriculture_1 -> Distance Certificate Course Agroforestry (display alias only;
confirm this naming with Academy management before release);
donor_investor_funding -> Communicate effectively with donors and investors.

shared/portal-registry.js is a NAVIGATION registry, not a student registry.
shared/academy-courses.js retains existing module IDs. PostgreSQL remains the
authority for Academy student ID, enrolments, historical progress, points and
course records. D1 UUID is an authentication/workspace ID, not a competing Academy
identity. Its unique legacy_student_id links to the canonical PostgreSQL ID.
D1 retains passwords, sessions, verification/recovery and private work.
Existing linking requires a verified session, personal token and matching email;
public name search never authorizes linking. No automatic email-only legacy
profile takeover is added.

Available integrations observed: Render /api/academy-student personal-token read,
existing tutor auth/questions, public student search, upload/review flows and the
existing Zoho enrol-in-another-course form. None supplies a documented authenticated
atomic register/link + multi-course enrolment + profile-consent mutation contract.
No service credentials for such an integration are invented or configured.

## Minimal external dependency proposal (requires separate approval)

Extend the EXISTING Academy backend, not a new registry/service:
- A server-authenticated idempotent enrol/register operation after D1 verification.
  Bind an authenticated issuer/account ID to one canonical student. Do not trust a
  browser-supplied verified flag, email or arbitrary student ID. Existing-record
  linkage must retain the personal-token + verified-mailbox proof or a separately
  reviewed equivalent. Ambiguous identities go to explicit resolution, not duplicates.
- PostgreSQL transaction: upsert canonical identity by the approved stable linked
  subject; enforce unique linkage and unique (student_id, course_key); apply genuine
  prerequisites and atomically record all eligible selected enrolments. Return exact
  enrolled/pending/rejected states. Same idempotency key + payload returns the same
  result; changed payload conflicts. Concurrent identical requests cannot duplicate.
- Use a small D1 pending registration intent (not an Academy record) only when the
  integration is approved, to retain selected courses/private photo and consent
  through email verification and retry. Backend must recheck verification proof.
  Cross-system failures must be resumable under the same key; never announce success
  before PostgreSQL confirms. No such schema/migration is applied in this PR.
- Authenticated profile read/update keyed to the canonical ID: one name/photo,
  enrolments, available points/progress. Course pages use this same record.
- Explicit optional public profile consent, default false, scoped to name/photo/
  enrolments/appropriate achievements. A revisioned withdrawal must suppress every
  public course/profile projection and photo access; invalidate caches. Never expose
  email, authentication, drafts, questions or private files. Keep per-document/
  question consent separate. Review existing public permissions without expanding.
- Canonical photograph handling must not repurpose a private writing attachment or
  public legacy photo as automatic consent. Define private storage/authenticated
  reads, consent-scoped public access, replacement and cache invalidation.
- A session-to-Academy capability for protected course access is required before
  claiming one new login replaces all legacy personal-token flows. Preserve existing
  authorised tokens until that equivalent is approved.

Additional enrolment link remains exactly:
https://forms.zohopublic.eu/greenmakombeh/form/KETSOAcademyEnrolinanothercourse/formperma/FWXOc5zBBvDexB4K15XxcJypcvSrt6CYM5mOSMe2Ipg
Label: Enrol in another course. No form fields, webhook or Zoho behaviour changed.

## Navigation and compatibility

Root is home, not a sixth tab. Five matching links/tabs derive from the same registry:
1 /academy/online/ (Forest Green)
2 /academy/distance/ (Tree Bark)
3 /academy/donors/ (Orange accent, dark text)
4 /student-account/ (Muted Leaf Green)
5 /staff-home/ (Dark Charcoal)
Logo links home. Shared student cookie is unchanged. Staff authentication remains
separate and actual staff API authorization is preserved. Staff landing offers the
existing login through /uploader/?programme=staff; no student session grants access.

Original root uploader preserved at /uploader/ with original script/API endpoints.
Old root ?token and ?programme links redirect there with query parameters intact,
no-store and no-referrer; browser fallback also preserves the fragment.
The landing page has no generic upload-help panel. Photo help appears only in crop
UI; document help appears only during document selection. Existing galleries,
course/points APIs, tutor, project metadata and staff upload handlers unchanged.
Course outlines are browseable; this PR does not invent missing lesson content
or bypass personal-token access. Production student email remains false.

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

## Brand review and screenshots

Missing approved assets:
assets/brand/ketso_logo_white_clean.png
docs/brand/KETSO_Short_Brand_Book_and_AI_Prompting_Guide.docx
No generic logo was substituted. Missing image alt text is visible in screenshots.
Full brand-book compliance is BLOCKED until originals are supplied.

Implemented supplied palette: #203A29, #CF6600, #7D552C, #E8EFEA, #F7F5EF,
#1E211E; tab accents #547D60 and #414740. Book Antiqua with Palatino/Georgia serif
fallbacks, no remote font download. Logo intended width 180px/minimum 140px.
Dark text on Orange-accented white cards; native labels, focus outlines, 44px
buttons, responsive single-column mobile layout. Reviewed landing/workspace
screenshots; no horizontal overflow at 360/390/1280. No asset recolouring/cropping.
Book Antiqua appearance depends on device-installed fonts; fallbacks are expected.

30 local screenshots under artifacts/portal-review (ignored generated artifacts):
landing, registration, all five tabs, photo-crop, login-lockout and signed-in-workspace,
each at 360px, 390px and 1280px. Screenshots use synthetic data only. They show the
registration gate, not a functioning external enrolment system. Tests use Chromium;
native Android/device camera and bandwidth acceptance still required.

## Acceptance, blockers and rollback

Run npm test plus all five scripts: check-portal, check-student-workspace,
check-staging-safeguards, check-staff-metadata and check-academy-mobile.
Academy mobile uses CHROMIUM_PATH and exact Cropper 1.6.2 local fixture when CDN
access is unavailable. Test evidence is local/mock, not live backend verification.

Mandatory before release: approved assets/full brand review; approved canonical
registration/profile/enrolment and consent-withdrawal integration; authoritative
distance-course mapping; real concurrent duplicate/multi-course tests against that
integration; public projection/cache revocation; actual application AI; legacy
staff/tutor/course/points smoke; signed webhook before email activation; independent
production/staging credentials. No disabled feature may be called complete.

New unit tests deliberately verify registration remains fail-closed and no fake
enrolment/profile is created. Actual multi-course enrolment, central public-profile
withdrawal and canonical photo propagation cannot be end-to-end tested until the
backend capability exists. Existing individual publication withdrawal, private file
isolation, personal-token linking and staff auth regressions continue to run.

Rollback (after separate release approval only): restore recorded pre-feature
Pages production SHA 87edd041942fe83838ed78ea7b79f3fae0304833/deployment
05313109-3a29-4052-8254-6f98d84dca9a. Preserve D1/R2 and encrypted outbox keys.
No schema migration is introduced here. Old and new rate keys coexist; rolling
back reactivates old shared counters, so explain restored limits and inspect only
the affected account. Keep email false and do not activate Zapier. No backend,
course enrolment or consent migration is silently reversed.

## Final local validation

152 automated tests passed with zero failures/skips. All five browser scripts pass:
portal at 360/390/1280, student workspace, staging isolation, three staff metadata
scenarios and ten Academy mobile scenarios. Screenshots are local artifacts, not
production evidence. No tests claim real enrolment/consent integration is complete.
