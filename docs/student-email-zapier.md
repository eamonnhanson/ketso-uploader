# Student verification and password reset: Zapier → Zoho Mail

Local implementation only. No live Zap/account was configured, no email was
sent, no migration applied to a configured database, and no deployment performed.
Local verification results are recorded below.
Work is confined to `eamonnhanson/ketso-uploader`; Render is unchanged.

## Flow and delivery truth

Registration/resend and password-reset requests write an encrypted message and
hashed link token atomically to the existing `STUDENT_DB`. They return HTTP 202
with an opaque status/retry receipt, never a link or mail-provider credential.
The outbox exists before any outbound request. A Pages `waitUntil` dispatch
claims an attempt atomically and POSTs JSON to a server-secret Zapier Catch Hook.
The hook's 2xx **does not mark the message sent**. Timeouts remain pending because
Zapier may have received the request. Explicit hook rejection marks it failed.
Only an authenticated success callback after Zoho accepts the email records
`sent`, with the Zoho message ID and confirmation time. Acceptance is not inbox
delivery: spam placement and later bounces are outside this callback's scope.

The browser provides Check email request and Retry email request controls.
Pending requests remain pending until confirmed, even after the ten-minute
confirmation window; at that point a manual retry is available. Failed requests
also respect that cooldown. There are at most three dispatch attempts per outbox
request, plus the existing per-IP/per-email auth limits and receipt/retry limits.
There is no autonomous scheduler or queue worker; an interrupted initial dispatch
is recovered by the receipt's manual retry. A lost receipt can be replaced by
requesting another email through the form, subject to auth limits.

Retries decrypt and reuse exactly the same message, recipient, account, purpose,
token and absolute expiry. They never change passwords, verify accounts, rotate
another account's token, or invalidate earlier links. Each retry has a fresh
attempt ID. The same message might be delivered twice if a late Zap completes;
exactly-once external delivery is not claimed. Do not replay the Zoho action to
repair a missing callback: replay the callback step alone where possible.
A late success from any recorded attempt is accepted; an old failure cannot
clobber a newer attempt, and no failure can downgrade confirmed success.
Duplicate callbacks are idempotent. Callback processing never activates an
account or resets a password.

Verification links still expire in 24 hours; reset links in 30 minutes. They
are hashed in the existing token table, single-use, and consumed only through
the existing handlers. Successful verification/reset still revokes sessions
and outstanding tokens. Dispatch checks token existence and expiry before
sending; a token already used or revoked is not reissued. A link can expire
while Zapier is delayed; the Zap must check expiry too. Expired links cannot
be revived by a callback or retry.

## Files and configuration

- `functions/_shared/student-email.js`: encrypted outbox, dispatch, receipts,
  authenticated callback and retry controls.
- `functions/api/student/[[path]].js`: registration/recovery queue integration
  and same-origin status/retry routes. Only the exact callback route is exempt
  from browser Origin checking; it requires callback authentication instead.
- `docs/sql/002_student_email_outbox.sql`: additive outbox and attempt tables in
  the **existing** D1 binding. No replacement database or R2 changes.
- `student-account/index.html`, `shared/student-workspace.js`: pending status,
  explicit status check and retry UI. Receipt is held only in page memory.

Cloudflare server-side configuration (separate staging values, never browser JS):

| Name | Type and purpose |
| --- | --- |
| `STUDENT_EMAIL_ENABLED` | Variable: literal `true` only after setup is ready; otherwise dispatch/request creation fails closed. |
| `STUDENT_ZAPIER_HOOK_URL` | Secret: exact HTTPS Catch Hook URL at `hooks.zapier.com/hooks/catch/...`. This URL is a credential. |
| `STUDENT_EMAIL_CALLBACK_SECRET` | Secret: independently generated random bearer credential, at least 32 random bytes encoded as base64url (at least 43 characters). Configure the same secret in the protected Zap callback action. |
| `STUDENT_EMAIL_ENCRYPTION_KEY` | Secret: independently generated 32-byte AES key encoded as standard base64. Encrypts the entire mail payload at rest using AES-GCM, random IV and outbox ID as authenticated data. |
| `STUDENT_EMAIL_ORIGIN` | Variable: exact approved HTTPS uploader origin, without path or trailing slash. All links and callbacks use this fixed origin, never a browser-supplied hostname. |
| `STUDENT_DB` | Existing D1 binding, with migrations 001 and 002 applied only to an explicitly authorized staging database. |

The earlier abstract `STUDENT_MAILER` service binding is superseded by this
server-side adapter; it is no longer invoked. Do not configure a fallback that
interprets a service's 2xx as Zoho acceptance. No Zoho password/OAuth token is
stored in Cloudflare or this repository: authorize Zoho inside Zapier only.
`STUDENT_PRIVATE_FILES`, draft access and existing student sessions are unchanged.

## Manual Zapier / Zoho setup (not executed)

1. Create a separate, disabled staging Zap using Webhooks by Zapier → Catch Hook.
   Store its URL only in the Cloudflare secret. Use synthetic data when building
   mappings; do not click a live Send Email test with a real student's address.
2. Validate payload version `1`, expected fixed sender and callback origin,
   nonempty request/attempt IDs, boolean eligibility, and `expires_at` (Unix
   seconds). If the expiry has passed, do not send. Send an authenticated
   `failed` callback if practical; otherwise the request will expire locally.
3. Use Paths (or equivalent guarded branches):
   - `eligible = true`: Zoho Mail → Send Email. Select an authorized Zoho account
     permitted to send as **info@planteenboom.nu**. Fix From to that address;
     map To, Subject and plain-text Body from `to`, `subject`, `text`.
     Confirm the mailbox/alias is verified and the account has send permission.
     Configure sender-domain authentication through the normal mail-admin process.
     Do not map arbitrary browser inputs or use a fallback sender.
   - `eligible = false`: do not call Zoho. Proceed to the callback with `skipped`.
     This path has no recipient or token. It handles nonexistent/ineligible
     accounts without returning an account-existence result to the browser.
4. On the eligible path, require that the Zoho action completed successfully and
   exposed the real provider message ID. Then and only then execute Webhooks →
   Custom Request, POST to the **fixed staging callback URL** below. Map the
   IDs from the Catch Hook, and message ID from Zoho's successful output. If
   this connector/version does not expose a verifiable success/message ID,
   stop setup: do not manufacture a value or substitute the Zap run ID.
5. Set `Content-Type: application/json` and protected header
   `Authorization: Bearer <STUDENT_EMAIL_CALLBACK_SECRET>` on the callback.
   This secret is configured in the callback action, not included in the Catch
   Hook payload or any browser response. Limit editor/task-history access.
6. Optional supported Zap error handling can call back with `failed`. Never
   continue an error path into the success callback. Without an error callback,
   failed Zoho steps remain pending here and become retryable after ten minutes.
7. Leave production disabled until staging authorization and manual checks are
   complete. Verify Zapier plan support for Paths, Webhooks and error handling.
   Do not enable automatic replay of an entire failed Zap without accounting
   for duplicate mail; prefer retrying only the failed callback action.

Catch Hook JSON fields:

| Field | Meaning |
| --- | --- |
| `version` | `1` |
| `request_id` | Durable outbox UUID; correlation only, not an account ID. |
| `attempt_id` | UUID for this dispatch; needed in the callback. |
| `eligible` | Whether this request should send mail; false means skip Zoho. |
| `from` | Always `info@planteenboom.nu`. |
| `to`, `subject`, `text` | Present only when eligible. Text contains the single-use link. Treat these as sensitive. |
| `purpose` | `verify` or `reset`. |
| `expires_at` | Absolute Unix expiry; retries do not extend it. |
| `callback_url` | Approved-origin `/api/student/email/callback`; configure a fixed matching URL in the Zap, not an unrestricted dynamic target. |

Successful callback body (placeholders only):

```json
{
  "request_id": "<Catch Hook request_id>",
  "attempt_id": "<Catch Hook attempt_id>",
  "status": "sent",
  "provider_message_id": "<actual successful Zoho message ID>"
}
```

For failure use `status: "failed"` with request/attempt IDs; omit provider ID.
For the ineligible branch use `status: "skipped"`; it cannot mark a real message
sent. A sent callback for an ineligible request or a skipped callback for an
eligible request is rejected. Unknown attempts are rejected. Missing/bad
callback authentication returns 401; malformed callbacks 400; unknown IDs 404.
Do not include provider error bodies, email text, passwords or credentials in
callbacks. Errors stored locally are fixed codes, not upstream response bodies.

## Privacy, operations and staging checklist

Status/retry are same-origin POST endpoints, using the opaque receipt in the
JSON body. The receipt is hashed in D1, never placed in URLs, and does not grant
account access. A caller cannot supply an account, purpose or recipient to a
retry. Status responses disclose no recipient, link, token, provider ID or
eligibility. Both sent and skipped are shown as generic `processed`: “If
eligible, check your inbox.” Workflow timing can still vary; do not expose the
outbox as a public list or give students Zapier/task-history access.

D1 stores only encrypted mail payloads and hashed link/receipt tokens; Zapier
and Zoho necessarily process recipient addresses and live links. Restrict Zap
access, avoid logging payloads, choose appropriate task-history retention, and
keep the callback credential out of shared screenshots and exports. Retain the
AES key while pending requests need retries; replacing it makes their payloads
unreadable. Drain/expire pending jobs before rotation. Rotate the callback
secret on both sides together. Define a separate approved cleanup policy for
expired outbox payloads/attempts and the existing token/session records.

Before an authorized staging check, manually configure the isolated D1 schema,
Cloudflare secrets/origin, the disabled Zap and its two branches, the Zoho
sender, and callback mappings. Only then enable staging and use controlled
recipient mailboxes. Check hook 2xx stays pending, Zoho success confirms, bad
callback credentials fail, repeated callbacks do not change accounts, timeouts
stay retryable, retry links are identical, expired/used links cannot reset or
verify again, and one receipt cannot inspect another request. These live staging checks have not been run. The local checks below use mocked
services and disposable in-memory fixtures only.

## Local verification — 27 November 2026

- `node --test test/student-workspace.test.cjs`: existing cases passed initially.
  Expanded coverage found one failure: unreadable encrypted payloads were marked
  pending as if dispatch had been attempted. The minimal fix records a failed
  attempt/outbox with `payload_unreadable`, makes no webhook call, and exposes
  only a generic failure message. Transport uncertainty remains pending.
- Final `npm test`: **94 passed, 0 failed**, including **23** student/account/email
  cases. All expected network calls are mocked. The student fixture now blocks
  unexpected network requests. SQLite databases exist only in memory; fixture
  tables are created from the schema definitions without touching any configured
  database or invoking a migration command.
- `node scripts/check-student-workspace.cjs`: passed in headless Chromium at
  390×844 with all requests intercepted. Covers registration/recovery request
  controls, pending/failed status, retry, login, guided-draft reload, exports,
  publication consent, private questions and staff corrections. Updated stale
  six-step report assertions to the current eleven-step template.
- `git diff --check`: passed.

Verified: AES-GCM payload decryption with the correct key/row ID and rejection
of mismatched row data; hashed receipts/tokens; no link, password, hook secret,
callback secret or encryption key in tested browser API responses or captured
application logs; missing/incorrect callback credentials; missing message ID;
unknown/mismatched attempts; duplicate callbacks; old failures and late successes;
hook rejection versus ambiguous transport errors; retry cooldown and three-attempt
cap; immutable recipient/link/expiry on retry; expired and consumed links;
registration verification, reset session revocation, and ineligible account paths.
Only a generic receipt is returned to a requesting browser. The intended email
link naturally reaches its recipient's browser when opened; it is removed from
the address bar and is never returned by the account-request/status APIs.

Changed during verification: `functions/_shared/student-email.js`,
`test/student-workspace.test.cjs`, `scripts/check-student-workspace.cjs`, and
this documentation (plus the workflow registry's verification date).

Readiness: suitable for manual, isolated staging configuration; not verified for
production. Remaining checks require the real Cloudflare runtime and explicitly
authorized controlled mail delivery: actual D1/service bindings and Worker CPU
budget, Zapier plan/connector behavior, Zoho success/message-ID output, sender
permissions, protected callback mapping, mail deliverability, and task-history
retention. A delayed Zap may send duplicate copies on retry; callbacks establish
provider acceptance, not inbox delivery. Receipt loss requires a new request;
there is no autonomous dispatcher. Eligible/skipped workflow timing can differ.
AES key rotation and expired-payload cleanup need an operational policy.

No live Zap/Zoho configuration, real email, production resource change, migration
execution against a configured database, deployment, commit or push was performed.


## Student staging infrastructure — owner confirmed 27 November 2026

The owner confirmed the following manual configuration in the **Preview**
environment of the existing Cloudflare Pages project `ketso-uploader`.
These facts are owner-confirmed, not independently queried through Cloudflare:

| Resource | Confirmed configuration |
| --- | --- |
| D1 | `ketso-student-staging` |
| D1 binding | `STUDENT_DB` |
| Schema | 001 and 002 applied; nine tables and three named indexes verified |
| Private R2 | `ketso-student-private-staging` |
| R2 binding | `STUDENT_PRIVATE_FILES` |
| Public R2 access | Disabled |

The local release-preparation branch is `student-staging`, based on
`22138c2` (the donor-template commit). All workspace/email changes remain
uncommitted pending approval. Both source PDFs are already tracked in that base.
No merge, commit, push or deployment was performed during branch preparation.

Expected stable Pages branch alias:
`https://student-staging.ketso-uploader.pages.dev`

Expected callback:
`https://student-staging.ketso-uploader.pages.dev/api/student/email/callback`

These are expected addresses, **not verified live deployments**. Confirm the
alias after an approved Preview deployment. Set `STUDENT_EMAIL_ORIGIN` to the
verified origin without a trailing slash. Check Pages Preview branch controls
permit `student-staging`, and that this branch is not the production branch.
A Git push may automatically trigger a Pages deployment; approval for a push
must account for that behavior. No push is authorized yet.

Email remains unenabled by this work. The owner has not confirmed the mail
secrets or enable flag. Keep `STUDENT_EMAIL_ENABLED` unset or false until the
Zap, sender, callback authentication and controlled staging check are approved.
Still required: `STUDENT_ZAPIER_HOOK_URL`, `STUDENT_EMAIL_CALLBACK_SECRET`,
`STUDENT_EMAIL_ENCRYPTION_KEY`, and the verified `STUDENT_EMAIL_ORIGIN`.
Do not reapply migrations merely to prepare the branch; they are already
owner-confirmed on the staging database.

### Staging isolation update

The earlier warning that legacy production routes remained reachable in Preview
is superseded by the server-enforced isolation described in
[student-staging-safety.md](student-staging-safety.md). Production keeps its
legacy routes; staging denies them and provides student-only profile/console
pages, separate staff authorization, host restrictions and a same-origin CSP.
The dedicated bindings work normally. Email stays disabled. Read the required
manual Preview branch restrictions, fail-closed behavior and recommended dedicated
Pages project before approving any push that could trigger deployment.

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


## Manual smoke verification and credential decision — 27 November 2026

Owner-reported live results for commit dfd02c516d2abb9f39a7779ed6d6b39dbe9419d6:
student workspace and staging profile load; staff upload dashboard and student
gallery are blocked; staging tutor page loads; registration with email disabled
returns the expected error. The owner checked D1 and found zero accounts, tokens,
outbox records, attempts and sessions. Preview is restricted to student-staging,
production storage bindings are removed, and Fail closed is configured.
These are manual owner observations, not an agent-run live test. The Cloudflare
GitHub check previously confirmed successful deployment. No email delivery has
been tested or authorized. The zero-row observation is for those five tables,
not a claim that every table was queried.

### Credential isolation decision

The deployed application safeguards passed the reported smoke checks. They do
not establish isolation against other code with access to the same Preview
environment. Existing Preview is conditionally suitable for controlled email
testing with staging-only secrets and synthetic recipients, but only after a
trusted operator checks all of the following:

- Pages → project → Deployments: inventory historical previews and hashed URLs,
  not just the current student-staging alias. Delete obsolete/untrusted preview
  deployments through a separately authorized action. Do not assume updating
  current settings or removing a binding revokes bindings from already-deployed
  versions. Conversely, do not assume adding a new secret automatically injects
  it into all old deployments; deployment/version behavior must be verified.
- Branch control restricts Git-triggered previews; it is not a restriction on
  manual/API/Wrangler uploads or on trusted code changed by a compromised user.
  Review Cloudflare members/roles, API tokens, CI credentials and manual deploy
  capabilities. Only trusted operators may deploy to the credential-bearing
  application. A manually uploaded artifact can omit the middleware entirely.
- Review GitHub collaborators, staging branch protection/rules, workflow changes
  and fork/PR deployment permissions. Access-protected URLs and host allowlists
  do not prevent deployed server code from reading its own bindings/secrets.
- Review Zap editors, connections and task-history access. Zap history necessarily
  contains recipient addresses and usable verification/reset links. The Catch
  Hook URL is itself a credential. The callback credential authorizes delivery
  state updates; it must not be included in the initial hook payload.

We cannot verify the deployment/permission inventory remotely. Therefore this
record does not certify the shared Preview environment as credential-isolated.
A dedicated project is not technically mandatory if the above audit succeeds,
but it is the recommended simplest dependable boundary before adding secrets.

### Recommended manual approach (not executed)

Create a separate student-staging Pages project connected only to the trusted
student-staging branch, using the existing staging-only D1/R2 resources, no
production bindings, and fresh staging-only credentials. Disable other branch
previews there and restrict deploy permissions/API tokens. Enable Fail closed.
If student-staging is that project's Production branch, use that project's
Production environment for these settings: it remains a staging application,
not the existing ketso-uploader production app. Set STUDENT_STAGING=true and
both origin variables to its actual canonical HTTPS hostname (no trailing slash).
Do not guess or assume the new project hostname. Keep email false and the Zap
disabled; repeat the read-only smoke checks after a separately authorized deploy.
A dedicated project still requires trusted deployers; shared broad account tokens
can defeat project separation. Nothing has been created or deployed by this task.

For retaining the current project after the audit, the exact origin remains
https://student-staging.ketso-uploader.pages.dev and the callback remains
https://student-staging.ketso-uploader.pages.dev/api/student/email/callback.

### Windows PowerShell: generate locally, never in chat

Run the following on your own Windows machine in a private PowerShell session
(Windows PowerShell 5.1 or PowerShell 7). These commands are instructions only;
they have not been executed by the agent. They use independent cryptographically
random 32-byte draws. No secret is printed or written to a file.

```powershell
function New-LocalRandomBase64 {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
        return [Convert]::ToBase64String($bytes)
    }
    finally {
        $rng.Dispose()
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
}

$callbackSecret = (New-LocalRandomBase64).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$aesKey = New-LocalRandomBase64

if ($callbackSecret.Length -ne 43) { throw 'Unexpected callback secret length' }
if ([Convert]::FromBase64String($aesKey).Length -ne 32) { throw 'Unexpected AES key length' }
```

After choosing the isolated deployment environment, run this separately:

```powershell
Set-Clipboard -Value $callbackSecret
```

Paste into Cloudflare secret STUDENT_EMAIL_CALLBACK_SECRET and the protected Zap
callback Authorization header as `Bearer ` followed by that same value. Do not
paste it into the Catch Hook payload. Then run separately:

```powershell
Set-Clipboard -Value $aesKey
```

Paste into Cloudflare secret STUDENT_EMAIL_ENCRYPTION_KEY. Keep standard Base64
including its trailing `=`; do not convert this key to Base64URL. Do not share
this AES key with Zapier or Zoho. Store recovery copies in an approved password
manager. Do not regenerate it casually: pending payloads require the original key.
When finished:

```powershell
Set-Clipboard -Value ''
Remove-Variable callbackSecret, aesKey
Remove-Item Function:\New-LocalRandomBase64
```

If Windows clipboard history or sync is enabled, clear its saved entries too;
clearing the current clipboard alone does not erase history. Do not echo the
variables, screenshot their values, paste them into chat, or commit them.

### Exact email environment settings

| Name | Cloudflare kind | Required value/purpose |
| --- | --- | --- |
| STUDENT_STAGING | Variable | true in the selected staging deployment environment |
| STUDENT_STAGING_ORIGIN | Variable | Actual canonical HTTPS staging origin; no trailing slash |
| STUDENT_EMAIL_ORIGIN | Variable | Exactly the same staging origin |
| STUDENT_EMAIL_ENABLED | Variable | false; do not enable until separately authorized |
| STUDENT_ZAPIER_HOOK_URL | Secret | Exact staging Catch Hook HTTPS URL from Zapier |
| STUDENT_EMAIL_CALLBACK_SECRET | Secret | Generated 43-character Base64URL callback secret |
| STUDENT_EMAIL_ENCRYPTION_KEY | Secret | Generated 32-byte AES key in standard Base64 |
| STUDENT_DB | D1 binding | ketso-student-staging |
| STUDENT_PRIVATE_FILES | R2 binding | ketso-student-private-staging; public access disabled |

STUDENT_STAGING_ADMIN_KEY is optional for the staging staff console, separate
from email and never a production credential. STUDENT_MAILER is obsolete.
No Zoho password or OAuth token belongs in Cloudflare; configure the authorized
Zoho connection in Zapier. The sender is fixed in code as info@planteenboom.nu;
there is no additional sender variable. A Zap send test can send real mail even
while STUDENT_EMAIL_ENABLED=false, so do not test/publish the Zap send step yet.

### Staging dispatch compatibility fix — 2026-11-27

The owner subsequently reported a live reset request with a pending attempt and
dispatch_unconfirmed, while a synthetic PowerShell request reached Zapier.
Earlier email-disabled smoke results are historical; this change does not change
the live enable flag or authorize test emails.

Cloudflare Workers rejects redirect: error before network I/O. Dispatch now uses
redirect: manual. All non-2xx responses, including redirects, are rejected with
hook_rejected; Location is never followed. A 2xx still requires the authenticated
callback. Encryption, token expiry, single-use links and retry limits are unchanged.

Structured warnings use event student_email_dispatch, internal request_id and
attempt_id, a fixed category (transport_failure, http_rejection, database_failure),
and HTTP status only for rejection. Transport failures retain dispatch_unconfirmed
and pending delivery. Database errors may leave the last durable state unchanged;
inspect logs and use the existing rate-limited retry when eligible. Never log raw
exceptions, bodies, Location headers, webhook URLs, recipients or credentials.
waitUntil manages background dispatch but does not automatically resume interrupted
work. No architecture or Zap changes are required.

Regression tests check supported fetch options, rejection of 301/302/303/307/308,
diagnostic field allowlisting and database/transport error separation. All 103
automated tests pass. Both browser checks pass using synthetic intercepted requests
only. The workspace check now waits for asynchronous area navigation before
entering question text, and asserts that the submitted question retains that text.

### Verified-account reset investigation — 27 November 2026

Owner reports successful registration email, Zoho provider ID, authenticated
callback, verification/login and skipped nonexistent-account resets, followed by
two eligible resets pending with dispatch_unconfirmed and no Zap run. Build logs
provided by the owner establish that the later redeployment at 17:19 UTC checked
out dfd02c516d2abb9f39a7779ed6d6b39dbe9419d6, not the fixed c361673 commit.
That old source still contains redirect: error and lacks categorized diagnostics.
This reintroduced the known Workers fetch defect. The earlier successful tests
are not evidence that this later deployment used the same code. Individual attempt
timestamps/runtime logs were not supplied, so their exact deployment correlation
has not been independently verified.

Registration and eligible reset share queueEmail, AES-GCM encryption, dispatchEmail
and waitUntil. Reset changes purpose, subject, link text and expiry (30 minutes
versus 24 hours). Ineligible reset encrypts an empty payload and sends eligible=false
without recipient or token. Token creation/encryption precede the accepted response;
decryption failures use payload_unreadable, missing/expired tokens use expired.
Neither path produces dispatch_unconfirmed from these operations. That code comes
from the fetch/options/serialization catch; the newer diagnostic describes its
category without replacing the durable code. JSON contains plain strings, numbers
and booleans. The staging admin key is read only by staff authentication.
waitUntil is shared by all three flows and does not explain this old-source build.

Minimal remedy: deploy the current student-staging tip containing c361673. Do not
change timeout, encryption, tokens, Zapier or the dispatch architecture speculatively.
After editing environment settings, do not retry an obsolete deployment: verify
its source commit first. Prefer a fresh push from the tested student-staging tip.
In Workers & Pages > ketso-uploader > Deployments, check the Preview branch and
source commit; the build log HEAD must match the intended commit. Verify the stable
branch alias points to that deployment. A successful build alone is insufficient.

Two additional offline regressions exercise two successive eligible resets for a
verified staging account with the staging admin key present, encrypted payload and
30-minute expiry, authenticated confirmation, transport failure, retry cooldown,
unchanged ownership/token on retry, single-use consumption and session revocation.
All 105 automated tests and both browser checks pass. No emails were sent during
this investigation. The commit adds tests and documentation only; the runtime fix
already exists in its ancestor. Deployment results are reported in the task.
Pending records are not automatically replayed by deployment. Existing retry and
expiry safeguards still apply; any live email test remains a separate action.

## Production release candidate

See [student-production-release.md](student-production-release.md) for the current
owner-confirmed production configuration, mandatory AI launch decision, candidate
comparison, remaining acceptance gates and rollback. Earlier optional-AI guidance
is superseded for this release. No production deployment or activation is authorized.
