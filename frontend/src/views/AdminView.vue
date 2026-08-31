<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api, setAdminToken } from '../api';
import AutoCompleteSelect from '../components/AutoCompleteSelect.vue';
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
import { clearNotifications, notifyError, notifySuccess } from '../utils/notifications';
import { t } from '../i18n';

const token = ref(localStorage.getItem('admin_token') || '');
const username = ref('');
const password = ref('');
const message = ref('');
const activeSection = ref('employees');
const currentUser = ref(null);
const isSuperAdmin = computed(() => currentUser.value?.userType === 'SUPER_ADMIN');
const users = ref([]);
const batches = ref([]);
const requests = ref([]);
const employees = ref([]);
const correctionModalOpen = ref(false);
const correctionEmployee = ref(null);
const correctionNote = ref('');
const newBatch = ref('');
const batchModalOpen = ref(false);
const batchEditor = reactive({ originalBatchNo: '', batchNo: '', status: 'INACTIVE' });
const employeeBatchFilter = ref('');
const employeeSearch = ref('');
const batchFilterOptions = computed(() => batches.value.map(batch => ({ value: batch.BATCH_NO, label: `${batch.BATCH_NO} (${batch.STATUS})` })));
const newUser = reactive({ username: '', displayName: '', password: '', userType: 'ADMIN' });
const userModalOpen = ref(false);
const editUserModalOpen = ref(false);
const editUser = reactive({ userId: null, username: '', displayName: '', userType: 'ADMIN', activeYn: 'Y' });
const passwordModalOpen = ref(false);
const selectedUser = ref(null);
const replacementPassword = ref('');
const ownPasswordModalOpen = ref(false);
const ownPassword = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const selectedEmployeeId = ref(null);
const editLoading = ref(false);
const editBatch = ref('');
const editApprovalStatus = ref('PENDING');
const editEmployee = reactive({});
const editEducation = ref([]);
const editChildren = ref([]);

const employeeFields = [
  ['NAME', 'Employee Name'], ['BIRTHDATE', 'Birth Date', 'date'], ['BLD_GROUP', 'Blood Group'],
  ['GENDER', 'Gender'], ['RELIGION', 'Religion'], ['NATIONALITY', 'Nationality'],
  ['MARITAL_STATUS', 'Marital Status'], ['EMAIL', 'Email', 'email'], ['PHONE', 'Primary Phone'],
  ['PHONE1', 'Alternate Phone'], ['HEIGHT', 'Height'], ['WEIGHT', 'Weight'], ['NID', 'NID'],
  ['PERMANENT_VILLAGE', 'Permanent Village / House'], ['PERMANENT_POST', 'Permanent Post'],
  ['PERMANENT_THANA', 'Permanent Thana / Upazila'], ['PERMANENT_DISTRICT', 'Permanent District'],
  ['PRESENT_VILLAGE', 'Present Village / House'], ['PRESENT_POST', 'Present Post'],
  ['PRESENT_THANA', 'Present Thana / Upazila'], ['PRESENT_DISTRICT', 'Present District'],
  ['EMGRCNY_PERSON', 'Emergency Person'], ['EMGRCNY_RELATION', 'Emergency Relationship'],
  ['EMGRCNY_PHONE', 'Emergency Phone'], ['EMGRCNY_ADDRESS', 'Emergency Address'],
  ['FATHER_NAME', 'Father Name'], ['FATHER_PHONE', 'Father Phone'], ['MOTHER_NAME', 'Mother Name'],
  ['MOTHER_PHONE', 'Mother Phone'], ['SPOUSE_NAME', 'Spouse Name'],
  ['SPOSE_MARRIAGE_DATE', 'Marriage Date', 'date'], ['SPOSE_OCCUPATION', 'Spouse Occupation'],
  ['SPOUSE_PHONE', 'Spouse Phone'], ['GRNT_NAME', 'Guarantor Name'],
  ['GRNT_RELE', 'Guarantor Relationship'], ['GRNT_FATHER', 'Guarantor Father'],
  ['GRNT_PRESENT_ADD', 'Guarantor Present Address'], ['GRNT_PERMANET_ADD', 'Guarantor Permanent Address'],
  ['GRNT_NATIONALITY', 'Guarantor Nationality'], ['GRNT_PROFFESSION', 'Guarantor Profession'],
  ['GRNT_NID', 'Guarantor NID'], ['GRNT_MOBILE', 'Guarantor Mobile']
];

function onEditMaritalStatusChange() {
  if (editEmployee.MARITAL_STATUS !== 'M') {
    editEmployee.SPOUSE_NAME = '';
    editEmployee.SPOSE_OCCUPATION = '';
    editEmployee.SPOUSE_PHONE = '';
    editEmployee.SPOSE_MARRIAGE_DATE = '';
    editChildren.value = [];
  }
}

if (token.value) setAdminToken(token.value);

function clearActionFeedback() {
  message.value = '';
  clearNotifications();
}

async function login() {
  clearActionFeedback();
  try {
    const { data } = await api.post('/admin/login', { username: username.value, password: password.value });
    token.value = data.token;
    currentUser.value = data.user;
    localStorage.setItem('admin_token', token.value);
    setAdminToken(token.value);
    password.value = '';
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Login failed');
  }
}

async function refresh() {
  if (!token.value) return;
  try {
    const me = await api.get('/admin/me');
    currentUser.value = me.data;
    const requestsToLoad = [
      api.get('/admin/batches'),
      api.get('/admin/update-requests'),
      api.get('/admin/employees', {
        params: {
          ...(employeeBatchFilter.value ? { batchNo: employeeBatchFilter.value } : {}),
          ...(employeeSearch.value.trim() ? { search: employeeSearch.value.trim() } : {})
        }
      })
    ];
    if (isSuperAdmin.value) requestsToLoad.push(api.get('/admin/users'));
    const [b, r, e, u] = await Promise.all(requestsToLoad);
    batches.value = b.data;
    requests.value = r.data;
    employees.value = e.data;
    users.value = u?.data || [];
    if (!isSuperAdmin.value && activeSection.value === 'users') activeSection.value = 'employees';
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, e.response?.status === 401 ? 'Session ended' : 'Data could not be refreshed');
    if (e.response?.status === 401) logout();
  }
}

async function createUser() {
  clearActionFeedback();
  try {
    const { data } = await api.post('/admin/users', newUser);
    message.value = data.message;
    notifySuccess(message.value, 'User created');
    newUser.username = '';
    newUser.displayName = '';
    newUser.password = '';
    newUser.userType = 'ADMIN';
    await refresh();
    userModalOpen.value = false;
    activeSection.value = 'users';
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'User could not be created');
  }
}

function openEditUserModal(user) {
  editUser.userId = user.USER_ID;
  editUser.username = user.USERNAME;
  editUser.displayName = user.DISPLAY_NAME;
  editUser.userType = user.USER_TYPE;
  editUser.activeYn = user.ACTIVE_YN;
  editUserModalOpen.value = true;
}

async function updateUser() {
  clearActionFeedback();
  try {
    const { data } = await api.put(`/admin/users/${editUser.userId}`, {
      username: editUser.username,
      displayName: editUser.displayName,
      userType: editUser.userType,
      activeYn: editUser.activeYn
    });
    notifySuccess(data.message, 'User updated');
    editUserModalOpen.value = false;
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'User could not be updated');
  }
}

async function deleteUser(user) {
  clearActionFeedback();
  if (!window.confirm(`Permanently delete user "${user.USERNAME}"?`)) return;
  try {
    const { data } = await api.delete(`/admin/users/${user.USER_ID}`);
    notifySuccess(data.message, 'User deleted');
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'User could not be deleted');
  }
}

async function updateUserPassword() {
  clearActionFeedback();
  if (!selectedUser.value) return;
  try {
    const { data } = await api.patch(
      `/admin/users/${selectedUser.value.USER_ID}/password`,
      { password: replacementPassword.value }
    );
    message.value = data.message;
    notifySuccess(message.value, 'Password updated');
    replacementPassword.value = '';
    selectedUser.value = null;
    passwordModalOpen.value = false;
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Password could not be updated');
  }
}

async function addBatch() {
  clearActionFeedback();
  try {
    await api.post('/admin/batches', { batchNo: newBatch.value });
    notifySuccess('The new batch was added successfully.', 'Batch created');
    newBatch.value = '';
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Batch could not be created');
  }
}

async function setBatch(batchNo, status) {
  clearActionFeedback();
  try {
    await api.patch(`/admin/batches/${encodeURIComponent(batchNo)}/status`, { status });
    notifySuccess(`Batch ${batchNo} is now ${status.toLowerCase()}.`, 'Batch updated');
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Batch could not be updated');
  }
}

function openOwnPasswordModal() {
  ownPassword.currentPassword = '';
  ownPassword.newPassword = '';
  ownPassword.confirmPassword = '';
  ownPasswordModalOpen.value = true;
}

async function changeOwnPassword() {
  clearActionFeedback();
  if (ownPassword.newPassword !== ownPassword.confirmPassword) {
    message.value = 'New password and confirmation do not match.';
    notifyError(message.value, 'Password could not be changed');
    return;
  }

  try {
    const { data } = await api.patch('/admin/me/password', {
      currentPassword: ownPassword.currentPassword,
      newPassword: ownPassword.newPassword
    });
    notifySuccess(data.message, 'Password changed');
    ownPasswordModalOpen.value = false;
    ownPassword.currentPassword = '';
    ownPassword.newPassword = '';
    ownPassword.confirmPassword = '';
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Password could not be changed');
  }
}

function openBatchModal(batch) {
  batchEditor.originalBatchNo = batch.BATCH_NO;
  batchEditor.batchNo = batch.BATCH_NO;
  batchEditor.status = batch.STATUS;
  batchModalOpen.value = true;
}

async function updateBatch() {
  clearActionFeedback();
  try {
    const { data } = await api.put(
      `/admin/batches/${encodeURIComponent(batchEditor.originalBatchNo)}`,
      { batchNo: batchEditor.batchNo, status: batchEditor.status }
    );
    if (employeeBatchFilter.value === batchEditor.originalBatchNo) {
      employeeBatchFilter.value = batchEditor.batchNo;
    }
    notifySuccess(data.message, 'Batch updated');
    batchModalOpen.value = false;
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Batch could not be updated');
  }
}

async function deleteBatch(batchNo) {
  clearActionFeedback();
  if (!window.confirm(`Permanently delete batch "${batchNo}"? Only empty batches can be deleted.`)) return;
  try {
    const { data } = await api.delete(`/admin/batches/${encodeURIComponent(batchNo)}`);
    notifySuccess(data.message, 'Batch deleted');
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Batch could not be deleted');
  }
}

async function approveEmployee(employee, approvalStatus) {
  clearActionFeedback();
  if (employee.APPROVAL_STATUS === 'DRAFT') {
    const draftMessage = 'This entry is still a draft. The employee must submit the completed form before it can be approved.';
    message.value = draftMessage;
    notifyError(draftMessage, 'Draft cannot be approved');
    return;
  }

  try {
    const { data } = await api.patch(`/admin/employees/${employee.EMP_ENTRY_ID}/approval`, { approvalStatus });
    message.value = data.message;
    notifySuccess(message.value, 'Employee status updated');
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Employee status could not be updated');
  }
}

async function assignIpi(employee) {
  clearActionFeedback();
  const ipi = window.prompt(`Assign IPI\nMerit List ID: ${employee.MERITLIST_ID}\nClass ID: ${employee.CLASS_ID}`, employee.IPI || '');
  if (ipi === null) return;
  try {
    const { data } = await api.patch(`/admin/employees/${employee.EMP_ENTRY_ID}/ipi`, { ipi: ipi.trim() });
    message.value = data.message;
    notifySuccess(message.value, 'IPI assigned');
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'IPI could not be assigned');
  }
}

async function deleteEmployee(employee) {
  clearActionFeedback();
  const label = employee.NAME || `${employee.MERITLIST_ID} / ${employee.CLASS_ID}`;
  if (!window.confirm(`Permanently delete all information for "${label}"? This cannot be undone.`)) return;
  try {
    const { data } = await api.delete(`/admin/employees/${employee.EMP_ENTRY_ID}`);
    notifySuccess(data.message, 'Employee deleted');
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Employee could not be deleted');
  }
}

function openCorrectionModal(employee) {
  correctionEmployee.value = employee;
  correctionNote.value = '';
  correctionModalOpen.value = true;
}

async function grantCorrectionAccess() {
  clearActionFeedback();
  if (!correctionEmployee.value) return;
  try {
    const { data } = await api.post(
      `/admin/employees/${correctionEmployee.value.EMP_ENTRY_ID}/correction-access`,
      { note: correctionNote.value }
    );
    notifySuccess(data.message, 'Correction access granted');
    correctionModalOpen.value = false;
    correctionEmployee.value = null;
    correctionNote.value = '';
    activeSection.value = 'requests';
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Correction access could not be granted');
  }
}

async function openEmployeeEditor(employee) {
  clearActionFeedback();
  editLoading.value = true;
  try {
    const { data } = await api.get(`/admin/employees/${employee.EMP_ENTRY_ID}`);
    Object.keys(editEmployee).forEach(key => delete editEmployee[key]);
    Object.assign(editEmployee, data.employee);
    editBatch.value = data.employee.batch_no;
    editApprovalStatus.value = data.employee.APPROVAL_STATUS;
    editEducation.value = normalizeEducationRows(data.education);
    editChildren.value = normalizeChildren(data.children);
    selectedEmployeeId.value = employee.EMP_ENTRY_ID;
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Employee details could not be loaded');
  } finally {
    editLoading.value = false;
  }
}

async function saveEmployeeDetails() {
  clearActionFeedback();
  if (!selectedEmployeeId.value) return;
  editLoading.value = true;
  try {
    const { data } = await api.put(`/admin/employees/${selectedEmployeeId.value}`, {
      employee: editEmployee,
      batchNo: editBatch.value,
      approvalStatus: editApprovalStatus.value,
      education: editEducation.value,
      children: editChildren.value
    });
    message.value = data.message;
    notifySuccess(message.value, 'Employee updated');
    selectedEmployeeId.value = null;
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Employee could not be updated');
  } finally {
    editLoading.value = false;
  }
}

function closeEmployeeEditor() {
  selectedEmployeeId.value = null;
}

async function decide(id, status) {
  clearActionFeedback();
  const remark = window.prompt('Admin remarks (optional)') || '';
  try {
    await api.patch(`/admin/update-requests/${id}`, { status, remark });
    notifySuccess(`The update request was ${status.toLowerCase()}.`, 'Request updated');
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Request could not be updated');
  }
}

async function exportBatch(batchNo) {
  clearActionFeedback();
  try {
    const response = await api.get(`/admin/export/${encodeURIComponent(batchNo)}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Employee_Data_${batchNo}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Excel export failed');
  }
}

async function deleteUpdateRequest(request) {
  clearActionFeedback();
  const warning = request.STATUS === 'APPROVED'
    ? 'Deleting this approved log immediately removes its temporary correction access. Continue?'
    : 'Delete this update request log?';
  if (!window.confirm(warning)) return;
  try {
    const { data } = await api.delete(`/admin/update-requests/${request.REQUEST_ID}`);
    notifySuccess(data.message, 'Request log deleted');
    await refresh();
  } catch (e) {
    message.value = e.response?.data?.message || e.message;
    notifyError(message.value, 'Request log could not be deleted');
  }
}

function logout() {
  token.value = '';
  currentUser.value = null;
  localStorage.removeItem('admin_token');
  setAdminToken('');
}

function openUserModal() {
  newUser.username = '';
  newUser.displayName = '';
  newUser.password = '';
  newUser.userType = 'ADMIN';
  userModalOpen.value = true;
}

function openPasswordModal(user) {
  selectedUser.value = user;
  replacementPassword.value = '';
  passwordModalOpen.value = true;
}

onMounted(refresh);
</script>

<template>
  <main class="page" @click.capture="clearActionFeedback">
    <section class="hero">
      <div>
        <span class="badge">{{ t('Admin') }}</span>
        <h1>{{ t('Employee Portal Admin') }}</h1>
        <p v-if="token">Manage administrator access, employees and update requests.</p>
      </div>
    </section>

    <section v-if="!token" class="card auth">
      <h2>{{ t('Admin Login') }}</h2>
      <label>{{ t('Username') }}</label><input v-model="username" autocomplete="username" />
      <label>{{ t('Password') }}</label><input v-model="password" type="password" autocomplete="current-password" @keyup.enter="login" />
      <button class="primary" @click="login">{{ t('Login') }}</button>
    </section>

    <template v-else>
      <section class="toolbar">
        <span>{{ currentUser?.displayName || currentUser?.username }} · {{ isSuperAdmin ? t('Super Admin') : t('Admin') }}</span>
        <button @click="openOwnPasswordModal">{{ t('Change My Password') }}</button>
        <button @click="refresh">{{ t('Refresh') }}</button>
        <button @click="logout">{{ t('Logout') }}</button>
      </section>

      <div v-if="ownPasswordModalOpen" class="modal-backdrop" @click.self="ownPasswordModalOpen = false">
        <section class="card modal" role="dialog" aria-modal="true" aria-labelledby="change-own-password-title">
          <div class="section-title"><h2 id="change-own-password-title">{{ t('Change My Password') }}</h2><button type="button" @click="ownPasswordModalOpen = false">{{ t('Close') }}</button></div>
          <p class="muted">Enter your current password and choose a new password with at least 8 characters.</p>
          <label>{{ t('Current Password') }}</label><input v-model="ownPassword.currentPassword" type="password" autocomplete="current-password" />
          <label>{{ t('New Password') }}</label><input v-model="ownPassword.newPassword" type="password" autocomplete="new-password" />
          <label>{{ t('Confirm New Password') }}</label><input v-model="ownPassword.confirmPassword" type="password" autocomplete="new-password" @keyup.enter="changeOwnPassword" />
          <div class="modal-actions"><button type="button" @click="ownPasswordModalOpen = false">{{ t('Cancel') }}</button><button class="primary" @click="changeOwnPassword">{{ t('Change Password') }}</button></div>
        </section>
      </div>

      <nav class="admin-menu" aria-label="Admin menu">
        <button v-if="isSuperAdmin" :class="{ active: activeSection === 'users' }" @click="activeSection = 'users'">{{ t('User List') }}</button>
        <button :class="{ active: activeSection === 'batches' }" @click="activeSection = 'batches'">{{ t('Batch Control') }}</button>
        <button :class="{ active: activeSection === 'employees' }" @click="activeSection = 'employees'">{{ t('Employee List') }}</button>
        <button :class="{ active: activeSection === 'requests' }" @click="activeSection = 'requests'">{{ t('Update Requests') }}</button>
      </nav>

      <section v-if="isSuperAdmin && activeSection === 'users'" class="card">
        <div class="section-title"><div><h2>{{ t('User List') }}</h2><span>{{ users.length }} user(s)</span></div><button class="primary" @click="openUserModal">{{ t('Create User') }}</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>{{ t('Username') }}</th><th>{{ t('Display Name') }}</th><th>{{ t('User Type') }}</th><th>{{ t('Status') }}</th><th>{{ t('Created') }}</th><th>{{ t('Action') }}</th></tr></thead>
          <tbody>
            <tr v-for="user in users" :key="user.USER_ID"><td>{{ user.USERNAME }}</td><td>{{ user.DISPLAY_NAME }}</td><td>{{ t(user.USER_TYPE === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin') }}</td><td>{{ t(user.ACTIVE_YN === 'Y' ? 'Active' : 'Inactive') }}</td><td>{{ formatDateTime(user.CREATED_AT) }}</td><td class="actions-cell"><button @click="openEditUserModal(user)">{{ t('Edit') }}</button><button @click="openPasswordModal(user)">{{ t('Update Password') }}</button><button class="danger" @click="deleteUser(user)">{{ t('Delete') }}</button></td></tr>
            <tr v-if="!users.length"><td colspan="6">No users found.</td></tr>
          </tbody>
        </table></div>
      </section>

      <div v-if="userModalOpen" class="modal-backdrop" @click.self="userModalOpen = false">
        <section class="card modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
          <div class="section-title"><h2 id="create-user-title">{{ t('Create User') }}</h2><button type="button" @click="userModalOpen = false">{{ t('Close') }}</button></div>
          <p class="muted">Usernames can contain letters, numbers, dot, dash and underscore. Passwords need at least 8 characters.</p>
          <label>{{ t('Username') }}</label><input v-model="newUser.username" autocomplete="username" />
          <label>{{ t('Display Name') }}</label><input v-model="newUser.displayName" autocomplete="name" />
          <label>{{ t('User Type') }}</label><select v-model="newUser.userType"><option value="ADMIN">{{ t('Admin') }}</option><option value="SUPER_ADMIN">{{ t('Super Admin') }}</option></select>
          <label>{{ t('Password') }}</label><input v-model="newUser.password" type="password" autocomplete="new-password" @keyup.enter="createUser" />
          <div class="modal-actions"><button type="button" @click="userModalOpen = false">{{ t('Cancel') }}</button><button class="primary" @click="createUser">{{ t('Create User') }}</button></div>
        </section>
      </div>

      <div v-if="editUserModalOpen" class="modal-backdrop" @click.self="editUserModalOpen = false">
        <section class="card modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
          <div class="section-title"><h2 id="edit-user-title">{{ t('Edit User') }}</h2><button type="button" @click="editUserModalOpen = false">{{ t('Close') }}</button></div>
          <label>{{ t('Username') }}</label><input v-model="editUser.username" autocomplete="username" />
          <label>{{ t('Display Name') }}</label><input v-model="editUser.displayName" autocomplete="name" />
          <label>{{ t('User Type') }}</label><select v-model="editUser.userType"><option value="ADMIN">{{ t('Admin') }}</option><option value="SUPER_ADMIN">{{ t('Super Admin') }}</option></select>
          <label>{{ t('Status') }}</label><select v-model="editUser.activeYn"><option value="Y">{{ t('Active') }}</option><option value="N">{{ t('Inactive') }}</option></select>
          <div class="modal-actions"><button type="button" @click="editUserModalOpen = false">{{ t('Cancel') }}</button><button class="primary" @click="updateUser">{{ t('Save Changes') }}</button></div>
        </section>
      </div>

      <div v-if="passwordModalOpen" class="modal-backdrop" @click.self="passwordModalOpen = false">
        <section class="card modal" role="dialog" aria-modal="true" aria-labelledby="update-password-title">
          <div class="section-title"><h2 id="update-password-title">{{ t('Update Password') }}</h2><button type="button" @click="passwordModalOpen = false">{{ t('Close') }}</button></div>
          <p class="muted">Set a new password for <b>{{ selectedUser?.USERNAME }}</b>. It must have at least 8 characters.</p>
          <label>{{ t('New Password') }}</label><input v-model="replacementPassword" type="password" autocomplete="new-password" @keyup.enter="updateUserPassword" />
          <div class="modal-actions"><button type="button" @click="passwordModalOpen = false">{{ t('Cancel') }}</button><button class="primary" @click="updateUserPassword">{{ t('Update Password') }}</button></div>
        </section>
      </div>

      <section v-if="activeSection === 'batches'" class="card">
        <h2>{{ t('Batch Control') }}</h2>
        <p class="muted">Activate a batch to accept new employee entries and let approved employees update their data without an admin request.</p>
        <div class="inline"><input v-model="newBatch" placeholder="BATCH-2026-01" /><button @click="addBatch">{{ t('Create Batch') }}</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>{{ t('Batch') }}</th><th>{{ t('Status') }}</th><th>{{ t('Actions') }}</th></tr></thead>
          <tbody>
            <tr v-for="batch in batches" :key="batch.BATCH_NO"><td>{{ batch.BATCH_NO }}</td><td>{{ t(batch.STATUS) }}</td><td class="actions-cell"><button v-if="batch.STATUS !== 'ACTIVE'" @click="setBatch(batch.BATCH_NO, 'ACTIVE')">{{ t('Activate') }}</button><button v-else @click="setBatch(batch.BATCH_NO, 'INACTIVE')">{{ t('Deactivate') }}</button><button @click="exportBatch(batch.BATCH_NO)">{{ t('Excel') }}</button><button v-if="isSuperAdmin" @click="openBatchModal(batch)">{{ t('Edit') }}</button><button v-if="isSuperAdmin" class="danger" @click="deleteBatch(batch.BATCH_NO)">{{ t('Delete') }}</button></td></tr>
            <tr v-if="!batches.length"><td colspan="3">No batches found.</td></tr>
          </tbody>
        </table></div>
      </section>

      <div v-if="isSuperAdmin && batchModalOpen" class="modal-backdrop" @click.self="batchModalOpen = false">
        <section class="card modal" role="dialog" aria-modal="true" aria-labelledby="edit-batch-title">
          <div class="section-title"><h2 id="edit-batch-title">{{ t('Edit Batch') }}</h2><button type="button" @click="batchModalOpen = false">{{ t('Close') }}</button></div>
          <p class="muted">Changing the batch number also updates every linked employee and update request.</p>
          <label>{{ t('Batch') }}</label><input v-model="batchEditor.batchNo" maxlength="100" />
          <label>{{ t('Status') }}</label><select v-model="batchEditor.status"><option value="ACTIVE">{{ t('Active') }}</option><option value="INACTIVE">{{ t('Inactive') }}</option></select>
          <div class="modal-actions"><button type="button" @click="batchModalOpen = false">{{ t('Cancel') }}</button><button class="primary" @click="updateBatch">{{ t('Save Changes') }}</button></div>
        </section>
      </div>

      <section v-if="activeSection === 'employees'" class="card">
          <div class="section-title"><div><h2>{{ t('Employee List') }}</h2><p class="muted">New submissions must be approved before an employee can update their data.</p></div><div class="employee-filters"><input v-model="employeeSearch" placeholder="Search name, ID, IPI or phone" @keyup.enter="refresh" /><AutoCompleteSelect v-model="employeeBatchFilter" :options="batchFilterOptions" :placeholder="t('Search batch')" /><button @click="refresh">{{ t('Search') }}</button></div></div>
          <div class="table-wrap"><table>
            <thead><tr><th>{{ t('Merit List ID') }}</th><th>{{ t('Class ID') }}</th><th>{{ t('Name') }}</th><th>{{ t('Phone') }}</th><th>{{ t('Batch') }}</th><th>{{ t('Approval Status') }}</th><th>{{ t('IPI') }}</th><th>{{ t('Actions') }}</th></tr></thead>
            <tbody>
              <tr v-for="employee in employees" :key="employee.EMP_ENTRY_ID"><td>{{ employee.MERITLIST_ID }}</td><td>{{ employee.CLASS_ID }}</td><td>{{ employee.NAME }}</td><td>{{ employee.PHONE }}</td><td>{{ employee.batch_no }}</td><td>{{ t(employee.APPROVAL_STATUS === 'DRAFT' ? 'Draft' : employee.APPROVAL_STATUS === 'PENDING' ? 'Pending' : employee.APPROVAL_STATUS === 'APPROVED' ? 'Approved' : 'Rejected') }}<small v-if="employee.APPROVAL_STATUS === 'DRAFT'" class="status-note">{{ t('Waiting for employee submission') }}</small></td><td>{{ employee.IPI || t('Not assigned') }}</td><td class="actions-cell"><router-link class="button-link" :to="{ name: 'admin-employee-edit', params: { empEntryId: employee.EMP_ENTRY_ID } }">{{ t('Edit Details') }}</router-link><button v-if="['PENDING', 'REJECTED'].includes(employee.APPROVAL_STATUS)" class="primary" @click="approveEmployee(employee, 'APPROVED')">{{ t('Approve') }}</button><button v-if="employee.APPROVAL_STATUS === 'PENDING'" class="danger" @click="approveEmployee(employee, 'REJECTED')">{{ t('Reject') }}</button><button @click="assignIpi(employee)">{{ t(employee.IPI ? 'Change IPI' : 'Assign IPI') }}</button><button v-if="employee.APPROVAL_STATUS === 'APPROVED'" @click="openCorrectionModal(employee)">{{ t('Send for Correction') }}</button><button v-if="isSuperAdmin" class="danger" @click="deleteEmployee(employee)">{{ t('Delete') }}</button></td></tr>
              <tr v-if="!employees.length"><td colspan="8">No employees found.</td></tr>
            </tbody>
          </table></div>
      </section>

      <div v-if="correctionModalOpen" class="modal-backdrop" @click.self="correctionModalOpen = false">
        <section class="card modal" role="dialog" aria-modal="true" aria-labelledby="correction-title">
          <div class="section-title"><h2 id="correction-title">{{ t('Send for Correction') }}</h2><button type="button" @click="correctionModalOpen = false">{{ t('Close') }}</button></div>
          <p class="muted">Grant 24-hour update access to <b>{{ correctionEmployee?.NAME || correctionEmployee?.MERITLIST_ID }}</b>. The employee will see these instructions after verifying on the public form.</p>
          <label>{{ t('Correction Instructions') }}</label><textarea v-model="correctionNote" maxlength="1000" rows="5" placeholder="Describe the information that needs correction"></textarea>
          <div class="modal-actions"><button type="button" @click="correctionModalOpen = false">{{ t('Cancel') }}</button><button class="primary" @click="grantCorrectionAccess">{{ t('Grant 24h Access') }}</button></div>
        </section>
      </div>

      <form v-if="activeSection === 'employees' && selectedEmployeeId" class="form" novalidate @submit.prevent="saveEmployeeDetails">
        <section class="card">
          <div class="section-title"><div><h2>{{ t('Employee Identity') }}</h2><p class="muted">Administrators can edit identity values, assign IPI, move the employee to another batch, and change approval status.</p></div><button type="button" @click="closeEmployeeEditor">{{ t('Close') }}</button></div>
          <div class="grid">
            <div class="field"><label>{{ t('Merit List ID') }}</label><input v-model="editEmployee.MERITLIST_ID" required /></div>
            <div class="field"><label>{{ t('Class ID') }}</label><input v-model="editEmployee.CLASS_ID" required /></div>
            <div class="field"><label>{{ t('IPI') }}</label><input v-model="editEmployee.IPI" :placeholder="t('Optional')" /></div>
            <div class="field"><label>{{ t('Batch') }}</label><select v-model="editBatch" required><option v-for="batch in batches" :key="batch.BATCH_NO" :value="batch.BATCH_NO">{{ batch.BATCH_NO }} ({{ t(batch.STATUS) }})</option></select></div>
            <div class="field"><label>{{ t('Approval Status') }}</label><select v-model="editApprovalStatus" :disabled="editEmployee.APPROVAL_STATUS === 'DRAFT'"><option v-if="editEmployee.APPROVAL_STATUS === 'DRAFT'" value="DRAFT">{{ t('Draft') }}</option><option value="PENDING">{{ t('Pending') }}</option><option value="APPROVED">{{ t('Approved') }}</option><option value="REJECTED">{{ t('Rejected') }}</option></select><small v-if="editEmployee.APPROVAL_STATUS === 'DRAFT'" class="status-note">{{ t('Waiting for employee submission') }}</small></div>
          </div>
        </section>

        <section class="card">
          <h2>{{ t('Basic Information') }}</h2>
          <div class="grid">
            <div class="field"><label>{{ t('Employee Name') }}</label><input v-model="editEmployee.NAME" /><small class="field-hint">{{ t('As per SSC/Dakhil certificate') }}</small></div>
            <div class="field"><label>{{ t('Birth Date') }}</label><DateInput v-model="editEmployee.BIRTHDATE" /><small class="field-hint">{{ t('As per SSC/Dakhil certificate') }}</small></div>
            <div class="field"><label>{{ t('Blood Group') }}</label><input v-model="editEmployee.BLD_GROUP" /></div>
            <div class="field"><label>{{ t('Nationality') }}</label><input v-model="editEmployee.NATIONALITY" /></div>
            <div class="field"><label>{{ t('Height') }}</label><HeightInput v-model="editEmployee.HEIGHT" /></div>
            <div class="field"><label>{{ t('Weight (kg)') }}</label><WeightInput v-model="editEmployee.WEIGHT" /></div>
            <div class="field"><label>{{ t('Gender') }}</label><select v-model="editEmployee.GENDER"><option value="">Select</option><option value="M">{{ t('Male') }}</option><option value="F">{{ t('Female') }}</option></select></div>
            <div class="field"><label>{{ t('Religion') }}</label><select v-model="editEmployee.RELIGION"><option value="">Select</option><option value="I">{{ t('Islam') }}</option><option value="H">{{ t('Hindu') }}</option><option value="B">{{ t('Buddha') }}</option><option value="C">{{ t('Christian') }}</option></select></div>
            <div class="field"><label>{{ t('Marital Status') }}</label><select v-model="editEmployee.MARITAL_STATUS" @change="onEditMaritalStatusChange"><option value="">Select</option><option value="U">{{ t('Unmarried') }}</option><option value="M">{{ t('Married') }}</option></select></div>
            <template v-if="editEmployee.MARITAL_STATUS === 'M'">
              <div class="field"><label>{{ t('Spouse Name') }}</label><input v-model="editEmployee.SPOUSE_NAME" /></div>
              <div class="field"><label>{{ t('Spouse Occupation') }}</label><input v-model="editEmployee.SPOSE_OCCUPATION" /></div>
              <div class="field"><label>{{ t('Spouse Phone') }}</label><PhoneInput v-model="editEmployee.SPOUSE_PHONE" :required="false" /></div>
              <div class="field"><label>{{ t('Marriage Date') }}</label><DateInput v-model="editEmployee.SPOSE_MARRIAGE_DATE" /></div>
            </template>
          </div>
        </section>

        <section class="card">
          <h2>{{ t('Contact & Identity') }}</h2>
          <div class="grid">
            <div class="field"><label>{{ t('Email') }}</label><input v-model="editEmployee.EMAIL" type="email" /></div>
            <div class="field"><label>{{ t('Primary Phone') }}</label><PhoneInput v-model="editEmployee.PHONE" :required="false" autocomplete="tel" /></div>
            <div class="field"><label>{{ t('Alternate Phone') }}</label><PhoneInput v-model="editEmployee.PHONE1" :required="false" /></div>
            <div class="field"><label>{{ t('NID') }}</label><NidInput v-model="editEmployee.NID" /></div>
          </div>
        </section>

        <section class="card">
          <h2>{{ t('Address Information') }}</h2>
          <div class="address-grid">
            <div class="address-box">
              <h3>{{ t('Permanent Address') }}</h3>
              <label>{{ t('Village / House / Road') }}</label><input v-model="editEmployee.PERMANENT_VILLAGE" />
              <label>{{ t('Post Office') }}</label><input v-model="editEmployee.PERMANENT_POST" />
              <label>{{ t('Thana / Upazila') }}</label><input v-model="editEmployee.PERMANENT_THANA" />
              <label>{{ t('District') }}</label><input v-model="editEmployee.PERMANENT_DISTRICT" />
            </div>
            <div class="address-box">
              <h3>{{ t('Present Address') }}</h3>
              <label>{{ t('Village / House / Road') }}</label><input v-model="editEmployee.PRESENT_VILLAGE" />
              <label>{{ t('Post Office') }}</label><input v-model="editEmployee.PRESENT_POST" />
              <label>{{ t('Thana / Upazila') }}</label><input v-model="editEmployee.PRESENT_THANA" />
              <label>{{ t('District') }}</label><input v-model="editEmployee.PRESENT_DISTRICT" />
            </div>
          </div>
        </section>

        <section class="card">
          <h2>{{ t('Emergency Contact') }}</h2>
          <div class="grid">
            <div class="field"><label>{{ t('Emergency Person') }}</label><input v-model="editEmployee.EMGRCNY_PERSON" /></div>
            <div class="field"><label>{{ t('Relationship') }}</label><input v-model="editEmployee.EMGRCNY_RELATION" /></div>
            <div class="field"><label>{{ t('Emergency Phone') }}</label><PhoneInput v-model="editEmployee.EMGRCNY_PHONE" :required="false" /></div>
            <div class="field"><label>{{ t('Emergency Address') }}</label><input v-model="editEmployee.EMGRCNY_ADDRESS" /></div>
          </div>
        </section>

        <section class="card">
          <h2>{{ t('Family Information') }}</h2>
          <div class="grid">
            <div class="field"><label>{{ t('Father Name') }}</label><input v-model="editEmployee.FATHER_NAME" /><small class="field-hint">{{ t('As per SSC/Dakhil certificate') }}</small></div>
            <div class="field"><label>{{ t('Father Phone') }}</label><PhoneInput v-model="editEmployee.FATHER_PHONE" :required="false" /></div>
            <div class="field"><label>{{ t('Mother Name') }}</label><input v-model="editEmployee.MOTHER_NAME" /></div>
            <div class="field"><label>{{ t('Mother Phone') }}</label><PhoneInput v-model="editEmployee.MOTHER_PHONE" :required="false" /></div>
          </div>
          <ChildInformation v-if="editEmployee.MARITAL_STATUS === 'M'" v-model="editChildren" />
        </section>

        <section class="card">
          <h2>{{ t('Guarantor Information') }}</h2>
          <div class="grid">
            <div class="field"><label>{{ t('Guarantor Name') }}</label><input v-model="editEmployee.GRNT_NAME" /></div>
            <div class="field"><label>{{ t('Relationship') }}</label><input v-model="editEmployee.GRNT_RELE" /></div>
            <div class="field"><label>{{ t('Guarantor Father') }}</label><input v-model="editEmployee.GRNT_FATHER" /></div>
            <div class="field"><label>{{ t('Present Address') }}</label><input v-model="editEmployee.GRNT_PRESENT_ADD" /></div>
            <div class="field"><label>{{ t('Permanent Address') }}</label><input v-model="editEmployee.GRNT_PERMANET_ADD" /></div>
            <div class="field"><label>{{ t('Nationality') }}</label><input v-model="editEmployee.GRNT_NATIONALITY" /></div>
            <div class="field"><label>{{ t('Profession') }}</label><input v-model="editEmployee.GRNT_PROFFESSION" /></div>
            <div class="field"><label>{{ t('NID') }}</label><NidInput v-model="editEmployee.GRNT_NID" /></div>
            <div class="field"><label>{{ t('Mobile') }}</label><PhoneInput v-model="editEmployee.GRNT_MOBILE" :required="false" /></div>
          </div>
        </section>

        <section class="card">
          <div class="section-title"><h2>{{ t('Education') }}</h2></div>
          <p class="muted">Administrators can save partial education data.</p>
          <EducationLevels v-model="editEducation" :require-complete="false" />
        </section>

        <section class="sticky-actions"><button type="button" @click="closeEmployeeEditor">{{ t('Cancel') }}</button><button class="primary" type="submit" :disabled="editLoading">{{ t(editLoading ? 'Saving…' : 'Save Employee Changes') }}</button></section>
      </form>

      <section v-if="activeSection === 'requests'" class="card">
        <h2>{{ t('Update Requests') }}</h2>
        <p class="muted">Approve employee requests, grant or extend correction access, and remove request logs. Deleting an active approval revokes its temporary access.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Merit List</th><th>Class ID</th><th>IPI</th><th>Name</th><th>Batch</th><th>Note</th><th>Status</th><th>Until</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="request in requests" :key="request.REQUEST_ID"><td>{{ request.MERITLIST_ID }}</td><td>{{ request.CLASS_ID }}</td><td>{{ request.IPI || '-' }}</td><td>{{ request.NAME }}</td><td>{{ request.BATCH_NO }}</td><td>{{ request.ADMIN_REMARKS || request.REQUEST_NOTE || '-' }}</td><td>{{ request.STATUS }}</td><td>{{ formatDateTime(request.APPROVED_UNTIL) }}</td><td class="actions-cell"><button v-if="request.STATUS === 'PENDING'" class="primary" @click="decide(request.REQUEST_ID, 'APPROVED')">{{ t('Approve 24h') }}</button><button v-if="request.STATUS === 'PENDING'" class="danger" @click="decide(request.REQUEST_ID, 'REJECTED')">{{ t('Reject') }}</button><button v-if="request.STATUS !== 'PENDING'" @click="decide(request.REQUEST_ID, 'APPROVED')">{{ t(request.STATUS === 'APPROVED' ? 'Extend 24h' : 'Allow 24h') }}</button><button class="danger" @click="deleteUpdateRequest(request)">{{ t('Delete Log') }}</button></td></tr>
            <tr v-if="!requests.length"><td colspan="9">No update requests found.</td></tr>
          </tbody>
        </table></div>
      </section>
    </template>
  </main>
</template>
