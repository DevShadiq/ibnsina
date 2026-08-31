import jwt from 'jsonwebtoken';
import { pool } from './db.js';

export function signAdmin(admin) {
  return jwt.sign(
    {
      sub: admin.USER_ID,
      username: admin.USERNAME,
      name: admin.DISPLAY_NAME,
      userType: admin.USER_TYPE
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export async function requireAdmin(req, res, next) {
  const value = req.headers.authorization || '';
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Admin login required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      `SELECT USER_ID, USERNAME, DISPLAY_NAME, USER_TYPE
         FROM admin_user
        WHERE USER_ID = ? AND ACTIVE_YN = 'Y'
        LIMIT 1`,
      [payload.sub]
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'This admin account is inactive or no longer exists.' });

    req.admin = {
      userId: user.USER_ID,
      username: user.USERNAME,
      name: user.DISPLAY_NAME,
      userType: user.USER_TYPE
    };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired admin session.' });
  }
}

export function requireSuperAdmin(req, res, next) {
  if (req.admin?.userType !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Super Admin access is required.' });
  }
  next();
}
