// src/__tests__/unit/services/llmService.test.js

const LLMService = require('../../../services/llmService');
const axios = require('axios');

jest.mock('axios');

describe('LLMService', () => {
  let service;

  beforeEach(() => {
    service = new LLMService({
      apiUrl: 'https://test.ngrok.io',
      model: 'llama3.2:8b'
    });
  });

  describe('extractVoiceEntry', () => {
    it('should extract structured data from simple voice entry', async () => {
      const mockResponse = {
        data: {
          response: '{\n  "timeSlot": "10:30-11:30",\n  "context": "errand",\n  "location": "grocery store",\n  "action": "going to grocery store"\n}'
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await service.extractVoiceEntry(
        'I am going to grocery store',
        { currentTime: new Date('2024-01-15T10:30:00') }
      );

      expect(result).toHaveProperty('timeSlot', '10:30-11:30');
      expect(result).toHaveProperty('context', 'errand');
      expect(result).toHaveProperty('location', 'grocery store');
      expect(result).toHaveProperty('usedLLM', true);
      expect(axios.post).toHaveBeenCalled();
    });

    it('should build prompt with current time context', async () => {
      axios.post.mockResolvedValue({
        data: { response: '{}' }
      });

      const currentTime = new Date('2024-01-15T14:30:00');
      await service.extractVoiceEntry('test entry', { currentTime });

      const callArgs = axios.post.mock.calls[0];
      const prompt = callArgs[1].prompt;

      expect(prompt).toContain('Current time: 14:30');
      expect(prompt).toContain('test entry');
    });

    it('should parse JSON response correctly', async () => {
      const mockResponse = {
        data: {
          response: 'Here is the extracted data:\n{\n  "timeSlot": "15:00-16:00",\n  "context": "meeting"\n}'
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await service.extractVoiceEntry('Meeting with team at 3pm');

      expect(result.timeSlot).toBe('15:00-16:00');
      expect(result.context).toBe('meeting');
    });

    it('should fallback to simple detection if LLM fails', async () => {
      axios.post.mockRejectedValue(new Error('LLM API error'));

      const result = await service.extractVoiceEntry('Meeting with team');

      expect(result.usedLLM).toBe(false);
      expect(result.context).toBe('meeting'); // Fallback regex should catch this
    });

    it('should handle invalid JSON response gracefully', async () => {
      const mockResponse = {
        data: {
          response: 'This is not valid JSON'
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await service.extractVoiceEntry('test entry');

      expect(result.usedLLM).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('_buildPrompt', () => {
    it('should build prompt with entry text and context', () => {
      const context = {
        currentTime: new Date('2024-01-15T10:30:00'),
        lat: 40.7128,
        lng: -74.0060
      };

      const prompt = service._buildPrompt('I am going to grocery store', context);

      expect(prompt).toContain('I am going to grocery store');
      expect(prompt).toContain('Current time: 10:30');
      expect(prompt).toContain('Extract:');
      expect(prompt).toContain('JSON');
    });
  });

  describe('_parseResponse', () => {
    it('should extract JSON from LLM response', () => {
      const response = 'Here is the data:\n{\n  "timeSlot": "10:30-11:30",\n  "context": "errand"\n}';

      const result = service._parseResponse(response);

      expect(result.timeSlot).toBe('10:30-11:30');
      expect(result.context).toBe('errand');
    });

    it('should use fallback detection if no JSON found', () => {
      const response = 'I cannot extract this information';

      const result = service._parseResponse(response);

      expect(result.usedLLM).toBe(false);
      expect(result).toHaveProperty('action');
    });

    it('should handle regex fallback for simple patterns', () => {
      const response = 'Meeting scheduled';

      const result = service._parseResponse(response);

      // Should use fallback regex detection
      expect(result.context).toBe('meeting');
    });
  });

  describe('_fallbackContextDetection', () => {
    it('should detect meeting context', () => {
      const result = service._fallbackContextDetection('Meeting with team');
      expect(result).toBe('meeting');
    });

    it('should detect fitness context', () => {
      const result = service._fallbackContextDetection('Going to the gym');
      expect(result).toBe('fitness');
    });

    it('should detect errand context', () => {
      const result = service._fallbackContextDetection('Going to grocery store');
      expect(result).toBe('errand');
    });

    it('should return null for unknown context', () => {
      const result = service._fallbackContextDetection('Random text');
      expect(result).toBeNull();
    });
  });
});

