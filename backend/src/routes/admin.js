import { Router } from 'express';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db.js';
import { requireAdmin, requireSuperAdmin, signAdmin } from '../auth.js';
import { normalizeAndValidateEmployeePhones } from '../utils/phones.js';
import { validateAndNormalizeEducation } from '../utils/education.js';
import { normalizeAndValidateMeasurements } from '../utils/measurements.js';
import { normalizeAndValidateEmployeeNids } from '../utils/nid.js';

const router = Router();

const EMP_COLUMNS = [
  'NAME','BIRTHDATE','BLD_GROUP','GENDER','RELIGION','NATIONALITY',
  'MARITAL_STATUS','EMAIL','PHONE','PHONE1','HEIGHT','WEIGHT','NID',
  'PERMANENT_VILLAGE','PERMANENT_POST','PERMANENT_THANA','PERMANENT_DISTRICT',
  'PRESENT_VILLAGE','PRESENT_POST','PRESENT_THANA','PRESENT_DISTRICT',
  'EMGRCNY_PERSON','EMGRCNY_RELATION','EMGRCNY_ADDRESS','EMGRCNY_PHONE',
  'FATHER_NAME','FATHER_PHONE','MOTHER_NAME','MOTHER_PHONE','SPOUSE_NAME',
  'SPOSE_MARRIAGE_DATE','SPOSE_OCCUPATION','SPOUSE_PHONE','GRNT_NAME',
  'GRNT_RELE','GRNT_FATHER','GRNT_PRESENT_ADD','GRNT_PERMANET_ADD',
  'GRNT_NATIONALITY','GRNT_PROFFESSION','GRNT_NID','GRNT_MOBILE'
];

function cleanObj(input, columns) {
  const result = {};
  for (const column of columns) {
    const value = input?.[column];
    result[column] = typeof value === 'string' ? value.trim() : (value ?? null);
  }
  return result;
}

function validateEmployee(employee, { required = false } = {}) {
  if (required && !employee.NAME) {
    throw Object.assign(new Error('Employee name is required.'), { status: 400 });
  }

  const allowed = {
    GENDER: ['', 'M', 'F'],
    RELIGION: ['', 'I', 'H', 'B', 'C'],
    MARITAL_STATUS: ['', 'U', 'M']
  };

  for (const [field, values] of Object.entries(allowed)) {
    if (!values.includes(employee[field] || '')) {
      throw Object.assign(new Error(`Invalid ${field} value.`), { status: 400 });
    }
  }

  normalizeAndValidateEmployeePhones(employee, { required });
  normalizeAndValidateMeasurements(employee, { required });
  normalizeAndValidateEmployeeNids(employee, { required });

  if (required && employee.MARITAL_STATUS === 'M' && !employee.SPOUSE_NAME) {
    throw Object.assign(new Error('Spouse name is required when marital status is Married.'), { status: 400 });
  }
}

function normalizeUserType(value) {
  return String(value || '').trim().toUpperCase().replace(/[ -]+/g, '_');
}

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    const [rows] = await pool.execute(
      `SELECT *
         FROM admin_user
        WHERE USERNAME = ?
          AND ACTIVE_YN = 'Y'
        LIMIT 1`,
      [username]
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.PASSWORD_HASH))) {
      return res.status(401).json({
        message: 'Invalid username or password.'
      });
    }

    res.json({
      token: signAdmin(user),
      user: {
        username: user.USERNAME,
        displayName: user.DISPLAY_NAME,
        userType: user.USER_TYPE
      }
    });

  } catch (e) {
    next(e);
  }
});

router.use(requireAdmin);

router.get('/me', (req, res) => {
  res.json({
    userId: req.admin.userId,
    username: req.admin.username,
    displayName: req.admin.name,
    userType: req.admin.userType
  });
});

router.patch('/me/password', async (req, res, next) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!currentPassword) {
    return res.status(400).json({ message: 'Current password is required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT PASSWORD_HASH FROM admin_user
        WHERE USER_ID = ? AND ACTIVE_YN = 'Y'
        LIMIT 1`,
      [req.admin.userId]
    );
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].PASSWORD_HASH))) {
      return res.status(403).json({ message: 'Current password is incorrect.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute(
      `UPDATE admin_user SET PASSWORD_HASH = ? WHERE USER_ID = ?`,
      [hash, req.admin.userId]
    );
    res.json({ ok: true, message: 'Your password was changed.' });
  } catch (e) {
    next(e);
  }
});

router.get('/users', requireSuperAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT USER_ID, USERNAME, DISPLAY_NAME, USER_TYPE, ACTIVE_YN, CREATED_AT
         FROM admin_user
        ORDER BY CREATED_AT DESC, USER_ID DESC`
    );

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/users', requireSuperAdmin, async (req, res, next) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || '').trim();
  const userType = normalizeUserType(req.body?.userType || 'ADMIN');

  if (!/^[A-Za-z0-9._-]{3,100}$/.test(username)) {
    return res.status(400).json({
      message: 'Username must be 3–100 characters and use letters, numbers, dot, dash or underscore only.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters.'
    });
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(userType)) {
    return res.status(400).json({ message: 'User type must be Admin or Super Admin.' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    await pool.execute(
      `INSERT INTO admin_user (USERNAME, PASSWORD_HASH, DISPLAY_NAME, USER_TYPE)
       VALUES (?, ?, ?, ?)`,
      [username, hash, displayName || username, userType]
    );

    res.status(201).json({ ok: true, message: `${userType === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} user created.` });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      e.status = 409;
      e.message = 'This username already exists.';
    }
    next(e);
  }
});

router.put('/users/:userId', requireSuperAdmin, async (req, res, next) => {
  const userId = Number(req.params.userId);
  const username = String(req.body?.username || '').trim();
  const displayName = String(req.body?.displayName || '').trim();
  const userType = normalizeUserType(req.body?.userType);
  const activeYn = String(req.body?.activeYn || '').toUpperCase();

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user ID.' });
  }
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(username)) {
    return res.status(400).json({ message: 'Username must be 3–100 characters and use letters, numbers, dot, dash or underscore only.' });
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(userType)) {
    return res.status(400).json({ message: 'User type must be Admin or Super Admin.' });
  }
  if (!['Y', 'N'].includes(activeYn)) {
    return res.status(400).json({ message: 'User status must be active or inactive.' });
  }
  if (userId === req.admin.userId && activeYn === 'N') {
    return res.status(409).json({ message: 'You cannot deactivate your own account.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `SELECT USER_ID FROM admin_user
        WHERE USER_TYPE = 'SUPER_ADMIN' AND ACTIVE_YN = 'Y'
        FOR UPDATE`
    );
    const [rows] = await conn.execute(
      `SELECT USER_TYPE, ACTIVE_YN FROM admin_user WHERE USER_ID = ? FOR UPDATE`,
      [userId]
    );
    const existing = rows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ message: 'Admin user not found.' });
    }

    const removesActiveSuperAdmin = existing.USER_TYPE === 'SUPER_ADMIN'
      && existing.ACTIVE_YN === 'Y'
      && (userType !== 'SUPER_ADMIN' || activeYn !== 'Y');
    if (removesActiveSuperAdmin) {
      const [counts] = await conn.execute(
        `SELECT COUNT(*) AS total FROM admin_user
          WHERE USER_TYPE = 'SUPER_ADMIN' AND ACTIVE_YN = 'Y' AND USER_ID <> ?`,
        [userId]
      );
      if (!Number(counts[0].total)) {
        await conn.rollback();
        return res.status(409).json({ message: 'At least one active Super Admin must remain.' });
      }
    }

    await conn.execute(
      `UPDATE admin_user
          SET USERNAME = ?, DISPLAY_NAME = ?, USER_TYPE = ?, ACTIVE_YN = ?
        WHERE USER_ID = ?`,
      [username, displayName || username, userType, activeYn, userId]
    );
    await conn.commit();
    res.json({ ok: true, message: 'User updated.' });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') {
      e.status = 409;
      e.message = 'This username already exists.';
    }
    next(e);
  } finally {
    conn.release();
  }
});

router.patch('/users/:userId/password', requireSuperAdmin, async (req, res, next) => {
  const userId = Number(req.params.userId);
  const password = String(req.body?.password || '');

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user ID.' });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters.'
    });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `UPDATE admin_user
          SET PASSWORD_HASH = ?
        WHERE USER_ID = ?`,
      [hash, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Admin user not found.' });
    }

    res.json({ ok: true, message: 'User password updated.' });
  } catch (e) {
    next(e);
  }
});

router.delete('/users/:userId', requireSuperAdmin, async (req, res, next) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user ID.' });
  }
  if (userId === req.admin.userId) {
    return res.status(409).json({ message: 'You cannot delete your own account.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `SELECT USER_ID FROM admin_user
        WHERE USER_TYPE = 'SUPER_ADMIN' AND ACTIVE_YN = 'Y'
        FOR UPDATE`
    );
    const [rows] = await conn.execute(
      `SELECT USER_TYPE, ACTIVE_YN FROM admin_user WHERE USER_ID = ? FOR UPDATE`,
      [userId]
    );
    const existing = rows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ message: 'Admin user not found.' });
    }
    if (existing.USER_TYPE === 'SUPER_ADMIN' && existing.ACTIVE_YN === 'Y') {
      const [counts] = await conn.execute(
        `SELECT COUNT(*) AS total FROM admin_user
          WHERE USER_TYPE = 'SUPER_ADMIN' AND ACTIVE_YN = 'Y' AND USER_ID <> ?`,
        [userId]
      );
      if (!Number(counts[0].total)) {
        await conn.rollback();
        return res.status(409).json({ message: 'At least one active Super Admin must remain.' });
      }
    }

    await conn.execute(`DELETE FROM admin_user WHERE USER_ID = ?`, [userId]);
    await conn.commit();
    res.json({ ok: true, message: 'User deleted.' });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

router.get('/batches', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT *
         FROM hr_batch_control
        ORDER BY CREATED_AT DESC`
    );

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/batches', async (req, res, next) => {
  const batchNo = String(req.body?.batchNo || '').trim();

  if (!batchNo) {
    return res.status(400).json({
      message: 'Batch number is required.'
    });
  }

  try {
    await pool.execute(
      `INSERT INTO hr_batch_control
       (BATCH_NO, STATUS, CREATED_BY)
       VALUES (?, 'INACTIVE', ?)`,
      [batchNo, req.admin.username]
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch('/batches/:batchNo/status', async (req, res, next) => {
  const batchNo = req.params.batchNo;
  const status = String(req.body?.status || '').toUpperCase();

  if (!['ACTIVE','INACTIVE'].includes(status)) {
    return res.status(400).json({
      message: 'Status must be ACTIVE or INACTIVE.'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `SELECT BATCH_NO
         FROM hr_batch_control
        FOR UPDATE`
    );

    if (status === 'ACTIVE') {
      await conn.execute(
        `UPDATE hr_batch_control
            SET STATUS = 'INACTIVE',
                CLOSED_AT = NOW()
          WHERE STATUS = 'ACTIVE'
            AND BATCH_NO <> ?`,
        [batchNo]
      );

      await conn.execute(
        `UPDATE hr_batch_control
            SET STATUS = 'ACTIVE',
                STARTED_AT = COALESCE(STARTED_AT, NOW()),
                CLOSED_AT = NULL,
                UPDATED_AT = NOW()
          WHERE BATCH_NO = ?`,
        [batchNo]
      );

    } else {
      await conn.execute(
        `UPDATE hr_batch_control
            SET STATUS = 'INACTIVE',
                CLOSED_AT = NOW(),
                UPDATED_AT = NOW()
          WHERE BATCH_NO = ?`,
        [batchNo]
      );
    }

    await conn.commit();
    res.json({ ok: true });

  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

router.put('/batches/:batchNo', requireSuperAdmin, async (req, res, next) => {
  const currentBatchNo = String(req.params.batchNo || '').trim();
  const batchNo = String(req.body?.batchNo || '').trim();
  const status = String(req.body?.status || '').toUpperCase();

  if (!currentBatchNo || !batchNo) {
    return res.status(400).json({ message: 'Batch number is required.' });
  }
  if (batchNo.length > 100) {
    return res.status(400).json({ message: 'Batch number cannot exceed 100 characters.' });
  }
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ message: 'Status must be ACTIVE or INACTIVE.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [batches] = await conn.query(
      `SELECT * FROM hr_batch_control FOR UPDATE`
    );
    const existing = batches.find(row => row.BATCH_NO === currentBatchNo);
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ message: 'Batch not found.' });
    }

    if (batchNo !== currentBatchNo) {
      if (batches.some(row => row.BATCH_NO === batchNo)) {
        await conn.rollback();
        return res.status(409).json({ message: 'This batch number already exists.' });
      }

      await conn.execute(
        `INSERT INTO hr_batch_control
          (BATCH_NO, STATUS, STARTED_AT, CLOSED_AT, CREATED_BY, CREATED_AT, UPDATED_AT)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          batchNo,
          existing.STATUS,
          existing.STARTED_AT,
          existing.CLOSED_AT,
          existing.CREATED_BY,
          existing.CREATED_AT,
          existing.UPDATED_AT
        ]
      );
      await conn.execute(
        `UPDATE up_emp SET batch_no = ? WHERE batch_no = ?`,
        [batchNo, currentBatchNo]
      );
      await conn.execute(
        `UPDATE hr_update_request SET BATCH_NO = ? WHERE BATCH_NO = ?`,
        [batchNo, currentBatchNo]
      );
      await conn.execute(
        `DELETE FROM hr_batch_control WHERE BATCH_NO = ?`,
        [currentBatchNo]
      );
    }

    if (status === 'ACTIVE') {
      await conn.execute(
        `UPDATE hr_batch_control
            SET STATUS = 'INACTIVE', CLOSED_AT = NOW(), UPDATED_AT = NOW()
          WHERE STATUS = 'ACTIVE' AND BATCH_NO <> ?`,
        [batchNo]
      );
      await conn.execute(
        `UPDATE hr_batch_control
            SET STATUS = 'ACTIVE', STARTED_AT = COALESCE(STARTED_AT, NOW()),
                CLOSED_AT = NULL, UPDATED_AT = NOW()
          WHERE BATCH_NO = ?`,
        [batchNo]
      );
    } else {
      await conn.execute(
        `UPDATE hr_batch_control
            SET STATUS = 'INACTIVE', CLOSED_AT = NOW(), UPDATED_AT = NOW()
          WHERE BATCH_NO = ?`,
        [batchNo]
      );
    }

    await conn.commit();
    res.json({ ok: true, message: 'Batch updated.' });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') {
      e.status = 409;
      e.message = 'This batch number already exists.';
    }
    next(e);
  } finally {
    conn.release();
  }
});

router.delete('/batches/:batchNo', requireSuperAdmin, async (req, res, next) => {
  const batchNo = String(req.params.batchNo || '').trim();
  if (!batchNo) return res.status(400).json({ message: 'Batch number is required.' });

  try {
    const [result] = await pool.execute(
      `DELETE FROM hr_batch_control WHERE BATCH_NO = ?`,
      [batchNo]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Batch not found.' });
    res.json({ ok: true, message: 'Batch deleted.' });
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
      e.status = 409;
      e.message = 'This batch contains employee or update-request records and cannot be deleted.';
    }
    next(e);
  }
});

/**
 * List employee records so admin can assign IPI using Merit List ID + Class ID.
 */
router.get('/employees', async (req, res, next) => {
  try {
    const batchNo = String(req.query.batchNo || '').trim();
    const search = String(req.query.search || '').trim();
    const params = [];
    const conditions = [];

    if (batchNo) {
      conditions.push('e.batch_no = ?');
      params.push(batchNo);
    }

    if (search) {
      const searchValue = `%${search}%`;
      conditions.push(`(
        e.MERITLIST_ID LIKE ? OR
        e.CLASS_ID LIKE ? OR
        e.IPI LIKE ? OR
        e.NAME LIKE ? OR
        e.PHONE LIKE ?
      )`);
      params.push(searchValue, searchValue, searchValue, searchValue, searchValue);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `SELECT e.EMP_ENTRY_ID,
              e.MERITLIST_ID,
              e.CLASS_ID,
              e.IPI,
              e.APPROVAL_STATUS,
              e.APPROVED_BY,
              e.APPROVED_AT,
              e.NAME,
              e.PHONE,
              e.batch_no,
              e.CREATED_AT,
              e.UPDATED_AT
         FROM up_emp e
         ${where}
        ORDER BY e.CREATED_AT DESC, e.EMP_ENTRY_ID DESC`,
      params
    );

    res.json(rows);

  } catch (e) {
    next(e);
  }
});

router.get('/employees/:empEntryId', async (req, res, next) => {
  const empEntryId = Number(req.params.empEntryId);

  if (!Number.isInteger(empEntryId) || empEntryId <= 0) {
    return res.status(400).json({ message: 'Invalid employee entry ID.' });
  }

  try {
    const [employees] = await pool.execute(
      `SELECT * FROM up_emp WHERE EMP_ENTRY_ID = ? LIMIT 1`,
      [empEntryId]
    );

    if (!employees[0]) {
      return res.status(404).json({ message: 'Employee record not found.' });
    }

    const [education] = await pool.execute(
      `SELECT SLNO, EMP_ENTRY_ID, EMPCODE, EXAMNAME, EXAMGROUP, BOARD, CLAS,
              PASSYEAR, REMARKS, INSTITUTE, SUBJECT_NAME
         FROM hr_empexamdet
        WHERE EMP_ENTRY_ID = ?
        ORDER BY SLNO`,
      [empEntryId]
    );

    res.json({ employee: employees[0], education });
  } catch (e) {
    next(e);
  }
});

router.delete('/employees/:empEntryId', requireSuperAdmin, async (req, res, next) => {
  const empEntryId = Number(req.params.empEntryId);
  if (!Number.isInteger(empEntryId) || empEntryId <= 0) {
    return res.status(400).json({ message: 'Invalid employee entry ID.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`DELETE FROM hr_update_request WHERE EMP_ENTRY_ID = ?`, [empEntryId]);
    const [result] = await conn.execute(`DELETE FROM up_emp WHERE EMP_ENTRY_ID = ?`, [empEntryId]);
    if (!result.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ message: 'Employee record not found.' });
    }
    await conn.commit();
    res.json({ ok: true, message: 'Employee information deleted.' });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

router.put('/employees/:empEntryId', async (req, res, next) => {
  const empEntryId = Number(req.params.empEntryId);
  const employee = cleanObj(req.body?.employee, EMP_COLUMNS);
  const meritlistId = String(req.body?.employee?.MERITLIST_ID || '').trim();
  const classId = String(req.body?.employee?.CLASS_ID || '').trim();
  const ipi = String(req.body?.employee?.IPI || '').trim();
  const batchNo = String(req.body?.batchNo || '').trim();
  const approvalStatus = String(req.body?.approvalStatus || '').toUpperCase();
  const education = Array.isArray(req.body?.education) ? req.body.education : [];

  if (!Number.isInteger(empEntryId) || empEntryId <= 0) {
    return res.status(400).json({ message: 'Invalid employee entry ID.' });
  }

  if (!meritlistId || !classId || !batchNo) {
    return res.status(400).json({
      message: 'Merit List ID, Class ID and batch are required.'
    });
  }

  if (!['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'].includes(approvalStatus)) {
    return res.status(400).json({ message: 'Invalid approval status.' });
  }

  const requireComplete = approvalStatus === 'APPROVED';

  try {
    validateEmployee(employee, { required: requireComplete });
  } catch (e) {
    return next(e);
  }

  let normalizedEducation;
  try {
    normalizedEducation = validateAndNormalizeEducation(education, { required: requireComplete });
  } catch (e) {
    return next(e);
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existing] = await conn.execute(
      `SELECT EMP_ENTRY_ID, APPROVAL_STATUS FROM up_emp WHERE EMP_ENTRY_ID = ? FOR UPDATE`,
      [empEntryId]
    );

    if (!existing[0]) {
      throw Object.assign(new Error('Employee record not found.'), { status: 404 });
    }

    if (existing[0].APPROVAL_STATUS === 'DRAFT' && approvalStatus !== 'DRAFT') {
      throw Object.assign(
        new Error('This employee entry is still a draft. The employee must submit it before its approval status can be changed.'),
        { status: 409 }
      );
    }

    if (existing[0].APPROVAL_STATUS !== 'DRAFT' && approvalStatus === 'DRAFT') {
      throw Object.assign(
        new Error('A submitted employee entry cannot be changed back to draft.'),
        { status: 409 }
      );
    }

    const [batch] = await conn.execute(
      `SELECT BATCH_NO FROM hr_batch_control WHERE BATCH_NO = ? LIMIT 1`,
      [batchNo]
    );

    if (!batch[0]) {
      throw Object.assign(new Error('Selected batch does not exist.'), { status: 400 });
    }

    const [duplicateIdentity] = await conn.execute(
      `SELECT EMP_ENTRY_ID FROM up_emp
        WHERE batch_no = ? AND MERITLIST_ID = ? AND CLASS_ID = ?
          AND EMP_ENTRY_ID <> ? LIMIT 1`,
      [batchNo, meritlistId, classId, empEntryId]
    );

    if (duplicateIdentity[0]) {
      throw Object.assign(new Error(`Merit List ID and Class ID are already used by another employee in batch ${batchNo}.`), { status: 409 });
    }

    if (ipi) {
      const [duplicateIpi] = await conn.execute(
        `SELECT EMP_ENTRY_ID FROM up_emp WHERE IPI = ? AND EMP_ENTRY_ID <> ? LIMIT 1`,
        [ipi, empEntryId]
      );

      if (duplicateIpi[0]) {
        throw Object.assign(new Error('This IPI is already assigned to another employee.'), { status: 409 });
      }
    }

    const setColumns = EMP_COLUMNS.map(column => `${column} = ?`).join(', ');
    const approvalAudit = ['DRAFT', 'PENDING'].includes(approvalStatus)
      ? [null, null]
      : [req.admin.username, new Date()];

    await conn.execute(
      `UPDATE up_emp
          SET MERITLIST_ID = ?, CLASS_ID = ?, IPI = ?, batch_no = ?,
              APPROVAL_STATUS = ?, APPROVED_BY = ?, APPROVED_AT = ?,
              ${setColumns}, UPDATED_AT = NOW()
        WHERE EMP_ENTRY_ID = ?`,
      [
        meritlistId,
        classId,
        ipi || null,
        batchNo,
        approvalStatus,
        ...approvalAudit,
        ...EMP_COLUMNS.map(column => employee[column] || null),
        empEntryId
      ]
    );

    await conn.execute(
      `DELETE FROM hr_empexamdet WHERE EMP_ENTRY_ID = ?`,
      [empEntryId]
    );

    for (const [index, row] of normalizedEducation.entries()) {
      await conn.execute(
        `INSERT INTO hr_empexamdet
         (EMP_ENTRY_ID, SLNO, EMPCODE, EXAMNAME, EXAMGROUP, BOARD, CLAS,
          PASSYEAR, REMARKS, INSTITUTE, SUBJECT_NAME)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empEntryId,
          index + 1,
          ipi || null,
          row.EXAMNAME || null,
          row.EXAMGROUP || null,
          row.BOARD || null,
          row.CLAS || null,
          row.PASSYEAR || null,
          row.REMARKS || null,
          row.INSTITUTE || null,
          row.SUBJECT_NAME || null
        ]
      );
    }

    await conn.commit();
    res.json({ ok: true, message: 'Employee details updated.' });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') {
      e.status = 409;
      e.message = String(e.message).includes('UK_EMP_IPI')
        ? 'This IPI is already assigned to another employee.'
        : `Merit List ID and Class ID are already used by another employee in batch ${batchNo}.`;
    }
    next(e);
  } finally {
    conn.release();
  }
});

router.patch('/employees/:empEntryId/approval', async (req, res, next) => {
  const empEntryId = Number(req.params.empEntryId);
  const approvalStatus = String(req.body?.approvalStatus || '').toUpperCase();

  if (!Number.isInteger(empEntryId) || empEntryId <= 0) {
    return res.status(400).json({ message: 'Invalid employee entry ID.' });
  }

  if (!['APPROVED', 'REJECTED'].includes(approvalStatus)) {
    return res.status(400).json({
      message: 'Approval status must be APPROVED or REJECTED.'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [employees] = await conn.execute(
      `SELECT * FROM up_emp WHERE EMP_ENTRY_ID = ? FOR UPDATE`,
      [empEntryId]
    );

    if (!employees[0]) {
      throw Object.assign(new Error('Employee record not found.'), { status: 404 });
    }

    if (employees[0].APPROVAL_STATUS === 'DRAFT') {
      throw Object.assign(
        new Error('This employee entry is still a draft. The employee must submit the completed form before an administrator can approve it.'),
        { status: 409 }
      );
    }

    if (approvalStatus === 'APPROVED') {
      const [education] = await conn.execute(
        `SELECT EXAMNAME, EXAMGROUP, BOARD, CLAS, PASSYEAR,
                REMARKS, INSTITUTE, SUBJECT_NAME
           FROM hr_empexamdet
          WHERE EMP_ENTRY_ID = ?
          ORDER BY SLNO`,
        [empEntryId]
      );

      validateEmployee(employees[0], { required: true });
      validateAndNormalizeEducation(education, { required: true });
    }

    await conn.execute(
      `UPDATE up_emp
          SET APPROVAL_STATUS = ?,
              APPROVED_BY = ?,
              APPROVED_AT = NOW(),
              UPDATED_AT = NOW()
        WHERE EMP_ENTRY_ID = ?`,
      [approvalStatus, req.admin.username, empEntryId]
    );

    await conn.commit();
    res.json({ ok: true, message: `Employee ${approvalStatus.toLowerCase()}.` });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

/**
 * Admin assigns or changes IPI.
 * Education EMPCODE is synchronized in the same transaction.
 */
router.patch('/employees/:empEntryId/ipi', async (req, res, next) => {
  const empEntryId = Number(req.params.empEntryId);
  const ipi = String(req.body?.ipi || '').trim();

  if (!Number.isInteger(empEntryId) || empEntryId <= 0) {
    return res.status(400).json({
      message: 'Invalid employee entry ID.'
    });
  }

  if (!ipi) {
    return res.status(400).json({
      message: 'IPI is required.'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [employees] = await conn.execute(
      `SELECT EMP_ENTRY_ID, MERITLIST_ID, CLASS_ID, IPI
         FROM up_emp
        WHERE EMP_ENTRY_ID = ?
        FOR UPDATE`,
      [empEntryId]
    );

    if (!employees[0]) {
      throw Object.assign(
        new Error('Employee record not found.'),
        { status: 404 }
      );
    }

    const [duplicate] = await conn.execute(
      `SELECT EMP_ENTRY_ID
         FROM up_emp
        WHERE IPI = ?
          AND EMP_ENTRY_ID <> ?
        LIMIT 1`,
      [ipi, empEntryId]
    );

    if (duplicate[0]) {
      throw Object.assign(
        new Error('This IPI is already assigned to another employee.'),
        { status: 409 }
      );
    }

    await conn.execute(
      `UPDATE up_emp
          SET IPI = ?,
              UPDATED_AT = NOW()
        WHERE EMP_ENTRY_ID = ?`,
      [ipi, empEntryId]
    );

    await conn.execute(
      `UPDATE hr_empexamdet
          SET EMPCODE = ?
        WHERE EMP_ENTRY_ID = ?`,
      [ipi, empEntryId]
    );

    await conn.execute(
      `UPDATE hr_update_request
          SET IPI = ?,
              UPDATED_AT = NOW()
        WHERE EMP_ENTRY_ID = ?`,
      [ipi, empEntryId]
    );

    await conn.commit();

    res.json({
      ok: true,
      message:
        'IPI assigned successfully to Merit List ID ' +
        employees[0].MERITLIST_ID +
        ' / Class ID ' +
        employees[0].CLASS_ID +
        '.'
    });

  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

router.post('/employees/:empEntryId/correction-access', async (req, res, next) => {
  const empEntryId = Number(req.params.empEntryId);
  const note = String(req.body?.note || '').trim();

  if (!Number.isInteger(empEntryId) || empEntryId <= 0) {
    return res.status(400).json({ message: 'Invalid employee entry ID.' });
  }
  if (!note) {
    return res.status(400).json({ message: 'Correction instructions are required.' });
  }
  if (note.length > 1000) {
    return res.status(400).json({ message: 'Correction instructions cannot exceed 1000 characters.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [employees] = await conn.execute(
      `SELECT EMP_ENTRY_ID, IPI, MERITLIST_ID, CLASS_ID, batch_no, APPROVAL_STATUS
         FROM up_emp WHERE EMP_ENTRY_ID = ? FOR UPDATE`,
      [empEntryId]
    );
    const employee = employees[0];
    if (!employee) {
      throw Object.assign(new Error('Employee record not found.'), { status: 404 });
    }
    if (employee.APPROVAL_STATUS !== 'APPROVED') {
      throw Object.assign(new Error('Correction access can only be granted to an approved employee.'), { status: 409 });
    }

    const [pending] = await conn.execute(
      `SELECT REQUEST_ID FROM hr_update_request
        WHERE EMP_ENTRY_ID = ? AND STATUS = 'PENDING'
        ORDER BY REQUESTED_AT DESC LIMIT 1 FOR UPDATE`,
      [empEntryId]
    );

    if (pending[0]) {
      await conn.execute(
        `UPDATE hr_update_request
            SET STATUS = 'APPROVED', APPROVED_AT = NOW(),
                APPROVED_UNTIL = DATE_ADD(NOW(), INTERVAL 24 HOUR),
                APPROVED_BY = ?, ADMIN_REMARKS = ?, UPDATED_AT = NOW()
          WHERE REQUEST_ID = ?`,
        [req.admin.username, note, pending[0].REQUEST_ID]
      );
    } else {
      await conn.execute(
        `INSERT INTO hr_update_request
          (REQUEST_ID, EMP_ENTRY_ID, IPI, MERITLIST_ID, CLASS_ID, BATCH_NO,
           REQUEST_NOTE, REQUESTED_AT, STATUS, APPROVED_AT, APPROVED_UNTIL,
           APPROVED_BY, ADMIN_REMARKS)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'APPROVED', NOW(),
                 DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?)`,
        [
          uuidv4(), employee.EMP_ENTRY_ID, employee.IPI || null,
          employee.MERITLIST_ID, employee.CLASS_ID, employee.batch_no,
          'Correction requested by administrator.', req.admin.username, note
        ]
      );
    }

    await conn.commit();
    res.status(201).json({
      ok: true,
      message: 'Correction access granted for 24 hours. The employee will see the instructions after verification.'
    });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

router.get('/update-requests', async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE hr_update_request
          SET STATUS = 'EXPIRED'
        WHERE STATUS = 'APPROVED'
          AND APPROVED_UNTIL <= NOW()`
    );

    const status = String(req.query.status || '').toUpperCase();
    const params = [];
    let where = '';

    if (['PENDING','APPROVED','REJECTED','EXPIRED'].includes(status)) {
      where = 'WHERE r.STATUS = ?';
      params.push(status);
    }

    const [rows] = await pool.execute(
      `SELECT r.*, e.NAME, e.PHONE
         FROM hr_update_request r
         JOIN up_emp e
           ON e.EMP_ENTRY_ID = r.EMP_ENTRY_ID
         ${where}
        ORDER BY r.REQUESTED_AT DESC`,
      params
    );

    res.json(rows);

  } catch (e) {
    next(e);
  }
});

router.patch('/update-requests/:requestId', async (req, res, next) => {
  const status = String(req.body?.status || '').toUpperCase();
  const remark = String(req.body?.remark || '').trim();

  if (!['APPROVED','REJECTED'].includes(status)) {
    return res.status(400).json({
      message: 'Status must be APPROVED or REJECTED.'
    });
  }

  try {
    if (status === 'APPROVED') {
      const [result] = await pool.execute(
        `UPDATE hr_update_request
            SET STATUS = 'APPROVED',
                APPROVED_AT = NOW(),
                APPROVED_UNTIL = DATE_ADD(NOW(), INTERVAL 24 HOUR),
                APPROVED_BY = ?,
                ADMIN_REMARKS = ?,
                UPDATED_AT = NOW()
          WHERE REQUEST_ID = ?`,
        [req.admin.username, remark || null, req.params.requestId]
      );
      if (!result.affectedRows) return res.status(404).json({ message: 'Update request not found.' });

    } else {
      const [result] = await pool.execute(
        `UPDATE hr_update_request
            SET STATUS = 'REJECTED',
                APPROVED_AT = NULL,
                APPROVED_UNTIL = NULL,
                APPROVED_BY = ?,
                ADMIN_REMARKS = ?,
                UPDATED_AT = NOW()
          WHERE REQUEST_ID = ?`,
        [req.admin.username, remark || null, req.params.requestId]
      );
      if (!result.affectedRows) return res.status(404).json({ message: 'Update request not found.' });
    }

    res.json({ ok: true });

  } catch (e) {
    next(e);
  }
});

router.delete('/update-requests/:requestId', async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      `DELETE FROM hr_update_request WHERE REQUEST_ID = ?`,
      [req.params.requestId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Update request not found.' });
    }
    res.json({ ok: true, message: 'Update request log deleted.' });
  } catch (e) {
    next(e);
  }
});

router.get('/export/:batchNo', async (req, res, next) => {
  try {
    const batchNo = req.params.batchNo;

    const [employees] = await pool.execute(
      `SELECT
          IPI,
          NAME,
          batch_no,
          BIRTHDATE,
          BLD_GROUP,
          GENDER,
          RELIGION,
          NATIONALITY,
          MARITAL_STATUS,
          EMAIL,
          PHONE,
          PHONE1,
          HEIGHT,
          WEIGHT,
          NID,
          PERMANENT_VILLAGE,
          PERMANENT_POST,
          PERMANENT_THANA,
          PERMANENT_DISTRICT,
          PRESENT_VILLAGE,
          PRESENT_POST,
          PRESENT_THANA,
          PRESENT_DISTRICT,
          EMGRCNY_PERSON,
          EMGRCNY_RELATION,
          EMGRCNY_ADDRESS,
          EMGRCNY_PHONE,
          FATHER_NAME,
          FATHER_PHONE,
          MOTHER_NAME,
          MOTHER_PHONE,
          SPOUSE_NAME,
          SPOSE_MARRIAGE_DATE,
          SPOSE_OCCUPATION,
          SPOUSE_PHONE,
          GRNT_NAME,
          GRNT_RELE,
          GRNT_FATHER,
          GRNT_PRESENT_ADD,
          GRNT_PERMANET_ADD,
          GRNT_NATIONALITY,
          GRNT_PROFFESSION,
          GRNT_NID,
          GRNT_MOBILE,
          CREATED_AT,
          UPDATED_AT
        FROM up_emp
       WHERE batch_no = ?
       ORDER BY MERITLIST_ID, CLASS_ID`,
      [batchNo]
    );

    const [exams] = await pool.execute(
      `SELECT
          d.SLNO,
          d.EMPCODE,
          d.EXAMNAME,
          d.EXAMGROUP,
          d.BOARD,
          d.CLAS,
          d.PASSYEAR,
          d.REMARKS,
          d.INSTITUTE,
          d.SUBJECT_NAME
        FROM hr_empexamdet d
        JOIN up_emp e
          ON e.EMP_ENTRY_ID = d.EMP_ENTRY_ID
       WHERE e.batch_no = ?
       ORDER BY e.MERITLIST_ID, e.CLASS_ID, d.SLNO`,
      [batchNo]
    );

    const workbook = new ExcelJS.Workbook();
    const empSheet = workbook.addWorksheet('up_emp');
    const examSheet = workbook.addWorksheet('hr_empexamdet');

    if (employees.length) {
      empSheet.columns = Object.keys(employees[0]).map(k => ({
        header: k,
        key: k,
        width: 18
      }));
      employees.forEach(r => empSheet.addRow(r));
    } else {
      empSheet.addRow(['No data']);
    }

    if (exams.length) {
      examSheet.columns = Object.keys(exams[0]).map(k => ({
        header: k,
        key: k,
        width: 18
      }));
      exams.forEach(r => examSheet.addRow(r));
    } else {
      examSheet.addRow(['No data']);
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Employee_Data_${batchNo}.xlsx"`
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (e) {
    next(e);
  }
});

export default router;
