<script setup>
import { language, toggleLanguage } from '../i18n';
</script>

<template>
  <button class="language-toggle" type="button" @click="toggleLanguage">
    {{ language === 'en' ? 'বাংলা' : 'English' }}
  </button>
</template>
