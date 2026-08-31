<script setup>
import DateInput from './DateInput.vue';
import PhoneInput from './PhoneInput.vue';
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
  <div class="child-information">
    <div class="section-title child-heading">
      <div>
        <h3>{{ t('Child Information') }}</h3>
        <p class="muted">{{ t('Optional. Add one entry for each child.') }}</p>
      </div>
      <button v-if="!disabled" type="button" @click="addChild">{{ t('Add Child') }}</button>
    </div>

    <p v-if="!modelValue.length" class="muted">{{ t('No child information added.') }}</p>

    <div v-for="(child, index) in modelValue" :key="index" class="edu child-entry">
      <div class="section-title">
        <b>{{ t('Child') }} {{ index + 1 }}</b>
        <button v-if="!disabled" type="button" class="danger" @click="removeChild(index)">{{ t('Remove') }}</button>
      </div>
      <div class="grid">
        <div class="field">
          <label>{{ t('Child Name') }}</label>
          <input v-model="child.FNAME" maxlength="100" :disabled="disabled" />
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
          <PhoneInput v-model="child.PHONE" :disabled="disabled" :required="false" />
        </div>
        <div class="field child-address">
          <label>{{ t('Address') }}</label>
          <input v-model="child.F_ADD" maxlength="100" :disabled="disabled" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.child-information {
  margin-top: 22px;
}

.child-heading {
  align-items: flex-start;
}

.child-heading h3,
.child-heading p {
  margin: 0;
}

.child-heading p {
  margin-top: 5px;
}

.child-entry .child-address {
  grid-column: span 2;
}

@media (max-width: 760px) {
  .child-entry .child-address {
    grid-column: auto;
  }
}
</style>
