import 'server-only';
import { neon } from '@neondatabase/serverless';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { Task, TaskInput } from './types';

type Row = Record<string, unknown>;
type DBState = { sqlite?: DatabaseSync; initialization?: Promise<void> };
const globalDB = globalThis as typeof globalThis & { taskNoteDB?: DBState };
const state = globalDB.taskNoteDB ??= {};

async function execute(sql: string, values: unknown[] = []): Promise<Row[]> {
  if (process.env.DATABASE_URL) {
    const query = neon(process.env.DATABASE_URL);
    return await query.query(sql, values) as Row[];
  }
  if (process.env.VERCEL) throw new Error('DATABASE_URL must be configured for deployment');
  if (!state.sqlite) {
    const { DatabaseSync } = await import('node:sqlite');
    const { mkdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const file = resolve(process.env.SQLITE_PATH || 'data/tasks.db');
    mkdirSync(dirname(file), { recursive: true });
    state.sqlite = new DatabaseSync(file);
    state.sqlite.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
  }
  const parameters: SQLInputValue[] = [];
  const sqliteSQL = sql.replace(/\$(\d+)/g, (_, index: string) => {
    const value = values[Number(index) - 1];
    parameters.push((typeof value === 'boolean' ? Number(value) : value) as SQLInputValue);
    return '?';
  });
  return state.sqlite.prepare(sqliteSQL).all(...parameters) as Row[];
}

const fields = 'id, title, course, due_date, description, is_completed, created_at';
const schema = `CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 title VARCHAR(100) NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
 course VARCHAR(100) NOT NULL CHECK (length(course) BETWEEN 1 AND 100),
 due_date TEXT NOT NULL,
 description VARCHAR(1000) NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
 is_completed BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TEXT NOT NULL
)`;

async function ready() {
  if (!state.initialization) {
    state.initialization = (async () => {
      await execute(schema);
      await execute('CREATE INDEX IF NOT EXISTS tasks_owner_due ON tasks (owner_id, due_date, created_at)');
    })().catch(error => { state.initialization = undefined; throw error; });
  }
  return state.initialization;
}

function toTask(row: Row): Task {
  return {
    id: String(row.id), title: String(row.title), course: String(row.course),
    due_date: String(row.due_date), description: String(row.description),
    is_completed: row.is_completed === true || row.is_completed === 1,
    created_at: String(row.created_at),
  };
}

export async function listTasks(owner: string): Promise<Task[]> {
  await ready();
  return (await execute(`SELECT ${fields} FROM tasks WHERE owner_id = $1 ORDER BY due_date, created_at, id`, [owner])).map(toTask);
}

export async function addTask(owner: string, input: TaskInput): Promise<Task> {
  await ready();
  const { randomUUID } = await import('node:crypto');
  const rows = await execute(`INSERT INTO tasks (id, owner_id, title, course, due_date, description, is_completed, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${fields}`,
  [randomUUID(), owner, input.title, input.course, input.due_date, input.description, false, new Date().toISOString()]);
  return toTask(rows[0]);
}

export async function editTask(owner: string, id: string, input: TaskInput): Promise<Task | null> {
  await ready();
  const rows = await execute(`UPDATE tasks SET title=$1, course=$2, due_date=$3, description=$4 WHERE id=$5 AND owner_id=$6 RETURNING ${fields}`,
    [input.title, input.course, input.due_date, input.description, id, owner]);
  return rows[0] ? toTask(rows[0]) : null;
}

export async function setStatus(owner: string, id: string, complete: boolean): Promise<Task | null> {
  await ready();
  const rows = await execute(`UPDATE tasks SET is_completed=$1 WHERE id=$2 AND owner_id=$3 RETURNING ${fields}`, [complete, id, owner]);
  return rows[0] ? toTask(rows[0]) : null;
}

export async function deleteTask(owner: string, id: string): Promise<boolean> {
  await ready();
  const rows = await execute('DELETE FROM tasks WHERE id=$1 AND owner_id=$2 RETURNING id', [id, owner]);
  return rows.length === 1;
}

export async function checkDatabase() {
  await ready();
  await execute('SELECT 1 AS ok');
}
