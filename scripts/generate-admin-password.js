#!/usr/bin/env node

/**
 * Script to generate a bcrypt hash for the admin password.
 * 
 * Usage:
 *   node scripts/generate-admin-password.js <your-password>
 * 
 * Example:
 *   node scripts/generate-admin-password.js mySecurePassword123
 * 
 * Then add the output to your .env.local file:
 *   ADMIN_PASSWORD=<generated-hash>
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Error: Please provide a password as an argument');
  console.error('Usage: node scripts/generate-admin-password.js <your-password>');
  process.exit(1);
}

if (password.length < 8) {
  console.warn('Warning: Password is less than 8 characters. Consider using a stronger password.');
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  
  // Verify the hash works by comparing
  bcrypt.compare(password, hash, (compareErr, isValid) => {
    if (compareErr) {
      console.error('Error verifying hash:', compareErr);
      process.exit(1);
    }
    
    if (!isValid) {
      console.error('ERROR: Generated hash does not match password!');
      process.exit(1);
    }
    
    console.log('\n✓ Generated bcrypt hash (verified):');
    console.log(hash);
    console.log('\nOPTION 1 - Use SINGLE quotes in .env.local:');
    console.log(`ADMIN_PASSWORD='${hash}'`);
    console.log('\nOPTION 2 - Use base64 encoding (more reliable):');
    const base64Hash = Buffer.from(hash).toString('base64');
    console.log(`ADMIN_PASSWORD_B64=${base64Hash}`);
    console.log('(Then use ADMIN_PASSWORD_B64 instead of ADMIN_PASSWORD)');
    console.log('\nIMPORTANT: Use SINGLE quotes to protect $ characters!');
    console.log('Correct: ADMIN_PASSWORD=\'$2a$10$...\'');
    console.log('Wrong:   ADMIN_PASSWORD="$2a$10$..." (double quotes may expand $)');
    console.log('Wrong:   ADMIN_PASSWORD=$2a$10$... (no quotes - shell strips $2a)\n');
  });
});
