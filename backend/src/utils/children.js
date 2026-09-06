const CHILD_COLUMNS = ['FNAME', 'F_OCUP', 'F_ADD', 'PHONE', 'BIRTH_DATE'];

const MAX_LENGTHS = {
  FNAME: 100,
  F_OCUP: 70,
  F_ADD: 100,
  PHONE: 25
};

function cleanChild(input) {
  const child = {};
  for (const column of CHILD_COLUMNS) {
    const value = input?.[column];
    child[column] = typeof value === 'string' ? value.trim() : (value ?? '');
  }
  return child;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateAndNormalizeChildren(input, { married = false } = {}) {
  if (!married) return [];

  if (!Array.isArray(input)) return [];
  if (input.length > 20) {
    throw Object.assign(new Error('A maximum of 20 children can be entered.'), { status: 400 });
  }

  return input
    .map(cleanChild)
    .filter(child => CHILD_COLUMNS.some(column => child[column]))
    .map((child, index) => {
      if (!child.FNAME) {
        throw Object.assign(
          new Error(`Child ${index + 1}: Child name is required when child information is entered.`),
          { status: 400 }
        );
      }

      for (const [column, maximum] of Object.entries(MAX_LENGTHS)) {
        if (String(child[column] || '').length > maximum) {
          throw Object.assign(
            new Error(`Child ${index + 1}: ${column} cannot exceed ${maximum} characters.`),
            { status: 400 }
          );
        }
      }

      if (child.BIRTH_DATE && !isValidDate(String(child.BIRTH_DATE))) {
        throw Object.assign(
          new Error(`Child ${index + 1}: Birth date is invalid.`),
          { status: 400 }
        );
      }

      return { ...child, CHILD_NOS: index + 1 };
    });
}
