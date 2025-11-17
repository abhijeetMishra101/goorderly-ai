// src/utils/contextDetector.js

/**
 * Detects context from voice entry text
 * @param {string} entry - Voice entry text
 * @returns {string} Detected context tag or empty string
 */
function detectContext(entry) {
  if (!entry || typeof entry !== 'string') {
    return '';
  }

  const lowerEntry = entry.toLowerCase();

  if (/meeting/i.test(lowerEntry)) {
    return 'meeting';
  }

  if (/gym|run|pushup|exercise|workout|fitness/i.test(lowerEntry)) {
    return 'fitness';
  }

  if (/call|talk|chat|conversation/i.test(lowerEntry)) {
    return 'communication';
  }

  if (/repair|shop|drive|errand|appointment/i.test(lowerEntry)) {
    return 'errand';
  }

  return '';
}

module.exports = {
  detectContext
};

