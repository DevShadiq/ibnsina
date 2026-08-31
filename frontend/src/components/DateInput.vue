<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <input
    :value="modelValue"
    type="date"
    :disabled="disabled"
    :required="required"
    @input="emit('update:modelValue', $event.target.value)"
  />
</template>
