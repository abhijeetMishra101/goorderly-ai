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
    // Lowered threshold from 0.8 to 0.5 to avoid LLM calls for more entries
    // This reduces timeout issues when LLM is slow or unavailable
    if (simpleResult.confidence >= 0.5) {
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
          setTimeout(() => reject(new Error('LLM timeout')), 6000) // 6s timeout for faster failure
        )
      ]);
      return {
        ...llmResult,
        usedLLM: true
      };
    } catch (error) {
      // Fallback to simple detection if LLM fails or times out
      const errorType = error.message.includes('timeout') ? 'timeout' : 
                       error.message.includes('unavailable') ? 'unavailable' : 'error';
      console.warn(`[SmartRouter] LLM extraction failed (${errorType}), using fallback:`, error.message);
      
      // If LLM is unavailable, log it but don't spam
      if (errorType === 'unavailable') {
        console.warn('[SmartRouter] LLM service appears to be down. Using simple detection for all entries.');
      }
      
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

    // Detect retrospective intent (describing something that already happened)
    const isRetrospective = this._detectRetrospectiveIntent(text);

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
    
    // Pattern matching for common contexts (expanded for better detection)
    const patterns = {
      meeting: /meeting|conference|call|standup|sync|zoom|teams|discuss|chat/i,
      fitness: /gym|workout|exercise|run|jog|fitness|pushup|crunches|yoga|meditation|walk/i,
      errand: /store|shop|grocery|repair|appointment|errand|pickup|delivery|pharmacy|bank/i,
      meal: /lunch|dinner|breakfast|eat|meal|restaurant|food|coffee|snack|drink/i,
      work: /work|office|desk|coding|development|project|task|deadline|meeting|email/i,
      personal: /home|family|personal|relax|break|rest|sleep|wake|shower|read/i,
      note: /note|reminder|remember|idea|thought|journal|log/i
    };

    let detectedContext = null;
    // Start with higher default confidence for generic entries to avoid LLM calls
    // Most entries are simple observations or tasks that don't need LLM processing
    let confidence = 0.6; // Medium confidence default (above 0.5 threshold)

    // Check for context patterns
    for (const [context, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerText)) {
        detectedContext = context;
        confidence = 0.9; // High confidence for pattern match
        break;
      }
    }
    
    // If we have both time reference and context, increase confidence even more
    if (timeReference && detectedContext) {
      confidence = 0.95; // Very high confidence
    }

    // Use detected time reference if found, otherwise infer from current time
    const timeSlot = timeReference || this._inferTimeSlot(currentTime || new Date());
    const hasExplicitTime = !!timeReference; // Track if time was explicitly mentioned
    
    // If we detected a time reference, increase confidence
    if (timeReference) {
      confidence = Math.max(confidence, 0.8); // High confidence for time detection
    }
    
    // For very short entries (likely simple observations), give higher confidence
    // This avoids LLM calls for simple phrases like "Testing changes again"
    if (text.trim().split(/\s+/).length <= 5 && !timeReference && !detectedContext) {
      confidence = 0.65; // Medium-high confidence for short generic entries
    }

    return {
      isReminder: false,
      context: detectedContext,
      timeSlot,
      hasExplicitTime, // Flag to indicate if time was explicitly mentioned
      isRetrospective,
      confidence,
      action: text
    };
  }

  /**
   * Detect if the entry is talking about something that already happened
   * (retrospective journaling) vs a future intent/reminder.
   * @param {string} text
   * @returns {boolean}
   */
  _detectRetrospectiveIntent(text) {
    const lower = text.toLowerCase();

    // Strong future markers – if these are present, don't treat as retrospective
    const futureMarkers = /\b(will|gonna|going to|later|tomorrow|next week|next month|next year)\b/;
    if (futureMarkers.test(lower)) {
      return false;
    }

    // Past-tense verbs / patterns that usually describe completed actions
    // Extended with common daily‑routine verbs like "dropped" so entries like
    // "Dropped Piku to school bus stop at 7 AM" are treated as retrospective.
    const pastVerbs = /\b(woke|was|were|did|went|had|ate|slept|finished|completed|started|stopped|met|called|talked|worked|wrote|read|ran|walked|dropped|picked up|picked|left|reached|arrived|drove|came|went out|got back|continued)\b/;

    // Explicit retrospective phrases
    const retrospectivePhrases = /\b(earlier today|this morning|this afternoon|this evening|a while ago|just now|previously|before now)\b/;

    return pastVerbs.test(lower) || retrospectivePhrases.test(lower);
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
  // Pattern 1.5: compact time like "730" or "0730" -> 7:30, "1130" -> 11:30
  match = text.match(/\b(\d{3,4})\b/);
  if (match) {
    const digits = match[1];
    let rawHour;
    let rawMinute;
    if (digits.length === 3) {
      rawHour = parseInt(digits.charAt(0), 10);
      rawMinute = parseInt(digits.slice(1), 10);
    } else {
      rawHour = parseInt(digits.slice(0, 2), 10);
      rawMinute = parseInt(digits.slice(2), 10);
    }
    if (rawHour >= 0 && rawHour <= 23 && rawMinute >= 0 && rawMinute < 60) {
      hour = rawHour;
      minute = rawMinute;
      ampm = null;
    }
  }

  if (hour === null) {
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
      
      // Calculate time slot (round to nearest hour slot for 1-hour slots)
      // Always use :00 for start and end minutes to match table format
      const slotStartMinute = 0;
      const slotEndMinute = 0;
      // End hour should always be start hour + 1 (or wrap to 0 if 24)
      const slotEndHour = (hour24 + 1) % 24;
      
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

    // Round DOWN to nearest hour (always create 1-hour slots to match template)
    // Template uses 1-hour slots like "5:00-6:00 PM", not 30-minute slots
    const slotStartMinute = 0; // Always start at :00
    const slotStartHour = hour; // Use current hour
    const slotEndMinute = 0; // Always end at :00
    const slotEndHour = (hour + 1) % 24; // Next hour (wraps at midnight)

    // Convert to 12-hour format with AM/PM (matches table format)
    const formatTime12 = (h, m) => {
      const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${h12}:${String(m).padStart(2, '0')}`;
    };

    // Determine AM/PM based on start hour (since both are in same period for 1-hour slots)
    const isPM = slotStartHour >= 12;
    const ampm = isPM ? 'PM' : 'AM';
    
    const startTime = formatTime12(slotStartHour, slotStartMinute);
    const endTime = formatTime12(slotEndHour, slotEndMinute);
    
    // Match template format exactly:
    // - AM slots: "5:00 - 6:00 AM" (with spaces around dash)
    // - PM slots: "5:00-6:00 PM" (no spaces around dash, except special cases)
    // - Special: "11:00AM - 12:00 PM" (no space before AM, space before PM)
    // - Special: "11:00 PM -12:00 AM" (space before PM, no space before AM)
    
    if (slotStartHour === 11 && slotEndHour === 12 && !isPM) {
      // "11:00AM - 12:00 PM"
      return `${startTime}AM - ${endTime} PM`;
    } else if (slotStartHour === 23 && slotEndHour === 0) {
      // "11:00 PM -12:00 AM"
      return `${startTime} PM -${endTime} AM`;
    } else if (isPM) {
      // PM slots: "5:00-6:00 PM" (no spaces around dash)
      return `${startTime}-${endTime} ${ampm}`;
    } else {
      // AM slots: "5:00 - 6:00 AM" (with spaces around dash)
      return `${startTime} - ${endTime} ${ampm}`;
    }
  }
}

module.exports = SmartRouter;

