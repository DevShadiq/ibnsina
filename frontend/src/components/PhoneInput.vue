<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  required: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  autocomplete: { type: String, default: 'off' },
  placeholder: { type: String, default: '01XXXXXXXXX' }
});

const emit = defineEmits(['update:modelValue', 'enter']);

const localDigits = computed(() => {
  let digits = String(props.modelValue || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('88')) digits = digits.slice(2);
  return digits.slice(0, 11);
});

function onInput(event) {
  let digits = event.target.value.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('88')) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  event.target.value = digits;
  emit('update:modelValue', digits);
}
</script>

<template>
  <div class="phone-input" :class="{ disabled }">
    <input
      :value="localDigits"
      type="tel"
      inputmode="numeric"
      pattern="01[3-9][0-9]{8}"
      minlength="11"
      maxlength="11"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      title="Enter an 11-digit Bangladesh mobile number starting with 013–019"
      @input="onInput"
      @keydown.enter="$emit('enter')"
    />
  </div>
</template>

<style scoped>
.phone-input {
  display: flex;
  align-items: stretch;
  width: 100%;
}

.phone-input input {
  min-width: 0;
  border-radius: 0.55rem;
}
</style>
