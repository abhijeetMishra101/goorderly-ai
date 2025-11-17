// src/models/userTemplate.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/db');
const User = require('./user');
const Template = require('./template');

const UserTemplate = sequelize.define('UserTemplate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    },
    field: 'user_id'
  },
  templateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Template,
      key: 'id'
    },
    field: 'template_id'
  },
  isSelected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_selected'
  },
  journalFolderName: {
    type: DataTypes.STRING(255),
    defaultValue: 'Daily Journals',
    field: 'journal_folder_name'
  },
  journalTimeHour: {
    type: DataTypes.INTEGER,
    defaultValue: 6,
    field: 'journal_time_hour'
  },
  journalTimeMinute: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'journal_time_minute'
  },
  appsScriptId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'apps_script_id'
  },
  appsScriptWebappUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'apps_script_webapp_url'
  },
  appsScriptDeploymentId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'apps_script_deployment_id'
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
  tableName: 'user_templates',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'template_id']
    }
  ]
});

// Associations will be set up in models/index.js after all models are loaded

module.exports = UserTemplate;

