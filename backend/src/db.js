import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import 'dotenv/config';

const { Pool, types } = pg;

// Keep the API response contract that the Vue application already consumes:
// safe BIGINT values are numbers and database dates remain ISO-like strings.
types.setTypeParser(20, value => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : value;
});
types.setTypeParser(1082, value => value); // date
types.setTypeParser(1114, value => value); // timestamp
types.setTypeParser(1184, value => value); // timestamptz

const connectionString = String(
  process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
).trim();

if (!connectionString) {
  throw new Error(
    'Missing DATABASE_URL. Set it to your pooled PostgreSQL connection string.'
  );
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const pgPool = new Pool({
  connectionString,
  max: positiveInteger(process.env.DB_POOL_MAX, process.env.VERCEL ? 3 : 10),
  idleTimeoutMillis: positiveInteger(process.env.DB_IDLE_TIMEOUT_MS, 30_000),
  connectionTimeoutMillis: positiveInteger(process.env.DB_CONNECT_TIMEOUT_MS, 10_000),
  allowExitOnIdle: true,
  options: '-c timezone=UTC',
  application_name: process.env.VERCEL
    ? 'employee-portal-vercel'
    : 'employee-portal'
});

// Fluid Compute may suspend an instance between requests. This lets Vercel
// release idle clients safely while still reusing the module-level pool.
if (process.env.VERCEL) attachDatabasePool(pgPool);

pgPool.on('error', error => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

/**
 * Convert the route layer's mysql2-style `?` parameters to PostgreSQL's
 * positional parameters. Quoted strings, identifiers and comments are left
 * untouched so literal question marks remain valid SQL.
 */
export function toPostgresPlaceholders(sql) {
  const source = String(sql);
  let index = 0;
  let output = '';
  let state = 'normal';
  let dollarQuote = '';

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (state === 'single-quote') {
      output += char;

      if (char === "'" && next === "'") {
        output += next;
        i += 1;
      } else if (char === "'") {
        state = 'normal';
      }
      continue;
    }

    if (state === 'double-quote') {
      output += char;

      if (char === '"' && next === '"') {
        output += next;
        i += 1;
      } else if (char === '"') {
        state = 'normal';
      }
      continue;
    }

    if (state === 'line-comment') {
      output += char;
      if (char === '\n') state = 'normal';
      continue;
    }

    if (state === 'block-comment') {
      output += char;
      if (char === '*' && next === '/') {
        output += next;
        i += 1;
        state = 'normal';
      }
      continue;
    }

    if (state === 'dollar-quote') {
      if (source.startsWith(dollarQuote, i)) {
        output += dollarQuote;
        i += dollarQuote.length - 1;
        state = 'normal';
      } else {
        output += char;
      }
      continue;
    }

    if (char === "'") {
      output += char;
      state = 'single-quote';
    } else if (char === '"') {
      output += char;
      state = 'double-quote';
    } else if (char === '-' && next === '-') {
      output += char + next;
      i += 1;
      state = 'line-comment';
    } else if (char === '/' && next === '*') {
      output += char + next;
      i += 1;
      state = 'block-comment';
    } else if (char === '$') {
      const match = source.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);

      if (match) {
        dollarQuote = match[0];
        output += dollarQuote;
        i += dollarQuote.length - 1;
        state = 'dollar-quote';
      } else {
        output += char;
      }
    } else if (char === '?') {
      output += `$${++index}`;
    } else {
      output += char;
    }
  }

  return output;
}

function normalizeRow(row) {
  const normalized = {};
  const hasExplicitUpperBatchNo = Object.hasOwn(row, 'BATCH_NO');

  for (const [key, value] of Object.entries(row)) {
    if (key === 'batch_no' && hasExplicitUpperBatchNo) continue;

    // Employee responses historically expose batch_no and COUNT aliases in
    // lowercase. Other legacy fields are uppercase in the frontend contract.
    const outputKey = key === 'batch_no' || key === 'total'
      ? key
      : key.toUpperCase();
    normalized[outputKey] = value;
  }

  return normalized;
}

function mapPostgresError(error) {
  error.pgCode = error.code;
  error.sqlMessage = [error.message, error.detail, error.constraint]
    .filter(Boolean)
    .join(' ');

  // Preserve the small mysql2 error contract that the existing route handlers
  // use to produce friendly conflict messages.
  if (error.code === '23505') error.code = 'ER_DUP_ENTRY';
  if (error.code === '23503') error.code = 'ER_ROW_IS_REFERENCED_2';

  return error;
}

async function execute(client, sql, params = []) {
  try {
    const result = await client.query(toPostgresPlaceholders(sql), params);

    if (result.command === 'SELECT') {
      return [result.rows.map(normalizeRow), result.fields];
    }

    const returnedRow = result.rows[0] ? normalizeRow(result.rows[0]) : null;
    const insertId = returnedRow
      ? returnedRow.EMP_ENTRY_ID ?? returnedRow.USER_ID ?? Object.values(returnedRow)[0]
      : undefined;

    return [{
      affectedRows: result.rowCount ?? 0,
      insertId,
      ...(returnedRow ? { row: returnedRow } : {})
    }, result.fields];
  } catch (error) {
    throw mapPostgresError(error);
  }
}

function wrapClient(client) {
  return {
    query: (sql, params) => execute(client, sql, params),
    execute: (sql, params) => execute(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release()
  };
}

export const pool = {
  query: (sql, params) => execute(pgPool, sql, params),
  execute: (sql, params) => execute(pgPool, sql, params),
  async getConnection() {
    try {
      return wrapClient(await pgPool.connect());
    } catch (error) {
      throw mapPostgresError(error);
    }
  },
  end: () => pgPool.end()
};
