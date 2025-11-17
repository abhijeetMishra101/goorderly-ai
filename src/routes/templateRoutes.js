// src/routes/templateRoutes.js

const express = require('express');
const router = express.Router();
const templateService = require('../services/templateService');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

/**
 * GET /api/templates
 * List all active templates
 */
router.get('/', optionalAuthenticate, async (req, res) => {
  try {
    const templates = await templateService.getAllActiveTemplates();
    
    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/templates/:id
 * Get template by ID
 */
router.get('/:id', optionalAuthenticate, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    
    if (isNaN(templateId)) {
      return res.status(400).json({
        error: 'Invalid template ID'
      });
    }

    const template = await templateService.getTemplateById(templateId);
    
    res.json({
      success: true,
      data: template
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
 * POST /api/templates
 * Create new template (admin only - for future use)
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, googleDocId, contentPreview } = req.body;

    if (!name || !googleDocId) {
      return res.status(400).json({
        error: 'Name and Google Doc ID are required'
      });
    }

    const template = await templateService.createTemplate({
      name,
      description,
      googleDocId,
      contentPreview
    });

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;

