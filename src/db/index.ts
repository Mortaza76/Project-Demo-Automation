import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { WorkflowStatus } from '../types';

const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL,
  products_json TEXT NOT NULL,
  status TEXT NOT NULL,
  response_token TEXT NOT NULL UNIQUE,
  requested_date TEXT,
  requested_time TEXT,
  timezone TEXT NOT NULL,
  event_idempotency_key TEXT NOT NULL,
  google_event_id TEXT,
  google_meet_link TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS state_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
`);

export type CreateLeadInput = {
  fullName: string;
  email: string;
  organization: string;
  products: string[];
  timezone: string;
};

export const createLead = (input: CreateLeadInput) => {
  const now = new Date().toISOString();
  const token = randomUUID();
  const eventKey = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO leads
    (full_name, email, organization, products_json, status, response_token, requested_date, requested_time, timezone, event_idempotency_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'NEW', ?, NULL, NULL, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    input.fullName,
    input.email,
    input.organization,
    JSON.stringify(input.products),
    token,
    input.timezone,
    eventKey,
    now,
    now,
  );
  insertTransition(Number(res.lastInsertRowid), null, 'NEW', 'Lead created', input);
  return getLeadById(Number(res.lastInsertRowid));
};

export const getLeadById = (id: number) => db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
export const getLeadByToken = (token: string) => db.prepare('SELECT * FROM leads WHERE response_token = ?').get(token);
export const listLeads = () => db.prepare('SELECT * FROM leads ORDER BY id DESC').all();

export const updateLeadStatus = (
  leadId: number,
  toStatus: WorkflowStatus,
  reason?: string,
  payload?: unknown,
) => {
  const current = getLeadById(leadId) as any;
  if (!current) throw new Error('Lead not found');
  db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').run(toStatus, new Date().toISOString(), leadId);
  insertTransition(leadId, current.status, toStatus, reason, payload);
};

export const setLeadRequestedSlot = (leadId: number, date: string, time: string, timezone: string) => {
  db.prepare(
    'UPDATE leads SET requested_date = ?, requested_time = ?, timezone = ?, updated_at = ? WHERE id = ?',
  ).run(date, time, timezone, new Date().toISOString(), leadId);
};

export const setLeadEvent = (leadId: number, eventId: string, meetLink: string) => {
  db.prepare('UPDATE leads SET google_event_id = ?, google_meet_link = ?, updated_at = ? WHERE id = ?').run(
    eventId,
    meetLink,
    new Date().toISOString(),
    leadId,
  );
};

const insertTransition = (
  leadId: number,
  fromStatus: string | null,
  toStatus: string,
  reason?: string,
  payload?: unknown,
) => {
  db.prepare(
    'INSERT INTO state_transitions (lead_id, from_status, to_status, reason, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(leadId, fromStatus, toStatus, reason ?? null, payload ? JSON.stringify(payload) : null, new Date().toISOString());
};

export const getTransitions = (leadId: number) =>
  db.prepare('SELECT * FROM state_transitions WHERE lead_id = ? ORDER BY id ASC').all(leadId);

export const enqueueJob = (leadId: number, type: string, payload?: unknown, delayMs = 0) => {
  const now = Date.now();
  db.prepare(
    'INSERT INTO jobs (lead_id, type, payload_json, status, attempts, max_attempts, run_at, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 5, ?, ?, ?)',
  ).run(
    leadId,
    type,
    payload ? JSON.stringify(payload) : null,
    'PENDING',
    new Date(now + delayMs).toISOString(),
    new Date(now).toISOString(),
    new Date(now).toISOString(),
  );
};

export const claimDueJobs = (limit = 10) => {
  const rows = db
    .prepare('SELECT * FROM jobs WHERE status = ? AND run_at <= ? ORDER BY id ASC LIMIT ?')
    .all('PENDING', new Date().toISOString(), limit) as any[];
  const update = db.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ? AND status = ?');
  const claimed: any[] = [];
  for (const r of rows) {
    const res = update.run('RUNNING', new Date().toISOString(), r.id, 'PENDING');
    if (res.changes === 1) claimed.push(r);
  }
  return claimed;
};

export const markJobDone = (jobId: number) => {
  db.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?').run('DONE', new Date().toISOString(), jobId);
};

export const markJobFailed = (job: any, error: string) => {
  const nextAttempts = job.attempts + 1;
  if (nextAttempts >= job.max_attempts) {
    db.prepare('UPDATE jobs SET status = ?, attempts = ?, last_error = ?, updated_at = ? WHERE id = ?').run(
      'FAILED',
      nextAttempts,
      error,
      new Date().toISOString(),
      job.id,
    );
    return;
  }
  const backoffMs = Math.min(60_000, 2 ** nextAttempts * 1000);
  db.prepare(
    'UPDATE jobs SET status = ?, attempts = ?, last_error = ?, run_at = ?, updated_at = ? WHERE id = ?',
  ).run(
    'PENDING',
    nextAttempts,
    error,
    new Date(Date.now() + backoffMs).toISOString(),
    new Date().toISOString(),
    job.id,
  );
};

export default db;
