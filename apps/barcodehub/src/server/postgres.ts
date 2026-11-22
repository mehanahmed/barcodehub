import pg, { type QueryResult, type QueryResultRow } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { lockDataDir } from '../../../../database/lock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** The repo's database/ folder, found by walking up, so it works from src/server and from the built dist-server/. */
function databaseDir(): string {
  for (let d = __dirname; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'database', 'schema.sql'))) return path.join(d, 'database');
    if (path.dirname(d) === d) throw new Error('database/schema.sql not found above ' + __dirname);
  }
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'embedded';

let pool: pg.Pool | null = null;

function isEmbedded(): boolean {
  return (
    connectionString === 'embedded' ||
    connectionString === '' ||
    connectionString.startsWith('embedded://')
  );
}

// One PGlite per process, kept on globalThis: Vite loads this file once for the plugin and again
// for each SSR endpoint graph (and again on every restart), and two instances on one folder corrupt it.
const shared = globalThis as typeof globalThis & { __bhubPglite?: { db: PGlite; ready: Promise<unknown> } };

function getEmbedded(): { db: PGlite; ready: Promise<unknown> } {
  if (!shared.__bhubPglite) {
    const dataDir = process.env.PGLITE_DATA_DIR || path.join(databaseDir(), 'data');
    if (dataDir.startsWith('memory://')) {
      const db = new PGlite(dataDir);
      // A fresh in-memory database (tests) has no tables until the schema is applied.
      const ready = db.exec(fs.readFileSync(path.join(databaseDir(), 'schema.sql'), 'utf8'));
      shared.__bhubPglite = { db, ready };
    } else {
      lockDataDir(dataDir);
      shared.__bhubPglite = { db: new PGlite(dataDir), ready: Promise.resolve() };
    }
  }
  return shared.__bhubPglite;
}

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')
          ? { rejectUnauthorized: false }
          : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pool;
}

export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  if (isEmbedded()) {
    const { db, ready } = getEmbedded();
    await ready;
    const res = await db.query<R>(text, params);
    return {
      rows: res.rows,
      command: '',
      rowCount: res.rows.length,
      oid: 0,
      fields: res.fields.map((f) => ({
        name: f.name,
        tableID: 0,
        columnID: 0,
        dataTypeID: 0,
        dataTypeSize: 0,
        dataTypeModifier: 0,
        format: '',
      })),
    };
  }

  return getPool().query<R>(text, params);
}

export async function checkConnection(): Promise<boolean> {
  try {
    const res = await query('SELECT 1 AS connected');
    return res.rows[0]?.connected === 1;
  } catch (err) {
    console.warn('PostgreSQL connection check failed:', err);
    return false;
  }
}
