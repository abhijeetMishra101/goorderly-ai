// tests/unit/utils/contextDetector.test.js

const { detectContext } = require('../../../src/utils/contextDetector');

describe('Context Detector', () => {
  describe('detectContext', () => {
    it('should detect meeting context', () => {
      expect(detectContext('I am going to a meeting')).toBe('meeting');
      expect(detectContext('Team meeting at 3pm')).toBe('meeting');
    });

    it('should detect fitness context', () => {
      expect(detectContext('Going to the gym')).toBe('fitness');
      expect(detectContext('Running in the park')).toBe('fitness');
      expect(detectContext('100 pushups done')).toBe('fitness');
    });

    it('should detect communication context', () => {
      expect(detectContext('Call with client')).toBe('communication');
      expect(detectContext('Talk to team')).toBe('communication');
      expect(detectContext('Chat with manager')).toBe('communication');
    });

    it('should detect errand context', () => {
      expect(detectContext('Car repair appointment')).toBe('errand');
      expect(detectContext('Shopping at mall')).toBe('errand');
      expect(detectContext('Drive to airport')).toBe('errand');
    });

    it('should return empty string for unknown context', () => {
      expect(detectContext('Random text')).toBe('');
      expect(detectContext('')).toBe('');
    });

    it('should be case insensitive', () => {
      expect(detectContext('MEETING')).toBe('meeting');
      expect(detectContext('Gym')).toBe('fitness');
    });
  });
});

