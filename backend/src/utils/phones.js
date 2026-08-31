export const PHONE_FIELDS = [
  'PHONE',
  'PHONE1',
  'EMGRCNY_PHONE',
  'FATHER_PHONE',
  'MOTHER_PHONE',
  'GRNT_MOBILE'
];

export const SPOUSE_PHONE_FIELD = 'SPOUSE_PHONE';
export const SPOUSE_FIELDS = [
  'SPOUSE_NAME',
  'SPOSE_OCCUPATION',
  'SPOUSE_PHONE',
  'SPOSE_MARRIAGE_DATE'
];

const PHONE_LABELS = {
  PHONE: 'Primary phone',
  PHONE1: 'Alternate phone',
  EMGRCNY_PHONE: 'Emergency phone',
  FATHER_PHONE: 'Father phone',
  MOTHER_PHONE: 'Mother phone',
  SPOUSE_PHONE: 'Spouse phone',
  GRNT_MOBILE: 'Guarantor mobile'
};

const BANGLADESH_MOBILE_PATTERN = /^01[3-9]\d{8}$/;

export function normalizePhone(value) {
  const phone = String(value || '').replace(/\s+/g, '');

  if (BANGLADESH_MOBILE_PATTERN.test(phone)) return phone;
  if (/^\+8801[3-9]\d{8}$/.test(phone)) return phone.slice(3);
  if (/^8801[3-9]\d{8}$/.test(phone)) return phone.slice(2);
  return phone;
}

export function localPhoneDigits(value) {
  const normalized = normalizePhone(value);
  return BANGLADESH_MOBILE_PATTERN.test(normalized) ? normalized : '';
}

export function normalizeAndValidateEmployeePhones(employee, { required = true } = {}) {
  if (
    (required && employee.MARITAL_STATUS !== 'M') ||
    (!required && employee.MARITAL_STATUS && employee.MARITAL_STATUS !== 'M')
  ) {
    for (const field of SPOUSE_FIELDS) employee[field] = null;
  }

  const submissionFields = employee.MARITAL_STATUS === 'M'
    ? [...PHONE_FIELDS, SPOUSE_PHONE_FIELD]
    : PHONE_FIELDS;

  for (const field of [...PHONE_FIELDS, SPOUSE_PHONE_FIELD]) {
    employee[field] = normalizePhone(employee[field]);

    if (!required) {
      employee[field] ||= null;
      continue;
    }

    if (!submissionFields.includes(field)) continue;

    if (!BANGLADESH_MOBILE_PATTERN.test(employee[field])) {
      throw Object.assign(
        new Error(`${PHONE_LABELS[field]} ${required ? 'is required and ' : ''}must be an 11-digit Bangladesh mobile number starting with 013, 014, 015, 016, 017, 018 or 019.`),
        { status: 400 }
      );
    }
  }
}
