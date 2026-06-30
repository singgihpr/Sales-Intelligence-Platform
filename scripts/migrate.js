import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../netlify/functions/lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
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
        await query(stmt);
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
}

// Run directly if executed as script
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
}
