// frontend/src/components/TemplateCard.js

import React from 'react';
import './TemplateCard.css';

const TemplateCard = ({ template, isSelected, onSelect }) => {
  return (
    <div 
      className={`template-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(template.id)}
    >
      <div className="template-header">
        <h3>{template.name}</h3>
        {isSelected && <span className="checkmark">✓</span>}
      </div>
      {template.description && (
        <p className="template-description">{template.description}</p>
      )}
      {template.contentPreview && (
        <div className="template-preview">
          {template.contentPreview.substring(0, 150)}...
        </div>
      )}
    </div>
  );
};

export default TemplateCard;

