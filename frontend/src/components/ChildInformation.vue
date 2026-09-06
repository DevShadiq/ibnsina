<script setup>
import DateInput from './DateInput.vue';
import { blankChild } from '../utils/children';
import { t } from '../i18n';

const props = defineProps({
  modelValue: { type: Array, required: true },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

function addChild() {
  emit('update:modelValue', [...props.modelValue, blankChild()]);
}

function removeChild(index) {
  emit('update:modelValue', props.modelValue.filter((_, rowIndex) => rowIndex !== index));
}
</script>

<template>
  <div class="section-title child-heading">
    <div>
      <h3>{{ t('Child Information') }}</h3>
      <p class="muted">{{ t('Optional. Add a row only when child information is available.') }}</p>
    </div>
    <button v-if="!disabled" type="button" @click="addChild">{{ t('Add Child') }}</button>
  </div>

  <p v-if="!modelValue.length" class="muted child-empty">{{ t('No child information added.') }}</p>

  <div v-for="(child, index) in modelValue" :key="index" class="child-row">
    <div class="section-title">
      <b>{{ t('Child') }} {{ index + 1 }}</b>
      <button v-if="!disabled" type="button" class="danger" @click="removeChild(index)">{{ t('Remove') }}</button>
    </div>

    <div class="grid">
      <div class="field">
        <label>{{ t('Child Name') }}<span class="required-mark"> *</span></label>
        <input v-model="child.FNAME" maxlength="100" :disabled="disabled" required />
      </div>
      <div class="field">
        <label>{{ t('Education Qualification') }}</label>
        <input v-model="child.F_OCUP" maxlength="70" :disabled="disabled" />
      </div>
      <div class="field">
        <label>{{ t('Birth Date') }}</label>
        <DateInput v-model="child.BIRTH_DATE" :disabled="disabled" />
      </div>
      <div class="field">
        <label>{{ t('Phone') }}</label>
        <input v-model="child.PHONE" type="tel" maxlength="25" :disabled="disabled" />
      </div>
      <div class="field child-address">
        <label>{{ t('Address') }}</label>
        <input v-model="child.F_ADD" maxlength="100" :disabled="disabled" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.child-heading { margin-top: 22px; }
.child-heading h3 { margin: 0; }
.child-empty { padding: 14px 0 4px; }
.child-row {
  padding: 20px;
  margin-top: 16px;
  border: 1px solid #dde6ef;
  border-radius: var(--radius-md);
  background: #f8fafc;
}
.child-row .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.child-address { grid-column: span 2; }

@media (max-width: 800px) {
  .child-row .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 560px) {
  .child-row .grid { grid-template-columns: 1fr; }
  .child-address { grid-column: auto; }
}
</style>
