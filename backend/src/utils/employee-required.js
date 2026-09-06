export const REQUIRED_EMPLOYEE_FIELDS = [
  ['NAME', 'Employee name'],
  ['BIRTHDATE', 'Birth date'],
  ['BLD_GROUP', 'Blood group'],
  ['GENDER', 'Gender'],
  ['RELIGION', 'Religion'],
  ['NATIONALITY', 'Nationality'],
  ['MARITAL_STATUS', 'Marital status'],
  ['HEIGHT', 'Height'],
  ['WEIGHT', 'Weight'],
  ['NID', 'NID'],
  ['PERMANENT_VILLAGE', 'Permanent address: Village / House / Road'],
  ['PERMANENT_POST', 'Permanent address: Post Office'],
  ['PERMANENT_THANA', 'Permanent address: Thana / Upazila'],
  ['PERMANENT_DISTRICT', 'Permanent address: District'],
  ['PRESENT_VILLAGE', 'Present address: Village / House / Road'],
  ['PRESENT_POST', 'Present address: Post Office'],
  ['PRESENT_THANA', 'Present address: Thana / Upazila'],
  ['PRESENT_DISTRICT', 'Present address: District'],
  ['EMGRCNY_PERSON', 'Emergency person'],
  ['EMGRCNY_RELATION', 'Emergency relationship'],
  ['EMGRCNY_ADDRESS', 'Emergency address'],
  ['EMGRCNY_PHONE', 'Emergency phone'],
  ['FATHER_NAME', 'Father name'],
  ['MOTHER_NAME', 'Mother name'],
  ['GRNT_NAME', 'Guarantor name'],
  ['GRNT_RELE', 'Guarantor relationship'],
  ['GRNT_FATHER', 'Guarantor father'],
  ['GRNT_PRESENT_ADD', 'Guarantor present address'],
  ['GRNT_PERMANET_ADD', 'Guarantor permanent address'],
  ['GRNT_NATIONALITY', 'Guarantor nationality'],
  ['GRNT_PROFFESSION', 'Guarantor profession'],
  ['GRNT_NID', 'Guarantor NID'],
  ['GRNT_MOBILE', 'Guarantor mobile']
];

export function validateRequiredEmployeeFields(employee) {
  for (const [field, label] of REQUIRED_EMPLOYEE_FIELDS) {
    if (!employee[field]) {
      throw Object.assign(new Error(`${label} is required.`), { status: 400 });
    }
  }
}
