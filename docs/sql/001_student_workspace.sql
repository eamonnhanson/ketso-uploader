-- Additive, uploader-owned Cloudflare D1 schema. Apply only after explicit approval.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS student_accounts (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 password_hash TEXT NOT NULL, salt TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0,
 password_version INTEGER NOT NULL DEFAULT 0, legacy_student_id TEXT UNIQUE,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS student_sessions (
 hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES student_accounts(id),
 password_version INTEGER NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS student_tokens (
 hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES student_accounts(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')), expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS student_rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS student_drafts (
 account_id TEXT NOT NULL REFERENCES student_accounts(id), area TEXT NOT NULL,
 content TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,area)
);
CREATE TABLE IF NOT EXISTS student_files (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES student_accounts(id),
 name TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS student_submissions (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES student_accounts(id), area TEXT NOT NULL,
 content TEXT NOT NULL, public INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
 ai_answer TEXT, ai_status TEXT NOT NULL DEFAULT 'not_requested',
 staff_answer TEXT, staff_updated_at INTEGER, reviewed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS student_public_work ON student_submissions(account_id,public,created_at);
CREATE INDEX IF NOT EXISTS student_question_queue ON student_submissions(area,reviewed,created_at);
