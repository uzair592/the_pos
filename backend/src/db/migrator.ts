import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7429482);');
    console.log('Running database migrations...');

    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    let migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      const candidates = [
        path.join(__dirname, '../../src/db/migrations'),
        path.join(process.cwd(), 'src/db/migrations'),
        path.join(process.cwd(), 'backend/src/db/migrations')
      ];
      const found = candidates.find(dir => fs.existsSync(dir));
      if (found) {
        migrationsDir = found;
      } else {
        console.log('No migrations directory found in any known locations.');
        return;
      }
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const { rows: appliedRows } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.version));

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`Successfully applied migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error applying migration ${file}:`, err);
        throw err;
      }
    }

    console.log('All migrations applied successfully.');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(7429482);');
    } catch (e) {
      // ignore
    }
    client.release();
  }
}

// If run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
