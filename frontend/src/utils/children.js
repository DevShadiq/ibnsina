export function blankChild() {
  return {
    EMPCODE: '',
    FNAME: '',
    F_OCUP: '',
    F_ADD: '',
    PHONE: '',
    CHILD_NOS: null,
    BIRTH_DATE: ''
  };
}

export function normalizeChildren(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    ...blankChild(),
    ...row,
    CHILD_NOS: index + 1
  }));
}
