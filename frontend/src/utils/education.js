export const EDUCATION_LEVELS = [
  'SSC / Dakhil / Equivalent',
  'HSC / Alim / Diploma / Equivalent',
  'Fazil / Honours / BA / B.Sc / Degree Pass / Equivalent',
  'Masters / Kamil / MBA / Equivalent'
];

export const EDUCATION_LEVEL_OPTIONS = [
  ['SSC', 'Dakhil'],
  ['HSC', 'Alim', 'Diploma'],
  ['Fazil', 'Honours', 'BA', 'B.Sc', 'Degree Pass'],
  ['Masters', 'Kamil', 'MBA']
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

export const UNIVERSITY_OPTIONS = [
  'University of Dhaka',
  'University of Rajshahi',
  'Bangladesh Agricultural University',
  'Bangladesh University of Engineering and Technology',
  'University of Chittagong',
  'Jahangirnagar University',
  'Islamic University, Bangladesh',
  'Shahjalal University of Science and Technology',
  'Khulna University',
  'National University, Bangladesh',
  'Bangladesh Open University',
  'Bangabandhu Sheikh Mujib Medical University',
  'Bangabandhu Sheikh Mujibur Rahman Agricultural University',
  'Hajee Mohammad Danesh Science and Technology University',
  'Mawlana Bhashani Science and Technology University',
  'Patuakhali Science and Technology University',
  'Sher-e-Bangla Agricultural University',
  'Chittagong University of Engineering and Technology',
  'Rajshahi University of Engineering and Technology',
  'Khulna University of Engineering and Technology',
  'Dhaka University of Engineering and Technology',
  'Noakhali Science and Technology University',
  'Jagannath University',
  'Comilla University',
  'Jatiya Kabi Kazi Nazrul Islam University',
  'Chittagong Veterinary and Animal Sciences University',
  'Sylhet Agricultural University',
  'Jessore University of Science and Technology',
  'Pabna University of Science and Technology',
  'Begum Rokeya University, Rangpur',
  'Bangladesh University of Professionals',
  'University of Barishal',
  'Rangamati Science and Technology University',
  'Rabindra University, Bangladesh',
  'Bangabandhu Sheikh Mujibur Rahman Digital University',
  'Bangabandhu Sheikh Mujibur Rahman Maritime University',
  'Islamic Arabic University',
  'North South University',
  'BRAC University',
  'Independent University, Bangladesh',
  'East West University',
  'American International University-Bangladesh',
  'Ahsanullah University of Science and Technology',
  'United International University',
  'University of Asia Pacific',
  'Daffodil International University',
  'Southeast University',
  'Stamford University Bangladesh',
  'International Islamic University Chittagong',
  'University of Liberal Arts Bangladesh',
  'Green University of Bangladesh',
  'Bangladesh University of Business and Technology',
  'State University of Bangladesh',
  'Primeasia University',
  'Eastern University',
  'Northern University Bangladesh',
  'ASA University Bangladesh',
  'Manarat International University',
  'Asian University of Bangladesh',
  'Gono Bishwabidyalay',
  'Other University'
];

export function blankEducation(level = '') {
  return {
    EXAMNAME: '',
    EXAMGROUP: '',
    BOARD: '',
    CLAS: '',
    PASSYEAR: '',
    REMARKS: '',
    INSTITUTE: '',
    SUBJECT_NAME: ''
  };
}

function normalizedExamName(index, examName) {
  const name = String(examName || '').trim();
  const exact = EDUCATION_LEVEL_OPTIONS[index].find(option => option.toLowerCase() === name.toLowerCase());
  if (exact) return exact;

  const lower = name.toLowerCase();
  if (index === 0) return /dakhil/.test(lower) ? 'Dakhil' : /ssc/.test(lower) ? 'SSC' : '';
  if (index === 1) {
    if (/alim/.test(lower)) return 'Alim';
    if (/diploma/.test(lower)) return 'Diploma';
    return /hsc/.test(lower) ? 'HSC' : '';
  }
  if (index === 2) {
    if (/fazil/.test(lower)) return 'Fazil';
    if (/honou?rs?/.test(lower)) return 'Honours';
    if (/b\.sc|bsc/.test(lower)) return 'B.Sc';
    if (/\bba\b/.test(lower)) return 'BA';
    if (/degree\s*pass/.test(lower)) return 'Degree Pass';
  }
  if (index === 3) {
    if (/kamil/.test(lower)) return 'Kamil';
    if (/\bmba\b/.test(lower)) return 'MBA';
    return /master|\bma\b|m\.sc|msc|m\.com|mcom|mbs|mss/.test(lower) ? 'Masters' : '';
  }
  return '';
}

function levelIndex(examName) {
  const name = String(examName || '').toLowerCase();
  if (/ssc|dakhil/.test(name)) return 0;
  if (/hsc|alim|diploma/.test(name)) return 1;
  if (/fazil|honou?rs?|\bba\b|b\.sc|bsc|degree\s*pass/.test(name)) return 2;
  if (/master|kamil|\bma\b|m\.sc|msc|\bmba\b|m\.com|mcom|mbs|mss/.test(name)) return 3;
  return -1;
}

export function normalizeEducationRows(rows = []) {
  const normalized = EDUCATION_LEVELS.map(blankEducation);
  const unused = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const index = levelIndex(row?.EXAMNAME);
    if (index >= 0 && !normalized[index].BOARD && !normalized[index].PASSYEAR) {
      normalized[index] = { ...blankEducation(), ...row, EXAMNAME: normalizedExamName(index, row.EXAMNAME) };
    } else {
      unused.push(row);
    }
  }

  for (const row of unused) {
    const index = normalized.findIndex(item => !item.BOARD && !item.PASSYEAR && !item.INSTITUTE);
    if (index < 0) break;
    normalized[index] = { ...blankEducation(), ...row, EXAMNAME: normalizedExamName(index, row.EXAMNAME) };
  }

  return normalized;
}
