'use strict';

/**
 * Copies the Lenis smooth-scroll files from node_modules into
 * public/vendor/lenis/<version>/, so the browser loads them from this site
 * (the Content Security Policy only allows scripts from 'self').
 *
 * The folder name carries the version, so the files can be cached forever:
 * upgrading Lenis produces a new path instead of changing an existing file.
 *
 * Run with: npm run vendor:lenis
 * After upgrading, update the <script> and <link> paths in the HTML pages.
 */

const fs = require('fs');
const path = require('path');

const FILES = ['lenis.min.js', 'lenis.css'];

const pkgDir = path.join(__dirname, '..', 'node_modules', 'lenis');
// Lenis's package "exports" hide package.json from require(), so read it directly.
const { version } = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const srcDir = path.join(pkgDir, 'dist');
const vendorRoot = path.join(__dirname, '..', 'public', 'vendor', 'lenis');
const outDir = path.join(vendorRoot, version);

fs.rmSync(vendorRoot, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of FILES) {
  fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
}

console.log(`Copied ${FILES.length} Lenis ${version} files to public/vendor/lenis/${version}/`);
