'use strict';

/**
 * Uploads image buffers to Supabase Storage through its REST API.
 *
 * Server-side only. It uses the Supabase service role key, which bypasses all
 * row-level security and must never be sent to the browser. The key lives only
 * in the SUPABASE_SERVICE_ROLE_KEY environment variable.
 *
 * No extra dependency is needed: Node 18+ has a built-in fetch.
 */

const baseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const bucket = process.env.SUPABASE_BUCKET || 'photos';

const isConfigured = () => Boolean(baseUrl && serviceKey);

// Builds a short, url-safe object path so no character needs escaping later.
function safePath(name) {
  const base = String(name || 'photo')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')      // drop any extension
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'photo';
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}-${base}.jpg`;
}

/**
 * Uploads one image buffer and returns its public URL.
 * The bucket must be public for the returned URL to load in a browser.
 */
async function uploadImage(buffer, contentType, name) {
  if (!isConfigured()) {
    throw new Error('Supabase storage is not configured on the server.');
  }
  const path = safePath(name);
  const endpoint = `${baseUrl}/storage/v1/object/${bucket}/${path}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      // Some Supabase gateways check the apikey header as well as the bearer
      // token, so send both to be safe. Both carry the service role key.
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': contentType || 'image/jpeg',
      'cache-control': '3600',
      'x-upsert': 'true'
    },
    body: buffer
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Supabase upload failed (${res.status}). Check the bucket name "${bucket}" exists and the keys are correct. ${detail.slice(0, 160)}`
    );
  }

  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

module.exports = { isConfigured, uploadImage, bucket };
