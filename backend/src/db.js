import pg from 'pg';
import 'dotenv/config';

const { Pool, types } = pg;

// Keep the API's existing JSON contract: MySQL returned BIGINT values as
// numbers and date/time values as strings.
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
    'Missing DATABASE_URL. Set it to the pooled connection string from your Neon project.'
  );
}

const poolOptions = {
  connectionString,
  max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
  options: '-c timezone=UTC'
};

const pgPool = new Pool(poolOptions);

pgPool.on('error', error => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

function toPostgresPlaceholders(sql) {
  let index = 0;
  let quoted = false;

  return String(sql).replace(/''|'|\?/g, token => {
    if (token === "''" && quoted) return token;
    if (token === "'") {
      quoted = !quoted;
      return token;
    }
    return quoted ? token : `$${++index}`;
  });
}

function normalizeRow(row) {
  const normalized = {};

  for (const [key, value] of Object.entries(row)) {
    // The legacy MySQL schema intentionally exposed this one column and the
    // COUNT alias in lowercase. The frontend relies on that response shape.
    const outputKey = key === 'batch_no' || key === 'total'
      ? key
      : key.toUpperCase();
    normalized[outputKey] = value;
  }

  return normalized;
}

function mapPostgresError(error) {
  error.pgCode = error.code;

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
      insertId
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
