#!/usr/bin/env node

/**
 * Script to list all users in the database
 * 
 * Usage:
 *   node scripts/list-users.js
 */

const { sequelize } = require('../src/database/db');
const { User } = require('../src/models');

async function listUsers() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✓ Database connected\n');

    const users = await User.findAll({
      attributes: ['id', 'email', 'name', 'googleId'],
      order: [['id', 'ASC']]
    });

    if (users.length === 0) {
      console.log('No users found in database.');
      return;
    }

    console.log('Users in database:');
    console.log('─'.repeat(80));
    console.log('ID'.padEnd(5) + 'Email'.padEnd(40) + 'Name'.padEnd(30) + 'Google ID');
    console.log('─'.repeat(80));

    users.forEach(user => {
      const id = String(user.id).padEnd(5);
      const email = (user.email || '').padEnd(40);
      const name = (user.name || '').padEnd(30);
      const googleId = user.googleId || '';
      console.log(`${id}${email}${name}${googleId}`);
    });

    console.log('─'.repeat(80));
    console.log(`\nTotal: ${users.length} user(s)`);
    console.log('\nTo fix a template, use:');
    console.log('  node scripts/fix-template-hourly-table.js <email-or-id>');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

listUsers();


