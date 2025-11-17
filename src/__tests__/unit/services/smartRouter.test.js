// src/__tests__/unit/services/smartRouter.test.js

const SmartRouter = require('../../../services/smartRouter');
const LLMService = require('../../../services/llmService');

jest.mock('../../../services/llmService');

describe('SmartRouter', () => {
  let router;
  let mockLLMService;

  beforeEach(() => {
    mockLLMService = {
      extractVoiceEntry: jest.fn()
    };
    LLMService.mockImplementation(() => mockLLMService);
    router = new SmartRouter();
  });

  describe('processVoiceEntry', () => {
    it('should use regex for simple patterns (no LLM call)', async () => {
      const result = await router.processVoiceEntry(
        'Meeting with team',
        { currentTime: new Date() }
      );

      expect(result.usedLLM).toBe(false);
      expect(result.context).toBe('meeting');
      expect(mockLLMService.extractVoiceEntry).not.toHaveBeenCalled();
    });

    it('should use LLM for ambiguous entries', async () => {
      mockLLMService.extractVoiceEntry.mockResolvedValue({
        timeSlot: '10:30-11:30',
        context: 'errand',
        usedLLM: true
      });

      const result = await router.processVoiceEntry(
        'I need to go somewhere but might stop at multiple places',
        { currentTime: new Date('2024-01-15T10:30:00') }
      );

      expect(result.usedLLM).toBe(true);
      expect(mockLLMService.extractVoiceEntry).toHaveBeenCalled();
    });

    it('should infer time slot from current time for simple entries', async () => {
      const currentTime = new Date('2024-01-15T10:30:00');
      const result = await router.processVoiceEntry(
        'Meeting with team',
        { currentTime }
      );

      expect(result.timeSlot).toBeDefined();
      expect(result.timeSlot).toMatch(/\d{2}:\d{2}-\d{2}:\d{2}/);
    });

    it('should return confidence score', async () => {
      const result = await router.processVoiceEntry(
        'Meeting with team',
        { currentTime: new Date() }
      );

      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should fallback to LLM if regex confidence is low', async () => {
      mockLLMService.extractVoiceEntry.mockResolvedValue({
        timeSlot: '14:00-15:00',
        context: 'work',
        usedLLM: true
      });

      const result = await router.processVoiceEntry(
        'Some completely random activity with no recognizable patterns',
        { currentTime: new Date('2024-01-15T14:00:00') }
      );

      expect(result.usedLLM).toBe(true);
      expect(mockLLMService.extractVoiceEntry).toHaveBeenCalled();
    });
  });

  describe('_trySimpleDetection', () => {
    it('should detect meeting patterns', () => {
      const result = router._trySimpleDetection('Meeting scheduled');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.context).toBe('meeting');
    });

    it('should detect fitness patterns', () => {
      const result = router._trySimpleDetection('Going to gym');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.context).toBe('fitness');
    });

    it('should detect errand patterns', () => {
      const result = router._trySimpleDetection('Grocery shopping');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.context).toBe('errand');
    });

    it('should return low confidence for ambiguous text', () => {
      const result = router._trySimpleDetection('Random activity');
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('_inferTimeSlot', () => {
    it('should infer time slot from current time', () => {
      const currentTime = new Date('2024-01-15T10:30:00');
      const slot = router._inferTimeSlot(currentTime);

      expect(slot).toMatch(/\d{2}:\d{2}-\d{2}:\d{2}/);
      expect(slot).toContain('10:30');
    });

    it('should handle time boundaries correctly', () => {
      const morning = new Date('2024-01-15T06:00:00');
      const night = new Date('2024-01-15T23:30:00');

      const morningSlot = router._inferTimeSlot(morning);
      const nightSlot = router._inferTimeSlot(night);

      expect(morningSlot).toBeDefined();
      expect(nightSlot).toBeDefined();
    });
  });
});

