export async function getActiveBatch(conn) {
  const [rows] = await conn.query(
    `SELECT BATCH_NO, STATUS, STARTED_AT
       FROM hr_batch_control
      WHERE STATUS = 'ACTIVE'
      ORDER BY STARTED_AT DESC, UPDATED_AT DESC`
  );

  if (rows.length > 1) {
    const err = new Error('More than one ACTIVE batch exists. Fix hr_batch_control.');
    err.status = 409;
    throw err;
  }

  return rows[0] || null;
}

export async function getEmployeePermission(
  conn,
  empEntryId,
  batchNo,
  approvalStatus = 'APPROVED'
) {
  if (approvalStatus !== 'APPROVED') {
    return {
      canEdit: false,
      reason: approvalStatus === 'DRAFT'
        ? 'DRAFT'
        : approvalStatus === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING_APPROVAL',
      approvedUntil: null,
      pending: false
    };
  }

  const [batchRows] = await conn.execute(
    `SELECT STATUS
       FROM hr_batch_control
      WHERE BATCH_NO = ?`,
    [batchNo]
  );

  if (batchRows[0]?.STATUS === 'ACTIVE') {
    const [corrections] = await conn.execute(
      `SELECT ADMIN_REMARKS, APPROVED_UNTIL
         FROM hr_update_request
        WHERE EMP_ENTRY_ID = ?
          AND STATUS = 'APPROVED'
          AND APPROVED_UNTIL > NOW()
          AND ADMIN_REMARKS IS NOT NULL
        ORDER BY APPROVED_UNTIL DESC
        LIMIT 1`,
      [empEntryId]
    );
    return {
      canEdit: true,
      reason: 'ACTIVE_BATCH',
      approvedUntil: corrections[0]?.APPROVED_UNTIL || null,
      correctionNote: corrections[0]?.ADMIN_REMARKS || null,
      pending: false
    };
  }

  const [approved] = await conn.execute(
    `SELECT REQUEST_ID, APPROVED_UNTIL, ADMIN_REMARKS
       FROM hr_update_request
      WHERE EMP_ENTRY_ID = ?
        AND STATUS = 'APPROVED'
        AND APPROVED_UNTIL > NOW()
      ORDER BY APPROVED_UNTIL DESC
      LIMIT 1`,
    [empEntryId]
  );

  if (approved[0]) {
    return {
      canEdit: true,
      reason: 'TEMP_APPROVAL',
      approvedUntil: approved[0].APPROVED_UNTIL,
      correctionNote: approved[0].ADMIN_REMARKS || null,
      pending: false
    };
  }

  const [pending] = await conn.execute(
    `SELECT REQUEST_ID
       FROM hr_update_request
      WHERE EMP_ENTRY_ID = ?
        AND STATUS = 'PENDING'
      ORDER BY REQUESTED_AT DESC
      LIMIT 1`,
    [empEntryId]
  );

  return {
    canEdit: false,
    reason: 'INACTIVE_BATCH',
    approvedUntil: null,
    pending: !!pending[0]
  };
}
