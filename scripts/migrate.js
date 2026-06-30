import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const rawDbUrl = process.env.DATABASE_URL || '';
const DATABASE_URL = rawDbUrl.replace(/([?&])channel_binding=[^&]*&?/g, '$1').replace(/[?&]$/, '');

export async function runMigrations() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found, skipping');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found');
      return;
    }

    console.log(`📦 Found ${files.length} migration file(s)`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Skip destructive migrations that contain DROP TABLE
      if (/DROP\s+TABLE/i.test(content)) {
        console.log(`⚠️  Skipping destructive migration: ${file}`);
        continue;
      }

      // Split by semicolon and execute each statement individually
      const statements = content
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (statements.length === 0) continue;

      console.log(`🔄 Running: ${file} (${statements.length} statement${statements.length > 1 ? 's' : ''})`);

      for (const stmt of statements) {
        try {
          await pool.query(stmt);
        } catch (err) {
          // Ignore "already exists" errors for idempotent migrations
          if (err.message && /already exists/i.test(err.message)) {
            // silently continue
          } else {
            throw err;
          }
        }
      }

      console.log(`✅ Completed: ${file}`);
    }

    console.log('🎉 All safe migrations applied');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run directly if executed as script
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch(() => process.exit(1));
}
