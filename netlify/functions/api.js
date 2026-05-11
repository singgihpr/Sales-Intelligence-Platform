import { neon } from '@neondatabase/serverless';
import xlsx from 'xlsx';
import Busboy from 'busboy';

const sql = neon(process.env.DATABASE_URL);

const parseExcelDate = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = val instanceof Date ? val : new Date(Math.round((val - 25569) * 86400 * 1000));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const transformToFrontend = async () => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const userId = process.env.DEFAULT_USER_ID;
  if (!userId) throw new Error('DEFAULT_USER_ID missing');

  const targetRow = await sql`SELECT target_be, incentive_rules FROM targets WHERE user_id = ${userId} AND month = ${currentMonth} AND year = ${currentYear}`;
  if (!targetRow?.length) throw new Error('No target configured');

  const salesSum = await sql`SELECT COALESCE(SUM(volume_be), 0) as total FROM sales_records WHERE record_date >= ${`${currentYear}-${String(currentMonth).padStart(2,'0')}-01`}`;
  const daysElapsed = Math.min(new Date().getDate(), 22);

  const outlets = await sql`
    SELECT o.id, o.name, o.type, o.address, o.contact_person, 
           COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM sr.record_date) = ${currentMonth} THEN sr.volume_be ELSE 0 END), 0) as beMonth,
           MAX(sr.record_date) as last_order
    FROM outlets o LEFT JOIN sales_records sr ON o.id = sr.outlet_id
    GROUP BY o.id, o.name, o.type, o.address, o.contact_person
  `;

  return {
    dashboardStats: {
      monthlyTargetBE: parseFloat(targetRow[0].target_be),
      currentBE: parseFloat(salesSum[0].total),
      daysElapsed,
      totalWorkingDays: 22,
      incentiveTiers: targetRow[0].incentive_rules
    },
    outlets: outlets.map(o => {
      const daysSince = o.last_order ? Math.floor((Date.now() - new Date(o.last_order)) / 86400000) : 99;
      return {
        id: o.id, name: o.name, type: o.type, address: o.address, contact: o.contact_person,
        beMonth: parseFloat(o.bemonth), health: Math.max(0, 100 - daysSince * 2),
        lastOrder: daysSince === 0 ? 'Today' : `${daysSince} days ago`,
        alert: daysSince > 7 ? 'Risk of Churn' : null
      };
    })
  };
};

export const handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  const type = params.type || 'records';
  const id = params.id;
  const isJson = event.headers['content-type']?.includes('application/json');

  try {
    // --- GET ---
    if (event.httpMethod === 'GET') {
      if (type === 'users') {
        const res = await sql`SELECT id, name, role, region, created_at FROM users ORDER BY created_at DESC`;
        return { statusCode: 200, body: JSON.stringify(res) };
      }
      if (type === 'outlets') {
        const res = await sql`SELECT id, name, type, address, contact_person, created_at FROM outlets ORDER BY created_at DESC`;
        return { statusCode: 200, body: JSON.stringify(res) };
      }
      if (type === 'records') {
        const res = await sql`
          SELECT sr.id, o.name as outlet, u.name as sales, sr.record_date::text as date, 
                 sr.volume_be as be, sr.sku_name as sku, sr.outlet_id, sr.sales_id
          FROM sales_records sr
          LEFT JOIN outlets o ON sr.outlet_id = o.id
          LEFT JOIN users u ON sr.sales_id = u.id
          ORDER BY sr.record_date DESC LIMIT 200
        `;
        return { statusCode: 200, body: JSON.stringify(res) };
      }
      return { statusCode: 200, body: JSON.stringify(await transformToFrontend()) };
    }

    // --- POST ---
    if (event.httpMethod === 'POST') {
      const body = isJson ? JSON.parse(event.body) : null;

      if (type === 'users' && isJson) {
        const { name, role, region } = body;
        const res = await sql`INSERT INTO users (id, name, role, region, netlify_uid) VALUES (gen_random_uuid(), ${name}, ${role}, ${region||''}, gen_random_uuid()::text) RETURNING *`;
        return { statusCode: 201, body: JSON.stringify(res[0]) };
      }
      if (type === 'outlets' && isJson) {
        const { name, type: otype, address, contact_person } = body;
        const res = await sql`INSERT INTO outlets (id, name, type, address, contact_person) VALUES (gen_random_uuid(), ${name}, ${otype||''}, ${address||''}, ${contact_person||''}) RETURNING *`;
        return { statusCode: 201, body: JSON.stringify(res[0]) };
      }
      if (!type && !isJson) {
        // Upload Handler
        let bodyBuffer;
        if (event.isBase64Encoded) bodyBuffer = Buffer.from(event.body, 'base64');
        else if (typeof event.body === 'string') bodyBuffer = Buffer.from(event.body, 'binary');
        else bodyBuffer = event.body;

        return new Promise((resolve) => {
          const busboy = Busboy({ headers: event.headers });
          busboy.on('file', async (fieldname, file) => {
            const chunks = [];
            file.on('data', d => chunks.push(d));
            file.on('end', async () => {
              try {
                const workbook = xlsx.read(Buffer.concat(chunks), { cellDates: true });
                const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]).map(r => ({ ...r, Date: parseExcelDate(r['Date']) }));
                const queries = rows.map(r => sql`
                  INSERT INTO sales_records (id, outlet_id, sales_id, record_date, volume_be, sku_name)
                  VALUES (gen_random_uuid(), (SELECT id FROM outlets WHERE name = ${r['Outlet Name']}), (SELECT id FROM users WHERE name = ${r['Sales Name']}), ${r['Date']}, ${r['Volume BE']}, ${r['SKU']||null})
                  ON CONFLICT DO NOTHING
                `);
                await Promise.all(queries);
                resolve({ statusCode: 200, body: JSON.stringify({ success: true, inserted: rows.length }) });
              } catch (e) { resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) }); }
            });
          });
          busboy.on('error', e => resolve({ statusCode: 400, body: JSON.stringify({ error: 'Invalid file' }) }));
          busboy.end(bodyBuffer);
        });
      }
    }

    // --- PUT ---
    if (event.httpMethod === 'PUT' && id && isJson) {
      const body = JSON.parse(event.body);
      if (type === 'users') {
        const res = await sql`UPDATE users SET name=${body.name}, role=${body.role}, region=${body.region||''} WHERE id=${id} RETURNING *`;
        return { statusCode: res.length ? 200 : 404, body: JSON.stringify(res[0] || { error: 'Not found' }) };
      }
      if (type === 'outlets') {
        const res = await sql`UPDATE outlets SET name=${body.name}, type=${body.type||''}, address=${body.address||''}, contact_person=${body.contact_person||''} WHERE id=${id} RETURNING *`;
        return { statusCode: res.length ? 200 : 404, body: JSON.stringify(res[0] || { error: 'Not found' }) };
      }
      // Default: Update Record
      const res = await sql`
        UPDATE sales_records SET 
          outlet_id = (SELECT id FROM outlets WHERE name = ${body.outlet}),
          sales_id = (SELECT id FROM users WHERE name = ${body.sales}),
          record_date = ${body.date}, volume_be = ${body.be}, sku_name = ${body.sku||null}
        WHERE id = ${id} RETURNING *
      `;
      return { statusCode: res.length ? 200 : 404, body: JSON.stringify(res[0] || { error: 'Not found' }) };
    }

    // --- DELETE ---
    if (event.httpMethod === 'DELETE' && id) {
      if (type === 'users') await sql`DELETE FROM users WHERE id=${id}`;
      else if (type === 'outlets') await sql`DELETE FROM outlets WHERE id=${id}`;
      else await sql`DELETE FROM sales_records WHERE id=${id}`;
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
};