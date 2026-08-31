import { pool } from './db.js';

try {
  const [rows] = await pool.query(
    `SELECT current_database() AS database,
            current_user AS database_user,
            version() AS server_version,
            NOW() AS checked_at`
  );

  const connection = rows[0];
  console.log(`Connected to PostgreSQL database "${connection.DATABASE}" as "${connection.DATABASE_USER}".`);
  console.log(connection.SERVER_VERSION);
  console.log(`Database time: ${connection.CHECKED_AT}`);
} finally {
  await pool.end();
}
