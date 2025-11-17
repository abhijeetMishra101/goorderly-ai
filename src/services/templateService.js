// src/services/templateService.js

const Template = require('../models/template');

class TemplateService {
  /**
   * Get all active templates
   * @returns {Promise<Array>} Array of templates
   */
  async getAllActiveTemplates() {
    try {
      const templates = await Template.findAll({
        where: { isActive: true },
        order: [['createdAt', 'DESC']]
      });
      return templates;
    } catch (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }
  }

  /**
   * Get template by ID
   * @param {number} templateId - Template ID
   * @returns {Promise<Object>} Template object
   */
  async getTemplateById(templateId) {
    try {
      const template = await Template.findByPk(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      if (!template.isActive) {
        throw new Error('Template is not active');
      }

      return template;
    } catch (error) {
      throw new Error(`Failed to fetch template: ${error.message}`);
    }
  }

  /**
   * Create a new template
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(templateData) {
    try {
      const { name, description, googleDocId, contentPreview } = templateData;

      if (!name || !googleDocId) {
        throw new Error('Name and Google Doc ID are required');
      }

      const template = await Template.create({
        name,
        description,
        googleDocId,
        contentPreview: contentPreview || '',
        isActive: true
      });

      return template;
    } catch (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Update template
   * @param {number} templateId - Template ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated template
   */
  async updateTemplate(templateId, updateData) {
    try {
      const template = await Template.findByPk(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      await template.update(updateData);
      return template;
    } catch (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }

  /**
   * Deactivate template
   * @param {number} templateId - Template ID
   * @returns {Promise<Object>} Updated template
   */
  async deactivateTemplate(templateId) {
    try {
      return await this.updateTemplate(templateId, { isActive: false });
    } catch (error) {
      throw new Error(`Failed to deactivate template: ${error.message}`);
    }
  }
}

module.exports = new TemplateService();

