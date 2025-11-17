// src/models/index.js

const User = require('./user');
const Template = require('./template');
const UserTemplate = require('./userTemplate');
const LLMUsageLog = require('./llmUsageLog');
const UserPlanTier = require('./userPlanTier');

// Set up associations after all models are loaded
User.belongsToMany(Template, {
  through: UserTemplate,
  foreignKey: 'user_id',
  otherKey: 'template_id',
  as: 'Templates'
});

Template.belongsToMany(User, {
  through: UserTemplate,
  foreignKey: 'template_id',
  otherKey: 'user_id',
  as: 'Users'
});

UserTemplate.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
UserTemplate.belongsTo(Template, { foreignKey: 'template_id', as: 'Template' });

User.hasMany(LLMUsageLog, { foreignKey: 'user_id', as: 'LLMUsageLogs' });
LLMUsageLog.belongsTo(User, { foreignKey: 'user_id', as: 'Owner' });

module.exports = {
  User,
  Template,
  UserTemplate,
  LLMUsageLog,
  UserPlanTier
};

