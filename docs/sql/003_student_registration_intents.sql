-- Additive D1 candidate. Apply only with deployment approval.
-- This is a retryable intent, not an Academy registry or enrolment record.
CREATE TABLE IF NOT EXISTS student_registration_intents (
 account_id TEXT PRIMARY KEY REFERENCES student_accounts(id),
 request_id TEXT NOT NULL UNIQUE, courses TEXT NOT NULL,
 consent INTEGER NOT NULL DEFAULT 0, photo_key TEXT NOT NULL,
 created_at INTEGER NOT NULL, completed INTEGER NOT NULL DEFAULT 0
);
