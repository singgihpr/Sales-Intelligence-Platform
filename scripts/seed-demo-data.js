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
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD;
if (!DEFAULT_PASSWORD) {
  console.error('❌ Error: DEFAULT_PASSWORD env var is required');
  process.exit(1);
}
const WIPE = process.argv.includes('--wipe');

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();
const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

const hash = async (pw) => bcrypt.hash(pw, 10);

const DEMO_USERS = [
  { name: 'Admin Demo', email: 'admin@demo.com', role: 'admin', region: 'Jakarta Selatan', level: null },
  { name: 'Siti Rahayu', email: 'supervisor@demo.com', role: 'supervisor', region: 'Jakarta Selatan', level: null },
  { name: 'Budi Santoso', email: 'budi@demo.com', role: 'sales', region: 'Jakarta Selatan', level: 'L2' },
  { name: 'Dewi Lestari', email: 'dewi@demo.com', role: 'sales', region: 'Jakarta Selatan', level: 'L3' },
  { name: 'Agus Prayogo', email: 'agus@demo.com', role: 'sales', region: 'Jakarta Selatan', level: 'L2' }
];

const DEMO_OUTLETS = [
  { name: 'Toko Buah Sejahtera', type: 'Warung', branch_area: 'Jakarta Selatan', address: 'Jl. Radio Dalam No. 12, Jakarta', contact_person: 'Bapak Haji Usman' },
  { name: 'Fresh Market Cilandak', type: 'Supermarket', branch_area: 'Jakarta Selatan', address: 'Cilandak Town Square, Ground Floor', contact_person: 'Ibu Maya' },
  { name: 'Hotel Grand Menteng', type: 'Hotel', branch_area: 'Jakarta Pusat', address: 'Jl. Matraman Raya No. 21', contact_person: 'Pak David' },
  { name: 'Resto Ayam Penyet', type: 'Restaurant', branch_area: 'Jakarta Selatan', address: 'Kuningan Food Court', contact_person: 'Mas Joko' },
  { name: 'RM Padang Sederhana', type: 'Restaurant', branch_area: 'Jakarta Selatan', address: 'Jl. Fatmawati No. 45', contact_person: 'Bu Sari' },
  { name: 'Indomaret Point', type: 'Minimarket', branch_area: 'Jakarta Selatan', address: 'Jl. Kemang Raya No. 8', contact_person: 'Pak Rudi' },
  { name: 'Hotel Shangri-La', type: 'Hotel', branch_area: 'Jakarta Pusat', address: 'Jl. Sudirman Kav. 1', contact_person: 'Ms. Linda' },
  { name: 'Warung Kopi Nusantara', type: 'Warung', branch_area: 'Jakarta Selatan', address: 'Jl. Blok M Square', contact_person: 'Kang Asep' }
];

const SKU_NAMES = ['Pisang Cavendish', 'Nanas Madu', 'Jeruk Siam', 'Apel Fuji', 'Mangga Harum Manis', 'Semangka Merah'];

async function wipe() {
  console.log('⚠️  Wiping existing demo data...');
  await sql`DELETE FROM sales_records WHERE TRUE`;
  await sql`DELETE FROM outlet_assignments WHERE TRUE`;
  await sql`DELETE FROM targets WHERE TRUE`;
  await sql`DELETE FROM users WHERE email LIKE '%@demo.com' OR email IN (${DEMO_USERS.map(u => u.email)})`;
  await sql`DELETE FROM outlets WHERE name IN (${DEMO_OUTLETS.map(o => o.name)})`;
  console.log('✅ Wipe complete');
}

async function seed() {
  if (WIPE) await wipe();

  console.log('🌱 Seeding users...');
  const createdUsers = [];
  for (const u of DEMO_USERS) {
    const pwHash = await hash(DEFAULT_PASSWORD);
    const res = await sql`
      INSERT INTO users (id, name, email, role, region, level, password_hash)
      VALUES (gen_random_uuid(), ${u.name}, ${u.email}, ${u.role}, ${u.region}, ${u.level}, ${pwHash})
      ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, region = EXCLUDED.region, level = EXCLUDED.level
      RETURNING id, name, email, role, level
    `;
    createdUsers.push(res[0]);
    console.log(`   Created: ${res[0].name} (${res[0].role}) ${res[0].level || ''}`);
  }

  const admin = createdUsers.find(u => u.role === 'admin');
  const supervisor = createdUsers.find(u => u.role === 'supervisor');
  const salesUsers = createdUsers.filter(u => u.role === 'sales');

  // Assign all salesmen to the supervisor
  if (supervisor) {
    for (const s of salesUsers) {
      await sql`UPDATE users SET supervisor_id = ${supervisor.id} WHERE id = ${s.id}`;
    }
    console.log(`   Assigned ${salesUsers.length} salesmen to supervisor ${supervisor.name}`);
  }

  console.log('🌱 Seeding outlets...');
  const createdOutlets = [];
  for (const o of DEMO_OUTLETS) {
    const res = await sql`
      INSERT INTO outlets (id, name, type, branch_area, address, contact_person)
      VALUES (gen_random_uuid(), ${o.name}, ${o.type}, ${o.branch_area}, ${o.address}, ${o.contact_person})
      ON CONFLICT DO NOTHING
      RETURNING id, name, branch_area
    `;
    if (res[0]) {
      createdOutlets.push(res[0]);
      console.log(`   Created: ${res[0].name}`);
    } else {
      // Outlet might already exist
      const existing = await sql`SELECT id, name, branch_area FROM outlets WHERE name = ${o.name}`;
      createdOutlets.push(existing[0]);
      console.log(`   Found existing: ${existing[0].name}`);
    }
  }

  console.log('🌱 Seeding assignments (6 assigned, 2 vacant)...');
  // Assign 3 outlets to Budi, 3 to Dewi, leave 2 vacant
  const assignments = [
    { outlet: 'Toko Buah Sejahtera', salesman: 'Budi Santoso' },
    { outlet: 'Fresh Market Cilandak', salesman: 'Budi Santoso' },
    { outlet: 'RM Padang Sederhana', salesman: 'Budi Santoso' },
    { outlet: 'Resto Ayam Penyet', salesman: 'Dewi Lestari' },
    { outlet: 'Indomaret Point', salesman: 'Dewi Lestari' },
    { outlet: 'Warung Kopi Nusantara', salesman: 'Dewi Lestari' }
    // Vacant: Hotel Grand Menteng, Hotel Shangri-La
  ];

  for (const a of assignments) {
    const outlet = createdOutlets.find(o => o.name === a.outlet);
    const salesman = createdUsers.find(u => u.name === a.salesman);
    if (!outlet || !salesman) continue;
    await sql`
      UPDATE outlet_assignments SET unassigned_at = CURRENT_TIMESTAMP WHERE outlet_id = ${outlet.id} AND unassigned_at IS NULL
    `;
    await sql`
      INSERT INTO outlet_assignments (id, outlet_id, salesman_id, assigned_by)
      VALUES (gen_random_uuid(), ${outlet.id}, ${salesman.id}, ${supervisor?.id || null})
    `;
    console.log(`   Assigned ${a.outlet} → ${a.salesman}`);
  }
  console.log('   Vacant: Hotel Grand Menteng, Hotel Shangri-La');

  console.log('🌱 Seeding sales records (~50 records)...');
  let recordCount = 0;
  for (const salesman of salesUsers) {
    // Get assigned outlets for this salesman
    const assigned = await sql`
      SELECT o.id, o.name FROM outlets o
      INNER JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = ${salesman.id} AND oa.unassigned_at IS NULL
    `;
    if (assigned.length === 0) continue;

    // Create 12-20 records per salesman across current month
    const numRecords = 12 + Math.floor(Math.random() * 9);
    for (let i = 0; i < numRecords; i++) {
      const outlet = assigned[Math.floor(Math.random() * assigned.length)];
      const day = Math.max(1, Math.min(28, Math.floor(Math.random() * 28) + 1));
      const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const volume = +(Math.random() * 120 + 10).toFixed(1); // 10-130 BE per record
      const sku = SKU_NAMES[Math.floor(Math.random() * SKU_NAMES.length)];
      await sql`
        INSERT INTO sales_records (id, outlet_id, sales_id, record_date, volume_be, sku_name)
        VALUES (gen_random_uuid(), ${outlet.id}, ${salesman.id}, ${date}, ${volume}, ${sku})
      `;
      recordCount++;
    }
  }
  console.log(`   Created ${recordCount} sales records`);

  console.log('🌱 Seeding targets (current month)...');
  for (const salesman of salesUsers) {
    const defaultTarget = salesman.level === 'L3' ? 3500 : 3499;
    const pc = { base_reward: salesman.level === 'L3' ? 1200000 : 1000000, tiers: [
      { threshold: 50, reward: Math.round((salesman.level === 'L3' ? 1200000 : 1000000) * 0.50), label: '50%' },
      { threshold: 100, reward: salesman.level === 'L3' ? 1200000 : 1000000, label: '100%' },
      { threshold: 110, reward: Math.round((salesman.level === 'L3' ? 1200000 : 1000000) * 1.25), label: '110%' }
    ]};
    const vc = { tiers: [
      { threshold: 1500, reward: 250000, label: 'Tier 1' },
      { threshold: 2500, reward: 500000, label: 'Tier 2' },
      { threshold: 3500, reward: 750000, label: 'Tier 3' }
    ]};
    const ac = { base_reward: salesman.level === 'L3' ? 400000 : 300000, tiers: [
      { threshold: 90, reward: Math.round((salesman.level === 'L3' ? 400000 : 300000) * 0.50), label: '90%' },
      { threshold: 100, reward: salesman.level === 'L3' ? 400000 : 300000, label: '100%' },
      { threshold: 125, reward: Math.round((salesman.level === 'L3' ? 400000 : 300000) * 1.25), label: '125%' }
    ]};

    await sql`
      INSERT INTO targets (id, user_id, month, year, target_be, percentage_config, volume_config, active_outlets_config)
      VALUES (gen_random_uuid(), ${salesman.id}, ${currentMonth}, ${currentYear}, ${defaultTarget}, ${JSON.stringify(pc)}::jsonb, ${JSON.stringify(vc)}::jsonb, ${JSON.stringify(ac)}::jsonb)
      ON CONFLICT (user_id, month, year) DO UPDATE SET target_be = EXCLUDED.target_be
    `;
    console.log(`   Target set for ${salesman.name}: ${defaultTarget} BE`);
  }

  console.log('\n✅ Demo seeding complete!');
  console.log('\nLogin credentials:');
  for (const u of DEMO_USERS) {
    console.log(`   ${u.role.toUpperCase()}: ${u.email} / ${DEFAULT_PASSWORD}`);
  }
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
}).finally(() => {
  pool.end();
});
