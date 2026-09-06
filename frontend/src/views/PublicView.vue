<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import DateInput from '../components/DateInput.vue';
import PhoneInput from '../components/PhoneInput.vue';
import NidInput from '../components/NidInput.vue';
import EducationLevels from '../components/EducationLevels.vue';
import ChildInformation from '../components/ChildInformation.vue';
import HeightInput from '../components/HeightInput.vue';
import WeightInput from '../components/WeightInput.vue';
import { formatDateTime } from '../utils/dates';
import { normalizeEducationRows } from '../utils/education';
import { normalizeChildren } from '../utils/children';
import { notifyError, notifySuccess } from '../utils/notifications';
import { t } from '../i18n';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDER_OPTIONS = [{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }];
const RELIGION_OPTIONS = [
  { value: 'I', label: 'Islam' }, { value: 'H', label: 'Hindu' },
  { value: 'B', label: 'Buddha' }, { value: 'C', label: 'Christian' }
];
const MARITAL_STATUS_OPTIONS = [{ value: 'U', label: 'Unmarried' }, { value: 'M', label: 'Married' }];
const FORM_STEPS = [
  { id: 'basic', label: 'Basic Information' },
  { id: 'contact', label: 'Contact & Identity' },
  { id: 'address', label: 'Address Information' },
  { id: 'emergency', label: 'Emergency Contact' },
  { id: 'family', label: 'Family Information' },
  { id: 'guarantor', label: 'Guarantor Information' },
  { id: 'education', label: 'Education' }
];

const REQUIRED_BY_STEP = [
  [
    ['NAME', 'Employee Name'], ['BIRTHDATE', 'Birth Date'], ['BLD_GROUP', 'Blood Group'],
    ['NATIONALITY', 'Nationality'], ['HEIGHT', 'Height'], ['WEIGHT', 'Weight (kg)'],
    ['GENDER', 'Gender'], ['RELIGION', 'Religion'], ['MARITAL_STATUS', 'Marital Status']
  ],
  [['PHONE', 'Primary Phone'], ['NID', 'NID']],
  [
    ['PERMANENT_VILLAGE', 'Permanent Address — Village / House / Road'],
    ['PERMANENT_POST', 'Permanent Address — Post Office'],
    ['PERMANENT_THANA', 'Permanent Address — Thana / Upazila'],
    ['PERMANENT_DISTRICT', 'Permanent Address — District'],
    ['PRESENT_VILLAGE', 'Present Address — Village / House / Road'],
    ['PRESENT_POST', 'Present Address — Post Office'],
    ['PRESENT_THANA', 'Present Address — Thana / Upazila'],
    ['PRESENT_DISTRICT', 'Present Address — District']
  ],
  [
    ['EMGRCNY_PERSON', 'Emergency Person'], ['EMGRCNY_RELATION', 'Emergency Relationship'],
    ['EMGRCNY_PHONE', 'Emergency Phone'], ['EMGRCNY_ADDRESS', 'Emergency Address']
  ],
  [['FATHER_NAME', 'Father Name'], ['MOTHER_NAME', 'Mother Name']],
  [
    ['GRNT_NAME', 'Guarantor Name'], ['GRNT_RELE', 'Guarantor Relationship'],
    ['GRNT_FATHER', 'Guarantor Father'], ['GRNT_PRESENT_ADD', 'Guarantor Present Address'],
    ['GRNT_PERMANET_ADD', 'Guarantor Permanent Address'],
    ['GRNT_NATIONALITY', 'Guarantor Nationality'], ['GRNT_PROFFESSION', 'Guarantor Profession'],
    ['GRNT_NID', 'Guarantor NID'], ['GRNT_MOBILE', 'Guarantor Mobile']
  ],
  []
];

const state = ref({ collectionOpen:false, activeBatch:null });

const credentials = reactive({
  meritlistId: '',
  classId: '',
  phone: ''
});

const newIdentity = reactive({
  meritlistId: '',
  classId: ''
});

const verifiedIdentity = reactive({
  meritlistId: '',
  classId: '',
  phone: ''
});

const mode = ref('');
const message = ref('');
const newEntryError = ref('');
const canRequestUpdate = ref(false);
const requestPending = ref(false);
const busy = ref(false);
const sameAddress = ref(false);
const batchNo = ref('');
const assignedIpi = ref('');
const draftEntryId = ref('');
const currentStep = ref(0);
const highestReachedStep = ref(0);
const lastSavedAt = ref('');
const validationIssues = ref([]);

const employee = reactive({
  NAME:'',BIRTHDATE:'',BLD_GROUP:'',GENDER:'',RELIGION:'',NATIONALITY:'Bangladeshi',
  MARITAL_STATUS:'',EMAIL:'',PHONE:'',PHONE1:'',HEIGHT:'',WEIGHT:'',NID:'',
  PERMANENT_VILLAGE:'',PERMANENT_POST:'',PERMANENT_THANA:'',PERMANENT_DISTRICT:'',
  PRESENT_VILLAGE:'',PRESENT_POST:'',PRESENT_THANA:'',PRESENT_DISTRICT:'',
  EMGRCNY_PERSON:'',EMGRCNY_RELATION:'',EMGRCNY_ADDRESS:'',EMGRCNY_PHONE:'',
  FATHER_NAME:'',FATHER_PHONE:'',MOTHER_NAME:'',MOTHER_PHONE:'',
  SPOUSE_NAME:'',SPOSE_MARRIAGE_DATE:'',SPOSE_OCCUPATION:'',SPOUSE_PHONE:'',
  GRNT_NAME:'',GRNT_RELE:'',GRNT_FATHER:'',GRNT_PRESENT_ADD:'',
  GRNT_PERMANET_ADD:'',GRNT_NATIONALITY:'Bangladeshi',GRNT_PROFFESSION:'',GRNT_NID:'',GRNT_MOBILE:''
});

const education = ref([]);
const children = ref([]);

const editable = computed(() => ['NEW','EDIT'].includes(mode.value));
const activeStep = computed(() => FORM_STEPS[currentStep.value]);
const progressPercent = computed(() => ((currentStep.value + 1) / FORM_STEPS.length) * 100);
const isLastStep = computed(() => currentStep.value === FORM_STEPS.length - 1);
const errorFields = computed(() => new Set(validationIssues.value.map(issue => issue.field)));

const basicFields = [
  ['NAME','Employee Name'],['BIRTHDATE','Birth Date','date'],['BLD_GROUP','Blood Group'],
  ['NATIONALITY','Nationality'],['HEIGHT','Height'],['WEIGHT','Weight (kg)']
];

const contactFields = [
  ['EMAIL','Email','email'],['PHONE','Primary Phone'],['PHONE1','Alternate Phone'],['NID','NID']
];

const emergencyFields = [
  ['EMGRCNY_PERSON','Emergency Person'],['EMGRCNY_RELATION','Relationship'],
  ['EMGRCNY_PHONE','Emergency Phone'],['EMGRCNY_ADDRESS','Emergency Address']
];

const familyFields = [
  ['FATHER_NAME','Father Name'],['FATHER_PHONE','Father Phone'],['MOTHER_NAME','Mother Name'],
  ['MOTHER_PHONE','Mother Phone']
];

const guarantorFields = [
  ['GRNT_NAME','Guarantor Name'],['GRNT_RELE','Relationship'],['GRNT_FATHER','Guarantor Father'],
  ['GRNT_PRESENT_ADD','Present Address'],['GRNT_PERMANET_ADD','Permanent Address'],
  ['GRNT_NATIONALITY','Nationality'],['GRNT_PROFFESSION','Profession'],
  ['GRNT_NID','NID'],['GRNT_MOBILE','Mobile']
];

function resetEmployee() {
  Object.keys(employee).forEach(k => employee[k] = '');
  employee.NATIONALITY = 'Bangladeshi';
  employee.GRNT_NATIONALITY = 'Bangladeshi';
  education.value = normalizeEducationRows();
  children.value = [];
  batchNo.value = '';
  assignedIpi.value = '';
  draftEntryId.value = '';
  sameAddress.value = false;
  currentStep.value = 0;
  highestReachedStep.value = 0;
  lastSavedAt.value = '';
  validationIssues.value = [];
}

function copyPermanent() {
  employee.PRESENT_VILLAGE = employee.PERMANENT_VILLAGE;
  employee.PRESENT_POST = employee.PERMANENT_POST;
  employee.PRESENT_THANA = employee.PERMANENT_THANA;
  employee.PRESENT_DISTRICT = employee.PERMANENT_DISTRICT;
}

function toggleSame() {
  if (sameAddress.value) copyPermanent();
}

function onPermanentInput() {
  if (sameAddress.value) copyPermanent();
}

function onMaritalStatusChange() {
  if (employee.MARITAL_STATUS !== 'M') {
    employee.SPOUSE_NAME = '';
    employee.SPOSE_OCCUPATION = '';
    employee.SPOUSE_PHONE = '';
    employee.SPOSE_MARRIAGE_DATE = '';
    children.value = [];
  }
}

async function revealForm(focusFirstField = false) {
  await nextTick();
  const section = document.querySelector(focusFirstField ? '#basic' : '#identity');
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (focusFirstField) {
    const firstInput = section?.querySelector('input:not(:disabled):not([readonly])');
    firstInput?.focus({ preventScroll: true });
  }
}

async function loadState() {
  const { data } = await api.get('/public/app-state');
  state.value = data;
}

async function lookup() {
  if (!credentials.meritlistId.trim() ||
      !credentials.classId.trim() ||
      !credentials.phone.trim()) {
    message.value = 'Merit List ID, Class ID and Phone Number are required.';
    return;
  }

  busy.value = true;

  try {
    const { data } = await api.post('/public/employee/lookup', {
      meritlistId: credentials.meritlistId.trim(),
      classId: credentials.classId.trim(),
      phone: credentials.phone.trim()
    });

    verifiedIdentity.meritlistId = credentials.meritlistId.trim();
    verifiedIdentity.classId = credentials.classId.trim();
    verifiedIdentity.phone = credentials.phone.replace(/\s+/g, '').trim();

    resetEmployee();

    if (!data.found) {
      mode.value = '';
      message.value = 'No existing employee was found. Use the New Employee section to submit a new entry.';
      return;
    }

    Object.keys(employee).forEach(k => {
      employee[k] = data.employee[k] ?? '';
    });

    batchNo.value = data.batchNo || '';
    assignedIpi.value = data.employee.IPI || '';

    education.value = normalizeEducationRows(data.education);
    children.value = normalizeChildren(data.children);

    mode.value = data.canEdit ? 'EDIT' : 'VIEW';
    canRequestUpdate.value = !!data.canRequestUpdate;
    requestPending.value = !!data.pending;

    if (data.reason === 'DRAFT') {
      message.value = 'This employee entry is saved as a draft. Use the New Employee section to continue editing it.';

    } else if (data.reason === 'PENDING_APPROVAL') {
      message.value = 'Identity verified. Your new employee data is waiting for admin approval.';

    } else if (data.reason === 'REJECTED') {
      message.value = 'Identity verified. This employee entry was not approved. Please contact an administrator.';

    } else if (data.correctionNote) {
      message.value = `Identity verified. Correction required: ${data.correctionNote}` +
        (data.approvedUntil ? ` Update access is available until ${formatDateTime(data.approvedUntil)}.` : '');

    } else if (data.reason === 'TEMP_APPROVAL') {
      message.value =
        `Identity verified. Admin approved temporary update access until ${formatDateTime(data.approvedUntil)}.`;

    } else if (data.canEdit) {
      message.value =
        'Identity verified. Your batch is ACTIVE, so you can update this record.';

    } else if (data.pending) {
      message.value =
        'Identity verified. Update request is pending admin approval.';

    } else {
      message.value =
        'Identity verified. Your batch is INACTIVE, so the record is view-only.';
    }

    await revealForm(false);

  } catch (e) {
    mode.value = '';
    message.value = e.response?.data?.message || e.message;

  } finally {
    busy.value = false;
  }
}

async function startNew() {
  newEntryError.value = '';

  if (!newIdentity.meritlistId.trim() || !newIdentity.classId.trim()) {
    newEntryError.value = 'Merit List ID and Class ID are required for a new employee.';
    return;
  }

  busy.value = true;

  try {
    const { data } = await api.post('/public/employee/new-entry', {
      meritlistId: newIdentity.meritlistId.trim(),
      classId: newIdentity.classId.trim()
    });

    verifiedIdentity.meritlistId = data.identity.meritlistId;
    verifiedIdentity.classId = data.identity.classId;
    verifiedIdentity.phone = '';
    resetEmployee();
    draftEntryId.value = data.empEntryId || data.employee?.EMP_ENTRY_ID || '';

    if (data.resumeDraft) {
      Object.keys(employee).forEach(key => {
        employee[key] = data.employee?.[key] ?? '';
      });
      employee.NATIONALITY ||= 'Bangladeshi';
      employee.GRNT_NATIONALITY ||= 'Bangladeshi';
      education.value = normalizeEducationRows(data.education);
      children.value = normalizeChildren(data.children);
    }

    mode.value = 'NEW';
    batchNo.value = data.activeBatch;
    canRequestUpdate.value = false;
    requestPending.value = false;
    message.value = data.resumeDraft
      ? 'Your saved draft has been loaded. Continue editing and submit it when complete.'
      : 'New employee entry. Save your progress at any stage, then submit the completed form for admin approval.';
    await revealForm(true);
  } catch (e) {
    newEntryError.value = e.response?.data?.message || e.message;
    notifyError(newEntryError.value, 'Employee entry already exists');
  } finally {
    busy.value = false;
  }
}

function hasValue(value) {
  return String(value ?? '').trim().length > 0;
}

function addValidationIssue(issues, step, field, label, message = '') {
  issues.push({
    step,
    field,
    label,
    message: message || `${label} is required.`
  });
}

function collectFinalValidationIssues() {
  const issues = [];

  REQUIRED_BY_STEP.forEach((fields, step) => {
    fields.forEach(([field, label]) => {
      if (!hasValue(employee[field])) addValidationIssue(issues, step, field, label);
    });
  });

  if (employee.MARITAL_STATUS === 'M') {
    if (!hasValue(employee.SPOUSE_NAME)) addValidationIssue(issues, 0, 'SPOUSE_NAME', 'Spouse Name');
    if (!hasValue(employee.SPOUSE_PHONE)) addValidationIssue(issues, 0, 'SPOUSE_PHONE', 'Spouse Phone');
  }

  const phonePattern = /^01[3-9]\d{8}$/;
  const phoneFields = [
    ['PHONE', 'Primary Phone', 1], ['PHONE1', 'Alternate Phone', 1],
    ['EMGRCNY_PHONE', 'Emergency Phone', 3], ['FATHER_PHONE', 'Father Phone', 4],
    ['MOTHER_PHONE', 'Mother Phone', 4], ['SPOUSE_PHONE', 'Spouse Phone', 0],
    ['GRNT_MOBILE', 'Guarantor Mobile', 5]
  ];

  phoneFields.forEach(([field, label, step]) => {
    const value = String(employee[field] || '').replace(/\s+/g, '');
    if (value && !phonePattern.test(value) && !issues.some(issue => issue.field === field)) {
      addValidationIssue(issues, step, field, label, `${label} must be an 11-digit Bangladesh mobile number.`);
    }
  });

  [['NID', 'NID', 1], ['GRNT_NID', 'Guarantor NID', 5]].forEach(([field, label, step]) => {
    const value = String(employee[field] || '').trim();
    if (value && ![10, 13, 17].includes(value.length) && !issues.some(issue => issue.field === field)) {
      addValidationIssue(issues, step, field, label, `${label} must be exactly 10, 13, or 17 digits.`);
    }
  });

  for (let index = 0; index < 3; index += 1) {
    const row = education.value[index] || {};
    const fields = [
      ['EXAMNAME', 'Education Level'], ['BOARD', index >= 2 ? 'University' : 'Board'],
      ['CLAS', 'Class / Result'], ['PASSYEAR', 'Pass Year']
    ];
    if (index >= 2) fields.push(['SUBJECT_NAME', 'Subject']);

    fields.forEach(([field, label]) => {
      if (!hasValue(row[field])) {
        addValidationIssue(
          issues,
          6,
          `education-${index}-${field}`,
          `${FORM_STEPS[6].label} ${index + 1}: ${label}`
        );
      }
    });
  }

  return issues;
}

async function focusIssue(issue) {
  currentStep.value = issue.step;
  highestReachedStep.value = Math.max(highestReachedStep.value, issue.step);
  await nextTick();
  const target = document.querySelector(`[data-field="${issue.field}"]`)
    || document.getElementById(FORM_STEPS[issue.step].id);
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const input = target?.matches?.('input, select, textarea')
    ? target
    : target?.querySelector?.('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
  input?.focus({ preventScroll: true });
}

function openStep(index) {
  if (mode.value !== 'VIEW' && index > highestReachedStep.value) return;
  currentStep.value = index;
  validationIssues.value = [];
  nextTick(() => document.getElementById(FORM_STEPS[index].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function previousStep() {
  if (currentStep.value > 0) openStep(currentStep.value - 1);
}

async function nextStep() {
  if (isLastStep.value) return;

  if (editable.value) {
    const saved = await save(false, { quiet: true });
    if (!saved) return;
  }

  const next = currentStep.value + 1;
  highestReachedStep.value = Math.max(highestReachedStep.value, next);
  currentStep.value = next;
  validationIssues.value = [];
  await nextTick();
  document.getElementById(activeStep.value.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitFinal() {
  validationIssues.value = collectFinalValidationIssues();

  if (validationIssues.value.length) {
    message.value = `Please complete ${validationIssues.value.length} required field${validationIssues.value.length === 1 ? '' : 's'} before submitting.`;
    await focusIssue(validationIssues.value[0]);
    notifyError(message.value, 'Form needs attention');
    return;
  }

  await save(true);
}

async function save(submitForApproval = true, { quiet = false } = {}) {
  busy.value = true;

  try {
    const isNewEntry = mode.value === 'NEW';
    const { data } = await api.post('/public/employee/save', {
      identity: verifiedIdentity,
      employee,
      education: education.value,
      children: children.value,
      newEntry: isNewEntry,
      draftEntryId: isNewEntry ? draftEntryId.value : null,
      submitForApproval
    });

    message.value = data.message || 'Employee information saved successfully.';
    if (!quiet) {
      notifySuccess(
        message.value,
        isNewEntry && !data.submitted ? 'Draft saved' : isNewEntry ? 'Employee submitted' : 'Employee updated'
      );
    }
    if (isNewEntry && data.submitted) {
      mode.value = 'VIEW';
      canRequestUpdate.value = false;
      requestPending.value = false;
    } else if (!submitForApproval) {
      draftEntryId.value = data.empEntryId || draftEntryId.value;
      lastSavedAt.value = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date());
    }

    return true;

  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Employee could not be saved');
    return false;

  } finally {
    busy.value = false;
  }
}

async function requestUpdate() {
  const note = window.prompt(
    'Why do you need to update your information?'
  ) ?? '';

  busy.value = true;

  try {
    const { data } = await api.post(
      '/public/employee/update-request',
      {
        ...verifiedIdentity,
        note
      }
    );

    message.value = data.message;
    notifySuccess(message.value, 'Request submitted');
    await lookup();

  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Request could not be submitted');

  } finally {
    busy.value = false;
  }
}

function startOver() {
  mode.value = '';
  message.value = '';
  newEntryError.value = '';
  canRequestUpdate.value = false;
  requestPending.value = false;
  credentials.meritlistId = '';
  credentials.classId = '';
  credentials.phone = '';
  newIdentity.meritlistId = '';
  newIdentity.classId = '';
  verifiedIdentity.meritlistId = '';
  verifiedIdentity.classId = '';
  verifiedIdentity.phone = '';
  resetEmployee();
}

onMounted(async () => {
  education.value = normalizeEducationRows();
  children.value = [];
  await loadState();
});
</script>

<template>
  <main class="page">
    <section class="hero">
      <div>
        <span class="badge">{{ t('HR DATA COLLECTION') }}</span>
        <h1>{{ t('Employee Information Portal') }}</h1>
        <p>Existing employees verify their details. New employees can submit a new entry.</p>
      </div>

      <div class="status">
        <b>{{ t(state.collectionOpen ? 'ACTIVE' : 'INACTIVE') }}</b>
        <span v-if="state.activeBatch">{{ t('Batch') }}: {{ state.activeBatch }}</span>
      </div>
    </section>

    <div v-if="!mode" class="entry-options">
      <section class="card entry-card new-entry primary-entry">
        <span class="entry-type">{{ t('New Employee') }}</span>
        <h2>{{ t('Create a first-time entry') }}</h2>
        <p class="muted">
          Enter Merit List ID and Class ID. We will check for an existing entry before opening the form.
        </p>

        <div class="grid">
          <div class="field">
            <label>{{ t('Merit List ID') }}<span class="required-mark"> *</span></label>
            <input v-model="newIdentity.meritlistId" autocomplete="off" :placeholder="t('Enter Merit List ID')" />
          </div>

          <div class="field">
            <label>{{ t('Class ID') }}<span class="required-mark"> *</span></label>
            <input v-model="newIdentity.classId" autocomplete="off" :placeholder="t('Enter Class ID')" @keyup.enter="startNew" />
          </div>
        </div>

        <div v-if="newEntryError" class="entry-inline-error" role="alert">
          <strong>{{ t('Entry cannot be started') }}</strong>
          <span>{{ newEntryError }}</span>
        </div>

        <div class="lookup-actions">
          <button class="primary" :disabled="busy" :aria-busy="busy" @click="startNew">
            {{ t(busy ? 'Checking…' : 'Check & Start New Entry') }}
          </button>
        </div>
      </section>

      <section class="card entry-card existing-entry">
        <span class="entry-type">{{ t('Existing Employee Verification') }}</span>
        <h2>{{ t('Find and update your information') }}</h2>
        <p class="muted">
          For an existing record, all three values must match exactly.
        </p>

        <div class="grid">
          <div class="field">
            <label>{{ t('Merit List ID') }}<span class="required-mark"> *</span></label>
            <input
              v-model="credentials.meritlistId"
              autocomplete="off"
              :placeholder="t('Enter Merit List ID')"
            />
          </div>

          <div class="field">
            <label>{{ t('Class ID') }}<span class="required-mark"> *</span></label>
            <input
              v-model="credentials.classId"
              autocomplete="off"
              :placeholder="t('Enter Class ID')"
            />
          </div>

          <div class="field">
            <label>{{ t('Phone Number') }}<span class="required-mark"> *</span></label>
            <PhoneInput
              v-model="credentials.phone"
              autocomplete="tel"
              :placeholder="t('Enter primary phone')"
              @enter="lookup"
            />
          </div>
        </div>

        <div class="lookup-actions">
          <button :disabled="busy" :aria-busy="busy" @click="lookup">
            {{ t(busy ? 'Checking…' : 'Verify Existing Employee') }}
          </button>
        </div>
      </section>
    </div>

    <section v-else class="session-strip">
      <div>
        <strong>{{ t('Employee form in progress') }}</strong>
        <span>{{ verifiedIdentity.meritlistId }} · {{ verifiedIdentity.classId }} · {{ t('Batch') }} {{ batchNo }}</span>
      </div>
      <button type="button" @click="startOver">{{ t('Use Another Employee') }}</button>
    </section>

    <div v-if="message" class="notice" role="status" aria-live="polite">{{ message }}</div>

    <form v-if="mode" class="form wizard-form" novalidate @submit.prevent="submitFinal">
      <section class="card identity-summary">
        <div class="section-title">
          <h2>{{ t('Employee Identity') }}</h2>
          <span>{{ t('Batch') }}: {{ batchNo }}</span>
        </div>

        <div class="grid">
          <div class="field">
            <label>{{ t('Merit List ID') }}</label>
            <input :value="verifiedIdentity.meritlistId" readonly />
          </div>

          <div class="field">
            <label>{{ t('Class ID') }}</label>
            <input :value="verifiedIdentity.classId" readonly />
          </div>

          <div class="field">
            <label>{{ t('IPI') }}</label>
            <input
              :value="assignedIpi || 'Not assigned by admin yet'"
              readonly
            />
          </div>
        </div>
      </section>

      <nav class="wizard-progress" :aria-label="t('Form sections')">
        <div class="wizard-progress-track" aria-hidden="true">
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>
        <button
          v-for="(step, index) in FORM_STEPS"
          :key="step.id"
          type="button"
          class="wizard-step"
          :class="{ active: index === currentStep, complete: index !== currentStep && (index < currentStep || index < highestReachedStep) }"
          :disabled="mode !== 'VIEW' && index > highestReachedStep"
          :aria-current="index === currentStep ? 'step' : undefined"
          @click="openStep(index)"
        >
          <span>{{ index < currentStep || index < highestReachedStep ? '✓' : index + 1 }}</span>
          <b>{{ t(step.label) }}</b>
        </button>
      </nav>

      <div class="wizard-heading">
        <div>
          <span>{{ t('Step') }} {{ currentStep + 1 }} {{ t('of') }} {{ FORM_STEPS.length }}</span>
          <strong>{{ t(activeStep.label) }}</strong>
        </div>
        <p v-if="editable">{{ t('Your progress is saved when you select Save & Next.') }}</p>
      </div>

      <section v-if="validationIssues.length" class="validation-summary" role="alert">
        <div>
          <strong>{{ t('Complete the required information') }}</strong>
          <span>{{ validationIssues.length }} {{ t('items need attention before final submission.') }}</span>
        </div>
        <ul>
          <li v-for="issue in validationIssues" :key="issue.field">
            <button type="button" @click="focusIssue(issue)">{{ t(issue.message) }}</button>
          </li>
        </ul>
      </section>

      <section v-show="currentStep === 0" id="basic" class="card wizard-panel">
        <div class="section-title">
          <h2 data-step="01">{{ t('Basic Information') }}</h2>
        </div>

        <div class="grid">
          <div
            v-for="[key,label,type] in basicFields"
            :key="key"
            class="field"
            :class="{ 'has-error': errorFields.has(key) }"
            :data-field="key"
          >
            <label>{{ t(label) }}<span v-if="['NAME', 'BIRTHDATE', 'BLD_GROUP', 'NATIONALITY', 'HEIGHT', 'WEIGHT'].includes(key)" class="required-mark"> *</span></label>
            <select v-if="key === 'BLD_GROUP'" v-model="employee[key]" :disabled="!editable"><option value="">{{ t('Select') }}</option><option v-for="group in BLOOD_GROUPS" :key="group" :value="group">{{ group }}</option></select>
            <DateInput v-else-if="type === 'date'" v-model="employee[key]" :disabled="!editable" />
            <HeightInput v-else-if="key === 'HEIGHT'" v-model="employee.HEIGHT" :disabled="!editable" />
            <WeightInput v-else-if="key === 'WEIGHT'" v-model="employee.WEIGHT" :disabled="!editable" />
            <input v-else v-model="employee[key]" :type="type || 'text'" :disabled="!editable" :required="key === 'NAME'" :autocomplete="key === 'NAME' ? 'name' : 'off'" />
            <small v-if="['NAME', 'BIRTHDATE'].includes(key)" class="field-hint">{{ t('As per SSC/Dakhil certificate') }}</small>
          </div>

          <div class="field" :class="{ 'has-error': errorFields.has('GENDER') }" data-field="GENDER">
            <label>{{ t('Gender') }}<span class="required-mark"> *</span></label>
            <select v-model="employee.GENDER" :disabled="!editable"><option value="">{{ t('Select') }}</option><option v-for="option in GENDER_OPTIONS" :key="option.value" :value="option.value">{{ t(option.label) }}</option></select>
          </div>

          <div class="field" :class="{ 'has-error': errorFields.has('RELIGION') }" data-field="RELIGION">
            <label>{{ t('Religion') }}<span class="required-mark"> *</span></label>
            <select v-model="employee.RELIGION" :disabled="!editable"><option value="">{{ t('Select') }}</option><option v-for="option in RELIGION_OPTIONS" :key="option.value" :value="option.value">{{ t(option.label) }}</option></select>
          </div>

          <div class="field" :class="{ 'has-error': errorFields.has('MARITAL_STATUS') }" data-field="MARITAL_STATUS">
            <label>{{ t('Marital Status') }}<span class="required-mark"> *</span></label>
            <select v-model="employee.MARITAL_STATUS" :disabled="!editable" @change="onMaritalStatusChange"><option value="">{{ t('Select') }}</option><option v-for="option in MARITAL_STATUS_OPTIONS" :key="option.value" :value="option.value">{{ t(option.label) }}</option></select>
          </div>

          <template v-if="employee.MARITAL_STATUS === 'M'">
            <div class="field" :class="{ 'has-error': errorFields.has('SPOUSE_NAME') }" data-field="SPOUSE_NAME"><label>{{ t('Spouse Name') }}<span class="required-mark"> *</span></label><input v-model="employee.SPOUSE_NAME" :disabled="!editable" /></div>
            <div class="field"><label>{{ t('Spouse Occupation') }}</label><input v-model="employee.SPOSE_OCCUPATION" :disabled="!editable" /></div>
            <div class="field" :class="{ 'has-error': errorFields.has('SPOUSE_PHONE') }" data-field="SPOUSE_PHONE"><label>{{ t('Spouse Phone') }}<span class="required-mark"> *</span></label><PhoneInput v-model="employee.SPOUSE_PHONE" :disabled="!editable" /></div>
            <div class="field"><label>{{ t('Marriage Date') }}</label><DateInput v-model="employee.SPOSE_MARRIAGE_DATE" :disabled="!editable" /></div>
          </template>
        </div>
      </section>

      <section v-show="currentStep === 1" id="contact" class="card wizard-panel">
        <h2 data-step="02">{{ t('Contact & Identity') }}</h2>

        <div class="grid">
          <div
            v-for="[key,label,type] in contactFields"
            :key="key"
            class="field"
            :class="{ 'has-error': errorFields.has(key) }"
            :data-field="key"
          >
            <label>
              {{ t(label) }}<span v-if="key === 'PHONE' || key === 'NID'" class="required-mark"> *</span>
              <small v-if="key === 'PHONE1'" class="optional-mark">{{ t('Optional') }}</small>
            </label>
            <PhoneInput
              v-if="key.includes('PHONE')"
              v-model="employee[key]"
              :disabled="!editable || (key === 'PHONE' && mode !== 'NEW')"
              :required="key === 'PHONE'"
              :autocomplete="key === 'PHONE' ? 'tel' : 'off'"
            />
            <NidInput v-else-if="key === 'NID'" v-model="employee[key]" :disabled="!editable" />
            <input v-else v-model="employee[key]" :type="type || 'text'" :autocomplete="key === 'EMAIL' ? 'email' : 'off'" :disabled="!editable" />
          </div>
        </div>

        <p class="muted" v-if="mode === 'NEW'">
          Enter a primary phone number. This will be required for future employee verification.
        </p>
        <p class="muted" v-else>
          Primary phone is part of employee verification and cannot be changed from this public session.
        </p>
      </section>

      <section v-show="currentStep === 2" id="address" class="card wizard-panel">
        <h2 data-step="03">{{ t('Address Information') }}</h2>

        <div class="address-grid">
          <div class="address-box">
            <h3>{{ t('Permanent Address') }}</h3>

            <label>{{ t('Village / House / Road') }}<span class="required-mark"> *</span></label>
            <input
              v-model="employee.PERMANENT_VILLAGE"
              data-field="PERMANENT_VILLAGE"
              :class="{ 'field-error': errorFields.has('PERMANENT_VILLAGE') }"
              :disabled="!editable"
              @input="onPermanentInput"
            />

            <label>{{ t('Post Office') }}<span class="required-mark"> *</span></label>
            <input
              v-model="employee.PERMANENT_POST"
              data-field="PERMANENT_POST"
              :class="{ 'field-error': errorFields.has('PERMANENT_POST') }"
              :disabled="!editable"
              @input="onPermanentInput"
            />

            <label>{{ t('Thana / Upazila') }}<span class="required-mark"> *</span></label>
            <input
              v-model="employee.PERMANENT_THANA"
              data-field="PERMANENT_THANA"
              :class="{ 'field-error': errorFields.has('PERMANENT_THANA') }"
              :disabled="!editable"
              @input="onPermanentInput"
            />

            <label>{{ t('District') }}<span class="required-mark"> *</span></label>
            <input
              v-model="employee.PERMANENT_DISTRICT"
              data-field="PERMANENT_DISTRICT"
              :class="{ 'field-error': errorFields.has('PERMANENT_DISTRICT') }"
              :disabled="!editable"
              @input="onPermanentInput"
            />
          </div>

          <div class="address-box">
            <h3>{{ t('Present Address') }}</h3>

            <label>{{ t('Village / House / Road') }}<span class="required-mark"> *</span></label>
            <input
              v-model="employee.PRESENT_VILLAGE"
              data-field="PRESENT_VILLAGE"
              :class="{ 'field-error': errorFields.has('PRESENT_VILLAGE') }"
              :disabled="!editable || sameAddress"
            />

            <label>{{ t('Post Office') }}<span class="required-mark"> *</span></label>
            <input
              v-model="employee.PRESENT_POST"
              data-field="PRESENT_POST"
              :class="{ 'field-error': errorFields.has('PRESENT_POST') }"
              :disabled="!editable || sameAddress"
            />

            <label>{{ t('Thana / Upazila') }}<span class="required-mark"> *</span></label>
            <input
              v-model="employee.PRESENT_THANA"
              data-field="PRESENT_THANA"
              :class="{ 'field-error': errorFields.has('PRESENT_THANA') }"
              :disabled="!editable || sameAddress"
            />

            <label>{{ t('District') }}<span class="required-mark"> *</span></label>
            <input
              v-model="employee.PRESENT_DISTRICT"
              data-field="PRESENT_DISTRICT"
              :class="{ 'field-error': errorFields.has('PRESENT_DISTRICT') }"
              :disabled="!editable || sameAddress"
            />
          </div>
        </div>

        <div class="copybar" v-if="editable">
          <label class="check">
            <input
              type="checkbox"
              v-model="sameAddress"
              @change="toggleSame"
            />
            {{ t('Same as Permanent Address') }}
          </label>

          <button type="button" @click="copyPermanent">
            {{ t('Copy Permanent → Present') }}
          </button>
        </div>
      </section>

      <section v-show="currentStep === 3" id="emergency" class="card wizard-panel">
        <h2 data-step="04">{{ t('Emergency Contact') }}</h2>

        <div class="grid">
          <div
            v-for="[key,label] in emergencyFields"
            :key="key"
            class="field"
            :class="{ 'has-error': errorFields.has(key) }"
            :data-field="key"
          >
            <label>{{ t(label) }}<span class="required-mark"> *</span></label>
            <PhoneInput v-if="key.includes('PHONE')" v-model="employee[key]" :disabled="!editable" />
            <input v-else v-model="employee[key]" :disabled="!editable" />
          </div>
        </div>
      </section>

      <section v-show="currentStep === 4" id="family" class="card wizard-panel">
        <h2 data-step="05">{{ t('Family Information') }}</h2>

        <div class="grid">
          <div
            v-for="[key,label,type] in familyFields"
            :key="key"
            class="field"
            :class="{ 'has-error': errorFields.has(key) }"
            :data-field="key"
          >
            <label>
              {{ t(label) }}<span v-if="!key.includes('PHONE')" class="required-mark"> *</span>
              <small v-if="key.includes('PHONE')" class="optional-mark">{{ t('Optional') }}</small>
            </label>
            <PhoneInput
              v-if="key.includes('PHONE')"
              v-model="employee[key]"
              :disabled="!editable"
              :required="false"
            />
            <DateInput v-else-if="type === 'date'" v-model="employee[key]" :disabled="!editable" />
            <input v-else v-model="employee[key]" :disabled="!editable" />
            <small v-if="key === 'FATHER_NAME'" class="field-hint">{{ t('As per SSC/Dakhil certificate') }}</small>
          </div>
        </div>

        <ChildInformation
          v-if="employee.MARITAL_STATUS === 'M'"
          v-model="children"
          :disabled="!editable"
        />
      </section>

      <section v-show="currentStep === 5" id="guarantor" class="card wizard-panel">
        <h2 data-step="06">{{ t('Guarantor Information') }}</h2>

        <div class="grid">
          <div
            v-for="[key,label] in guarantorFields"
            :key="key"
            class="field"
            :class="{ 'has-error': errorFields.has(key) }"
            :data-field="key"
          >
            <label>{{ t(label) }}<span class="required-mark"> *</span></label>
            <PhoneInput v-if="key === 'GRNT_MOBILE'" v-model="employee[key]" :disabled="!editable" />
            <NidInput v-else-if="key === 'GRNT_NID'" v-model="employee[key]" :disabled="!editable" />
            <input v-else v-model="employee[key]" :disabled="!editable" />
          </div>
        </div>
      </section>

      <section v-show="currentStep === 6" id="education" class="card wizard-panel">
        <div class="section-title"><h2 data-step="07">{{ t('Education') }}</h2></div>
        <p class="muted">{{ t('Levels 1–3 are required. Level 4 is optional.') }}</p>
        <EducationLevels v-model="education" :disabled="!editable" />
      </section>

      <section class="sticky-actions wizard-actions">
        <div class="save-status" role="status" aria-live="polite">
          <span v-if="busy" class="saving-dot"></span>
          <span v-else-if="lastSavedAt" class="saved-check">✓</span>
          <span v-if="busy">{{ t('Saving your progress…') }}</span>
          <span v-else-if="lastSavedAt">{{ t('Progress saved') }} · {{ lastSavedAt }}</span>
          <span v-else-if="editable">{{ t('Progress saves when you continue') }}</span>
        </div>

        <button
          v-if="canRequestUpdate"
          type="button"
          @click="requestUpdate"
        >
          {{ t('Request Update Access') }}
        </button>

        <button
          v-if="requestPending"
          type="button"
          disabled
        >
          {{ t('Request Pending') }}
        </button>

        <button v-if="currentStep > 0" type="button" :disabled="busy" @click="previousStep">
          <span aria-hidden="true">←</span> {{ t('Previous') }}
        </button>

        <button
          v-if="editable && !isLastStep"
          class="primary"
          :disabled="busy"
          :aria-busy="busy"
          type="button"
          @click="nextStep"
        >
          {{ t(busy ? 'Saving…' : 'Save & Next') }} <span aria-hidden="true">→</span>
        </button>

        <button
          v-else-if="editable"
          class="primary submit-final"
          :disabled="busy"
          :aria-busy="busy"
          type="submit"
        >
          {{ t(busy ? 'Submitting…' : mode === 'NEW' ? 'Check & Submit' : 'Check & Update') }}
        </button>

        <button v-else-if="!isLastStep" class="primary" type="button" @click="nextStep">
          {{ t('Next') }} <span aria-hidden="true">→</span>
        </button>
      </section>
    </form>

    <footer>
      <router-link to="/admin">{{ t('Admin') }}</router-link>
    </footer>
  </main>
</template>
