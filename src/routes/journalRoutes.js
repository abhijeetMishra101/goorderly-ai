// src/routes/journalRoutes.js

const express = require('express');
const router = express.Router();
const { getTodayYMD, isValidDateFormat } = require('../utils/dateUtils');

// Routes use journalService from req.journalService (set by middleware)
function createJournalRoutes() {
  // POST /api/journal/voice-entry
  router.post('/voice-entry', async (req, res) => {
    try {
      const journalService = req.journalService;
      const { text, lat, lng, context } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({
          error: 'Text is required'
        });
      }

      // Find today's journal
      const today = getTodayYMD();
      const journal = await journalService.findJournalByDate(today);

      if (!journal) {
        return res.status(404).json({
          error: 'No journal found for today'
        });
      }

      // Append voice entry
      const result = await journalService.appendVoiceEntry(journal.id, {
        text,
        timestamp: new Date(),
        lat,
        lng,
        context
      });

      // Check if this is an analysis request
      if (result.isAnalysisRequest) {
        return res.json({
          success: true,
          message: 'Day analysis completed successfully',
          isAnalysisRequest: true,
          analysis: result.analysis || null
        });
      }

      res.json({
        success: true,
        message: 'Voice entry logged successfully',
        context: result.context,
        isReminder: result.isReminder || false,
        timeSlot: result.timeSlot || null,
        targetDate: result.targetDate || null,
        targetTime: result.targetTime || null,
        convertedFromTimeSlot: result.convertedFromTimeSlot || false,
        mentionedPersons: result.mentionedPersons || [],
        sentiment: result.sentiment || 'neutral',
        inferredHashtags: result.inferredHashtags || [],
        actions: result.actions || [],
        journalEntry: result.journalEntry || null
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // POST /api/journal/create
  router.post('/create', async (req, res) => {
    try {
      const journalService = req.journalService;
      const { date } = req.body;

      if (date && !isValidDateFormat(date)) {
        return res.status(400).json({
          error: 'Invalid date format. Expected YYYY-MM-DD'
        });
      }

      const journal = await journalService.createDailyJournal(date, {
        createCalendarEvent: true
      });

      res.status(201).json(journal);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // POST /api/journal/update-template
  router.post('/update-template', async (req, res) => {
    try {
      const journalService = req.journalService;
      const GoogleDriveService = require('../services/googleDriveService');
      const driveService = new GoogleDriveService(req.user);
      
      // Get user's template document ID
      const userConfig = await journalService._getUserConfig();
      const templateDocId = userConfig.templateId;

      if (!templateDocId) {
        return res.status(404).json({
          error: 'Template document not found'
        });
      }

      // Templates are now created from a reference document and should not be
      // modified programmatically. The updateTemplateWithHourlyTable function
      // would corrupt the table structure.
      res.json({
        success: true,
        message: 'Template is managed from reference document and does not need updating',
        alreadyHasTable: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // GET /api/journal/:journalId/content (must come before /:date route)
  router.get('/:journalId/content', async (req, res) => {
    try {
      const journalService = req.journalService;
      const { journalId } = req.params;

      // Find today's journal to verify it exists and matches
      const today = getTodayYMD();
      const journal = await journalService.findJournalByDate(today);

      if (!journal || journal.id !== journalId) {
        return res.status(404).json({
          error: 'Journal not found'
        });
      }

      const content = await journalService.getJournalContent(journalId);
      res.setHeader('Content-Type', 'text/plain');
      res.send(content);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // POST /api/journal/:date/analyze
  router.post('/:date/analyze', async (req, res) => {
    try {
      const journalService = req.journalService;
      const { date } = req.params;

      if (!isValidDateFormat(date)) {
        return res.status(400).json({
          error: 'Invalid date format. Expected YYYY-MM-DD'
        });
      }

      // Find journal for the specified date
      const journal = await journalService.findJournalByDate(date);

      if (!journal) {
        return res.status(404).json({
          error: 'Journal not found for the specified date'
        });
      }

      // Fill End of Day Analysis
      const result = await journalService.fillEndOfDayAnalysis(journal.id, date);

      res.json({
        success: true,
        message: 'Day analysis completed successfully',
        analysis: result.analysis
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // GET /api/journal/:date
  router.get('/:date', async (req, res) => {
    try {
      const journalService = req.journalService;
      const { date } = req.params;

      if (!isValidDateFormat(date)) {
        return res.status(400).json({
          error: 'Invalid date format. Expected YYYY-MM-DD'
        });
      }

      const journal = await journalService.findJournalByDate(date);

      if (!journal) {
        return res.status(404).json({
          error: 'Journal not found'
        });
      }

      res.json(journal);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  return router;
}

module.exports = createJournalRoutes;

