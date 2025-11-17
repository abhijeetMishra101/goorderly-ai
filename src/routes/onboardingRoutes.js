// src/routes/onboardingRoutes.js

const express = require('express');
const router = express.Router();
const onboardingService = require('../services/userOnboardingService');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/onboarding/status
 * Check onboarding status for current user
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await onboardingService.getOnboardingStatus(req.user.id);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/onboarding/select-template
 * Select a template (before confirmation)
 */
router.post('/select-template', authenticate, async (req, res) => {
  try {
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({
        error: 'Template ID is required'
      });
    }

    const userTemplate = await onboardingService.selectTemplate(
      req.user.id,
      templateId
    );

    res.json({
      success: true,
      message: 'Template selected successfully',
      data: {
        templateId: userTemplate.templateId,
        userId: userTemplate.userId
      }
    });
  } catch (error) {
    if (error.message === 'Template not found' || error.message === 'Template is not active') {
      return res.status(404).json({
        error: error.message
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/onboarding/confirm
 * Confirm template selection and save preferences
 */
router.post('/confirm', authenticate, async (req, res) => {
  try {
    const { templateId, preferences } = req.body;

    if (!templateId) {
      return res.status(400).json({
        error: 'Template ID is required'
      });
    }

    // Validate preferences
    const validatedPreferences = {
      journalFolderName: preferences?.journalFolderName || 'Daily Journals',
      journalTimeHour: preferences?.journalTimeHour || 6,
      journalTimeMinute: preferences?.journalTimeMinute || 0
    };

    // Validate time
    if (validatedPreferences.journalTimeHour < 0 || validatedPreferences.journalTimeHour > 23) {
      return res.status(400).json({
        error: 'Invalid journal time hour (0-23)'
      });
    }

    if (validatedPreferences.journalTimeMinute < 0 || validatedPreferences.journalTimeMinute > 59) {
      return res.status(400).json({
        error: 'Invalid journal time minute (0-59)'
      });
    }

    const userTemplate = await onboardingService.confirmTemplateSelection(
      req.user.id,
      templateId,
      validatedPreferences
    );

    res.json({
      success: true,
      message: 'Template selection confirmed and preferences saved',
      data: {
        templateId: userTemplate.templateId,
        journalFolderName: userTemplate.journalFolderName,
        journalTimeHour: userTemplate.journalTimeHour,
        journalTimeMinute: userTemplate.journalTimeMinute
      }
    });
  } catch (error) {
    console.error('Onboarding confirm error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message
      });
    }

    // Return more detailed error for debugging
    res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;

