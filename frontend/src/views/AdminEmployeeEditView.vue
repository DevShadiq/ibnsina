<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, setAdminToken } from '../api';
import AutoCompleteSelect from '../components/AutoCompleteSelect.vue';
import DateInput from '../components/DateInput.vue';
import PhoneInput from '../components/PhoneInput.vue';
import NidInput from '../components/NidInput.vue';
import EducationLevels from '../components/EducationLevels.vue';
import HeightInput from '../components/HeightInput.vue';
import WeightInput from '../components/WeightInput.vue';
import { normalizeEducationRows } from '../utils/education';
import { clearNotifications, notifyError, notifySuccess } from '../utils/notifications';
import { t } from '../i18n';

const props = defineProps({ empEntryId: { type: String, required: true } });
const router = useRouter();
const token = localStorage.getItem('admin_token') || '';
const employee = reactive({});
const batches = ref([]);
const education = ref([]);
const batchNo = ref('');
const approvalStatus = ref('PENDING');
const message = ref('');
const loading = ref(true);
const saving = ref(false);
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const approvalOptions = computed(() => [
  ...(employee.APPROVAL_STATUS === 'DRAFT' ? [{ value: 'DRAFT', label: 'Draft' }] : []),
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' }
]);
const batchOptions = computed(() => batches.value.map(batch => ({ value: batch.BATCH_NO, label: `${batch.BATCH_NO} (${batch.STATUS})` })));

if (token) setAdminToken(token);

function clearActionFeedback() {
  message.value = '';
  clearNotifications();
}

function onMaritalStatusChange() {
  if (employee.MARITAL_STATUS !== 'M') {
    employee.SPOUSE_NAME = '';
    employee.SPOSE_OCCUPATION = '';
    employee.SPOUSE_PHONE = '';
    employee.SPOSE_MARRIAGE_DATE = '';
  }
}

async function load() {
  if (!token) {
    router.replace('/admin');
    return;
  }

  loading.value = true;
  try {
    const [employeeResponse, batchResponse] = await Promise.all([
      api.get(`/admin/employees/${props.empEntryId}`),
      api.get('/admin/batches')
    ]);
    Object.assign(employee, employeeResponse.data.employee);
    batchNo.value = employeeResponse.data.employee.batch_no;
    approvalStatus.value = employeeResponse.data.employee.APPROVAL_STATUS;
    batches.value = batchResponse.data;
    education.value = normalizeEducationRows(employeeResponse.data.education);
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Employee details could not be loaded');
  } finally {
    loading.value = false;
  }
}

async function save() {
  clearActionFeedback();
  saving.value = true;
  try {
    const { data } = await api.put(`/admin/employees/${props.empEntryId}`, {
      employee,
      batchNo: batchNo.value,
      approvalStatus: approvalStatus.value,
      education: education.value
    });
    notifySuccess(data.message, 'Employee updated');
    await load();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Employee could not be updated');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="page" @click.capture="clearActionFeedback">
    <section class="hero">
      <div>
        <span class="badge">{{ t('Admin') }}</span>
        <h1>{{ t('Edit Employee') }}</h1>
        <p>Update employee information, education, batch, approval status and IPI.</p>
      </div>
    </section>

    <section class="toolbar">
      <router-link class="button-link" to="/admin">← {{ t('Back to Employee List') }}</router-link>
    </section>

    <section v-if="loading" class="card">Loading employee details…</section>

    <form v-else class="form" novalidate @submit.prevent="save">
      <section class="card">
          <div class="section-title"><div><h2>{{ t('Employee Identity') }}</h2><p class="muted">Administrators can edit identity values, assign IPI, move the employee to another batch, and change approval status.</p></div></div>
        <div class="grid">
          <div class="field"><label>{{ t('Merit List ID') }}</label><input v-model="employee.MERITLIST_ID" required /></div>
          <div class="field"><label>{{ t('Class ID') }}</label><input v-model="employee.CLASS_ID" required /></div>
          <div class="field"><label>{{ t('IPI') }}</label><input v-model="employee.IPI" :placeholder="t('Optional')" /></div>
          <div class="field"><label>{{ t('Batch') }}</label><AutoCompleteSelect v-model="batchNo" :options="batchOptions" required :placeholder="t('Search batch')" /></div>
          <div class="field"><label>{{ t('Approval Status') }}</label><AutoCompleteSelect v-model="approvalStatus" :options="approvalOptions" :disabled="employee.APPROVAL_STATUS === 'DRAFT'" placeholder="Search approval status" /><small v-if="employee.APPROVAL_STATUS === 'DRAFT'" class="status-note">{{ t('Waiting for employee submission') }}</small></div>
        </div>
      </section>

      <section class="card">
        <h2>{{ t('Basic Information') }}</h2>
        <div class="grid">
          <div class="field"><label>{{ t('Employee Name') }}</label><input v-model="employee.NAME" /></div>
          <div class="field"><label>{{ t('Birth Date') }}</label><DateInput v-model="employee.BIRTHDATE" /></div>
          <div class="field"><label>{{ t('Blood Group') }}</label><select v-model="employee.BLD_GROUP"><option value="">Select</option><option v-for="group in bloodGroups" :key="group" :value="group">{{ group }}</option></select></div>
          <div class="field"><label>{{ t('Nationality') }}</label><input v-model="employee.NATIONALITY" /></div>
          <div class="field"><label>{{ t('Height') }}</label><HeightInput v-model="employee.HEIGHT" /></div>
          <div class="field"><label>{{ t('Weight (kg)') }}</label><WeightInput v-model="employee.WEIGHT" /></div>
          <div class="field"><label>{{ t('Gender') }}</label><select v-model="employee.GENDER"><option value="">Select</option><option value="M">{{ t('Male') }}</option><option value="F">{{ t('Female') }}</option></select></div>
          <div class="field"><label>{{ t('Religion') }}</label><select v-model="employee.RELIGION"><option value="">Select</option><option value="I">{{ t('Islam') }}</option><option value="H">{{ t('Hindu') }}</option><option value="B">{{ t('Buddha') }}</option><option value="C">{{ t('Christian') }}</option></select></div>
          <div class="field"><label>{{ t('Marital Status') }}</label><select v-model="employee.MARITAL_STATUS" @change="onMaritalStatusChange"><option value="">Select</option><option value="U">{{ t('Unmarried') }}</option><option value="M">{{ t('Married') }}</option></select></div>
          <template v-if="employee.MARITAL_STATUS === 'M'">
            <div class="field"><label>{{ t('Spouse Name') }}</label><input v-model="employee.SPOUSE_NAME" /></div>
            <div class="field"><label>{{ t('Spouse Occupation') }}</label><input v-model="employee.SPOSE_OCCUPATION" /></div>
            <div class="field"><label>{{ t('Spouse Phone') }}</label><PhoneInput v-model="employee.SPOUSE_PHONE" :required="false" /></div>
            <div class="field"><label>{{ t('Marriage Date') }}</label><DateInput v-model="employee.SPOSE_MARRIAGE_DATE" /></div>
          </template>
        </div>
      </section>

      <section class="card">
        <h2>{{ t('Contact & Identity') }}</h2>
        <div class="grid">
          <div class="field"><label>{{ t('Email') }}</label><input v-model="employee.EMAIL" type="email" /></div>
          <div class="field"><label>{{ t('Primary Phone') }}</label><PhoneInput v-model="employee.PHONE" :required="false" autocomplete="tel" /></div>
          <div class="field"><label>{{ t('Alternate Phone') }}</label><PhoneInput v-model="employee.PHONE1" :required="false" /></div>
          <div class="field"><label>{{ t('NID') }}</label><NidInput v-model="employee.NID" /></div>
        </div>
      </section>

      <section class="card">
        <h2>{{ t('Address Information') }}</h2>
        <div class="address-grid">
          <div class="address-box"><h3>{{ t('Permanent Address') }}</h3><label>{{ t('Village / House / Road') }}</label><input v-model="employee.PERMANENT_VILLAGE" /><label>{{ t('Post Office') }}</label><input v-model="employee.PERMANENT_POST" /><label>{{ t('Thana / Upazila') }}</label><input v-model="employee.PERMANENT_THANA" /><label>{{ t('District') }}</label><input v-model="employee.PERMANENT_DISTRICT" /></div>
          <div class="address-box"><h3>{{ t('Present Address') }}</h3><label>{{ t('Village / House / Road') }}</label><input v-model="employee.PRESENT_VILLAGE" /><label>{{ t('Post Office') }}</label><input v-model="employee.PRESENT_POST" /><label>{{ t('Thana / Upazila') }}</label><input v-model="employee.PRESENT_THANA" /><label>{{ t('District') }}</label><input v-model="employee.PRESENT_DISTRICT" /></div>
        </div>
      </section>

      <section class="card">
        <h2>{{ t('Emergency Contact') }}</h2>
        <div class="grid"><div class="field"><label>{{ t('Emergency Person') }}</label><input v-model="employee.EMGRCNY_PERSON" /></div><div class="field"><label>{{ t('Relationship') }}</label><input v-model="employee.EMGRCNY_RELATION" /></div><div class="field"><label>{{ t('Emergency Phone') }}</label><PhoneInput v-model="employee.EMGRCNY_PHONE" :required="false" /></div><div class="field"><label>{{ t('Emergency Address') }}</label><input v-model="employee.EMGRCNY_ADDRESS" /></div></div>
      </section>

      <section class="card">
        <h2>{{ t('Family Information') }}</h2>
        <div class="grid"><div class="field"><label>{{ t('Father Name') }}</label><input v-model="employee.FATHER_NAME" /></div><div class="field"><label>{{ t('Father Phone') }}</label><PhoneInput v-model="employee.FATHER_PHONE" :required="false" /></div><div class="field"><label>{{ t('Mother Name') }}</label><input v-model="employee.MOTHER_NAME" /></div><div class="field"><label>{{ t('Mother Phone') }}</label><PhoneInput v-model="employee.MOTHER_PHONE" :required="false" /></div></div>
      </section>

      <section class="card">
        <h2>{{ t('Guarantor Information') }}</h2>
        <div class="grid"><div class="field"><label>{{ t('Guarantor Name') }}</label><input v-model="employee.GRNT_NAME" /></div><div class="field"><label>{{ t('Relationship') }}</label><input v-model="employee.GRNT_RELE" /></div><div class="field"><label>{{ t('Guarantor Father') }}</label><input v-model="employee.GRNT_FATHER" /></div><div class="field"><label>{{ t('Present Address') }}</label><input v-model="employee.GRNT_PRESENT_ADD" /></div><div class="field"><label>{{ t('Permanent Address') }}</label><input v-model="employee.GRNT_PERMANET_ADD" /></div><div class="field"><label>{{ t('Nationality') }}</label><input v-model="employee.GRNT_NATIONALITY" /></div><div class="field"><label>{{ t('Profession') }}</label><input v-model="employee.GRNT_PROFFESSION" /></div><div class="field"><label>{{ t('NID') }}</label><NidInput v-model="employee.GRNT_NID" /></div><div class="field"><label>{{ t('Mobile') }}</label><PhoneInput v-model="employee.GRNT_MOBILE" :required="false" /></div></div>
      </section>

      <section class="card">
        <div class="section-title"><h2>{{ t('Education') }}</h2></div>
        <p class="muted">Administrators can save partial education data.</p>
        <EducationLevels v-model="education" :require-complete="false" />
      </section>

      <section class="sticky-actions"><router-link class="button-link" to="/admin">{{ t('Cancel') }}</router-link><button class="primary" type="submit" :disabled="saving">{{ t(saving ? 'Saving…' : 'Save Employee Changes') }}</button></section>
    </form>
  </main>
</template>
