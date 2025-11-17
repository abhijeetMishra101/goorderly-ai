// src/models/user.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/db');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  googleId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    field: 'google_id'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  pictureUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'picture_url'
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'refresh_token',
    get() {
      const encrypted = this.getDataValue('refreshToken');
      return encrypted ? decrypt(encrypted) : null;
    },
    set(value) {
      this.setDataValue('refreshToken', value ? encrypt(value) : null);
    }
  },
  planTier: {
    type: DataTypes.STRING(50),
    defaultValue: 'free',
    field: 'plan_tier'
  },
  llmUsageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'llm_usage_count'
  },
  usageResetDate: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
    field: 'usage_reset_date'
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
  tableName: 'users',
  timestamps: true,
  underscored: true
});

module.exports = User;

