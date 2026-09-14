# ketso-uploader

Cloudflare Pages uploader and Functions. Staff photo reliability changes are documented in [the handover](docs/reliable-staff-photo-upload.md), with [UX conclusions](docs/ux-review-conclusions.nl.md) and a [workflow registry](docs/workflow-registry.csv).

Use Node 24 LTS. Run `npm test` (no new dependencies). For a local-only staff fixture, run `node scripts/preview-staff-upload.cjs` and open `http://localhost:8767/?staff_name=Test%20Staff`.

Production deployment settings live outside this repository. A branch or PR is not proof of what is deployed. Do not run submission tests against production.
