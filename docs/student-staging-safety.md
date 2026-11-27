# Isolated student staging application

Branch: `student-staging`. No commit, push, deployment, real mail or production
resource change is authorized/performed by this work. The owner confirmed Preview
D1 `ketso-student-staging` (`STUDENT_DB`), migrations 001/002 (nine tables/three named
indexes), and private R2 `ketso-student-private-staging`
(`STUDENT_PRIVATE_FILES`, public access disabled). No migrations were rerun.

## Enforcement

`_routes.json` sends every request, including static assets, through root Pages
Functions middleware. `functions/_middleware.js` applies a small staging allowlist;
it denies legacy routes before their handler or HTML is executed. Production
requests pass through unchanged. No Render or PostgreSQL code was modified.

Staging detection uses `STUDENT_STAGING=true`, or the existing project's Preview
hostnames (`*.ketso-uploader.pages.dev`), or a non-main `CF_PAGES_BRANCH` when that
metadata is available. Do not rely on build variables being available at runtime:
set the explicit Preview variable. The intended production branch is `main`.

Only the exact `STUDENT_STAGING_ORIGIN` may use staging resources. Its default is
`https://student-staging.ketso-uploader.pages.dev`. Other branch aliases and hashed
Preview URLs are denied, even when they run this same code with shared bindings.
Use the stable alias for the application and callback. A custom/dedicated project
origin requires an explicit `STUDENT_STAGING_ORIGIN` and `STUDENT_STAGING=true`.

Staging exposes only the account page, student API, exact student JS/CSS assets,
source templates, and safe generated profile/question-console pages. `/` redirects
to `/student-account/`. Unknown routes are denied. A server-supplied CSP restricts
connections, scripts and forms to this origin and disables frames/workers. Legacy
HTML/JS is not served; its hard-coded production calls cannot start. No frontend
fetch monkey-patching or UI hiding is used as the security boundary.

The account page omits the production course-token form. `/api/student/link` is
also denied by middleware and by the student handler itself. Staging staff access
uses only `STUDENT_STAGING_ADMIN_KEY` (minimum 32 characters); absent configuration
fails closed. It never sends a supplied credential to Render. The generated
question console loads only the staging queue, with no legacy answer/close UI.
Staging questions do not invoke shared AI bindings; they remain available to staff.

Accounts, drafts, questions and files retain their normal authentication and
owner/publication checks and use the dedicated student bindings. Staging does
not provide an authentication bypass or auto-verify students. With email disabled,
new email-based registrations/resets fail closed as designed. Existing verified
synthetic accounts can still use drafts, files and the workspace.

## Production dependency inventory

| Surface | Dependency / risk in legacy app | Staging action |
| --- | --- | --- |
| `app.js`, uploader root | Production uploader `/upload`, Render review/question writes, Zoho forms | Root redirects; legacy script denied |
| `/upload`, `/list` | `KETSO_BUCKET` public file writes/listing | All methods denied before handlers |
| `/api/staff-uploads*`, `/api/staff-managed-uploads*` | Render review writes, metadata edits, management; underlying PostgreSQL | All methods denied |
| `/api/academy-student-search` | Render student names/emails and other real identity fields | Denied |
| Galleries, profiles, academy upload receipts, anonymous claims | Render/R2 real student information and media | Legacy pages denied; staging profile reads only staging D1 |
| Onboarding, academy submission, admin review | Render save/submit/approve/reject/hide writes and public bucket uploads | Denied |
| Legacy tutor/my-questions pages | Real private questions, Render answer/close actions | Denied or replaced with staging-only console |
| New account's course linking | Render personal-token lookup | Denied in middleware and handler |
| New queue's staff authorization | Render tutor queue GET with real admin credential | Replaced by separate staging-key check |
| New student persistence | D1 and private R2 | Allowed through existing ownership/session controls; no `KETSO_BUCKET` fallback |
| Email | Zapier → Zoho | Disabled unless explicit enable and complete secrets; fixed origin must match staging |
| AI | Optional Cloudflare AI and approved information | Disabled in staging handler |
| PostgreSQL | No direct driver/binding in uploader; accessed behind Render | No staging Render calls, so no PostgreSQL reads/writes through this app |

Production code and legacy routes remain intact and are exercised by regression
checks. `STUDENT_STAGING` must never be enabled on the existing production app.

## Required manual Cloudflare configuration before approval to push

1. In **Workers & Pages → ketso-uploader → Settings**, select **Preview**:
   - `STUDENT_STAGING=true`.
   - `STUDENT_STAGING_ORIGIN=https://student-staging.ketso-uploader.pages.dev`.
   - `STUDENT_EMAIL_ENABLED=false` (or unset). Leave Zap/Zoho dispatch disabled.
   - Confirm `STUDENT_DB` and `STUDENT_PRIVATE_FILES` target only the owner-confirmed
     staging resources. Public R2 access must remain disabled.
   - Do not supply production `KETSO_BUCKET`, Render/PostgreSQL credentials,
     production mail secrets or shared AI bindings to Preview. Remove unnecessary
     Preview grants only; do not change Production settings.
   - Optionally configure a separate staging-only `STUDENT_STAGING_ADMIN_KEY`
     for synthetic staff-console checks. Do not reuse any production password.
2. Check **Builds & deployments → Branch control / Preview deployments**:
   include only `student-staging`, with no wildcard/all-branch preview builds.
   Keep existing production branch `main`. Restrict who may push/approve changes
   on the staging branch and prevent untrusted PR/fork deployments receiving
   these resources. Existing unrelated previews need a separate review/removal
   plan; new code cannot protect their old implementations.
3. Ensure Pages Functions uses **fail closed** request-limit/failure behavior.
   Never allow a Functions failure/quota exhaustion to serve legacy static assets
   without the middleware. Verify `_routes.json` includes all routes and has no
   exclusions in the built artifact. If fail-closed operation cannot be assured,
   do not deploy this shared legacy artifact as staging.
4. Prefer Cloudflare Access for human staging users. An authenticated Zap callback
   will eventually need a narrowly configured service-access route/token; do not
   bypass Access for the whole app. No callback setup or mail enablement is
   authorized yet.
5. After a separately approved deployment, verify the exact branch alias and
   middleware denial/CSP behavior at the edge before entering any test records.
   Never use real student data. The middleware cannot introspect the Cloudflare
   IDs behind D1/R2 bindings; dashboard verification is essential.

### Shared Preview configuration is not a branch security boundary

Preview variables, credentials and bindings are project/environment scoped, not
private to one Git branch. Host checks protect this application's requests, but
another branch can remove the checks and directly use its inherited bindings.
Neither a hostname nor Cloudflare Access prevents malicious deployed server code
from accessing its own environment. Do not store production credentials here.

**Recommended durable isolation:** use a dedicated Pages project for the student
staging application, connected only to the trusted `student-staging` branch,
with its own dedicated D1/R2 and staging-only secrets. Set `STUDENT_STAGING=true`
and the dedicated origin in that project's deployment environment (its
"Production" environment is still only the staging application). Disable other
branch previews there. Keep the current production project/resources unchanged.
This is a manual recommendation, not a resource created by this task.

The existing project can be used provisionally only with the restricted Preview
branch controls, trusted repository permissions and fail-closed behavior above.
If those cannot be confirmed, do not approve the push for deployment. A push may
automatically deploy; commit approval and deployment approval are separate.

## Email gate and remaining limits

`STUDENT_EMAIL_ENABLED` must be literally `true`, with complete server-only
configuration, before either queueing or dispatch. Dispatch rechecks the gate.
On staging, `STUDENT_EMAIL_ORIGIN` must match the isolated staging origin. No
secret has been generated or enabled by this task. When separately authorized,
use staging-only Zap/Zoho credentials and restricted test recipients. Previously
accepted external Zap jobs cannot be recalled merely by disabling the local gate.
Duplicate delivery on retries and provider acceptance versus inbox delivery remain
as described in `student-email-zapier.md`.

## Local verification

`npm test`: 101 passed, zero failed. Includes legacy production behavior, staging
route denial for reads/writes, host restrictions, separate staging staff auth,
disabled dispatch, and normal authenticated D1/private R2 operations without
legacy storage or AI access. Fixtures are in-memory; no configured database or
migration execution was used.

Browser commands: `node scripts/check-student-workspace.cjs` (existing flows) and
`node scripts/check-staging-safeguards.cjs` (actual middleware responses and CSP,
with synthetic hostname and all requests intercepted). No real emails or
production requests are made by these fixtures. Live Cloudflare configuration
and routing remain unverified until an explicitly approved deployment check.

## First Preview deployment authorization — 27 November 2026

The owner manually verified: production branch main unchanged; Preview builds
restricted to student-staging; STUDENT_STAGING=true; STUDENT_STAGING_ORIGIN
https://student-staging.ketso-uploader.pages.dev; STUDENT_EMAIL_ENABLED=false;
STUDENT_DB=ketso-student-staging; STUDENT_PRIVATE_FILES=ketso-student-private-staging;
001/002 applied with all twelve named database objects verified; KETSO_BUCKET
removed from Preview; runtime Fail closed. These are owner-confirmed settings.

The owner authorized the first commit and push of student-staging to trigger
Preview deployment and non-destructive smoke checks. This supersedes earlier
no-push authorization notes; main merges and production changes remain prohibited.
Email enablement and sending remain prohibited. Deployment results will be reported
against the pushed commit; authorization alone does not establish deployment success.

## Live manual verification and credential isolation update

The owner reports that workspace/profile/tutor pages load, legacy staff-upload
and student-gallery pages are blocked, email-disabled registration fails as
expected, and accounts/tokens/outbox/attempts/sessions each have zero rows.
Preview branch restriction, removed production storage, and Fail closed were
reconfirmed on 27 November 2026. See [student-email-zapier.md](student-email-zapier.md)
for the historical/manual deployment risk assessment, conditional shared-Preview
acceptance criteria, recommended dedicated project and local PowerShell commands.
No credentials were generated, emails enabled or deployments performed in this update.
