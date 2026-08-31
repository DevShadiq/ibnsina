export const EDUCATION_LEVELS = [
  'SSC / Dakhil',
  'HSC / Alim',
  'Fazil / Honours / BA / B.Sc',
  'Masters / Kamil'
];

export const EDUCATION_LEVEL_OPTIONS = [
  ['SSC', 'Dakhil'],
  ['HSC', 'Alim'],
  ['Fazil', 'Honours', 'BA', 'B.Sc'],
  ['Masters', 'Kamil']
];

export const EDUCATION_BOARDS = [
  'Barishal',
  'Chattogram',
  'Cumilla',
  'Dhaka',
  'Dinajpur',
  'Jashore',
  'Mymensingh',
  'Rajshahi',
  'Sylhet',
  'Madrasa',
  'Technical'
];

export const EDUCATION_GROUPS = [
  'General',
  'Science',
  'Humanities',
  'Business',
  'Others'
];

const EXAM_COLUMNS = [
  'EXAMNAME', 'EXAMGROUP', 'BOARD', 'CLAS', 'PASSYEAR',
  'REMARKS', 'INSTITUTE', 'SUBJECT_NAME'
];

const REQUIRED_DETAILS = ['EXAMNAME', 'BOARD', 'CLAS', 'PASSYEAR'];
const FIELD_LABELS = {
  EXAMNAME: 'Education Level',
  BOARD: 'Board',
  CLAS: 'Class / Result',
  PASSYEAR: 'Pass Year',
  INSTITUTE: 'Institute'
};

function cleanRow(input) {
  const row = {};
  for (const column of EXAM_COLUMNS) {
    const value = input?.[column];
    row[column] = typeof value === 'string' ? value.trim() : (value ?? null);
  }
  return row;
}

function hasEnteredDetails(row) {
  return EXAM_COLUMNS.some(column => row[column]);
}

export function validateAndNormalizeEducation(input, { required = true } = {}) {
  const rows = Array.isArray(input) ? input.map(cleanRow) : [];
  const normalized = [];

  for (let index = 0; index < EDUCATION_LEVELS.length; index += 1) {
    const row = rows[index] || cleanRow({});
    const rowRequired = required && index < 3;
    const active = rowRequired || hasEnteredDetails(row);

    if (!active) {
      if (!required) normalized.push(row);
      continue;
    }

    if (required) {
      for (const field of REQUIRED_DETAILS) {
        if (!row[field]) {
          const label = field === 'BOARD' && index >= 2 ? 'University' : FIELD_LABELS[field];
          throw Object.assign(
            new Error(`${EDUCATION_LEVELS[index]}: ${label} is required.`),
            { status: 400 }
          );
        }
      }
    }

    if (row.EXAMNAME && !EDUCATION_LEVEL_OPTIONS[index].includes(row.EXAMNAME)) {
      throw Object.assign(
        new Error(`${EDUCATION_LEVELS[index]}: select a valid education level.`),
        { status: 400 }
      );
    }

    if (index < 2 && row.BOARD && !EDUCATION_BOARDS.includes(row.BOARD)) {
      throw Object.assign(
        new Error(`${EDUCATION_LEVELS[index]}: select a valid education board from the list.`),
        { status: 400 }
      );
    }

    if (index < 2) {
      if (row.EXAMGROUP && !EDUCATION_GROUPS.includes(row.EXAMGROUP)) {
        throw Object.assign(
          new Error(`${EDUCATION_LEVELS[index]}: select a valid Group from the list.`),
          { status: 400 }
        );
      }
      row.SUBJECT_NAME = null;
    } else {
      if (required && !row.SUBJECT_NAME) {
        throw Object.assign(
          new Error(`${EDUCATION_LEVELS[index]}: Subject is required.`),
          { status: 400 }
        );
      }
      row.EXAMGROUP = null;
    }

    normalized.push(row);
  }

  return normalized;
}
