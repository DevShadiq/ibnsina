<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

function onInput(event) {
  const cleaned = event.target.value.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  const value = dot < 0
    ? cleaned
    : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`;

  event.target.value = value;
  emit('update:modelValue', value);
}
</script>

<template>
  <div class="weight-input">
    <input
      :value="props.modelValue"
      type="text"
      inputmode="decimal"
      pattern="[0-9]+(?:\.[0-9]+)?"
      placeholder="70"
      :disabled="disabled"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.weight-input {
  display: flex;
  align-items: stretch;
  width: 100%;
}

.weight-input input {
  min-width: 0;
  border-radius: 0.55rem;
}
</style>
