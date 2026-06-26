/**
 * Formats a "HH:MM:SS" or "HH:MM" string to "X:00 AM/PM"
 */
function formatTime12(time) {
  if (!time) return '';
  const parts = time.split(':').map(Number);
  const h = parts[0];
  const m = parts[1] || 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return hour12 + ':' + String(m).padStart(2, '0') + ' ' + period;
}

module.exports = { formatTime12 };
