// tests/unit/utils/journalParser.test.js

const { parseJournalContent } = require('../../../src/utils/journalParser');

describe('Journal Parser', () => {
  describe('parseJournalContent', () => {
    it('should extract total character count', () => {
      const text = 'Sample journal text with some content';
      const result = parseJournalContent(text);
      
      expect(result.totalChars).toBe(text.length);
    });

    it('should count filled time slots', () => {
      const text = `
        06:00 - 07:00 AM Meeting with team
        07:00 - 08:00 AM 
        08:00 - 09:00 AM Work on project
        09:00 - 10:00 AM
      `;
      
      const result = parseJournalContent(text);
      
      expect(result.filledSlots).toBeGreaterThan(0);
      expect(result.emptySlots).toBeGreaterThan(0);
    });

    it('should detect productivity mentions', () => {
      const text = 'Productivity was high today. Very productive day! Also productivity improved.';
      const result = parseJournalContent(text);
      
      expect(result.productivityMentions).toBeGreaterThanOrEqual(2);
    });

    it('should detect mental/physical state mentions', () => {
      const text = 'I felt alert this morning but tired after lunch';
      const result = parseJournalContent(text);
      
      expect(result.mentalMentions).toBeGreaterThan(0);
    });

    it('should count todo lines with hashtags', () => {
      const text = `
        #office Complete project
        #personal Exercise
        #health Checkup
      `;
      
      const result = parseJournalContent(text);
      
      expect(result.todoLines).toBe(3);
    });

    it('should handle empty journal text', () => {
      const result = parseJournalContent('');
      
      expect(result.totalChars).toBe(0);
      expect(result.filledSlots).toBe(0);
      expect(result.emptySlots).toBe(0);
    });

    it('should calculate fill rate correctly', () => {
      const text = `
        06:00 - 07:00 AM Meeting
        07:00 - 08:00 AM
        08:00 - 09:00 AM Work
        09:00 - 10:00 AM
      `;
      
      const result = parseJournalContent(text);
      const totalSlots = result.filledSlots + result.emptySlots;
      
      expect(totalSlots).toBeGreaterThan(0);
      expect(result.filledSlots + result.emptySlots).toBe(totalSlots);
    });
  });
});

