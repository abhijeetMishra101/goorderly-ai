// src/utils/dateUtils.js

/**
 * Formats date to YYYY-MM-DD format
 * @param {Date} date - Date object
 * @param {string} timezone - Timezone string (optional)
 * @returns {string} Formatted date string
 */
function formatDateYMD(date, timezone = null) {
  const d = new Date(date);
  
  if (timezone) {
    // Using Intl.DateTimeFormat for timezone support
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    return formatter.format(d);
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Gets tomorrow's date in YYYY-MM-DD format
 * @param {string} timezone - Timezone string (optional)
 * @returns {string} Tomorrow's date string
 */
function getTomorrowYMD(timezone = null) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateYMD(tomorrow, timezone);
}

/**
 * Gets today's date in YYYY-MM-DD format
 * @param {string} timezone - Timezone string (optional)
 * @returns {string} Today's date string
 */
function getTodayYMD(timezone = null) {
  return formatDateYMD(new Date(), timezone);
}

/**
 * Validates date format YYYY-MM-DD
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid format
 */
function isValidDateFormat(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }
  
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * Formats date to hashtag format: DD_Mon_YYYY (e.g., "14_Nov_2025")
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {string} Formatted date string for hashtag
 */
function formatDateForHashtag(date) {
  const d = date instanceof Date ? date : new Date(date + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}_${month}_${year}`;
}

/**
 * Parses hashtag date format to YYYY-MM-DD
 * @param {string} hashtagDate - Date in format "DD_Mon_YYYY"
 * @returns {string} Date in YYYY-MM-DD format
 */
function parseHashtagDate(hashtagDate) {
  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  const match = hashtagDate.match(/(\d{2})_(\w{3})_(\d{4})/);
  if (!match) {
    throw new Error(`Invalid hashtag date format: ${hashtagDate}`);
  }
  
  const [, day, month, year] = match;
  const monthNum = months[month];
  if (!monthNum) {
    throw new Error(`Invalid month in hashtag date: ${hashtagDate}`);
  }
  
  return `${year}-${monthNum}-${day}`;
}

module.exports = {
  formatDateYMD,
  getTomorrowYMD,
  getTodayYMD,
  isValidDateFormat,
  formatDateForHashtag,
  parseHashtagDate
};

