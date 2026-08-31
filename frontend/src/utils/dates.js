const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  const monthIndex = Number(month) - 1;
  if (!year || !day || monthIndex < 0 || monthIndex > 11) return String(value);
  return `${day.padStart(2, '0')}-${MONTHS[monthIndex]}-${year}`;
}

export function formatDateTime(value) {
  if (!value) return '-';
  const text = String(value).replace('T', ' ');
  const [date, time = ''] = text.split(' ');
  const [rawHour = '0', minute = '00'] = time.split(':');
  const hour = Number(rawHour);
  if (!time || Number.isNaN(hour)) return formatDate(date);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${formatDate(date)} ${String(hour12).padStart(2, '0')}:${minute} ${suffix}`;
}
