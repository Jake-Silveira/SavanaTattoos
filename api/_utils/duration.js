/**
 * DURATION_MAP — Tattoo session duration (minutes) by service and size.
 * Mirrors window.DURATION_MAP in utils.js for server-side consistency.
 */
const DURATION_MAP = {
  'Small Tattoo':    { XS: 30, Small: 45, Medium: 60, Large: 90, XL: 120, XXL: 180 },
  'Medium Tattoo':   { XS: 45, Small: 60, Medium: 90, Large: 120, XL: 150, XXL: 210 },
  'Large Tattoo':    { XS: 60, Small: 90, Medium: 120, Large: 180, XL: 240, XXL: 300 },
  'Custom Design':   { XS: 60, Small: 90, Medium: 150, Large: 180, XL: 240, XXL: 300 },
  'Cover-Up':        { XS: 60, Small: 90, Medium: 120, Large: 180, XL: 240, XXL: 300 },
  'Touch-Up':        { XS: 15, Small: 30, Medium: 45, Large: 60, XL: 90, XXL: 120 },
  'Flash Tattoo':    { XS: 15, Small: 20, Medium: 30, Large: 45, XL: 60, XXL: 60 },
  'Consultation':    { XS: 30, Small: 30, Medium: 45, Large: 45, XL: 60, XXL: 60 }
};

/**
 * Calculate duration: use provided duration_minutes, or derive from map.
 */
function calculateDuration(service, sizeCategory, customSize, durationMinutes) {
  if (durationMinutes) return parseInt(durationMinutes);
  if (DURATION_MAP[service] && DURATION_MAP[service][sizeCategory]) {
    return DURATION_MAP[service][sizeCategory];
  }
  return 60; // fallback
}

module.exports = { DURATION_MAP, calculateDuration };
