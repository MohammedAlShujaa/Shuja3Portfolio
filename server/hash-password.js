'use strict';

// Prints a bcrypt hash for a password, useful if you want to set the admin hash
// by hand instead of re-running the seed. Usage: npm run hash -- "your password"

const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash -- "your password"');
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 10));
