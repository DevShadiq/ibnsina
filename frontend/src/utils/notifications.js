import { reactive } from 'vue';

export const notifications = reactive([]);

let nextId = 1;
const timers = new Map();

export function dismissNotification(id) {
  const index = notifications.findIndex(notification => notification.id === id);
  if (index >= 0) notifications.splice(index, 1);

  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
}

export function clearNotifications() {
  for (const id of [...timers.keys()]) {
    clearTimeout(timers.get(id));
  }
  timers.clear();
  notifications.splice(0, notifications.length);
}

export function showNotification(message, options = {}) {
  const text = String(message || '').trim();
  if (!text) return null;

  // Feedback represents the latest action; do not stack obsolete results.
  clearNotifications();

  const notification = {
    id: nextId++,
    message: text,
    title: options.title || 'Notification',
    type: options.type || 'info',
    duration: options.duration ?? 5000
  };

  notifications.push(notification);

  if (notification.duration > 0) {
    timers.set(
      notification.id,
      setTimeout(() => dismissNotification(notification.id), notification.duration)
    );
  }

  return notification.id;
}

export function notifySuccess(message, title = 'Success') {
  return showNotification(message, { type: 'success', title });
}

export function notifyError(message, title = 'Unable to complete') {
  return showNotification(message, { type: 'error', title, duration: 6500 });
}
