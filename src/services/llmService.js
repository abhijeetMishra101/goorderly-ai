// src/services/llmService.js

const axios = require('axios');

/**
 * LLM Service for intelligent voice entry processing
 * Integrates with self-hosted Ollama (M1 Mac via ngrok)
 */
class LLMService {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.LLM_API_URL || 'http://localhost:11434';
    this.model = config.model || process.env.LLM_MODEL || 'llama3.2:3b-instruct-q4_K_M';
    this._healthCheckCache = null; // Cache health check result for 30 seconds
    this._healthCheckTime = 0;
  }

  /**
   * Check if Ollama is running and accessible
   * @returns {Promise<boolean>} True if Ollama is available
   */
  async checkHealth() {
    // Cache health check for 30 seconds to avoid too many requests
    const now = Date.now();
    if (this._healthCheckCache !== null && (now - this._healthCheckTime) < 30000) {
      return this._healthCheckCache;
    }

    try {
      const response = await axios.get(`${this.apiUrl}/api/tags`, {
        timeout: 2000 // Quick 2s check
      });
      this._healthCheckCache = response.status === 200;
      this._healthCheckTime = now;
      return this._healthCheckCache;
    } catch (error) {
      this._healthCheckCache = false;
      this._healthCheckTime = now;
      return false;
    }
  }

  /**
   * Extract structured data from voice entry
   * @param {string} text - Voice entry text
   * @param {Object} context - Current time, location, etc.
   * @returns {Promise<Object>} Structured extraction
   */
  async extractVoiceEntry(text, context = {}) {
    // Quick health check before making request
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      throw new Error('LLM service unavailable - Ollama is not running or not accessible');
    }

    const prompt = this._buildPrompt(text, context);
    
    try {
      const response = await axios.post(`${this.apiUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower = more deterministic
          top_p: 0.9,
          num_predict: 40 // Further reduced from 55 for faster inference
        }
      }, {
        timeout: 7000 // 7 second timeout for faster failure and fallback
      });

      const result = this._parseResponse(response.data.response);
      
      // Post-process to ensure time slots are intelligently calculated
      if (result.timeSlot && !result.isReminder) {
        result.timeSlot = this._adjustTimeSlotForNextOccurrence(
          result.timeSlot, 
          text, 
          context.currentTime || new Date()
        );
      }
      
      return result;
    } catch (error) {
      const errorType = error.code === 'ECONNABORTED' ? 'timeout' : 
                       error.code === 'ECONNREFUSED' ? 'connection_refused' : 
                       'unknown';
      console.error(`[LLM Service] ${errorType} error:`, error.message);
      if (errorType === 'timeout') {
        console.warn('[LLM Service] Request timed out after 7s, falling back to simple detection');
      }
      // Throw error so SmartRouter can use its fallback
      throw error;
    }
  }

  /**
   * Build prompt for LLM
   * @param {string} text - Entry text
   * @param {Object} context - Context information
   * @returns {string} Formatted prompt
   */
  _buildPrompt(text, context) {
    const currentTime = context.currentTime || new Date();
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const currentDate = currentTime.toISOString().split('T')[0];
    
    // Calculate tomorrow's date
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    // Format current time in 12-hour format for context
    const currentHour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    const currentAMPM = hour >= 12 ? 'PM' : 'AM';
    const currentTime12 = `${currentHour12}:${String(minute).padStart(2, '0')} ${currentAMPM}`;

    return `Parse: "${text}"

Current Time: ${currentTime12} (${timeStr} 24-hour), Date: ${currentDate}, Tomorrow: ${tomorrowDate}

Template structure:
- ⏰ Hourly Plan (time slots: 12:00-1:00 AM, 1:00-2:00 AM, ..., 11:00 PM-12:00 AM)
- 📋 To-Do List (for tasks with #office #personal #health tags)
- 🧠 Notes / Quick Logs (for quick notes)
- 📝 Free-form Journal (for longer entries with #hashtags, person mentions, observations, rants)

PERSON MENTION DETECTION:
- Detect if the entry mentions people (names like "Sumit", "Rohit", "John", etc.)
- Infer sentiment: positive, negative, or neutral
- Infer context: observation, rant, task, meeting, etc.
- If person is mentioned, create a journal entry with hashtags: #PersonName #date #sentiment #context

INFERRED HASHTAGS (IMPORTANT - Always infer relevant hashtags):
- Infer relevant context hashtags based on entry content and meaning
- Examples of hashtags to infer:
  * Optimism/Hope: "will work", "going to", "hope", "excited", "confident", "believe" → #optimism
  * Achievement: "completed", "finished", "done", "accomplished", "achieved" → #achievement
  * Planning: "plan", "schedule", "organize", "preparing" → #planning
  * Reflection: "think", "realize", "understand", "insight", "reflecting" → #reflection
  * Observation: "noticed", "saw", "observed", "seeing" → #observation
  * Rant/Venting: "hate", "annoying", "frustrating", "can't stand" → #rant
  * Gratitude: "thankful", "grateful", "appreciate", "thanks" → #gratitude
  * Motivation: "motivated", "inspired", "determined", "focused" → #motivation
  * Stress: "stressed", "overwhelmed", "pressure", "too much" → #stress
  * Learning: "study", "learn", "reading", "research", "practicing" → #learning
  * Relaxation: "weekend", "relax", "rest", "break", "vacation" → #relaxation
  * Work: "work", "productive", "focus", "deep work" → #work
  * Health: "exercise", "gym", "workout", "health", "fitness" → #health
  * Social: "friend", "family", "meeting", "party", "social" → #social
  * Creative: "creative", "art", "design", "writing", "music" → #creative
- Add multiple hashtags if entry contains multiple contexts or themes
- Be creative and infer hashtags that capture the essence, mood, or theme of the entry
- Don't just match keywords - understand the meaning and infer appropriate hashtags

MULTIPLE ACTIONS:
- An entry can require multiple actions (e.g., both timeSlot AND journal)
- Example: "Rohit has scheduled a call for 11:30PM today" → timeSlot: "11:00 PM-12:00 AM" AND journal entry about Rohit
- Use "actions" array: ["timeSlot", "journal"] or ["reminder", "journal"] or ["timeSlot"] or ["journal"]

IMPORTANT - Time Reference Intelligence:
- If user mentions a time like "7 o'clock", "7 AM", "7 PM", "at 3", etc., determine the NEXT UPCOMING occurrence:
  * If current time is before the mentioned time today → schedule for today
  * If current time is after the mentioned time today → schedule for the next occurrence (could be tomorrow if it's AM/PM specific)
  * For times without AM/PM (e.g., "7 o'clock"): choose the next logical occurrence:
    - If it's morning/early day (before 2 PM) → likely means PM today
    - If it's late afternoon/evening (after 2 PM) → if time has passed today, likely means AM tomorrow; if not passed, could be PM today
    - Use context clues (e.g., "drop to school" suggests morning/AM, "dinner" suggests evening/PM)

Is this a REMINDER? If yes, return JSON:
{"isReminder":true,"task":"...","targetDate":"YYYY-MM-DD","targetTime":"HH:MM","mentionedPersons":[],"sentiment":"neutral","inferredHashtags":[],"actions":["reminder"]}

If no, determine where to place entry:
- For time-specific activities: use "timeSlot" (e.g., "7:00-8:00 AM", "7:00-8:00 PM", "2:00-3:00 PM")
  * ALWAYS include AM/PM in timeSlot
  * Calculate the NEXT UPCOMING time slot based on current time
- For tasks: use "context" with tags (#office, #personal, #health)
- For quick notes: use "context":"note"
- For journal entries: use "context":"journal" and include #hashtags in "action"

Return JSON with ALL fields:
{
  "isReminder":false,
  "timeSlot":"...",
  "context":"...",
  "location":"...",
  "action":"...",
  "mentionedPersons":["PersonName1","PersonName2"],
  "sentiment":"positive|negative|neutral",
  "inferredHashtags":["#hashtag1","#hashtag2"],
  "actions":["timeSlot","journal"],
  "journalEntry":"Formatted text for free-form journal with hashtags (if applicable)"
}

Fields:
- mentionedPersons: array of person names detected (empty array if none)
- sentiment: "positive", "negative", or "neutral"
- inferredHashtags: array of context hashtags (e.g., ["#observation", "#rant", "#meeting"])
- actions: array of actions to take (e.g., ["timeSlot", "journal"] or ["reminder", "journal"] or ["timeSlot"] or ["journal"])
- journalEntry: formatted text for free-form journal (only if actions includes "journal")

JSON only:`;
  }

  /**
   * Parse LLM response and extract JSON
   * @param {string} llmResponse - Raw LLM response
   * @returns {Object} Parsed data
   */
  _parseResponse(llmResponse) {
    try {
      // Extract JSON from response (might have extra text)
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Handle reminder entries
      if (parsed.isReminder === true) {
        return {
          isReminder: true,
          task: parsed.task || '',
          targetDate: parsed.targetDate || null,
          targetTime: parsed.targetTime || null,
          timeSlot: parsed.timeSlot || null,
          context: parsed.context || null,
          mentionedPersons: parsed.mentionedPersons || [],
          sentiment: parsed.sentiment || 'neutral',
          inferredHashtags: parsed.inferredHashtags || [],
          actions: parsed.actions || ['reminder'],
          journalEntry: parsed.journalEntry || null,
          usedLLM: true
        };
      }
      
      // Handle regular entries
      // Check if timeSlot was provided (indicates explicit time mention)
      const hasExplicitTime = !!(parsed.timeSlot && parsed.timeSlot.trim());
      
      return {
        isReminder: false,
        timeSlot: parsed.timeSlot || null,
        hasExplicitTime, // Flag to indicate if time was explicitly mentioned
        context: parsed.context || null,
        location: parsed.location || null,
        action: parsed.action || '',
        mentionedPersons: parsed.mentionedPersons || [],
        sentiment: parsed.sentiment || 'neutral',
        inferredHashtags: parsed.inferredHashtags || [],
        actions: parsed.actions || (parsed.timeSlot ? ['timeSlot'] : ['journal']),
        journalEntry: parsed.journalEntry || null,
        usedLLM: true
      };
    } catch (error) {
      // Throw error so SmartRouter can use its fallback
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  /**
   * Adjust time slot to ensure it represents the next upcoming occurrence
   * @param {string} timeSlot - Time slot string (e.g., "7:00-8:00 AM")
   * @param {string} text - Original text for context clues
   * @param {Date} currentTime - Current time
   * @returns {string} Adjusted time slot
   */
  _adjustTimeSlotForNextOccurrence(timeSlot, text, currentTime) {
    if (!timeSlot) return timeSlot;
    
    // Parse the time slot to extract hour
    const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) return timeSlot; // Can't parse, return as-is
    
    const startHour = parseInt(timeMatch[1], 10);
    const startMinute = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[5].toUpperCase();
    
    // Convert to 24-hour format
    let hour24 = startHour;
    if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
    if (ampm === 'AM' && hour24 === 12) hour24 = 0;
    
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;
    const slotMinutes = hour24 * 60 + startMinute;
    
    // Check if the time slot is in the past today
    const isPastToday = slotMinutes < currentMinutes;
    
    const lowerText = text.toLowerCase();
    
    // Context clues for morning activities (strong indicators)
    const morningClues = /school|drop.*school|pickup.*school|morning|breakfast|early|am\b/i;
    // Context clues for evening activities (strong indicators)
    const eveningClues = /dinner|evening|night|late|pm\b/i;
    
    // If time is in the past, we need to adjust
    if (isPastToday) {
      // Strong morning context but scheduled for PM -> switch to AM (next day)
      if (morningClues.test(lowerText) && ampm === 'PM') {
        return timeSlot.replace('PM', 'AM');
      }
      
      // Strong evening context but scheduled for AM -> switch to PM (next day)
      if (eveningClues.test(lowerText) && ampm === 'AM' && startHour < 12) {
        return timeSlot.replace('AM', 'PM');
      }
      
      // For times like 7, 8, 9 o'clock that are in the past:
      // - If it's currently afternoon/evening (after 2 PM) and we have 7-11 PM, it's likely meant for next morning
      // - If it's currently morning and we have 7-11 AM, it's likely meant for next morning (already passed)
      if (startHour >= 7 && startHour <= 11) {
        if (ampm === 'PM' && currentHour >= 14) {
          // It's afternoon/evening, 7-11 PM has passed, likely meant for next morning
          return timeSlot.replace('PM', 'AM');
        }
        if (ampm === 'AM' && currentHour >= 7) {
          // It's morning, 7-11 AM has passed, likely meant for next morning (keep as AM)
          // But if we're in the evening, it might have been meant for PM today
          if (currentHour >= 18) {
            return timeSlot.replace('AM', 'PM');
          }
        }
      }
    } else {
      // Time is in the future today, but check if context suggests it should be different
      // If user says "7 o'clock" and it's morning, they might mean 7 PM today, not 7 AM
      if (startHour >= 7 && startHour <= 11) {
        // If it's early morning (before 7 AM) and we scheduled 7-11 AM, that's correct
        // But if user says "7 o'clock" with evening context, they might mean PM
        if (eveningClues.test(lowerText) && ampm === 'AM' && currentHour < 7) {
          return timeSlot.replace('AM', 'PM');
        }
        
        // If it's afternoon and user says "7 o'clock" without context, they likely mean 7 PM
        if (currentHour >= 12 && currentHour < 19 && ampm === 'AM' && !morningClues.test(lowerText)) {
          return timeSlot.replace('AM', 'PM');
        }
      }
    }
    
    return timeSlot;
  }

  /**
   * Fallback context detection using regex
   * @param {string} text - Text to analyze
   * @returns {string|null} Detected context
   */
  _fallbackContextDetection(text) {
    const lowerText = text.toLowerCase();

    if (/meeting|conference|call/i.test(lowerText)) return 'meeting';
    if (/gym|workout|exercise|run/i.test(lowerText)) return 'fitness';
    if (/store|shop|grocery|errand/i.test(lowerText)) return 'errand';
    if (/lunch|dinner|breakfast|eat/i.test(lowerText)) return 'meal';
    if (/work|office|desk/i.test(lowerText)) return 'work';
    if (/home|family|personal/i.test(lowerText)) return 'personal';

    return null;
  }
}

module.exports = LLMService;

