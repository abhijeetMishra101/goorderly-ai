// src/models/llmUsageLog.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/db');
const User = require('./user');

const LLMUsageLog = sequelize.define('LLMUsageLog', {
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
  entryText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'entry_text'
  },
  usedLLM: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'used_llm'
  },
  llmProvider: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'llm_provider'
  },
  tokensUsed: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'tokens_used'
  },
  costCents: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
    field: 'cost_cents'
  },
  responseTimeMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'response_time_ms'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  }
}, {
  tableName: 'llm_usage_logs',
  timestamps: true,
  underscored: true,
  updatedAt: false // Only created_at, no updated_at
});

LLMUsageLog.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

module.exports = LLMUsageLog;

