import mysql from 'mysql2/promise';
import fs from 'node:fs';
import 'dotenv/config';

const sslCaFromEnvironment = String(process.env.DB_SSL_CA || '').replace(/\\n/g, '\n');
const sslCaPath = String(process.env.DB_SSL_CA_PATH || '').trim();
const sslCa = sslCaFromEnvironment || (sslCaPath
  ? fs.readFileSync(sslCaPath, 'utf8')
  : undefined);

const ssl = String(process.env.DB_SSL).toLowerCase() === 'true'
  ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      ...(sslCa ? { ca: sslCa } : {})
    }
  : undefined;

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true
});
