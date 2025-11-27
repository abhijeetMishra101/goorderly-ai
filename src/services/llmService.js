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

Is this an ANALYSIS REQUEST? If user asks to analyze their day (e.g., "perform analysis of my day", "analyze my day", "end of day analysis"), return JSON:
{"isAnalysisRequest":true,"action":"analyze"}

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
      
      // Handle analysis request
      if (parsed.isAnalysisRequest === true) {
        return {
          isAnalysisRequest: true,
          action: parsed.action || 'analyze',
          usedLLM: true
        };
      }
      
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

  /**
   * Analyze journal content and generate End of Day Analysis
   * @param {string} journalText - Full journal content for the day
   * @returns {Promise<Object>} Analysis result with insights
   */
  async analyzeJournalContent(journalText) {
    console.log(`[LLM Service] ===== analyzeJournalContent START =====`);
    console.log(`[LLM Service] Input journalText type: ${typeof journalText}`);
    console.log(`[LLM Service] Input journalText length: ${journalText ? journalText.length : 'null/undefined'}`);
    
    // Quick health check before making request
    console.log(`[LLM Service] Checking Ollama health...`);
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      throw new Error('LLM service unavailable - Ollama is not running or not accessible');
    }
    console.log(`[LLM Service] Ollama health check passed`);

    // If journal is very long, use chunking and summarization
    const CHUNK_SIZE = 1500; // Characters per chunk (reduced for faster processing)
    let processedJournalText = journalText;
    
    console.log(`[LLM Service] Journal text length: ${journalText.length} characters`);
    console.log(`[LLM Service] CHUNK_SIZE threshold: ${CHUNK_SIZE} characters`);
    console.log(`[LLM Service] Will chunk? ${journalText.length > CHUNK_SIZE ? 'YES' : 'NO'}`);
    
    if (journalText.length > CHUNK_SIZE) {
      console.log(`[LLM Service] ✓ Journal text is long (${journalText.length} chars > ${CHUNK_SIZE}), using chunking and summarization`);
      try {
        console.log(`[LLM Service] Calling _chunkAndSummarize...`);
        processedJournalText = await this._chunkAndSummarize(journalText, CHUNK_SIZE);
        console.log(`[LLM Service] ✓ Summarized journal to ${processedJournalText.length} characters`);
      } catch (error) {
        console.error(`[LLM Service] ✗ Chunking failed:`, error);
        console.error(`[LLM Service] Error stack:`, error.stack);
        console.error(`[LLM Service] Using fallback: last ${CHUNK_SIZE} chars`);
        // Fallback: use last chunk if chunking fails
        processedJournalText = '...' + journalText.slice(-CHUNK_SIZE);
      }
    } else {
      console.log(`[LLM Service] ✓ Journal is short enough (${journalText.length} chars <= ${CHUNK_SIZE}), processing directly`);
    }
    
    console.log(`[LLM Service] Final processedJournalText length: ${processedJournalText.length} characters`);

    // Filter out template/placeholder text to focus on actual journal entries
    const filteredText = this._filterTemplateText(processedJournalText);
    console.log(`[LLM Service] Filtered journal text length: ${filteredText.length} characters (removed ${processedJournalText.length - filteredText.length} chars of template)`);
    
    // If journal has very little actual content, return default analysis
    if (filteredText.trim().length < 100) {
      console.log(`[LLM Service] Journal has minimal content (${filteredText.length} chars), returning default analysis`);
      return {
        whatWentWell: 'Journal is mostly empty. Start logging your day to get personalized insights!',
        whatDidntGoWell: 'No entries to analyze yet.',
        productivityScore: 5,
        mentalPhysicalState: 'Unable to determine from available entries.',
        improvements: 'Add more journal entries throughout the day for better analysis.'
      };
    }
    
    const prompt = this._buildAnalysisPrompt(filteredText);
    console.log(`[LLM Service] Prompt length: ${prompt.length} characters`);
    
    try {
      console.log(`[LLM Service] Sending request to Ollama...`);
      console.log(`[LLM Service] Prompt preview (first 300 chars): ${prompt.substring(0, 300)}...`);
      const startTime = Date.now();
      const response = await axios.post(`${this.apiUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Very low temperature for faster, more focused responses
          top_p: 0.6,
          num_predict: 200 // Increased to ensure complete JSON response
        }
      }, {
        timeout: 300000 // 300 second (5 minute) timeout for analysis
      });
      const duration = Date.now() - startTime;
      console.log(`[LLM Service] ✓ Ollama response received in ${duration}ms`);
      console.log(`[LLM Service] Response preview (first 200 chars): ${response.data.response.substring(0, 200)}...`);

      const result = this._parseAnalysisResponse(response.data.response);
      return result;
    } catch (error) {
      const errorType = error.code === 'ECONNABORTED' ? 'timeout' : 
                       error.code === 'ECONNREFUSED' ? 'connection_refused' : 
                       'unknown';
      console.error(`[LLM Service] Analysis ${errorType} error:`, error.message);
      throw error;
    }
  }

  /**
   * Chunk journal text and summarize each chunk, then combine summaries
   * @param {string} journalText - Full journal text
   * @param {number} chunkSize - Size of each chunk in characters
   * @returns {Promise<string>} Combined summary of all chunks
   */
  async _chunkAndSummarize(journalText, chunkSize) {
    console.log(`[LLM Service] ===== _chunkAndSummarize START =====`);
    console.log(`[LLM Service] Input: ${journalText.length} chars, chunkSize: ${chunkSize}`);
    
    // Split journal into chunks (try to break at paragraph boundaries)
    const chunks = [];
    let currentChunk = '';
    
    // Split by double newlines (paragraphs) first
    const paragraphs = journalText.split(/\n\n+/);
    console.log(`[LLM Service] Split into ${paragraphs.length} paragraphs`);
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const wouldBeLength = (currentChunk ? currentChunk.length + 2 : 0) + paragraph.length;
      
      if (wouldBeLength <= chunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          console.log(`[LLM Service] Created chunk ${chunks.length}: ${currentChunk.length} chars`);
        }
        // If single paragraph is longer than chunk size, split it
        if (paragraph.length > chunkSize) {
          console.log(`[LLM Service] Paragraph ${i} is too long (${paragraph.length} chars), splitting by sentences`);
          // Split long paragraph by sentences
          const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
          let sentenceChunk = '';
          for (const sentence of sentences) {
            if ((sentenceChunk + sentence).length <= chunkSize) {
              sentenceChunk += sentence;
            } else {
              if (sentenceChunk) {
                chunks.push(sentenceChunk);
                console.log(`[LLM Service] Created chunk ${chunks.length} from sentences: ${sentenceChunk.length} chars`);
              }
              sentenceChunk = sentence;
            }
          }
          currentChunk = sentenceChunk;
        } else {
          currentChunk = paragraph;
        }
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk);
      console.log(`[LLM Service] Created final chunk ${chunks.length}: ${currentChunk.length} chars`);
    }
    
    console.log(`[LLM Service] ✓ Split journal into ${chunks.length} chunks total`);
    
    // Summarize each chunk (limit to max 10 chunks to prevent excessive processing)
    const MAX_CHUNKS = 10;
    const chunksToProcess = chunks.slice(0, MAX_CHUNKS);
    if (chunks.length > MAX_CHUNKS) {
      console.log(`[LLM Service] Limiting to first ${MAX_CHUNKS} chunks (out of ${chunks.length} total)`);
    }
    
    const summaries = [];
    for (let i = 0; i < chunksToProcess.length; i++) {
      try {
        console.log(`[LLM Service] Summarizing chunk ${i + 1}/${chunksToProcess.length} (${chunksToProcess[i].length} chars)...`);
        const summary = await this._summarizeChunk(chunksToProcess[i], i + 1, chunksToProcess.length);
        summaries.push(summary);
        console.log(`[LLM Service] Chunk ${i + 1} summarized to ${summary.length} chars`);
      } catch (error) {
        console.warn(`[LLM Service] Failed to summarize chunk ${i + 1}, using truncated version:`, error.message);
        // If summarization fails, use a truncated version of the chunk
        summaries.push(chunksToProcess[i].substring(0, 200) + '...');
      }
    }
    
    // Combine all summaries
    return summaries.join('\n\n');
  }

  /**
   * Summarize a single chunk of journal text
   * @param {string} chunk - Journal chunk to summarize
   * @param {number} chunkNum - Chunk number (for context)
   * @param {number} totalChunks - Total number of chunks
   * @returns {Promise<string>} Summary of the chunk
   */
  async _summarizeChunk(chunk, chunkNum, totalChunks) {
    const prompt = `Summarize journal section ${chunkNum}/${totalChunks}. Keep: activities, tasks, emotions, key events. Be brief:

${chunk}

Brief summary:`;

    try {
      const response = await axios.post(`${this.apiUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Very low for factual summarization
          top_p: 0.6,
          num_predict: 50 // Very short summaries (1-2 sentences)
        }
      }, {
        timeout: 20000 // 20 second timeout per chunk (faster)
      });

      return response.data.response.trim();
    } catch (error) {
      console.warn(`[LLM Service] Chunk ${chunkNum} summarization failed, using truncated chunk:`, error.message);
      // Fallback: return first 200 chars of chunk if summarization fails
      return chunk.substring(0, 200) + '...';
    }
  }

  /**
   * Filter out template text and placeholders from journal
   * @param {string} journalText - Raw journal text
   * @returns {string} Filtered text with only actual entries
   */
  _filterTemplateText(journalText) {
    // Remove common template sections
    const templatePatterns = [
      /🗓️ Daily Journal[^\n]*\n/g,
      /📋 To-Do List[^\n]*\n/g,
      /🧠 Notes \/ Quick Logs[^\n]*\n/g,
      /📝 Free-form Journal[^\n]*\n/g,
      /Write anything here[^\n]*\n/g,
      /Tag relevant people[^\n]*\n/g,
      /⏰ Hourly Plan[^\n]*\n/g,
      /Time Slot[^\n]*\n/g,
      /Task Description[^\n]*\n/g,
      /📊 End of Day Analysis[^\n]*\n/g,
      /🎯 What went well[^\n]*\n/g,
      /🚫 What didn't go well[^\n]*\n/g,
      /📈 Productivity Score[^\n]*\n/g,
      /🧠 Mental\/Physical State[^\n]*\n/g,
      /Example:[^\n]*\n/g,
      /🌱 What to improve tomorrow[^\n]*\n/g,
      /^-\s*$/gm, // Empty bullet points
      /^\s*$/gm, // Empty lines
    ];
    
    let filtered = journalText;
    for (const pattern of templatePatterns) {
      filtered = filtered.replace(pattern, '');
    }
    
    // Remove multiple consecutive newlines
    filtered = filtered.replace(/\n{3,}/g, '\n\n');
    
    return filtered.trim();
  }

  /**
   * Build prompt for journal analysis
   * @param {string} journalText - Journal content (may be summarized and filtered)
   * @returns {string} Formatted prompt
   */
  _buildAnalysisPrompt(journalText) {
    return `Analyze these journal entries and provide End of Day Analysis. Return ONLY a single JSON object (not an array):

${journalText}

Return this exact JSON structure (replace values):
{
  "whatWentWell": "2-3 brief things that went well (as a single string, not array)",
  "whatDidntGoWell": "2-3 brief challenges (as a single string, not array)",
  "productivityScore": 7,
  "mentalPhysicalState": "Brief description",
  "improvements": "2-3 brief suggestions (as a single string, not array)"
}

IMPORTANT: 
- Return ONLY the JSON object, no array, no extra text
- All text fields must be STRINGS, not arrays
- Productivity score: 1-10 integer
- Separate multiple items with periods, not arrays`;
  }

  /**
   * Parse LLM analysis response
   * @param {string} llmResponse - Raw LLM response
   * @returns {Object} Parsed analysis
   */
  _parseAnalysisResponse(llmResponse) {
    try {
      console.log(`[LLM Service] Parsing response, full length: ${llmResponse.length} chars`);
      
      // First, try to find a JSON object (not array)
      let jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      
      // If no complete object found, try to extract incomplete JSON and fix it
      if (!jsonMatch) {
        // Try to find start of JSON object
        const startMatch = llmResponse.match(/\{[\s\S]*/);
        if (startMatch) {
          console.warn(`[LLM Service] Incomplete JSON detected, attempting to fix...`);
          let incompleteJson = startMatch[0].trim();
          
          // Remove trailing comma if present
          incompleteJson = incompleteJson.replace(/,\s*$/, '');
          
          // Try to extract fields we can find
          const parsed = this._parseIncompleteJSON(incompleteJson);
          if (parsed) {
            return this._validateAnalysisFields(parsed);
          }
        }
        
        // If no object found, try to find array and convert first element
        const arrayMatch = llmResponse.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          console.warn(`[LLM Service] Response is an array, extracting first object`);
          const array = JSON.parse(arrayMatch[0]);
          if (Array.isArray(array) && array.length > 0 && typeof array[0] === 'object') {
            // Convert array of entries to analysis format
            return this._convertEntriesToAnalysis(array);
          }
        }
        throw new Error('No JSON object or array found in analysis response');
      }
      
      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        // JSON might be incomplete, try to fix it
        console.warn(`[LLM Service] JSON parse failed, attempting to fix incomplete JSON...`);
        parsed = this._parseIncompleteJSON(jsonMatch[0]);
        if (!parsed) {
          throw parseError;
        }
      }
      
      // Check if it's an array (shouldn't be, but handle it)
      if (Array.isArray(parsed)) {
        console.warn(`[LLM Service] Parsed JSON is an array, converting to analysis format`);
        return this._convertEntriesToAnalysis(parsed);
      }
      
      // Validate and set defaults
      return this._validateAnalysisFields(parsed);
    } catch (error) {
      console.error(`[LLM Service] JSON parsing error:`, error);
      console.error(`[LLM Service] Response that failed:`, llmResponse.substring(0, 500));
      throw new Error(`Failed to parse analysis response: ${error.message}`);
    }
  }

  /**
   * Parse incomplete JSON by extracting fields manually
   * @param {string} incompleteJson - Incomplete JSON string
   * @returns {Object|null} Parsed object or null if extraction fails
   */
  _parseIncompleteJSON(incompleteJson) {
    const result = {};
    
    // Extract whatWentWell
    const whatWentWellMatch = incompleteJson.match(/"whatWentWell"\s*:\s*"([^"]*)"/);
    if (whatWentWellMatch) {
      result.whatWentWell = whatWentWellMatch[1];
    }
    
    // Extract whatDidntGoWell
    const whatDidntGoWellMatch = incompleteJson.match(/"whatDidntGoWell"\s*:\s*"([^"]*)"/);
    if (whatDidntGoWellMatch) {
      result.whatDidntGoWell = whatDidntGoWellMatch[1];
    }
    
    // Extract productivityScore
    const productivityScoreMatch = incompleteJson.match(/"productivityScore"\s*:\s*(\d+)/);
    if (productivityScoreMatch) {
      result.productivityScore = parseInt(productivityScoreMatch[1]);
    }
    
    // Extract mentalPhysicalState
    const mentalPhysicalStateMatch = incompleteJson.match(/"mentalPhysicalState"\s*:\s*"([^"]*)"/);
    if (mentalPhysicalStateMatch) {
      result.mentalPhysicalState = mentalPhysicalStateMatch[1];
    }
    
    // Extract improvements
    const improvementsMatch = incompleteJson.match(/"improvements"\s*:\s*"([^"]*)"/);
    if (improvementsMatch) {
      result.improvements = improvementsMatch[1];
    }
    
    // Return null if we couldn't extract anything useful
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Validate and set defaults for analysis fields
   * @param {Object} parsed - Parsed analysis object
   * @returns {Object} Validated analysis object with defaults
   */
  _validateAnalysisFields(parsed) {
    // Convert arrays to strings if needed (LLM sometimes returns arrays)
    const whatWentWell = Array.isArray(parsed.whatWentWell) 
      ? parsed.whatWentWell.join('. ') 
      : (parsed.whatWentWell || 'No specific highlights captured today.');
    
    const whatDidntGoWell = Array.isArray(parsed.whatDidntGoWell)
      ? parsed.whatDidntGoWell.join('. ')
      : (parsed.whatDidntGoWell || 'No major challenges noted today.');
    
    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements.join('. ')
      : (parsed.improvements || 'Continue maintaining current routine.');
    
    return {
      whatWentWell,
      whatDidntGoWell,
      productivityScore: Math.max(1, Math.min(10, parseInt(parsed.productivityScore) || 5)),
      mentalPhysicalState: parsed.mentalPhysicalState || 'State not clearly indicated in entries.',
      improvements
    };
  }

  /**
   * Convert array of journal entries to analysis format (fallback)
   * @param {Array} entries - Array of entry objects
   * @returns {Object} Analysis object
   */
  _convertEntriesToAnalysis(entries) {
    // Extract insights from entries array
    const positiveEntries = entries.filter(e => e.mood === 'positive' || e.sentiment === 'positive');
    const negativeEntries = entries.filter(e => e.mood === 'negative' || e.sentiment === 'negative' || e.mood === 'lame');
    
    const whatWentWell = positiveEntries.length > 0 
      ? `Completed ${positiveEntries.length} positive activities/entries.`
      : 'No specific highlights captured today.';
    
    const whatDidntGoWell = negativeEntries.length > 0
      ? `Encountered ${negativeEntries.length} challenges or negative experiences.`
      : 'No major challenges noted today.';
    
    // Calculate productivity score based on entries
    const totalEntries = entries.length;
    const positiveRatio = positiveEntries.length / Math.max(totalEntries, 1);
    const productivityScore = Math.max(1, Math.min(10, Math.round(5 + (positiveRatio * 5))));
    
    return {
      whatWentWell,
      whatDidntGoWell,
      productivityScore,
      mentalPhysicalState: 'Mixed state based on entries.',
      improvements: 'Continue logging entries for better insights.'
    };
  }
}

module.exports = LLMService;

