// src/database/init.js

const { sequelize } = require('./db');
const fs = require('fs');
const path = require('path');
const { seedTemplate } = require('./seeders/001_seed_template');

async function initializeDatabase() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Run migrations
    const migration1Path = path.join(__dirname, 'migrations', '001_create_tables.sql');
    const migration1SQL = fs.readFileSync(migration1Path, 'utf8');
    await sequelize.query(migration1SQL);
    console.log('✓ Migration 001: Initial tables created');

    // Run migration 002 if it exists
    const migration2Path = path.join(__dirname, 'migrations', '002_add_apps_script_fields.sql');
    if (fs.existsSync(migration2Path)) {
      const migration2SQL = fs.readFileSync(migration2Path, 'utf8');
      await sequelize.query(migration2SQL);
      console.log('✓ Migration 002: Apps Script fields added');
    }

    // Sync models (create tables if they don't exist)
    const { User, Template, UserTemplate, LLMUsageLog, UserPlanTier } = require('../models');
    await sequelize.sync({ alter: false });
    console.log('✓ Models synchronized');

    // Seed initial data
    await seedTemplate();
    console.log('✓ Initial template seeded');

    console.log('\n✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
