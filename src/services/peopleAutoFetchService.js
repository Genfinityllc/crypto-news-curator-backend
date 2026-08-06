/**
 * PEOPLE AUTO-FETCH — when a real person is named in an article title but is not
 * already in our people list, fetch a portrait (Wikipedia), normalize + store it
 * at `logos/people/<slug>.jpg`, and register them in the dynamic people store so
 * they appear in the dropdown and can be used as a collage likeness reference.
 *
 * resolvePeople(title) returns { people, subjectImageUrls } — the caller awaits
 * this BEFORE generating so the reference exists first.
 */

const https = require('https');
const sharp = require('sharp');
const { getSupabaseClient } = require('../config/supabase');
const peopleStore = require('../data/peopleStore');
const logger = require('../utils/logger');

let extractPersonNames = null;
try { ({ extractPersonNames } = require('./articlePipelineService')); } catch (_) {}

const UA = 'GenfinityBot/1.0 (editorial; contact: valor.kopeny@cc-ea.org)';

function getJSON(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': UA } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
function getBuffer(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': UA } }, r => {
      if (r.statusCode !== 200) { rej(new Error('HTTP ' + r.statusCode)); return; }
      const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => res(Buffer.concat(chunks)));
    }).on('error', rej);
  });
}

function slugify(name) {
  return String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Wikipedia lead portrait for a person's name (best notable match via redirects).
async function wikiPortrait(name) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=pageimages&piprop=thumbnail&pithumbsize=500&redirects=1&format=json`;
  const j = await getJSON(u);
  const pages = j && j.query && j.query.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  return (page.thumbnail && page.thumbnail.source) || null;
}

// Ensure a person exists in our store; fetch + store + register if new.
async function ensurePerson(name) {
  const existing = await peopleStore.findByName(name);
  if (existing && existing.imageUrl) {
    return { name: existing.name, slug: existing.slug, imageUrl: existing.imageUrl, added: false };
  }
  const slug = slugify(name);
  if (!slug) return null;
  let portraitUrl = null;
  try { portraitUrl = await wikiPortrait(name); } catch (e) { logger.warn(`wikiPortrait(${name}) failed: ${e.message}`); }
  if (!portraitUrl) { logger.info(`👤 auto-fetch: no portrait found for "${name}"`); return null; }
  let jpg = null;
  try {
    const raw = await getBuffer(portraitUrl);
    jpg = await sharp(raw).resize(800, 800, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  } catch (e) { logger.warn(`auto-fetch portrait process failed for "${name}": ${e.message}`); return null; }
  const sb = getSupabaseClient();
  if (!sb) return null;
  const dest = `people/${slug}.jpg`;
  const { error } = await sb.storage.from('logos').upload(dest, jpg, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (error) { logger.warn(`auto-fetch upload failed for "${name}": ${error.message}`); return null; }
  const imageUrl = `${peopleStore.PUBLIC_BASE}/${dest}`;
  await peopleStore.addDynamic({ slug, name, org: '', imageUrl });
  logger.info(`👤 auto-fetched + stored new person "${name}" -> ${dest}`);
  return { name, slug, imageUrl, added: true };
}

// Resolve every real person named in a title to a stored reference portrait.
async function resolvePeople(title) {
  if (!extractPersonNames || !title) return { people: [], subjectImageUrls: [] };
  let names = [];
  try { names = await extractPersonNames(title); } catch (e) { logger.warn(`name extraction failed: ${e.message}`); }
  const people = [];
  const seen = new Set();
  for (const nm of names.slice(0, 3)) {
    try {
      const p = await ensurePerson(nm);
      if (p && p.imageUrl && !seen.has(p.imageUrl)) { seen.add(p.imageUrl); people.push(p); }
    } catch (e) { logger.warn(`ensurePerson(${nm}) failed: ${e.message}`); }
  }
  return { people, subjectImageUrls: people.map(p => p.imageUrl) };
}

module.exports = { resolvePeople, ensurePerson, slugify, wikiPortrait };
