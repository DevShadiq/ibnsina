const CHILD_COLUMNS = ['FNAME', 'F_OCUP', 'F_ADD', 'PHONE', 'BIRTH_DATE'];
const MAX_LENGTHS = { FNAME: 100, F_OCUP: 70, F_ADD: 100, PHONE: 25 };

function cleanChild(input) {
  const child = {};
  for (const column of CHILD_COLUMNS) {
    const value = input?.[column];
    child[column] = typeof value === 'string' ? value.trim() : (value ?? null);
  }
  return child;
}

function hasDetails(child) {
  return CHILD_COLUMNS.some(column => child[column]);
}

export function validateAndNormalizeChildren(input, { married = false } = {}) {
  if (!married) return [];

  const children = (Array.isArray(input) ? input : [])
    .map(cleanChild)
    .filter(hasDetails);

  for (const [index, child] of children.entries()) {
    for (const [column, maxLength] of Object.entries(MAX_LENGTHS)) {
      if (child[column] && String(child[column]).length > maxLength) {
        throw Object.assign(
          new Error(`Child ${index + 1}: ${column} cannot exceed ${maxLength} characters.`),
          { status: 400 }
        );
      }
    }
  }

  return children;
}
