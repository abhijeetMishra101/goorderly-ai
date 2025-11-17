// frontend/src/pages/Confirmation.js

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import './Confirmation.css';

const Confirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const templateId = location.state?.templateId;

  const [template, setTemplate] = useState(null);
  const [preferences, setPreferences] = useState({
    journalFolderName: 'Daily Journals',
    journalTimeHour: 6,
    journalTimeMinute: 0
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!templateId) {
      navigate('/templates');
      return;
    }
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      const response = await api.getTemplate(templateId);
      setTemplate(response.data);
    } catch (err) {
      setError('Failed to load template details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError(null);

      await api.confirmOnboarding(templateId, preferences);

      // Redirect to dashboard or success page
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err.message || err.error || 'Failed to confirm. Please try again.';
      setError(errorMessage);
      console.error('Confirmation error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="confirmation-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="confirmation-container">
      <div className="confirmation-card">
        <h1>Confirm Your Setup</h1>
        <p className="subtitle">Review your selection and customize your preferences</p>

        {template && (
          <div className="template-summary">
            <h2>Selected Template</h2>
            <div className="template-info">
              <h3>{template.name}</h3>
              {template.description && <p>{template.description}</p>}
            </div>
          </div>
        )}

        <div className="preferences-section">
          <h2>Journal Preferences</h2>

          <div className="preference-field">
            <label htmlFor="folderName">Folder Name</label>
            <input
              id="folderName"
              type="text"
              value={preferences.journalFolderName}
              onChange={(e) => setPreferences({
                ...preferences,
                journalFolderName: e.target.value
              })}
              placeholder="Daily Journals"
            />
          </div>

          <div className="preference-field">
            <label htmlFor="journalTime">Daily Journal Creation Time</label>
            <div className="time-inputs">
              <input
                id="journalTimeHour"
                type="number"
                min="0"
                max="23"
                value={preferences.journalTimeHour}
                onChange={(e) => setPreferences({
                  ...preferences,
                  journalTimeHour: parseInt(e.target.value) || 0
                })}
              />
              <span>:</span>
              <input
                id="journalTimeMinute"
                type="number"
                min="0"
                max="59"
                value={preferences.journalTimeMinute}
                onChange={(e) => setPreferences({
                  ...preferences,
                  journalTimeMinute: parseInt(e.target.value) || 0
                })}
              />
            </div>
            <p className="help-text">Journals will be created automatically at this time</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="actions">
          <button
            className="back-btn"
            onClick={() => navigate('/templates')}
            disabled={submitting}
          >
            Back
          </button>
          <button
            className="confirm-btn"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Confirming...' : 'Confirm & Start'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Confirmation;

