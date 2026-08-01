import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type StoredWorkspaceUserRole = "SITE_ADMIN" | "COMPANY_ADMIN" | "FINANCE" | "AUDITOR";

export type StoredWorkspaceUserRecord = {
  id: string;
  name: string;
  email: string;
  role: StoredWorkspaceUserRole;
  companyId?: string;
  isActive: boolean;
  createdAt: string;
  password?: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string | null;
  is_active: number;
  created_at: string;
  password: string | null;
};

const databasePath = path.join(process.cwd(), "data", "portal.db");

let database: DatabaseSync | null = null;

function ensureDatabaseDirectory() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

function getDatabase() {
  if (database) {
    return database;
  }

  ensureDatabaseDirectory();
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      company_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      password TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
  `);

  return database;
}

function mapRow(row: UserRow): StoredWorkspaceUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as StoredWorkspaceUserRole,
    companyId: row.company_id ?? undefined,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    password: row.password ?? undefined,
  };
}

export function upsertWorkspaceUsers(users: StoredWorkspaceUserRecord[]) {
  if (users.length === 0) {
    return;
  }

  const db = getDatabase();
  const statement = db.prepare(`
    INSERT INTO users (id, name, email, role, company_id, is_active, created_at, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      role = excluded.role,
      company_id = excluded.company_id,
      is_active = excluded.is_active,
      created_at = excluded.created_at,
      password = excluded.password
  `);

  for (const user of users) {
    statement.run(
      user.id,
      user.name,
      user.email.trim().toLowerCase(),
      user.role,
      user.companyId ?? null,
      user.isActive ? 1 : 0,
      user.createdAt,
      user.password ?? null,
    );
  }
}

export function listWorkspaceUsersByCompany(companyId: string) {
  const db = getDatabase();
  const statement = db.prepare(`
    SELECT id, name, email, role, company_id, is_active, created_at, password
    FROM users
    WHERE company_id = ?
    ORDER BY datetime(created_at) ASC, lower(name) ASC
  `);

  return statement.all(companyId).map((row) => mapRow(row as UserRow));
}

export function listWorkspaceSiteUsers() {
  const db = getDatabase();
  const statement = db.prepare(`
    SELECT id, name, email, role, company_id, is_active, created_at, password
    FROM users
    WHERE company_id IS NULL
    ORDER BY datetime(created_at) ASC, lower(name) ASC
  `);

  return statement.all().map((row) => mapRow(row as UserRow));
}

export function listAllWorkspaceUsers() {
  const db = getDatabase();
  const statement = db.prepare(`
    SELECT id, name, email, role, company_id, is_active, created_at, password
    FROM users
    ORDER BY company_id IS NULL DESC, lower(email) ASC
  `);

  return statement.all().map((row) => mapRow(row as UserRow));
}

export function findWorkspaceUserRecordByEmail(email: string) {
  const db = getDatabase();
  const statement = db.prepare(`
    SELECT id, name, email, role, company_id, is_active, created_at, password
    FROM users
    WHERE lower(email) = lower(?)
    LIMIT 1
  `);
  const row = statement.get(email.trim().toLowerCase()) as UserRow | undefined;
  return row ? mapRow(row) : null;
}

export function getWorkspaceUserRecordById(userId: string) {
  const db = getDatabase();
  const statement = db.prepare(`
    SELECT id, name, email, role, company_id, is_active, created_at, password
    FROM users
    WHERE id = ?
    LIMIT 1
  `);
  const row = statement.get(userId) as UserRow | undefined;
  return row ? mapRow(row) : null;
}

export function updateWorkspaceUserPasswordById(userId: string, password: string) {
  const db = getDatabase();
  const statement = db.prepare(`
    UPDATE users
    SET password = ?
    WHERE id = ?
  `);

  statement.run(password, userId);
}
