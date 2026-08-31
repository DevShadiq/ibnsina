import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const [username, password, displayName = 'Administrator', rawUserType = 'SUPER_ADMIN'] = process.argv.slice(2);
const userType = String(rawUserType).toUpperCase().replace(/[ -]+/g, '_');

if (!username || !password) {
  console.error('Usage: npm run admin:create -- <username> <password> [displayName] [ADMIN|SUPER_ADMIN]');
  process.exit(1);
}

if (!['ADMIN', 'SUPER_ADMIN'].includes(userType)) {
  console.error('User type must be ADMIN or SUPER_ADMIN.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);

await pool.execute(
  `INSERT INTO admin_user (USERNAME, PASSWORD_HASH, DISPLAY_NAME, USER_TYPE)
   VALUES (?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE PASSWORD_HASH = VALUES(PASSWORD_HASH),
                           DISPLAY_NAME = VALUES(DISPLAY_NAME),
                           USER_TYPE = VALUES(USER_TYPE),
                           ACTIVE_YN = 'Y'`,
  [username, hash, displayName, userType]
);

console.log(`${userType === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} user "${username}" created/updated.`);
await pool.end();
