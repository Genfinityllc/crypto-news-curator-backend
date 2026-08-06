/**
 * PEOPLE STORE — merges the static peopleRegistry with a DYNAMIC list of people
 * auto-added at runtime (fetched when a new name shows up in an article title).
 *
 * The dynamic list is persisted as a single JSON file in Supabase storage at
 * `logos/people/_dynamic.json` so it survives restarts and is shared across
 * replicas. Their portraits live alongside the static ones at
 * `logos/people/<slug>.jpg`. Both the /people dropdown and the auto-people
 * resolver read the combined list from here.
 */

const axios = require('axios');
const { getSupabaseClient } = require('../config/supabase');
const { listPeople } = require('./peopleRegistry');
const logger = require('../utils/logger');

const BUCKET = 'logos';
const DYN_PATH = 'people/_dynamic.json';
const PUBLIC_BASE = 'https://daqxnvcfmepjzcgfdrdf.supabase.co/storage/v1/object/public/logos';
const TTL_MS = 20000;

let cache = { data: null, ts: 0 };

async function getDynamic(force = false) {
  if (!force && cache.data && (Date.now() - cache.ts) < TTL_MS) return cache.data;
  try {
    const url = `${PUBLIC_BASE}/${DYN_PATH}?t=${Date.now()}`;
    // A missing object returns 400/404 on this project; treat both as "empty".
    const r = await axios.get(url, { timeout: 12000, validateStatus: s => s === 200 || s === 404 || s === 400 });
    const arr = (r.status === 200 && Array.isArray(r.data)) ? r.data : [];
    cache = { data: arr, ts: Date.now() };
    return arr;
  } catch (e) {
    logger.warn(`peopleStore.getDynamic failed: ${e.message}`);
    return cache.data || [];
  }
}

async function addDynamic(entry) {
  if (!entry || !entry.slug || !entry.imageUrl) return false;
  const sb = getSupabaseClient();
  if (!sb) return false;
  try {
    const cur = await getDynamic(true);
    if (cur.some(p => p.slug === entry.slug)) return true; // already present
    const next = [...cur, { slug: entry.slug, name: entry.name, org: entry.org || '', imageUrl: entry.imageUrl }];
    const buf = Buffer.from(JSON.stringify(next), 'utf8');
    const { error } = await sb.storage.from(BUCKET).upload(DYN_PATH, buf, { contentType: 'application/json', upsert: true, cacheControl: '0' });
    if (error) { logger.warn(`peopleStore.addDynamic upload failed: ${error.message}`); return false; }
    cache = { data: next, ts: Date.now() };
    return true;
  } catch (e) {
    logger.warn(`peopleStore.addDynamic failed: ${e.message}`);
    return false;
  }
}

async function listCombined() {
  const stat = listPeople();
  const seen = new Set(stat.map(p => p.slug));
  const merged = stat.slice();
  const dyn = await getDynamic();
  for (const d of dyn) {
    if (d && d.slug && d.imageUrl && !seen.has(d.slug)) {
      seen.add(d.slug);
      merged.push({ slug: d.slug, name: d.name, org: d.org || '', imageUrl: d.imageUrl, grounded: true, dynamic: true });
    }
  }
  return merged;
}

const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/["'.]/g, '').replace(/\s+/g, ' ').trim();

async function findByName(name) {
  if (!name) return null;
  const all = await listCombined();
  const n = norm(name);
  let hit = all.find(p => norm(p.name) === n);
  return hit || null;
}

module.exports = { getDynamic, addDynamic, listCombined, findByName, PUBLIC_BASE };
