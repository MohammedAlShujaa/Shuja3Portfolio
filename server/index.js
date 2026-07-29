'use strict';

// Local entry point. Vercel uses api/index.js instead.

const app = require('./app');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Portfolio running at http://localhost:${port}`);
  console.log(`Admin panel at       http://localhost:${port}/admin`);
});
