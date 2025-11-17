// src/services/smartRouter.js

const LLMService = require('./llmService');

/**
 * Smart Router for voice entry processing
 * Routes simple entries to regex detection (fast, free)
 * Routes complex entries to LLM (slower, costs tokens)
 */
class SmartRouter {
  constructor(config = {}) {
    this.llmService = config.llmService || new LLMService({
      apiUrl: process.env.LLM_API_URL,
      model: process.env.LLM_MODEL || 'llama3.2:3b-instruct-q4_K_M'
    });
  }

  /**
   * Process voice entry with smart routing
   * @param {string} text - Voice entry text
   * @param {Object} context - Context (currentTime, lat, lng)
   * @returns {Promise<Object>} Extracted data
   */
  async processVoiceEntry(text, context = {}) {
    // Step 1: Try simple detection first (regex/rules)
    const simpleResult = this._trySimpleDetection(text, context.currentTime);

    // If confidence is high enough, use regex result (no LLM call)
    if (simpleResult.confidence >= 0.8) {
      return {
        ...simpleResult,
        usedLLM: false
      };
    }

    // For reminders detected by simple detection, skip LLM if we have basic info
    // This avoids slow LLM calls for simple "remind me tomorrow" cases
    if (simpleResult.isReminder && simpleResult.task && simpleResult.targetDate) {
      console.log('[SmartRouter] Reminder detected with basic info, skipping LLM for speed');
      return {
        ...simpleResult,
        usedLLM: false
      };
    }

    // Step 2: Use LLM for ambiguous/complex entries (with timeout)
    try {
      const llmResult = await Promise.race([
        this.llmService.extractVoiceEntry(text, context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('LLM timeout')), 28000) // 28s timeout (before 30s axios timeout)
        )
      ]);
      return {
        ...llmResult,
        usedLLM: true
      };
    } catch (error) {
      // Fallback to simple detection if LLM fails or times out
      console.warn('LLM extraction failed, using fallback:', error.message);
      return {
        ...simpleResult,
        usedLLM: false,
        error: error.message
      };
    }
  }

  /**
   * Try simple pattern detection using regex
   * @param {string} text - Entry text
   * @param {Date} currentTime - Current time
   * @returns {Object} Detection result
   */
  _trySimpleDetection(text, currentTime) {
    const lowerText = text.toLowerCase();

    // Check for reminder patterns first (low confidence - needs LLM for date parsing)
    // More flexible patterns to catch variations like "remind me to", "remind me tomorrow", etc.
    const reminderPatterns = [
      /remind me (tomorrow|next week|next month|on|to)/i,
      /set a reminder/i,
      /remind me to/i,
      /remind.*tomorrow/i,
      /remind.*next/i
    ];
    
    const isReminder = reminderPatterns.some(pattern => pattern.test(lowerText));
    
    // If it looks like a reminder, return low confidence to force LLM processing
    if (isReminder) {
      // Try to extract basic info for fallback if LLM fails
      const tomorrowMatch = lowerText.match(/tomorrow/i);
      const taskMatch = lowerText.match(/remind me (?:to )?(.+?)(?: tomorrow| next|$)/i);
      const task = taskMatch ? taskMatch[1].trim() : text.replace(/remind me (?:to )?/i, '').trim();
      
      // Calculate tomorrow's date for fallback
      const tomorrow = new Date(currentTime || new Date());
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];
      
      return {
        isReminder: true,
        confidence: 0.2, // Low confidence - force LLM for date parsing
        task: task, // Basic task extraction for fallback
        targetDate: tomorrowMatch ? tomorrowDate : null, // If "tomorrow" mentioned, use it as fallback
        action: text
      };
    }

    // Check for time references like "7 o'clock", "at 7", "7 AM", "7 PM", etc.
    const timeReference = this._detectTimeReference(text, currentTime || new Date());
    
    // Pattern matching for common contexts
    const patterns = {
      meeting: /meeting|conference|call|standup|sync/i,
      fitness: /gym|workout|exercise|run|jog|fitness|pushup|crunches/i,
      errand: /store|shop|grocery|repair|appointment|errand|pickup/i,
      meal: /lunch|dinner|breakfast|eat|meal|restaurant|food/i,
      work: /work|office|desk|coding|development|project/i,
      personal: /home|family|personal|relax|break/i
    };

    let detectedContext = null;
    let confidence = 0.3; // Low confidence default

    // Check for context patterns
    for (const [context, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerText)) {
        detectedContext = context;
        confidence = 0.9; // High confidence for pattern match
        break;
      }
    }

    // Use detected time reference if found, otherwise infer from current time
    const timeSlot = timeReference || this._inferTimeSlot(currentTime || new Date());
    const hasExplicitTime = !!timeReference; // Track if time was explicitly mentioned
    
    // If we detected a time reference, increase confidence
    if (timeReference) {
      confidence = Math.max(confidence, 0.7); // Medium-high confidence for time detection
    }

    return {
      isReminder: false,
      context: detectedContext,
      timeSlot,
      hasExplicitTime, // Flag to indicate if time was explicitly mentioned
      confidence,
      action: text
    };
  }

  /**
   * Detect time references in text and calculate next upcoming time slot
   * @param {string} text - Entry text
   * @param {Date} currentTime - Current time
   * @returns {string|null} Time slot string or null if no time reference found
   */
  _detectTimeReference(text, currentTime) {
    const lowerText = text.toLowerCase();
    let hour = null;
    let minute = 0;
    let ampm = null;
    
    // Try patterns in order of specificity (most specific first)
    // Pattern 1: "7:00", "7:00 AM" (most specific - has minutes)
    let match = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (match) {
      hour = parseInt(match[1], 10);
      minute = parseInt(match[2], 10);
      ampm = match[3] ? match[3].toUpperCase() : null;
    } else {
      // Pattern 2: "7 AM", "7 PM"
      match = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
      if (match) {
        hour = parseInt(match[1], 10);
        minute = 0;
        ampm = match[2].toUpperCase();
      } else {
        // Pattern 3: "at 7", "at 7 AM"
        match = text.match(/\bat\s+(\d{1,2})(?:\s*(am|pm))?/i);
        if (match) {
          hour = parseInt(match[1], 10);
          minute = 0;
          ampm = match[2] ? match[2].toUpperCase() : null;
        } else {
          // Pattern 4: "7 o'clock", "7 o clock"
          match = text.match(/(\d{1,2})\s*o['']?clock/i);
          if (match) {
            hour = parseInt(match[1], 10);
            minute = 0;
            ampm = null;
          }
        }
      }
    }
    
    // If we found a time reference, process it
    if (hour !== null) {
      // If no AM/PM specified, we need to infer it
      if (!ampm) {
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();
        const currentMinutes = currentHour * 60 + currentMinute;
        
        // Context clues
        const morningClues = /school|drop|pickup|morning|breakfast|early/i;
        const eveningClues = /dinner|evening|night|late/i;
        
        if (morningClues.test(lowerText)) {
          ampm = 'AM';
        } else if (eveningClues.test(lowerText)) {
          ampm = 'PM';
        } else {
          // Infer based on current time and the mentioned hour
          // If it's afternoon/evening and hour is 7-11, likely means PM
          // If it's morning and hour is 7-11, could be AM or PM depending on current time
          if (currentHour >= 12) {
            // It's afternoon/evening
            if (hour >= 7 && hour <= 11) {
              // If the time hasn't passed today, it's likely PM today
              const testHour24 = hour + 12;
              const testMinutes = testHour24 * 60 + minute;
              if (testMinutes > currentMinutes) {
                ampm = 'PM';
              } else {
                // Time has passed, likely means AM tomorrow
                ampm = 'AM';
              }
            } else {
              ampm = 'PM';
            }
          } else {
            // It's morning
            if (hour >= 7 && hour <= 11) {
              // If the time hasn't passed today, it's likely AM today
              const testMinutes = hour * 60 + minute;
              if (testMinutes > currentMinutes) {
                ampm = 'AM';
              } else {
                // Time has passed, likely means PM today or AM tomorrow
                // Default to PM today for now
                ampm = 'PM';
              }
            } else {
              ampm = 'AM';
            }
          }
        }
      }
      
      // Convert to 24-hour format for calculation
      let hour24 = hour;
      if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
      if (ampm === 'AM' && hour24 === 12) hour24 = 0;
      
      // Calculate time slot (round to nearest 30-minute slot)
      const slotStartMinute = minute < 30 ? 0 : 30;
      const slotEndMinute = slotStartMinute === 0 ? 30 : 0;
      const slotEndHour = slotStartMinute === 0 ? hour24 : (hour24 + 1) % 24;
      
      // Convert to 12-hour format
      const formatTime12 = (h, m) => {
        const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return `${h12}:${String(m).padStart(2, '0')}`;
      };
      
      const slotAMPM = slotEndHour >= 12 ? 'PM' : 'AM';
      return `${formatTime12(hour24, slotStartMinute)} - ${formatTime12(slotEndHour, slotEndMinute)} ${slotAMPM}`;
    }
    
    return null;
  }

  /**
   * Infer time slot from current time
   * @param {Date} currentTime - Current time
   * @returns {string} Time slot string in 12-hour format (e.g., "3:30 - 4:30 PM")
   */
  _inferTimeSlot(currentTime) {
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();

    // Round DOWN to nearest 30-minute slot (so 16:51 becomes 4:30-5:30 PM, not 5:30-6:00 PM)
    const slotStartMinute = minute < 30 ? 0 : 30;
    const slotStartHour = hour; // Always use current hour (round down)
    const slotEndMinute = slotStartMinute === 0 ? 30 : 0;
    const slotEndHour = slotStartMinute === 0 ? slotStartHour : (slotStartHour + 1) % 24;

    // Convert to 12-hour format with AM/PM (matches table format)
    const formatTime12 = (h, m) => {
      const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${h12}:${String(m).padStart(2, '0')}`;
    };

    const ampm = slotEndHour >= 12 ? 'PM' : 'AM';
    return `${formatTime12(slotStartHour, slotStartMinute)} - ${formatTime12(slotEndHour, slotEndMinute)} ${ampm}`;
  }
}

module.exports = SmartRouter;

