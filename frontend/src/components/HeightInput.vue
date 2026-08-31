<script setup>
import { ref, watch } from 'vue';
import { t } from '../i18n';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);
const feet = ref('');
const inches = ref('');
let lastEmitted = null;

function parseHeight(value) {
  const text = String(value || '');
  const match = text.match(/^\s*(\d+)\s*'\s*(\d+)\s*"?\s*$/)
    || text.match(/^\s*(\d+)\s*(?:ft|feet|[.\-])\s*(\d+)\s*(?:in|inches?)?\s*$/i);
  return match ? { feet: match[1], inches: match[2] } : { feet: '', inches: '' };
}

watch(
  () => props.modelValue,
  value => {
    if (value === lastEmitted) return;
    const parsed = parseHeight(value);
    feet.value = parsed.feet;
    inches.value = parsed.inches;
  },
  { immediate: true }
);

function emitHeight() {
  lastEmitted = feet.value === ''
    ? ''
    : `${Number(feet.value)}' ${Number(inches.value || 0)}"`;
  emit('update:modelValue', lastEmitted);
}

function updateFeet(event) {
  feet.value = event.target.value.replace(/\D/g, '').slice(0, 2);
  event.target.value = feet.value;
  emitHeight();
}

function updateInches(event) {
  inches.value = event.target.value.replace(/\D/g, '').slice(0, 2);
  event.target.value = inches.value;
  emitHeight();
}
</script>

<template>
  <div class="height-input">
    <label>
      <input
        :value="feet"
        type="number"
        inputmode="numeric"
        min="1"
        max="99"
        :placeholder="t('Feet')"
        :aria-label="t('Feet')"
        :disabled="disabled"
        @input="updateFeet"
      />
    </label>
    <label>
      <input
        :value="inches"
        type="number"
        inputmode="numeric"
        min="0"
        max="11"
        :placeholder="t('Inches')"
        :aria-label="t('Inches')"
        :disabled="disabled"
        @input="updateInches"
      />
    </label>
  </div>
</template>

<style scoped>
.height-input {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.height-input label {
  display: grid;
  gap: 0.3rem;
}

</style>
