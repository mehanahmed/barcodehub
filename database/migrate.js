import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import { lockDataDir } from './lock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically load .env if available
const rootEnv = path.resolve(__dirname, '..', '.env');
try {
  if (fs.existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }
} catch {
  // Ignore
}

const { Pool } = pg;

async function migrateWithPgPool(connectionString) {
  console.log(`Attempting connection to PostgreSQL server at: ${connectionString.replace(/:[^:@]+@/, ':****@')}...`);
  const pool = new Pool({
    connectionString,
    ssl:
      process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')
        ? { rejectUnauthorized: false }
        : undefined,
    connectionTimeoutMillis: 3000,
  });

  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL server! Reading database/schema.sql...');
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying PostgreSQL schema...');
    await client.query(sql);

    const res = await client.query('SELECT count(*) FROM "Packages"');
    console.log(`✅ PostgreSQL database migrated successfully! Packages seeded: ${res.rows[0].count}`);
    return true;
  } finally {
    client.release();
    await pool.end();
  }
}

async function migrateWithPGlite() {
  const dataDir = path.resolve(__dirname, 'data');
  console.log(`\n📦 Initializing Local Embedded PostgreSQL database at: ${dataDir}...`);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  lockDataDir(dataDir);
  const db = new PGlite(dataDir);
  try {
    console.log('Reading database/schema.sql...');
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying schema to local PostgreSQL...');
    await db.exec(sql);

    const res = await db.query('SELECT count(*) FROM "Packages"');
    console.log(`✅ Local PostgreSQL database initialized successfully! Packages seeded: ${res.rows[0].count}`);

    // If .env doesn't exist, create it with local setting
    if (!fs.existsSync(rootEnv)) {
      fs.writeFileSync(
        rootEnv,
        `# PostgreSQL Database\n# Set your remote PostgreSQL connection here (Neon, Supabase, RDS) or leave empty for embedded\nDATABASE_URL=embedded\n`
      );
      console.log('✅ Created .env with DATABASE_URL=embedded');
    }
  } finally {
    await db.close();
  }
}

async function run() {
  const explicitUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (explicitUrl && explicitUrl !== 'embedded') {
    try {
      await migrateWithPgPool(explicitUrl);
      return;
    } catch (err) {
      console.warn(`\n⚠️  Could not connect to external PostgreSQL (${err.message}).`);
      console.log('Falling back to local embedded PostgreSQL...');
    }
  }

  // Fallback to local embedded PostgreSQL
  await migrateWithPGlite();
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
