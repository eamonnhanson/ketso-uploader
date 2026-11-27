# Staff management usability

The management editor now has a visible 44px Close editor button in its sticky
heading. Close and Cancel discard the current form; successful saves still
close automatically. A failed save leaves the editor open, retains all fields
and checked collections, and re-enables its controls.

The collection filter uses sessionStorage key `ketso_staff_collection`. On a
new page visit, Current projects is queried first to obtain the API catalog.
Only then is a saved preference validated and restored, followed by a request
for that view before rendering its thumbnails. Removed or empty preferences
are deleted and fall back to Current projects. A deliberate filter change
while loading takes priority. This preference is separate from each upload's
collection memberships, which continue to use the existing PATCH/GET API.

The staff uploader's management link is now a prominent green navigation
button, full width on phones. Its destination and staff authentication remain
the same. No API, database schema, or migration changes are required.

## Verification

On 18 October 2026, Node 24.19.0 `npm test` passed all 84 tests, with no failures
or skips. New tests cover close/discard, automatic close, full input retention
after a save error, collection assignment on save/reopen, preference restoration
after the catalog, invalid preference removal, built-in/default filters,
return navigation, and user changes during initial loading.

Browser checks passed on desktop and a 390x844 phone viewport using synthetic
in-memory fixtures: existing staff login, upload-to-management navigation,
close/discard, successful save/automatic close, save error/input retention,
retry, checked collections on reopen, remembered filters after leaving and
returning, and fallback for a removed collection. The sticky close button stays
visible while scrolling a long mobile editor.

To reproduce without production access, run:

```text
node scripts/preview-staff-management.cjs
```

Open http://127.0.0.1:8770/, choose KETSO staff, and enter the fixture-only
password `fixture-password`. The fixture banner offers a one-shot save failure,
an invalid stored collection, and a preference reset. Data lives only in the
process memory and resets on restart. No database, R2, production API, or
notification calls are made. The browser fixture verifies the existing client
PATCH/reload behavior; it is not a database migration acceptance test.
