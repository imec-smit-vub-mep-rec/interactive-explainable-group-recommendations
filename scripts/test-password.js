#!/usr/bin/env node

/**
 * Script to test if a password matches a bcrypt hash.
 * 
 * Usage:
 *   node scripts/test-password.js <password> <hash>
 * 
 * Example:
 *   node scripts/test-password.js mypassword $2a$10$...
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2];
const hash = process.argv[3];

if (!password || !hash) {
  console.error('Error: Please provide both password and hash');
  console.error('Usage: node scripts/test-password.js <password> <hash>');
  process.exit(1);
}

bcrypt.compare(password, hash, (err, isValid) => {
  if (err) {
    console.error('Error comparing:', err);
    process.exit(1);
  }
  
  if (isValid) {
    console.log('✓ Password matches hash!');
  } else {
    console.log('✗ Password does NOT match hash');
    console.log('\nTroubleshooting:');
    console.log('1. Make sure there are no quotes around the hash');
    console.log('2. Make sure there are no trailing spaces');
    console.log('3. Make sure you copied the entire hash');
    console.log('4. Try regenerating the hash with: pnpm run generate-admin-password <password>');
  }
});
