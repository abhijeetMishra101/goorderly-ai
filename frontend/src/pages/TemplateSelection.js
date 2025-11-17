// frontend/src/pages/TemplateSelection.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TemplateCard from '../components/TemplateCard';
import api from '../services/api';
import './TemplateSelection.css';

const TemplateSelection = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.getTemplates();
      setTemplates(response.data || []);
    } catch (err) {
      setError('Failed to load templates. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
  };

  const handleContinue = async () => {
    if (!selectedTemplateId) {
      setError('Please select a template');
      return;
    }

    try {
      await api.selectTemplate(selectedTemplateId);
      navigate('/confirm', { state: { templateId: selectedTemplateId } });
    } catch (err) {
      setError('Failed to select template. Please try again.');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="template-selection-container">
        <div className="loading">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="template-selection-container">
      <div className="template-selection-card">
        <h1>Choose Your Journal Template</h1>
        <p className="subtitle">Select a template that works best for your journaling style</p>

        {error && <div className="error-message">{error}</div>}

        <div className="templates-grid">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedTemplateId === template.id}
              onSelect={handleSelectTemplate}
            />
          ))}
        </div>

        {templates.length === 0 && (
          <div className="no-templates">
            No templates available. Please contact support.
          </div>
        )}

        <div className="actions">
          <button
            className="continue-btn"
            onClick={handleContinue}
            disabled={!selectedTemplateId}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateSelection;

