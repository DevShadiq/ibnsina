<template>
  <router-link
    v-if="showHomeButton"
    class="global-home-link"
    to="/"
    :aria-label="t('Go to Public Form')"
    :title="t('Go to Public Form')"
  >
    <span class="global-home-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 10.8 12 3l9 7.8" />
        <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
      </svg>
    </span>
    <span>{{ t('Public Form') }}</span>
  </router-link>
  <LanguageToggle />
  <NotificationCenter />
  <router-view />
</template>

<script setup>
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import LanguageToggle from './components/LanguageToggle.vue';
import NotificationCenter from './components/NotificationCenter.vue';
import { t } from './i18n';
import { clearNotifications } from './utils/notifications';

const route = useRoute();
const showHomeButton = computed(() => route.path !== '/');
watch(() => route.fullPath, clearNotifications);
</script>
