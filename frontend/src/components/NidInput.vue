<script setup>
defineProps({
  modelValue: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

function onInput(event) {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 17);
  event.target.value = digits;
  emit('update:modelValue', digits);
}
</script>

<template>
  <input
    :value="modelValue"
    type="text"
    inputmode="numeric"
    pattern="[0-9]{10}|[0-9]{13}|[0-9]{17}"
    maxlength="17"
    :disabled="disabled"
    autocomplete="off"
    placeholder="10, 13, or 17 digits"
    title="Enter exactly 10, 13, or 17 digits"
    @input="onInput"
  />
</template>
