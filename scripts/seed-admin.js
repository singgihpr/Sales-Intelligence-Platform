import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sql = (strings, ...values) => {
  let q = '';
  const params = [];
  for (let i = 0; i < strings.length; i++) {
    q += strings[i];
    if (i < values.length) { q += `$${i + 1}`; params.push(values[i] === undefined ? null : values[i]); }
  }
  return pool.query(q, params).then(r => r.rows);
};

async function seed() {
  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3];
  if (!password) {
    console.error('❌ Error: Password argument is required. Usage: npm run seed -- email@example.com YourPassword "Admin Name"');
    process.exit(1);
  }
  const name = process.argv[4] || 'Admin User';

  const hash = await bcrypt.hash(password, 10);

  try {
    const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      await sql`UPDATE users SET password_hash = ${hash}, role = 'admin' WHERE email = ${email}`;
      console.log(`✅ Updated existing user: ${email}`);
    } else {
      const res = await sql`
        INSERT INTO users (id, name, email, role, region, password_hash)
        VALUES (gen_random_uuid(), ${name}, ${email}, 'admin', 'HQ', ${hash})
        RETURNING *
      `;
      console.log(`✅ Created admin user: ${res[0].email} (role: ${res[0].role})`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
