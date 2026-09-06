import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db.js';
import { getActiveBatch, getEmployeePermission } from '../services/access.js';
import {
  localPhoneDigits,
  normalizeAndValidateEmployeePhones,
  normalizePhone
} from '../utils/phones.js';
import { validateAndNormalizeEducation } from '../utils/education.js';
import { normalizeAndValidateMeasurements } from '../utils/measurements.js';
import { normalizeAndValidateEmployeeNids } from '../utils/nid.js';
import { validateAndNormalizeChildren } from '../utils/children.js';
import { validateRequiredEmployeeFields } from '../utils/employee-required.js';

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

const allowed = {
  GENDER: ['', 'M', 'F'],
  RELIGION: ['', 'I', 'H', 'B', 'C'],
  MARITAL_STATUS: ['', 'U', 'M']
};

function cleanObj(input, columns) {
  const out = {};
  for (const c of columns) {
    const v = input?.[c];
    out[c] = typeof v === 'string' ? v.trim() : (v ?? null);
  }
  return out;
}

function validateEmployee(e, { required = true } = {}) {
  if (required) {
    validateRequiredEmployeeFields(e);
  }

  for (const key of Object.keys(allowed)) {
    if (!allowed[key].includes(e[key] || '')) {
      throw Object.assign(new Error(`Invalid ${key} value.`), { status: 400 });
    }
  }

  normalizeAndValidateEmployeePhones(e, { required });
  normalizeAndValidateMeasurements(e, { required });
  normalizeAndValidateEmployeeNids(e, { required });

  if (required && e.MARITAL_STATUS === 'M' && !e.SPOUSE_NAME) {
    throw Object.assign(new Error('Spouse name is required when marital status is Married.'), { status: 400 });
  }
}

async function getVerifiedEmployee(conn, meritlistId, classId, phone, lock = false) {
  const sql =
    `SELECT *
       FROM up_emp
      WHERE MERITLIST_ID = ?
        AND CLASS_ID = ?
        AND RIGHT(REPLACE(REPLACE(PHONE, ' ', ''), '+', ''), 11) = ?
      ORDER BY CREATED_AT DESC, EMP_ENTRY_ID DESC
      LIMIT 1` + (lock ? ' FOR UPDATE' : '');

  const [rows] = await conn.execute(
    sql,
    [meritlistId, classId, localPhoneDigits(phone)]
  );

  return rows[0] || null;
}

async function getEmployeeByIdentity(conn, meritlistId, classId, batchNo = '', lock = false) {
  const batchCondition = batchNo ? ' AND batch_no = ?' : '';
  const params = batchNo ? [meritlistId, classId, batchNo] : [meritlistId, classId];
  const sql =
    `SELECT *
       FROM up_emp
      WHERE MERITLIST_ID = ?
        AND CLASS_ID = ?
        ${batchCondition}
      ORDER BY CREATED_AT DESC, EMP_ENTRY_ID DESC
      LIMIT 1` + (lock ? ' FOR UPDATE' : '');

  const [rows] = await conn.execute(sql, params);
  return rows[0] || null;
}

async function getReservedDraft(conn, empEntryId, meritlistId, classId, batchNo, lock = false) {
  const sql =
    `SELECT *
       FROM up_emp
      WHERE EMP_ENTRY_ID = ?
        AND MERITLIST_ID = ?
        AND CLASS_ID = ?
        AND batch_no = ?
        AND APPROVAL_STATUS = 'DRAFT'
      LIMIT 1` + (lock ? ' FOR UPDATE' : '');
  const [rows] = await conn.execute(
    sql,
    [empEntryId, meritlistId, classId, batchNo]
  );
  return rows[0] || null;
}

async function getEmployeeChildren(conn, empEntryId) {
  const [rows] = await conn.execute(
    `SELECT FAMILY_ID, EMP_ENTRY_ID, EMPCODE, FNAME, F_OCUP, F_ADD,
            PHONE, CHILD_NOS, BIRTH_DATE
       FROM hr_empfamilydet
      WHERE EMP_ENTRY_ID = ?
      ORDER BY CHILD_NOS, FAMILY_ID`,
    [empEntryId]
  );
  return rows;
}

router.get('/app-state', async (req, res, next) => {
  try {
    const conn = await pool.getConnection();

    try {
      const active = await getActiveBatch(conn);

      res.json({
        activeBatch: active?.BATCH_NO || null,
        collectionOpen: !!active
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    next(e);
  }
});

/**
 * First step for employee.
 *
 * Existing employee:
 * MERITLIST_ID + CLASS_ID + PHONE must all match.
 *
 * New employee:
 * No row may already exist for BATCH_NO + MERITLIST_ID + CLASS_ID.
 * An ACTIVE batch must exist.
 */
router.post('/employee/lookup', async (req, res, next) => {
  const meritlistId = String(req.body?.meritlistId || '').trim();
  const classId = String(req.body?.classId || '').trim();
  const phone = normalizePhone(req.body?.phone);

  if (!meritlistId || !classId || !phone) {
    return res.status(400).json({
      message: 'Merit List ID, Class ID and Phone Number are required.'
    });
  }

  if (!localPhoneDigits(phone)) {
    return res.status(400).json({
      message: 'Phone Number must be 11 digits and start with 013, 014, 015, 016, 017, 018 or 019.'
    });
  }

  const conn = await pool.getConnection();

  try {
    const employee = await getVerifiedEmployee(
      conn,
      meritlistId,
      classId,
      phone
    );

    const active = await getActiveBatch(conn);

    if (!employee) {
      // Prevent someone from creating a second row when merit/class exists
      // but the phone was typed incorrectly.
      const [sameIdentity] = await conn.execute(
        `SELECT EMP_ENTRY_ID
           FROM up_emp
          WHERE MERITLIST_ID = ?
            AND CLASS_ID = ?
          LIMIT 1`,
        [meritlistId, classId]
      );

      if (sameIdentity[0]) {
        return res.status(401).json({
          message: 'Merit List ID / Class ID was found, but the phone number does not match.'
        });
      }

      return res.json({
        found: false,
        canCreate: !!active,
        canEdit: !!active,
        activeBatch: active?.BATCH_NO || null,
        identity: {
          meritlistId,
          classId,
          phone
        }
      });
    }

    const permission = await getEmployeePermission(
      conn,
      employee.EMP_ENTRY_ID,
      employee.batch_no,
      employee.APPROVAL_STATUS
    );

    const [education] = await conn.execute(
      `SELECT SLNO, EMP_ENTRY_ID, EMPCODE, EXAMNAME, EXAMGROUP, BOARD, CLAS,
              PASSYEAR, REMARKS, INSTITUTE, SUBJECT_NAME
         FROM hr_empexamdet
        WHERE EMP_ENTRY_ID = ?
        ORDER BY SLNO`,
      [employee.EMP_ENTRY_ID]
    );

    const children = await getEmployeeChildren(conn, employee.EMP_ENTRY_ID);

    res.json({
      found: true,
      employee,
      education,
      children,
      batchNo: employee.batch_no,
      ...permission,
      canRequestUpdate:
        employee.APPROVAL_STATUS === 'APPROVED' &&
        !permission.canEdit &&
        !permission.pending
    });

  } catch (e) {
    next(e);
  } finally {
    conn.release();
  }
});

/**
 * New employees enter Merit List ID and Class ID themselves. They do not need
 * to verify a phone number because no employee record exists yet.
 */
router.post('/employee/new-entry', async (req, res, next) => {
  const meritlistId = String(req.body?.meritlistId || '').trim();
  const classId = String(req.body?.classId || '').trim();

  if (!meritlistId || !classId) {
    return res.status(400).json({
      message: 'Merit List ID and Class ID are required.'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const active = await getActiveBatch(conn);

    if (!active) {
      await conn.rollback();
      return res.status(409).json({
        message: 'New employee submissions are available only while a batch is ACTIVE.'
      });
    }

    const existing = await getEmployeeByIdentity(
      conn,
      meritlistId,
      classId,
      active.BATCH_NO,
      true
    );

    if (existing) {
      if (existing.APPROVAL_STATUS === 'DRAFT') {
        const [education] = await conn.execute(
          `SELECT SLNO, EMP_ENTRY_ID, EMPCODE, EXAMNAME, EXAMGROUP, BOARD, CLAS,
                  PASSYEAR, REMARKS, INSTITUTE, SUBJECT_NAME
             FROM hr_empexamdet
            WHERE EMP_ENTRY_ID = ?
            ORDER BY SLNO`,
          [existing.EMP_ENTRY_ID]
        );

        const children = await getEmployeeChildren(conn, existing.EMP_ENTRY_ID);

        await conn.commit();

        return res.json({
          canCreate: true,
          resumeDraft: true,
          empEntryId: existing.EMP_ENTRY_ID,
          activeBatch: active.BATCH_NO,
          identity: { meritlistId, classId },
          employee: existing,
          education,
          children
        });
      }

      await conn.rollback();
      return res.status(409).json({
        message: `This employee entry was already ${existing.APPROVAL_STATUS.toLowerCase()} in batch ${active.BATCH_NO}. Use a different Merit List ID and Class ID for a new employee.`
      });
    }

    const [result] = await conn.execute(
      `INSERT INTO up_emp
       (MERITLIST_ID, CLASS_ID, NATIONALITY, batch_no, APPROVAL_STATUS, CREATED_AT)
       VALUES (?, ?, 'Bangladeshi', ?, 'DRAFT', NOW())`,
      [meritlistId, classId, active.BATCH_NO]
    );

    await conn.commit();

    res.json({
      canCreate: true,
      draftCreated: true,
      empEntryId: result.insertId,
      activeBatch: active.BATCH_NO,
      identity: { meritlistId, classId }
    });

  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') {
      e.status = 409;
      e.message = 'This Merit List ID and Class ID was just started in the active batch. Start again to resume its saved draft.';
    }
    next(e);
  } finally {
    conn.release();
  }
});

router.post('/employee/save', async (req, res, next) => {
  const newEntry = Boolean(req.body?.newEntry);
  const submitForApproval = req.body?.submitForApproval !== false;
  const draftEntryId = Number.parseInt(req.body?.draftEntryId, 10) || null;
  const identity = {
    meritlistId: String(req.body?.identity?.meritlistId || '').trim(),
    classId: String(req.body?.identity?.classId || '').trim(),
    phone: normalizePhone(req.body?.identity?.phone)
  };

  if (!identity.meritlistId || !identity.classId || (!newEntry && !identity.phone)) {
    return res.status(400).json({
      message: newEntry
        ? 'Merit List ID and Class ID are required.'
        : 'Merit List ID, Class ID and Phone Number are required.'
    });
  }


  if (!newEntry && !localPhoneDigits(identity.phone)) {
    return res.status(400).json({
      message: 'Phone Number must be 11 digits and start with 013, 014, 015, 016, 017, 018 or 019.'
    });
  }

  const employee = cleanObj(req.body?.employee, EMP_COLUMNS);
  employee.PHONE = normalizePhone(employee.PHONE || identity.phone);

  const education = Array.isArray(req.body?.education) ? req.body.education : [];
  const children = Array.isArray(req.body?.children) ? req.body.children : [];

  validateEmployee(employee, { required: submitForApproval });

  let normalizedEducation;
  let normalizedChildren;
  try {
    normalizedEducation = validateAndNormalizeEducation(education, { required: submitForApproval });
    normalizedChildren = validateAndNormalizeChildren(children, {
      married: employee.MARITAL_STATUS === 'M'
    });
  } catch (e) {
    return next(e);
  }

  // Existing employees cannot change the phone used for verification.
  if (!newEntry && normalizePhone(employee.PHONE) !== identity.phone) {
    return res.status(400).json({
      message: 'Primary phone cannot be changed in this session.'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    let active = null;
    let current;

    if (newEntry) {
      active = await getActiveBatch(conn);

      if (!active) {
        throw Object.assign(
          new Error('There is no ACTIVE batch for new submissions.'),
          { status: 409 }
        );
      }

      current = draftEntryId
        ? await getReservedDraft(
            conn,
            draftEntryId,
            identity.meritlistId,
            identity.classId,
            active.BATCH_NO,
            true
          )
        : await getEmployeeByIdentity(
            conn,
            identity.meritlistId,
            identity.classId,
            active.BATCH_NO,
            true
          );

      if (draftEntryId && !current) {
        throw Object.assign(
          new Error('This draft is no longer available. Return to New Employee and check the Merit List ID and Class ID again.'),
          { status: 409 }
        );
      }
    } else {
      current = await getVerifiedEmployee(
        conn,
        identity.meritlistId,
        identity.classId,
        identity.phone,
        true
      );
    }

    let empEntryId;
    let ipi = null;

    const resumingDraft = newEntry && current?.APPROVAL_STATUS === 'DRAFT';

    if (newEntry && current && !resumingDraft) {
      throw Object.assign(
        new Error(`This Merit List ID and Class ID already exists in batch ${active.BATCH_NO}. Duplicates are not allowed within the same batch.`),
        { status: 409 }
      );
    }

    if (!current) {
      if (!newEntry) {
        const sameIdentity = await getEmployeeByIdentity(
          conn,
          identity.meritlistId,
          identity.classId,
          '',
          true
        );

        if (sameIdentity) {
          throw Object.assign(
            new Error('This Merit List ID and Class ID already exists. Phone verification failed.'),
            { status: 401 }
          );
        }
      }

      active ||= await getActiveBatch(conn);

      if (!active) {
        throw Object.assign(
          new Error('There is no ACTIVE batch for new submissions.'),
          { status: 409 }
        );
      }

      const insertCols = [
        'MERITLIST_ID',
        'CLASS_ID',
        ...EMP_COLUMNS,
        'batch_no',
        'APPROVAL_STATUS'
      ];

      const values = [
        identity.meritlistId,
        identity.classId,
        ...EMP_COLUMNS.map(c => employee[c] || null),
        active.BATCH_NO,
        submitForApproval ? 'PENDING' : 'DRAFT'
      ];

      const [result] = await conn.execute(
        `INSERT INTO up_emp
         (${insertCols.join(',')}, CREATED_AT)
         VALUES (${insertCols.map(() => '?').join(',')}, NOW())`,
        values
      );

      empEntryId = result.insertId;

    } else if (resumingDraft) {
      empEntryId = current.EMP_ENTRY_ID;
      ipi = current.IPI || null;

      const updateCols = EMP_COLUMNS;
      const setSql = updateCols.map(c => `${c} = ?`).join(',');

      await conn.execute(
        `UPDATE up_emp
            SET ${setSql},
                APPROVAL_STATUS = ?,
                UPDATED_AT = NOW()
          WHERE EMP_ENTRY_ID = ?`,
        [
          ...updateCols.map(c => employee[c] || null),
          submitForApproval ? 'PENDING' : 'DRAFT',
          current.EMP_ENTRY_ID
        ]
      );

      await conn.execute(
        `DELETE FROM hr_empexamdet WHERE EMP_ENTRY_ID = ?`,
        [current.EMP_ENTRY_ID]
      );

      await conn.execute(
        `DELETE FROM hr_empfamilydet WHERE EMP_ENTRY_ID = ?`,
        [current.EMP_ENTRY_ID]
      );

    } else {
      empEntryId = current.EMP_ENTRY_ID;
      ipi = current.IPI || null;

      const permission = await getEmployeePermission(
        conn,
        current.EMP_ENTRY_ID,
        current.batch_no,
        current.APPROVAL_STATUS
      );

      if (!permission.canEdit) {
        throw Object.assign(
          new Error(
            'This record is locked. Admin approval is required for an inactive batch.'
          ),
          { status: 403 }
        );
      }

      const updateCols = EMP_COLUMNS;
      const setSql = updateCols.map(c => `${c} = ?`).join(',');

      await conn.execute(
        `UPDATE up_emp
            SET ${setSql},
                UPDATED_AT = NOW()
          WHERE EMP_ENTRY_ID = ?`,
        [
          ...updateCols.map(c => employee[c] || null),
          current.EMP_ENTRY_ID
        ]
      );

      await conn.execute(
        `DELETE FROM hr_empexamdet
          WHERE EMP_ENTRY_ID = ?`,
        [current.EMP_ENTRY_ID]
      );

      await conn.execute(
        `DELETE FROM hr_empfamilydet WHERE EMP_ENTRY_ID = ?`,
        [current.EMP_ENTRY_ID]
      );
    }

    for (const [index, row] of normalizedEducation.entries()) {
      await conn.execute(
        `INSERT INTO hr_empexamdet
         (EMP_ENTRY_ID, SLNO, EMPCODE, EXAMNAME, EXAMGROUP, BOARD, CLAS,
          PASSYEAR, REMARKS, INSTITUTE, SUBJECT_NAME)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          empEntryId,
          row.SLNO || index + 1,
          ipi,
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

    for (const child of normalizedChildren) {
      await conn.execute(
        `INSERT INTO hr_empfamilydet
         (EMP_ENTRY_ID, EMPCODE, FNAME, F_OCUP, F_ADD, PHONE, CHILD_NOS, BIRTH_DATE)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empEntryId,
          ipi,
          child.FNAME || null,
          child.F_OCUP || null,
          child.F_ADD || null,
          child.PHONE || null,
          child.CHILD_NOS,
          child.BIRTH_DATE || null
        ]
      );
    }

    await conn.commit();

    res.json({
      ok: true,
      empEntryId,
      ipi,
      submitted: submitForApproval,
      message: newEntry
        ? submitForApproval
          ? 'Employee information submitted and is waiting for admin approval.'
          : 'Draft saved successfully. You can continue editing and submit it later.'
        : 'Employee information updated successfully.'
    });

  } catch (e) {
    await conn.rollback();
    if (
      e.code === 'ER_DUP_ENTRY'
      && /UK_EMP_BATCH_MERIT_CLASS/i.test(String(e.sqlMessage || ''))
    ) {
      e.status = 409;
      e.message = 'This Merit List ID and Class ID already exists in the active batch. Duplicates are not allowed within the same batch.';
    }
    next(e);
  } finally {
    conn.release();
  }
});

router.post('/employee/update-request', async (req, res, next) => {
  const meritlistId = String(req.body?.meritlistId || '').trim();
  const classId = String(req.body?.classId || '').trim();
  const phone = normalizePhone(req.body?.phone);
  const note = String(req.body?.note || '').trim();

  if (!meritlistId || !classId || !phone) {
    return res.status(400).json({
      message: 'Merit List ID, Class ID and Phone Number are required.'
    });
  }


  if (!localPhoneDigits(phone)) {
    return res.status(400).json({
      message: 'Phone Number must be 11 digits and start with 013, 014, 015, 016, 017, 018 or 019.'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const employee = await getVerifiedEmployee(
      conn,
      meritlistId,
      classId,
      phone,
      true
    );

    if (!employee) {
      throw Object.assign(
        new Error('Employee verification failed.'),
        { status: 401 }
      );
    }

    const permission = await getEmployeePermission(
      conn,
      employee.EMP_ENTRY_ID,
      employee.batch_no,
      employee.APPROVAL_STATUS
    );

    if (employee.APPROVAL_STATUS !== 'APPROVED') {
      throw Object.assign(
        new Error('This employee record is waiting for admin approval.'),
        { status: 403 }
      );
    }

    if (permission.canEdit) {
      await conn.rollback();
      return res.json({
        ok: true,
        message: 'You already have update access.'
      });
    }

    if (permission.pending) {
      await conn.rollback();
      return res.json({
        ok: true,
        message: 'An update request is already pending.'
      });
    }

    await conn.execute(
      `INSERT INTO hr_update_request
       (REQUEST_ID, EMP_ENTRY_ID, IPI, MERITLIST_ID, CLASS_ID,
        BATCH_NO, REQUEST_NOTE, STATUS, REQUESTED_AT)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [
        uuidv4(),
        employee.EMP_ENTRY_ID,
        employee.IPI || null,
        employee.MERITLIST_ID,
        employee.CLASS_ID,
        employee.batch_no,
        note || null
      ]
    );

    await conn.commit();

    res.json({
      ok: true,
      message: 'Update request submitted for admin approval.'
    });

  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

export default router;
