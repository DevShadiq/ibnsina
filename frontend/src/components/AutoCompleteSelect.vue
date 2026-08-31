<script setup>
import { computed } from 'vue';
import { t } from '../i18n';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Search or select' },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'change']);
const listId = `autocomplete-${Math.random().toString(36).slice(2)}`;
const normalizedOptions = computed(() => props.options.map(option => (
  typeof option === 'object'
    ? { value: String(option.value ?? ''), label: String(option.label ?? option.value ?? '') }
    : { value: String(option), label: String(option) }
)));
const displayValue = computed(() => {
  const selected = normalizedOptions.value.find(option => option.value === String(props.modelValue ?? ''));
  return selected?.label || props.modelValue || '';
});

function update(event) {
  const selected = normalizedOptions.value.find(option => option.label === event.target.value);
  const value = selected?.value || event.target.value;
  emit('update:modelValue', value);
  emit('change', value);
}
</script>

<template>
  <input
    :value="displayValue"
    :list="listId"
    :placeholder="t(placeholder)"
    :disabled="disabled"
    :required="required"
    autocomplete="off"
    @input="update"
    @change="update"
  />
  <datalist :id="listId">
    <option value="" :label="t('Select')" />
    <option v-for="option in normalizedOptions" :key="option.value" :value="option.label" />
  </datalist>
</template>
