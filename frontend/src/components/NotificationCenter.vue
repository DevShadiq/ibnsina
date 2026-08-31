<script setup>
import { dismissNotification, notifications } from '../utils/notifications';

const icons = {
  success: 'M5 12.5 9.2 17 19 7',
  error: 'm7 7 10 10 M17 7 7 17',
  info: 'M12 11v6m0-10h.01',
  warning: 'M12 9v4m0 4h.01'
};
</script>

<template>
  <Teleport to="body">
    <TransitionGroup
      name="notification"
      tag="div"
      class="notification-stack"
      aria-live="polite"
      aria-relevant="additions"
    >
      <article
        v-for="item in notifications"
        :key="item.id"
        class="notification-card"
        :class="`notification-card--${item.type}`"
        :role="item.type === 'error' ? 'alert' : 'status'"
      >
        <div class="notification-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
            <path :d="icons[item.type] || icons.info" />
          </svg>
        </div>

        <div class="notification-copy">
          <strong>{{ item.title }}</strong>
          <p>{{ item.message }}</p>
        </div>

        <button
          class="notification-close"
          type="button"
          aria-label="Dismiss notification"
          @click="dismissNotification(item.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>

        <span
          v-if="item.duration > 0"
          class="notification-progress"
          :style="{ animationDuration: `${item.duration}ms` }"
          aria-hidden="true"
        />
      </article>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.notification-stack {
  position: fixed;
  z-index: 10000;
  top: 22px;
  right: 22px;
  display: grid;
  width: min(410px, calc(100vw - 32px));
  gap: 12px;
  pointer-events: none;
}

.notification-card {
  --notification-color: #2b6fda;
  --notification-soft: #e9f2ff;
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 30px;
  gap: 12px;
  padding: 16px 14px 17px 16px;
  overflow: hidden;
  color: #17223b;
  border: 1px solid rgb(194 207 221 / 72%);
  border-radius: 16px;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 18px 48px rgb(16 42 67 / 20%), 0 3px 10px rgb(16 42 67 / 8%);
  backdrop-filter: blur(18px);
  pointer-events: auto;
}

.notification-card--success { --notification-color: #0b8f68; --notification-soft: #e3f8f0; }
.notification-card--error { --notification-color: #c0362c; --notification-soft: #fff0ee; }
.notification-card--warning { --notification-color: #b7791f; --notification-soft: #fff7df; }

.notification-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: var(--notification-color);
  border-radius: 13px;
  background: var(--notification-soft);
}

.notification-icon svg { width: 22px; height: 22px; }
.notification-copy { min-width: 0; padding-top: 1px; }
.notification-copy strong { display: block; color: #102a43; font-size: .94rem; line-height: 1.35; }
.notification-copy p { margin: 4px 0 0; color: #5c6e84; font-size: .84rem; line-height: 1.5; overflow-wrap: anywhere; }

.notification-close {
  display: grid;
  width: 30px;
  min-height: 30px;
  padding: 0;
  place-items: center;
  color: #8190a3;
  border: 0;
  border-radius: 9px;
  background: transparent;
  box-shadow: none;
}

.notification-close:hover { color: #31445e; background: #eef3f8; box-shadow: none; transform: none; }
.notification-close svg { width: 17px; height: 17px; }

.notification-progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--notification-color);
  transform-origin: left;
  animation-name: notification-countdown;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

.notification-enter-active, .notification-leave-active { transition: opacity 220ms ease, transform 260ms cubic-bezier(.22, 1, .36, 1); }
.notification-enter-from { opacity: 0; transform: translate3d(35px, -8px, 0) scale(.97); }
.notification-leave-to { opacity: 0; transform: translate3d(28px, 0, 0) scale(.96); }
.notification-move { transition: transform 260ms ease; }

@keyframes notification-countdown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

@media (max-width: 600px) {
  .notification-stack { top: 12px; right: 12px; width: calc(100vw - 24px); }
  .notification-card { grid-template-columns: 38px minmax(0, 1fr) 28px; padding: 14px 12px 15px 14px; }
  .notification-icon { width: 38px; height: 38px; }
}

@media (prefers-reduced-motion: reduce) {
  .notification-enter-active, .notification-leave-active, .notification-move { transition: none; }
  .notification-progress { animation: none; }
}
</style>
