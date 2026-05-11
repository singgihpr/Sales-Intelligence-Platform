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

  if (!userId) throw new Error('DEFAULT_USER_ID missing in .env');

  const targetRow = await sql`SELECT target_be, incentive_rules FROM targets WHERE user_id = ${userId} AND month = ${currentMonth} AND year = ${currentYear}`;
  if (!targetRow || targetRow.length === 0) throw new Error('No target configured for current month');

  const salesSum = await sql`SELECT COALESCE(SUM(volume_be), 0) as total FROM sales_records WHERE record_date >= ${`${currentYear}-${String(currentMonth).padStart(2,'0')}-01`}`;
  
  const daysElapsed = Math.min(new Date().getDate(), 22);
  const totalWorkingDays = 22;
  const currentBE = parseFloat(salesSum[0].total);
  const runRate = (currentBE / daysElapsed) * totalWorkingDays;

  const dashboardStats = {
    monthlyTargetBE: parseFloat(targetRow[0].target_be),
    currentBE,
    daysElapsed,
    totalWorkingDays,
    incentiveTiers: targetRow[0].incentive_rules
  };

  const outlets = await sql`
    SELECT o.id, o.name, o.type, o.address, o.contact_person, 
           COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM sr.record_date) = ${currentMonth} THEN sr.volume_be ELSE 0 END), 0) as beMonth,
           MAX(sr.record_date) as last_order
    FROM outlets o LEFT JOIN sales_records sr ON o.id = sr.outlet_id
    GROUP BY o.id, o.name, o.type, o.address, o.contact_person
  `;

  const frontendOutlets = outlets.map(o => {
    const prevMonthBE = 0;
    const trend = prevMonthBE === 0 ? 0 : Math.round(((o.bemonth - prevMonthBE) / prevMonthBE) * 100);
    const daysSinceOrder = o.last_order ? Math.floor((Date.now() - new Date(o.last_order)) / (1000 * 60 * 60 * 24)) : 99;
    const health = Math.max(0, Math.min(100, 100 - (trend * -2) - (daysSinceOrder > 7 ? 15 : 0)));
    
    return {
      id: o.id, name: o.name, type: o.type, health, trend,
      lastOrder: daysSinceOrder === 0 ? 'Today' : `${daysSinceOrder} days ago`,
      beMonth: parseFloat(o.bemonth), address: o.address, contact: o.contact_person,
      alert: health < 40 ? 'Risk of Churn' : trend < -20 ? 'Decline detected' : null,
      history: []
    };
  });

  return { dashboardStats, outlets: frontendOutlets };
};

export const handler = async (event, context) => {
  if (event.httpMethod === 'GET') {
    try {
      const data = await transformToFrontend();
      return { statusCode: 200, body: JSON.stringify(data) };
    } catch (err) {
      console.error('GET Error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    console.log('📥 Received POST upload');
    try {
      let bodyBuffer;
      if (event.isBase64Encoded) bodyBuffer = Buffer.from(event.body, 'base64');
      else if (typeof event.body === 'string') bodyBuffer = Buffer.from(event.body, 'binary');
      else bodyBuffer = event.body;

      return new Promise((resolve) => {
        const busboy = Busboy({ headers: event.headers });
        
        busboy.on('file', async (fieldname, file, info) => {
          console.log(`📄 Parsing: ${info.filename}`);
          const chunks = [];
          file.on('data', data => chunks.push(data));
          
          file.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks);
              const workbook = xlsx.read(buffer, { cellDates: true });
              const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
              const rows = rawRows.map(r => ({ ...r, Date: parseExcelDate(r['Date']) }));
              console.log(`📊 Extracted & parsed ${rows.length} rows`);

              const queries = rows.map(row => sql`
                INSERT INTO sales_records (id, outlet_id, sales_id, record_date, volume_be, sku_name)
                VALUES (gen_random_uuid(), 
                        (SELECT id FROM outlets WHERE name = ${row['Outlet Name']}),
                        (SELECT id FROM users WHERE name = ${row['Sales Name']}),
                        ${row['Date']}, ${row['Volume BE']}, ${row['SKU'] || null})
                ON CONFLICT DO NOTHING;
              `);
              await Promise.all(queries);

              resolve({ statusCode: 200, body: JSON.stringify({ success: true, inserted: rows.length }) });
            } catch (err) {
              console.error('❌ Upload/DB Error:', err.message);
              resolve({ statusCode: 500, body: JSON.stringify({ error: err.message }) });
            }
          });
        });

        busboy.on('error', err => {
          console.error('❌ Busboy Error:', err);
          resolve({ statusCode: 400, body: JSON.stringify({ error: 'Invalid file format' }) });
        });

        busboy.end(bodyBuffer);
      });
    } catch (err) {
      console.error('❌ Function Crash:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
};