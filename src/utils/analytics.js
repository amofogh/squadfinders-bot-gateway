/**
 * Returns UTC date key in YYYY-MM-DD format
 * @param {Date} date - Date to convert (defaults to now)
 * @returns {string} Date key in YYYY-MM-DD format
 */
export const dayKeyUTC = (date = new Date()) => {
  return date.toISOString().split('T')[0];
};