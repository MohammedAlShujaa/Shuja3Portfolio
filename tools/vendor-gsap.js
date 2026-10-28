'use strict';

/**
 * Copies the GSAP files the site uses from node_modules into
 * public/vendor/gsap/<version>/, so the browser loads them from this site
 * (the Content Security Policy only allows scripts from 'self').
 *
 * The folder name carries the version, so the files can be cached forever:
 * upgrading GSAP produces a new path instead of changing an existing file.
 *
 * Run with: npm run vendor:gsap
 * After upgrading, update the <script> paths in the HTML pages to match.
 */

const fs = require('fs');
const path = require('path');

const FILES = [
  'gsap.min.js',
  'SplitText.min.js',
  'DrawSVGPlugin.min.js',
  'ScrambleTextPlugin.min.js'
];

const { version } = require('gsap/package.json');
const srcDir = path.dirname(require.resolve('gsap/dist/gsap.min.js'));
const vendorRoot = path.join(__dirname, '..', 'public', 'vendor', 'gsap');
const outDir = path.join(vendorRoot, version);

fs.rmSync(vendorRoot, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of FILES) {
  fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
}

console.log(`Copied ${FILES.length} GSAP ${version} files to public/vendor/gsap/${version}/`);
