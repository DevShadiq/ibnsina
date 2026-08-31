export function blankChild() {
  return {
    FNAME: '',
    F_OCUP: '',
    F_ADD: '',
    PHONE: '',
    BIRTH_DATE: ''
  };
}

export function normalizeChildren(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    ...blankChild(),
    ...row,
    BIRTH_DATE: row?.BIRTH_DATE ? String(row.BIRTH_DATE).slice(0, 10) : ''
  }));
}
