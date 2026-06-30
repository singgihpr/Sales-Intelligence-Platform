import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';

const { Pool } = pg;

const rawDbUrl = process.env.DATABASE_URL || '';
const DATABASE_URL = rawDbUrl.replace(/([?&])channel_binding=[^&]*&?/g, '$1').replace(/[?&]$/, '');

let sql;
let query;

// Create a single pg pool for raw queries — works with both local Postgres and Neon
const pool = new Pool({ connectionString: DATABASE_URL });

query = async (sqlStr) => {
  const res = await pool.query(sqlStr);
  return res.rows;
};

if (DATABASE_URL.includes('neon.tech') || process.env.USE_NEON === 'true') {
  // Use neon for tagged templates in serverless environments (optimized)
  sql = neon(DATABASE_URL);
} else {
  // Use pg pool for tagged templates in VM environments
  sql = (strings, ...values) => {
    let queryStr = '';
    const params = [];
    for (let i = 0; i < strings.length; i++) {
      queryStr += strings[i];
      if (i < values.length) {
        queryStr += `$${i + 1}`;
        params.push(values[i] === undefined ? null : values[i]);
      }
    }
    return pool.query(queryStr, params).then(res => res.rows);
  };
}

export { sql, query };
