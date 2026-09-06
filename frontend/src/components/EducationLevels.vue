<script setup>
import { computed } from 'vue';
import AutoCompleteSelect from './AutoCompleteSelect.vue';
import {
  EDUCATION_BOARDS,
  EDUCATION_GROUPS,
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_OPTIONS,
  UNIVERSITY_OPTIONS
} from '../utils/education';
import { t } from '../i18n';

const props = defineProps({
  modelValue: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
  requireComplete: { type: Boolean, default: true }
});

defineEmits(['update:modelValue']);

const universityOptions = UNIVERSITY_OPTIONS.map(value => ({ value, label: value }));
const rows = computed(() => props.modelValue);

function isRequired(index) {
  if (!props.requireComplete) return false;
  if (index < 3) return true;
  const row = rows.value[index] || {};
  return ['EXAMNAME', 'BOARD', 'CLAS', 'PASSYEAR', 'INSTITUTE', 'EXAMGROUP', 'SUBJECT_NAME']
    .some(key => String(row[key] || '').trim());
}

function selectEducationBoard(item) {
  if (item.EXAMNAME === 'Dakhil' || item.EXAMNAME === 'Alim') {
    item.BOARD = 'Madrasa';
  }
}

function sanitizePassYear(item, event) {
  item.PASSYEAR = event.target.value.replace(/\D/g, '').slice(0, 4);
}
</script>

<template>
  <div v-for="(item, index) in rows" :key="EDUCATION_LEVELS[index]" class="edu">
    <div class="section-title">
      <b>{{ t('Level') }} {{ index + 1 }} — {{ EDUCATION_LEVELS[index] }}</b>
      <span class="requirement-label" :class="props.requireComplete && index < 3 ? 'required' : 'optional'">
        {{ t(props.requireComplete && index < 3 ? 'Required' : 'Optional') }}
      </span>
    </div>

    <div class="grid">
      <div class="field">
        <label>{{ t('Education Level') }}<span v-if="isRequired(index)" class="required-mark"> *</span></label>
        <select
          v-model="item.EXAMNAME"
          :disabled="disabled"
          :required="isRequired(index)"
          @change="selectEducationBoard(item)"
        >
          <option value="">{{ t('Select') }}</option>
          <option v-for="degree in EDUCATION_LEVEL_OPTIONS[index]" :key="degree" :value="degree">{{ degree }}</option>
        </select>
      </div>

      <div class="field">
        <label>{{ t(index < 2 ? 'Board' : 'University') }}<span v-if="isRequired(index)" class="required-mark"> *</span></label>
        <select
          v-if="index < 2"
          v-model="item.BOARD"
          :disabled="disabled"
          :required="isRequired(index)"
        >
          <option value="">{{ t('Select') }}</option>
          <option v-for="board in EDUCATION_BOARDS" :key="board" :value="board">{{ board }}</option>
        </select>
        <AutoCompleteSelect
          v-else
          v-model="item.BOARD"
          :options="universityOptions"
          :disabled="disabled"
          :required="isRequired(index)"
          placeholder="Select or write university name"
        />
      </div>

      <div v-if="index < 2" class="field">
        <label>{{ t('Group') }}<span v-if="isRequired(index)" class="required-mark"> *</span></label>
        <select v-model="item.EXAMGROUP" :disabled="disabled" :required="isRequired(index)">
          <option value="">{{ t('Select') }}</option>
          <option v-for="group in EDUCATION_GROUPS" :key="group" :value="group">{{ t(group) }}</option>
        </select>
      </div>

      <div class="field">
        <label>{{ t('Class / Result') }}<span v-if="isRequired(index)" class="required-mark"> *</span></label>
        <input v-model="item.CLAS" :disabled="disabled" :required="isRequired(index)" />
      </div>

      <div class="field">
        <label>{{ t('Pass Year') }}<span v-if="isRequired(index)" class="required-mark"> *</span></label>
        <input
          v-model="item.PASSYEAR"
          inputmode="numeric"
          maxlength="4"
          pattern="[0-9]{4}"
          :disabled="disabled"
          :required="isRequired(index)"
          @input="sanitizePassYear(item, $event)"
        />
      </div>

      <div v-if="index >= 2" class="field">
        <label>{{ t('Subject') }}<span v-if="isRequired(index)" class="required-mark"> *</span></label>
        <input v-model="item.SUBJECT_NAME" :disabled="disabled" :required="isRequired(index)" />
      </div>

      <div class="field">
        <label>{{ t('Institute') }}</label>
        <input v-model="item.INSTITUTE" :disabled="disabled" />
      </div>

    </div>
  </div>
</template>

<style scoped>
.requirement-label.required {
  color: #dc2626;
  font-weight: 800;
}

.requirement-label.optional {
  color: #64748b;
}
</style>
