// src/utils/journalParser.js

/**
 * Parses journal content and extracts structured data
 * @param {string} text - Journal document text
 * @returns {Object} Analysis result with metrics
 */
function parseJournalContent(text) {
  const analysis = {
    totalChars: text.length,
    filledSlots: 0,
    emptySlots: 0,
    productivityMentions: 0,
    mentalMentions: 0,
    todoLines: 0
  };

  if (!text || text.length === 0) {
    return analysis;
  }

  // Count filled hourly slots
  // Pattern: HH:mm - HH:mm AM/PM
  const slotRegex = /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/gi;
  const slots = [...text.matchAll(slotRegex)];
  
  slots.forEach(slot => {
    const startIndex = slot.index;
    const slotText = slot[0];
    // Check next 100 characters after the slot for content
    const nextText = text.substring(
      startIndex + slotText.length,
      startIndex + slotText.length + 100
    ).trim();
    
    // Remove common whitespace and newlines to check if there's actual content
    const content = nextText.replace(/\s+/g, ' ').trim();
    
    if (content.length > 5) {
      analysis.filledSlots++;
    } else {
      analysis.emptySlots++;
    }
  });

  // Count mentions
  analysis.productivityMentions = (text.match(/productivity/gi) || []).length;
  analysis.mentalMentions = (text.match(/mental|physical|alert|tired|slump/gi) || []).length;
  analysis.todoLines = (text.match(/#office|#personal|#health/gi) || []).length;

  return analysis;
}

module.exports = {
  parseJournalContent
};

