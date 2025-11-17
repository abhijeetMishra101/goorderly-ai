// src/models/userPlanTier.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/db');

const UserPlanTier = sequelize.define('UserPlanTier', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  dailyLlmLimit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'daily_llm_limit',
    comment: '-1 means unlimited'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  }
}, {
  tableName: 'user_plan_tiers',
  timestamps: true,
  underscored: true
});

module.exports = UserPlanTier;

