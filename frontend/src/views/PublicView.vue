<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import DateInput from '../components/DateInput.vue';
import PhoneInput from '../components/PhoneInput.vue';
import NidInput from '../components/NidInput.vue';
import EducationLevels from '../components/EducationLevels.vue';
import HeightInput from '../components/HeightInput.vue';
import WeightInput from '../components/WeightInput.vue';
import { formatDateTime } from '../utils/dates';
import { normalizeEducationRows } from '../utils/education';
import { notifyError, notifySuccess } from '../utils/notifications';
import { t } from '../i18n';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDER_OPTIONS = [{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }];
const RELIGION_OPTIONS = [
  { value: 'I', label: 'Islam' }, { value: 'H', label: 'Hindu' },
  { value: 'B', label: 'Buddha' }, { value: 'C', label: 'Christian' }
];
const MARITAL_STATUS_OPTIONS = [{ value: 'U', label: 'Unmarried' }, { value: 'M', label: 'Married' }];

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
const canRequestUpdate = ref(false);
const requestPending = ref(false);
const busy = ref(false);
const sameAddress = ref(false);
const batchNo = ref('');
const assignedIpi = ref('');

const employee = reactive({
  NAME:'',BIRTHDATE:'',BLD_GROUP:'',GENDER:'',RELIGION:'',NATIONALITY:'',
  MARITAL_STATUS:'',EMAIL:'',PHONE:'',PHONE1:'',HEIGHT:'',WEIGHT:'',NID:'',
  PERMANENT_VILLAGE:'',PERMANENT_POST:'',PERMANENT_THANA:'',PERMANENT_DISTRICT:'',
  PRESENT_VILLAGE:'',PRESENT_POST:'',PRESENT_THANA:'',PRESENT_DISTRICT:'',
  EMGRCNY_PERSON:'',EMGRCNY_RELATION:'',EMGRCNY_ADDRESS:'',EMGRCNY_PHONE:'',
  FATHER_NAME:'',FATHER_PHONE:'',MOTHER_NAME:'',MOTHER_PHONE:'',
  SPOUSE_NAME:'',SPOSE_MARRIAGE_DATE:'',SPOSE_OCCUPATION:'',SPOUSE_PHONE:'',
  GRNT_NAME:'',GRNT_RELE:'',GRNT_FATHER:'',GRNT_PRESENT_ADD:'',
  GRNT_PERMANET_ADD:'',GRNT_NATIONALITY:'',GRNT_PROFFESSION:'',GRNT_NID:'',GRNT_MOBILE:''
});

const education = ref([]);

const editable = computed(() => ['NEW','EDIT'].includes(mode.value));

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
  education.value = normalizeEducationRows();
  batchNo.value = '';
  assignedIpi.value = '';
  sameAddress.value = false;
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
  if (!newIdentity.meritlistId.trim() || !newIdentity.classId.trim()) {
    message.value = 'Merit List ID and Class ID are required for a new employee.';
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

    if (data.resumeDraft) {
      Object.keys(employee).forEach(key => {
        employee[key] = data.employee?.[key] ?? '';
      });
      education.value = normalizeEducationRows(data.education);
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
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Employee entry could not be started');
  } finally {
    busy.value = false;
  }
}

async function save(submitForApproval = true) {
  busy.value = true;

  try {
    const isNewEntry = mode.value === 'NEW';
    const { data } = await api.post('/public/employee/save', {
      identity: verifiedIdentity,
      employee,
      education: education.value,
      newEntry: isNewEntry,
      submitForApproval
    });

    message.value = data.message || 'Employee information saved successfully.';
    notifySuccess(
      message.value,
      isNewEntry && !data.submitted ? 'Draft saved' : isNewEntry ? 'Employee submitted' : 'Employee updated'
    );
    if (isNewEntry && data.submitted) {
      mode.value = 'VIEW';
      canRequestUpdate.value = false;
      requestPending.value = false;
    } else {
      await lookup();
    }

  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Employee could not be saved');

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
      <section class="card entry-card existing-entry">
        <span class="entry-type">{{ t('Existing Employee Verification') }}</span>
        <h2>{{ t('Find and update your information') }}</h2>
        <p class="muted">
          For an existing record, all three values must match exactly.
        </p>

        <div class="grid">
          <div class="field">
            <label>{{ t('Merit List ID') }}</label>
            <input
              v-model="credentials.meritlistId"
              autocomplete="off"
              :placeholder="t('Enter Merit List ID')"
            />
          </div>

          <div class="field">
            <label>{{ t('Class ID') }}</label>
            <input
              v-model="credentials.classId"
              autocomplete="off"
              :placeholder="t('Enter Class ID')"
            />
          </div>

          <div class="field">
            <label>{{ t('Phone Number') }}</label>
            <PhoneInput
              v-model="credentials.phone"
              autocomplete="tel"
              :placeholder="t('Enter primary phone')"
              @enter="lookup"
            />
          </div>
        </div>

        <div class="lookup-actions">
          <button class="primary" :disabled="busy" :aria-busy="busy" @click="lookup">
            {{ t(busy ? 'Checking…' : 'Verify Existing Employee') }}
          </button>
        </div>
      </section>

      <section class="card entry-card new-entry">
        <span class="entry-type">{{ t('New Employee') }}</span>
        <h2>{{ t('Create a first-time entry') }}</h2>
        <p class="muted">
          Enter Merit List ID and Class ID, then complete the guided form. An admin will review the submission.
        </p>

        <div class="grid">
          <div class="field">
            <label>{{ t('Merit List ID') }}</label>
            <input v-model="newIdentity.meritlistId" autocomplete="off" :placeholder="t('Enter Merit List ID')" />
          </div>

          <div class="field">
            <label>{{ t('Class ID') }}</label>
            <input v-model="newIdentity.classId" autocomplete="off" :placeholder="t('Enter Class ID')" @keyup.enter="startNew" />
          </div>
        </div>

        <div class="lookup-actions">
          <button class="primary" :disabled="busy" :aria-busy="busy" @click="startNew">
            {{ t(busy ? 'Starting…' : 'Start New Employee Entry') }}
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

    <form v-if="mode" class="form" @submit.prevent="save(true)">
      <nav class="form-nav" :aria-label="t('Form sections')">
        <a href="#identity">01 {{ t('Employee Identity') }}</a>
        <a href="#basic">02 {{ t('Basic Information') }}</a>
        <a href="#contact">03 {{ t('Contact & Identity') }}</a>
        <a href="#address">04 {{ t('Address Information') }}</a>
        <a href="#emergency">05 {{ t('Emergency Contact') }}</a>
        <a href="#family">06 {{ t('Family Information') }}</a>
        <a href="#guarantor">07 {{ t('Guarantor Information') }}</a>
        <a href="#education">08 {{ t('Education') }}</a>
      </nav>

      <section id="identity" class="card">
        <div class="section-title">
          <h2 data-step="01">{{ t('Employee Identity') }}</h2>
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

      <section id="basic" class="card">
        <div class="section-title">
          <h2 data-step="02">{{ t('Basic Information') }}</h2>
        </div>

        <div class="grid">
          <div
            v-for="[key,label,type] in basicFields"
            :key="key"
            class="field"
          >
            <label>{{ t(label) }}<span v-if="key === 'NAME'" class="required-mark"> *</span></label>
            <select v-if="key === 'BLD_GROUP'" v-model="employee[key]" :disabled="!editable"><option value="">{{ t('Select') }}</option><option v-for="group in BLOOD_GROUPS" :key="group" :value="group">{{ group }}</option></select>
            <DateInput v-else-if="type === 'date'" v-model="employee[key]" :disabled="!editable" />
            <HeightInput v-else-if="key === 'HEIGHT'" v-model="employee.HEIGHT" :disabled="!editable" />
            <WeightInput v-else-if="key === 'WEIGHT'" v-model="employee.WEIGHT" :disabled="!editable" />
            <input v-else v-model="employee[key]" :type="type || 'text'" :disabled="!editable" :required="key === 'NAME'" :autocomplete="key === 'NAME' ? 'name' : 'off'" />
          </div>

          <div class="field">
            <label>{{ t('Gender') }}</label>
            <select v-model="employee.GENDER" :disabled="!editable"><option value="">{{ t('Select') }}</option><option v-for="option in GENDER_OPTIONS" :key="option.value" :value="option.value">{{ t(option.label) }}</option></select>
          </div>

          <div class="field">
            <label>{{ t('Religion') }}</label>
            <select v-model="employee.RELIGION" :disabled="!editable"><option value="">{{ t('Select') }}</option><option v-for="option in RELIGION_OPTIONS" :key="option.value" :value="option.value">{{ t(option.label) }}</option></select>
          </div>

          <div class="field">
            <label>{{ t('Marital Status') }}</label>
            <select v-model="employee.MARITAL_STATUS" :disabled="!editable" @change="onMaritalStatusChange"><option value="">{{ t('Select') }}</option><option v-for="option in MARITAL_STATUS_OPTIONS" :key="option.value" :value="option.value">{{ t(option.label) }}</option></select>
          </div>

          <template v-if="employee.MARITAL_STATUS === 'M'">
            <div class="field"><label>{{ t('Spouse Name') }}<span class="required-mark"> *</span></label><input v-model="employee.SPOUSE_NAME" :disabled="!editable" required /></div>
            <div class="field"><label>{{ t('Spouse Occupation') }}</label><input v-model="employee.SPOSE_OCCUPATION" :disabled="!editable" /></div>
            <div class="field"><label>{{ t('Spouse Phone') }}<span class="required-mark"> *</span></label><PhoneInput v-model="employee.SPOUSE_PHONE" :disabled="!editable" /></div>
            <div class="field"><label>{{ t('Marriage Date') }}</label><DateInput v-model="employee.SPOSE_MARRIAGE_DATE" :disabled="!editable" /></div>
          </template>
        </div>
      </section>

      <section id="contact" class="card">
        <h2 data-step="03">{{ t('Contact & Identity') }}</h2>

        <div class="grid">
          <div
            v-for="[key,label,type] in contactFields"
            :key="key"
            class="field"
          >
            <label>{{ t(label) }}<span v-if="key.includes('PHONE')" class="required-mark"> *</span></label>
            <PhoneInput
              v-if="key.includes('PHONE')"
              v-model="employee[key]"
              :disabled="!editable || (key === 'PHONE' && mode !== 'NEW')"
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

      <section id="address" class="card">
        <h2 data-step="04">{{ t('Address Information') }}</h2>

        <div class="address-grid">
          <div class="address-box">
            <h3>{{ t('Permanent Address') }}</h3>

            <label>{{ t('Village / House / Road') }}</label>
            <input
              v-model="employee.PERMANENT_VILLAGE"
              :disabled="!editable"
              @input="onPermanentInput"
            />

            <label>{{ t('Post Office') }}</label>
            <input
              v-model="employee.PERMANENT_POST"
              :disabled="!editable"
              @input="onPermanentInput"
            />

            <label>{{ t('Thana / Upazila') }}</label>
            <input
              v-model="employee.PERMANENT_THANA"
              :disabled="!editable"
              @input="onPermanentInput"
            />

            <label>{{ t('District') }}</label>
            <input
              v-model="employee.PERMANENT_DISTRICT"
              :disabled="!editable"
              @input="onPermanentInput"
            />
          </div>

          <div class="address-box">
            <h3>{{ t('Present Address') }}</h3>

            <label>{{ t('Village / House / Road') }}</label>
            <input
              v-model="employee.PRESENT_VILLAGE"
              :disabled="!editable || sameAddress"
            />

            <label>{{ t('Post Office') }}</label>
            <input
              v-model="employee.PRESENT_POST"
              :disabled="!editable || sameAddress"
            />

            <label>{{ t('Thana / Upazila') }}</label>
            <input
              v-model="employee.PRESENT_THANA"
              :disabled="!editable || sameAddress"
            />

            <label>{{ t('District') }}</label>
            <input
              v-model="employee.PRESENT_DISTRICT"
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

      <section id="emergency" class="card">
        <h2 data-step="05">{{ t('Emergency Contact') }}</h2>

        <div class="grid">
          <div
            v-for="[key,label] in emergencyFields"
            :key="key"
            class="field"
          >
            <label>{{ t(label) }}<span v-if="key.includes('PHONE')" class="required-mark"> *</span></label>
            <PhoneInput v-if="key.includes('PHONE')" v-model="employee[key]" :disabled="!editable" />
            <input v-else v-model="employee[key]" :disabled="!editable" />
          </div>
        </div>
      </section>

      <section id="family" class="card">
        <h2 data-step="06">{{ t('Family Information') }}</h2>

        <div class="grid">
          <div
            v-for="[key,label,type] in familyFields"
            :key="key"
            class="field"
          >
            <label>{{ t(label) }}<span v-if="key.includes('PHONE')" class="required-mark"> *</span></label>
            <PhoneInput
              v-if="key.includes('PHONE')"
              v-model="employee[key]"
              :disabled="!editable"
            />
            <DateInput v-else-if="type === 'date'" v-model="employee[key]" :disabled="!editable" />
            <input v-else v-model="employee[key]" :disabled="!editable" />
          </div>
        </div>
      </section>

      <section id="guarantor" class="card">
        <h2 data-step="07">{{ t('Guarantor Information') }}</h2>

        <div class="grid">
          <div
            v-for="[key,label] in guarantorFields"
            :key="key"
            class="field"
          >
            <label>{{ t(label) }}<span v-if="key === 'GRNT_MOBILE'" class="required-mark"> *</span></label>
            <PhoneInput v-if="key === 'GRNT_MOBILE'" v-model="employee[key]" :disabled="!editable" />
            <NidInput v-else-if="key === 'GRNT_NID'" v-model="employee[key]" :disabled="!editable" />
            <input v-else v-model="employee[key]" :disabled="!editable" />
          </div>
        </div>
      </section>

      <section id="education" class="card">
        <div class="section-title"><h2 data-step="08">{{ t('Education') }}</h2></div>
        <p class="muted">{{ t('Levels 1–3 are required. Level 4 is optional.') }}</p>
        <EducationLevels v-model="education" :disabled="!editable" />
      </section>

      <section class="sticky-actions">
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

        <button
          v-if="mode === 'NEW'"
          :disabled="busy"
          :aria-busy="busy"
          type="button"
          @click="save(false)"
        >
          {{ t(busy ? 'Saving…' : 'Save Data') }}
        </button>

        <button
          v-if="mode === 'NEW'"
          class="primary"
          :disabled="busy"
          :aria-busy="busy"
          type="submit"
        >
          {{ t(busy ? 'Submitting…' : 'Submit Employee Data') }}
        </button>

        <button
          v-else-if="mode === 'EDIT'"
          class="primary"
          :disabled="busy"
          :aria-busy="busy"
          type="submit"
        >
          {{ t(busy ? 'Saving…' : 'Update Employee') }}
        </button>
      </section>
    </form>

    <footer>
      <router-link to="/admin">{{ t('Admin') }}</router-link>
    </footer>
  </main>
</template>
