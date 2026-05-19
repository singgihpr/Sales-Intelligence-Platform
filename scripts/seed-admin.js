import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const rawDbUrl = process.env.DATABASE_URL || '';
const DATABASE_URL = rawDbUrl.replace(/([?&])channel_binding=[^&]*&?/g, '$1').replace(/[?&]$/, '');
const sql = neon(DATABASE_URL);

async function seed() {
  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3] || 'Password123!';
  const name = process.argv[4] || 'Admin User';

  const hash = await bcrypt.hash(password, 10);

  try {
    const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      await sql`UPDATE users SET password_hash = ${hash}, role = 'admin' WHERE email = ${email}`;
      console.log(`✅ Updated existing user: ${email}`);
    } else {
      const res = await sql`
        INSERT INTO users (id, name, email, role, region, password_hash, netlify_uid)
        VALUES (gen_random_uuid(), ${name}, ${email}, 'admin', 'HQ', ${hash}, gen_random_uuid()::text)
        RETURNING *
      `;
      console.log(`✅ Created admin user: ${res[0].email} (role: ${res[0].role})`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
