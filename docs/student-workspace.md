# Student accounts and private workspace (not deployed)

This implementation belongs only to `eamonnhanson/ketso-uploader`, a Cloudflare
Pages application. The existing Render backend remains unchanged. Existing
staff upload, registry, gallery, points and course routes are preserved.
The current public student name/email lookup is **not authentication** and is
never used to authorize a workspace account or attach an existing profile.
Legacy course-link flows retain their current authorization model; securing
those backend endpoints would require separately authorized backend work.

## Added workflow

The uploader landing page includes student sign-in. `/student-account/` offers
registration, email verification, password reset, logout, five private writing
areas and submitted-work history. Students must verify their email before
signing in. Verification asks the mailbox owner to confirm their own name and
password; a pre-registered account cannot fix the owner's password or name.
A password reset revokes existing sessions and outstanding recovery links.

An account has an opaque public profile ID. A student can attach an existing
course profile using their personal course token. The server resolves that
token using the existing `/api/academy-student` read endpoint, requires the
record's email to match the verified account email, and permits only one
account per legacy profile ID. No token is stored. Staff must resolve missing
or outdated legacy emails in the existing registry. Knowing a name, public
student ID, or email does not grant account or draft access.

Private areas: motivation letter, last year's report, funding proposal,
business case development, and a question to KETSO. Every area accepts text
and documents/images. Report and proposal also have one-question-at-a-time
forms. Autosave and explicit save persist to the server; revision checks
reject stale concurrent saves. Failed saves keep the page's local text and
warn before leaving. Public submissions are separate snapshots, so later
draft edits do not silently change public work.

Submission of ordinary work requires explicit public consent. Questions are
private by default and can be published separately by their owner. Public
consent includes attachment contents and, for questions, AI and staff replies.
Owners can make submissions private again; downloaded copies cannot be recalled.
Private attachments have no public bucket URLs. Staff can read attachments
only when they are part of a submitted question, not an unsubmitted draft.

The existing `/tutor-questions/` console has an additional question queue with
unreviewed items first, AI guidance/status, attachments and editable staff
answers. It reuses the existing admin-key authentication by verifying it with
the existing tutor backend. It refreshes once a minute while open and not
being edited. Each question is durably queued before requesting AI, including
AI failures. These are in-console alerts, not newly sent emails. The staff home
links to the console. Answers become visible when students refresh their history.

## Required configuration and release blockers

No production migration, binding change, external notification or deployment
was performed. Deployment settings remain outside this repository.

1. `STUDENT_DB`: new uploader-owned Cloudflare D1 binding. After explicit
   approval, apply `docs/sql/001_student_workspace.sql` to that **new** database.
   The schema is additive and idempotent; it does not touch the Render database.
2. `STUDENT_PRIVATE_FILES`: separate private R2 bucket binding, with public
   access disabled. Never bind the existing public `KETSO_BUCKET` here. Files
   have random IDs and are served only through authorization-checked routes
   as downloads with `nosniff`. Maximum 5 MB/file, 5 files/draft, 100 files/account.
3. Student email uses a durable outbox and Zapier → Zoho Mail adapter. The old
   `STUDENT_MAILER` binding is superseded. See [student-email-zapier.md](student-email-zapier.md)
   for server secrets, the additive 002 migration in the existing D1 database,
   authenticated delivery callbacks and manual staging setup. Webhook 2xx does
   not confirm mail acceptance; missing configuration fails closed.
4. Optional Cloudflare Workers `AI` binding and `KETSO_APPROVED_INFORMATION`
   containing operator-approved KETSO information. No existing suitable AI
   integration or approved knowledge collection was present in this repository.
   The adapter uses `@cf/meta/llama-3.1-8b-instruct`; verify availability before
   enabling it. With either input missing it returns no fabricated answer and
   leaves the question for staff. AI is labelled, constrained to approved text,
   told not to follow student instructions, and never claims to read attached
   documents. It always includes the educational/non-donor/no-promises notice.
   Model output still requires staff review; these prompts are not a guarantee
   of factual accuracy. There is no unsupported retrieval or donor lookup.
5. Source templates are now available and incorporated from
   `docs/templates/Template donor report.pdf` and
   `docs/templates/KETSO_Donor_Proposal_Writing_Template.pdf` on
   `codex/donor-templates`. The report follows its five chapters, including
   exact approved wording, milestones, beneficiary distinctions, evidence,
   safeguarding, exit plans and the original approved financial structure.
   The proposal covers information, summary, five chapters, final review and
   teaching reflection. Related fields and table columns are grouped into
   11 report steps and 12 proposal steps; students enter their own rows in
   the answer box. No sample project figures are prefilled.
   Versioned drafts distinguish these templates from earlier general prompts.
   Earlier answers are preserved as labelled text notes for students to review
   and transfer, rather than silently reassigned to new questions. Existing
   submitted snapshots retain their original question labels. ODT and print
   output use template section headings and answers, without teaching prompts.
   Uploaded evidence remains separate from the editable ODT.
   This template update was inspected without running tests, as requested.

Use HTTPS. Sessions use `__Host-` HttpOnly Secure SameSite=Strict cookies with
8-hour expiry, server-side hashed tokens, and password-version checks. Recovery
and verification tokens are single-use, hashed in storage, and expire after
30 minutes and 24 hours respectively. Links carry tokens in URL fragments,
removed from browser history on load. Mutation endpoints require same-origin
requests. Auth rate limits use trusted Cloudflare client IP and hashed email;
account writes have a separate quota. Configure Cloudflare edge abuse controls
before public release as an additional layer. Passwords are 15–128 characters,
with random salts and WebCrypto PBKDF2-SHA-512 (100,000 iterations, compatible
with Workers' PBKDF2 limit). Benchmark the configured Workers CPU budget before
release; increase the work factor or adopt a reviewed identity provider when
the runtime supports it. There is no localStorage password/session storage.

Operational follow-up before enabling accounts: verify mail delivery, actual
bindings and bucket privacy, Worker CPU budget, HTTPS cookie behavior, staff
credentials against the intended read endpoint, database backups, retention
and cleanup for expired tokens/sessions/rate-limit rows and unattached files.
The current attachment cap is cumulative; support must handle cleanup rather
than silently deleting potentially published evidence. Provision no production
resources or migrations without the owner's authorization.

## Earlier local verification (before the email integration)

`npm test` runs existing regression tests plus actual handler tests against
Node's in-memory SQLite using a D1-compatible adapter. These tests cover
verification, token expiry/replay, password reset revocation, origin checks,
auth rate limiting, cross-account draft/file denial, optimistic concurrency,
publication consent/snapshot privacy, question queue fallback, and ODT structure.
They use synthetic mail, R2 and AI bindings and no production requests.
`node scripts/check-student-workspace.cjs` runs browser acceptance against
intercepted local fixtures, with no live network services. It requires Playwright
and Chromium (uses `/usr/bin/chromium` when available).

Browser acceptance passed at 390×844 for login, guided answer navigation and
reload, editable ODT download, print content, publication consent, separation
of published work from later drafts, private questions, the public profile and
staff corrections. Actual email delivery and Cloudflare bindings still require
a separately authorized staging check.

## Staging configuration update

The owner confirmed Preview `STUDENT_DB` → `ketso-student-staging` (001/002
applied; nine tables and three named indexes verified) and
`STUDENT_PRIVATE_FILES` → `ketso-student-private-staging` with public access
disabled on 27 November 2026. See [student-email-zapier.md](student-email-zapier.md#student-staging-infrastructure--owner-confirmed-27-november-2026)
for the expected `student-staging` hostname, remaining email setup and the
production dependencies retained by legacy pages. These confirmations supersede
earlier prerequisites above; no Cloudflare changes were made by this agent.

## Isolated Preview safeguards

See [student-staging-safety.md](student-staging-safety.md) for the current
server/browser production isolation, restricted staging staff access, disabled
course linking and AI, normal private D1/R2 use, and the mandatory Cloudflare
branch/failure-mode checks before pushing. Production behavior is preserved.

## Attachment downloads — 27 November 2026

The tutor browser previously replaced the server filename with question-attachment
when downloading a blob, removing its extension. Files also used a generic binary
MIME type. Tutor downloads now use stored filenames; tutor/public lists show actual
uploaded filenames. Responses use the supported extension's MIME type, RFC 5987
UTF-8 attachment filenames, no-store, nosniff and sandbox. New uploads retain the
extension when a long name is shortened; unsafe control/path characters are removed.
Existing files require no migration. Previously truncated names cannot be recovered
if the original extension was already lost.

Question attachment IDs are saved in each submission's immutable content snapshot,
not resolved from the latest draft. Uploads have unique storage IDs and are never
overwritten. Later draft edits and new submissions preserve earlier bytes and IDs.
The UI shows the question date and explains that listed uploads retain their original
contents. Generated ODT downloads contain current writing/answers, not uploaded files.
Draft attachments remain selected until removed: submitting again intentionally
includes the currently listed files. No evidence of snapshot corruption was found;
the particular live older attachment was not inspected.

Private file URLs require the owner session or authenticated staff access to a
submitted question. Staff cannot download draft-only attachments; other accounts
cannot attach or retrieve private files. Public access is derived on every download
from public submission references, not a permanent public R2 URL. Making the last
public submission referencing a file private revokes anonymous access immediately.
If the same upload is deliberately reused in another public submission, it remains
public until that submission is private too. Already downloaded copies cannot be
revoked. The private bucket and all authentication routes remain unchanged.

Regression coverage verifies old/new question snapshots and exact bytes, owner and
staff access, wrong/missing credentials, cross-account attachment rejection,
publication/revocation, all supported MIME types, Unicode filename encoding and
long-name extensions. Chromium checks the tutor filename and downloaded bytes.
Validation: 107 automated tests and both browser checks. No real student data or
live emails are used. Only student-staging is authorized for this deployment.

## Production release candidate

See [student-production-release.md](student-production-release.md) for the current
owner-confirmed production configuration, mandatory AI launch decision, candidate
comparison, remaining acceptance gates and rollback. Earlier optional-AI guidance
is superseded for this release. No production deployment or activation is authorized.
