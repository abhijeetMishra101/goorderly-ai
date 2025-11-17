// src/models/template.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/db');

const Template = sequelize.define('Template', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  googleDocId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'google_doc_id'
  },
  contentPreview: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'content_preview'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'templates',
  timestamps: true,
  underscored: true
});

module.exports = Template;

