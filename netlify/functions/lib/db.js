import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';

const { Pool } = pg;

const rawDbUrl = process.env.DATABASE_URL || '';
const DATABASE_URL = rawDbUrl.replace(/([?&])channel_binding=[^&]*&?/g, '$1').replace(/[?&]$/, '');

let sql;

if (DATABASE_URL.includes('neon.tech') || process.env.USE_NEON === 'true') {
  sql = neon(DATABASE_URL);
} else {
  const pool = new Pool({ connectionString: DATABASE_URL });

  sql = (strings, ...values) => {
    let query = '';
    const params = [];
    for (let i = 0; i < strings.length; i++) {
      query += strings[i];
      if (i < values.length) {
        query += `$${i + 1}`;
        params.push(values[i] === undefined ? null : values[i]);
      }
    }
    return pool.query(query, params).then(res => res.rows);
  };
}

export { sql };
