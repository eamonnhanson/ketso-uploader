-- Additive tables in the existing STUDENT_DB. Do not apply without authorization.
CREATE TABLE IF NOT EXISTS student_email_outbox (
 id TEXT PRIMARY KEY, receipt_hash TEXT NOT NULL UNIQUE,
 account_id TEXT REFERENCES student_accounts(id), purpose TEXT NOT NULL,
 token_hash TEXT, payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','failed','sent','skipped','expired')),
 attempts INTEGER NOT NULL DEFAULT 0, current_attempt TEXT,
 created_at INTEGER NOT NULL, expires INTEGER NOT NULL, retry_after INTEGER NOT NULL DEFAULT 0,
 confirmed_at INTEGER, provider_message_id TEXT
);
CREATE TABLE IF NOT EXISTS student_email_attempts (
 id TEXT PRIMARY KEY, outbox_id TEXT NOT NULL REFERENCES student_email_outbox(id),
 created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 error_code TEXT
);
CREATE INDEX IF NOT EXISTS student_email_pending ON student_email_outbox(status,created_at);
