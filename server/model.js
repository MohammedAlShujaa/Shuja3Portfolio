'use strict';

/**
 * The model book's details: the cover line, the comp card, and the
 * measurements. Edited in the admin panel (Modeling, Model details), saved in
 * site_settings under the key "model", and rendered into /modeling by
 * render.js. Until something is saved, the defaults below are shown.
 */

const db = require('./db');

// Measurement fields, in comp card order, with the unit shown after the value.
const MEASUREMENTS = [
  { key: 'height', label: 'Height', unit: 'cm' },
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'pants', label: 'Pants', unit: '' },
  { key: 'size', label: 'Size', unit: '' },
  { key: 'shoes', label: 'Shoes', unit: 'EU' },
  { key: 'eyes', label: 'Eyes', unit: '' },
  { key: 'hair', label: 'Hair', unit: '' }
];

const DEFAULT_MODEL = {
  cover_line: 'Menswear model, 184 cm',
  based_in: 'Surabaya, Indonesia',
  languages: 'Arabic, English, Indonesian',
  instagram: 'shuj0a',
  measurements: {
    height: '184',
    weight: '65',
    chest: '115',
    waist: '64',
    hips: '105',
    pants: '33',
    size: 'L',
    shoes: '43-44',
    eyes: 'Brown',
    hair: 'Dark brown'
  }
};

const clean = (v, max = 120) => String(v === null || v === undefined ? '' : v).trim().slice(0, max);

// "@shuj0a", "shuj0a" or an instagram.com link all become "shuj0a".
const cleanHandle = (v) =>
  clean(v, 200)
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .slice(0, 60);

// Keeps only known fields, as trimmed strings. An empty string means "hide it".
function fromInput(body) {
  const b = body || {};
  const m = b.measurements || {};
  const measurements = {};
  MEASUREMENTS.forEach(({ key }) => { measurements[key] = clean(m[key], 40); });
  return {
    cover_line: clean(b.cover_line),
    based_in: clean(b.based_in),
    languages: clean(b.languages),
    instagram: cleanHandle(b.instagram),
    measurements
  };
}

// The saved details, falling back to the defaults for anything never saved.
async function getModel() {
  const saved = await db.getSetting('model');
  if (!saved) return DEFAULT_MODEL;
  return {
    ...DEFAULT_MODEL,
    ...saved,
    measurements: { ...DEFAULT_MODEL.measurements, ...(saved.measurements || {}) }
  };
}

async function saveModel(body) {
  const value = fromInput(body);
  await db.setSetting('model', value);
  return value;
}

module.exports = { MEASUREMENTS, DEFAULT_MODEL, getModel, saveModel };
