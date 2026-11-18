// Cover Studio: shared backdrops and account drafts.
// Mounted at /api/cover-generator/studio.
//
// Shared backdrops: a list of background images that everyone using the Studio
// sees (signed in or not). Only the owner account can add to it or remove from
// it. Images are COPIED into `cover-images/studio/shared/`, because the cleanup
// job in config/supabase.js deletes files in the root of that bucket after 7
// days (it does not look inside folders).
//
// Drafts: a signed-in person's working covers, readable and writable only by
// that account (the Firebase ID token is verified here, signature included).
// Files live in `cover-images/studio/drafts/<key>/<draftId>/`, where <key> is
// derived from the account id. The bucket itself is public-by-address (this
// Supabase project cannot create private buckets from the server), so privacy
// rests on two things: nothing ever lists or reveals these addresses except
// these routes, and the addresses cannot be guessed.

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { getSupabaseClient } = require('../config/supabase');

const router = express.Router();

const BUCKET = 'cover-images';
const SHARED_DIR = 'studio/shared';
const DRAFTS_DIR = 'studio/drafts';
const MAX_SHARED = 300;
const MAX_DRAFTS = 300;
const MAX_PICTURES = 80;
const MAX_PICTURE_BYTES = 10 * 1024 * 1024; // the bucket's own limit per file

// ---------------------------------------------------------------- sign-in
// Firebase ID tokens are checked against Google's published keys. No service
// account is needed for that, only the project name (a public value).
const PROJECTS = [process.env.FIREBASE_PROJECT_ID, 'crypto-curator'].filter(Boolean);
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks = { keys: {}, until: 0 };

async function signingKey(kid) {
  if (!jwks.keys[kid] || Date.now() > jwks.until) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error(`key fetch ${res.status}`);
    const body = await res.json();
    const keys = {};
    (body.keys || []).forEach((k) => {
      keys[k.kid] = crypto.createPublicKey({ key: k, format: 'jwk' });
    });
    const age = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
    jwks = { keys, until: Date.now() + Math.min(6 * 3600, age ? Number(age[1]) : 3600) * 1000 };
  }
  return jwks.keys[kid] || null;
}

const b64json = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

// -> { uid, email } or null
async function verifyIdToken(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const header = b64json(parts[0]);
    const claims = b64json(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return null;
    const key = await signingKey(header.kid);
    if (!key) return null;
    const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
    if (!ok) return null;
    const now = Math.floor(Date.now() / 1000);
    if (!PROJECTS.includes(claims.aud)) return null;
    if (claims.iss !== `https://securetoken.google.com/${claims.aud}`) return null;
    if (!(claims.exp > now) || !(claims.iat <= now + 300)) return null;
    if (!claims.sub || typeof claims.sub !== 'string') return null;
    return { uid: claims.sub, email: claims.email ? String(claims.email).toLowerCase() : null };
  } catch (e) {
    logger.warn(`studio: token check failed: ${e.message}`);
    return null;
  }
}

async function whoIs(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return verifyIdToken(h.slice(7).trim());
}

// The owner accounts, named by the owner on 2026-11-18. They manage the shared
// backgrounds and share ONE set of drafts between them (see homeOf).
const OWNER_EMAILS = ['valor.kopeny@cc-ea.org', 'valor@genfinity.io'];

// An owner account: one of the emails above, the existing master-account
// settings, or the optional lists in the environment.
function isOwner(user) {
  if (!user) return false;
  if (user.email && OWNER_EMAILS.includes(user.email)) return true;
  try {
    const PromptRefinementService = require('../services/promptRefinementService');
    if (PromptRefinementService.isMasterAccount(user.uid, user.email)) return true;
  } catch (e) {
    /* that service is optional here */
  }
  const list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (user.email && list(process.env.STUDIO_OWNER_EMAILS).includes(user.email)) return true;
  if (list(process.env.STUDIO_OWNER_UIDS).includes(user.uid.toLowerCase())) return true;
  return false;
}

const needUser = async (req, res) => {
  const user = await whoIs(req);
  if (!user) res.status(401).json({ success: false, error: 'Sign in to use drafts in your account.' });
  return user;
};

// ---------------------------------------------------------------- storage
const store = () => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Storage is not available');
  return client.storage.from(BUCKET);
};

async function readFile(path) {
  const { data, error } = await store().download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function readJson(path, fallback) {
  const buf = await readFile(path);
  if (!buf) return fallback;
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch (e) {
    return fallback;
  }
}

async function writeFile(path, buffer, contentType, cacheControl = '3600') {
  const { error } = await store().upload(path, buffer, { contentType, upsert: true, cacheControl });
  if (error) throw new Error(error.message || 'upload failed');
}

const writeJson = (path, value) => writeFile(path, Buffer.from(JSON.stringify(value)), 'application/json', '0');

async function listFolder(folder) {
  const out = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const { data, error } = await store().list(folder, { limit: 1000, offset });
    if (error) throw new Error(error.message || 'list failed');
    (data || []).forEach((f) => out.push(f.name));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function removeFiles(paths) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await store().remove(paths.slice(i, i + 100));
    if (error) throw new Error(error.message || 'remove failed');
  }
}

const publicUrl = (path) => store().getPublicUrl(path).data.publicUrl;

// Data that changes (the lists, a draft's cover) is never overwritten in place:
// this storage can hand back the old contents of an overwritten or deleted file
// for a moment. Each save writes a new file `<name>_<time>.json` and removes
// the older ones; reading takes the newest name from the folder listing, which
// is always current.
const versionsOf = (names, name) => names.filter((n) => n.startsWith(`${name}_`) && n.endsWith('.json')).sort();

async function readVersioned(dir, name, fallback) {
  const mine = versionsOf(await listFolder(dir), name);
  if (!mine.length) return fallback;
  return readJson(`${dir}/${mine[mine.length - 1]}`, fallback);
}

async function writeVersioned(dir, name, value) {
  const old = versionsOf(await listFolder(dir), name);
  const stamp = String(Date.now()).padStart(15, '0');
  await writeJson(`${dir}/${name}_${stamp}_${crypto.randomBytes(3).toString('hex')}.json`, value);
  if (old.length) await removeFiles(old.map((n) => `${dir}/${n}`)).catch(() => null);
}

// One change at a time per index file (read, change, write back).
const queues = new Map();
function inTurn(key, job) {
  const next = (queues.get(key) || Promise.resolve()).then(job, job);
  queues.set(key, next.catch(() => null));
  return next;
}

const fail = (res, e, what) => {
  logger.error(`studio: ${what}: ${e.message}`);
  res.status(500).json({ success: false, error: `${what} failed. Try again in a moment.` });
};

// ---------------------------------------------------------------- who am I
router.get('/me', async (req, res) => {
  const user = await whoIs(req);
  res.json({ success: true, signedIn: !!user, isOwner: isOwner(user) });
});

// ---------------------------------------------------------------- shared backdrops
const cleanShared = (list) => (Array.isArray(list) ? list.filter((b) => b && b.id && b.path) : []);
const sharedView = (b) => ({ id: b.id, url: publicUrl(b.path), thumb: publicUrl(b.thumbPath || b.path), added: b.added });

router.get('/backdrops', async (req, res) => {
  try {
    const list = cleanShared(await readVersioned(SHARED_DIR, 'index', []));
    res.json({ success: true, backdrops: list.map(sharedView) });
  } catch (e) {
    fail(res, e, 'Loading the shared backgrounds');
  }
});

// Only images already in this project's own storage can be shared (no fetching
// of arbitrary addresses from the server).
function ownStoragePath(url) {
  const base = `${String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/`;
  const clean = String(url || '').split('?')[0];
  if (!base.startsWith('http') || !clean.startsWith(base)) return null;
  const path = decodeURIComponent(clean.slice(base.length));
  if (!path || path.includes('..') || path.startsWith('/')) return null;
  return path;
}

// A generated image whose upload to storage failed is served from this
// server's own temporary folder until the next deploy. Such an address can be
// shared too: the file is read straight from that folder (name checked, never
// fetched over the network).
function ownTempFile(url) {
  const m = /^https?:\/\/[^/]+\/temp\/controlnet-images\/([A-Za-z0-9_-]{6,80})\.png$/.exec(String(url || '').split('?')[0]);
  return m ? path.join(__dirname, '../../temp/controlnet-images', `${m[1]}.png`) : null;
}

router.post('/backdrops', async (req, res) => {
  const user = await whoIs(req);
  if (!isOwner(user)) return res.status(403).json({ success: false, error: 'Only the owner account can add shared backgrounds.' });
  const stored = ownStoragePath(req.body && req.body.url);
  const tempFile = stored ? null : ownTempFile(req.body && req.body.url);
  const from = stored || (tempFile ? `temp:${path.basename(tempFile)}` : null);
  if (!from) return res.status(400).json({ success: false, error: 'That image cannot be shared from here.' });
  try {
    const result = await inTurn(SHARED_DIR, async () => {
      const list = cleanShared(await readVersioned(SHARED_DIR, 'index', []));
      const had = list.find((b) => b.from === from);
      if (had) return { item: had, list, added: false };
      if (list.length >= MAX_SHARED) throw new Error('limit');
      const original = stored ? await readFile(stored) : await fs.readFile(tempFile).catch(() => null);
      if (!original) throw new Error('gone');
      const sharp = require('sharp');
      // a lighter copy for everyone to load, and a small one for the grid
      const full = await sharp(original).flatten({ background: '#000000' }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      const thumb = await sharp(original).flatten({ background: '#000000' }).resize(480, null, { withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      const id = `b-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
      const item = { id, path: `${SHARED_DIR}/${id}.jpg`, thumbPath: `${SHARED_DIR}/${id}_t.jpg`, from, added: Date.now() };
      await writeFile(item.path, full, 'image/jpeg', '31536000');
      await writeFile(item.thumbPath, thumb, 'image/jpeg', '31536000');
      const next = [item, ...list];
      await writeVersioned(SHARED_DIR, 'index', next);
      return { item, list: next, added: true };
    });
    res.json({ success: true, added: result.added, backdrop: sharedView(result.item), backdrops: result.list.map(sharedView) });
  } catch (e) {
    if (e.message === 'gone') return res.status(410).json({ success: false, error: 'That image is no longer stored on the server.' });
    if (e.message === 'limit') return res.status(400).json({ success: false, error: `The shared list is full (${MAX_SHARED}). Remove some first.` });
    fail(res, e, 'Adding the shared background');
  }
});

router.delete('/backdrops/:id', async (req, res) => {
  const user = await whoIs(req);
  if (!isOwner(user)) return res.status(403).json({ success: false, error: 'Only the owner account can remove shared backgrounds.' });
  try {
    const list = await inTurn(SHARED_DIR, async () => {
      const all = cleanShared(await readVersioned(SHARED_DIR, 'index', []));
      const gone = all.find((b) => b.id === req.params.id);
      if (!gone) return all;
      const next = all.filter((b) => b !== gone);
      await writeVersioned(SHARED_DIR, 'index', next);
      await removeFiles([gone.path, gone.thumbPath].filter(Boolean)).catch(() => null);
      return next;
    });
    res.json({ success: true, backdrops: list.map(sharedView) });
  } catch (e) {
    fail(res, e, 'Removing the shared background');
  }
});

// ---------------------------------------------------------------- recovery
// Backdrops generated before 2026-11-18 were never put in storage (see the
// CLAUDE.md note) and were lost from this server. The image service keeps its
// own history for about 7 days, so they are fetched back from there and added
// to the shared backgrounds. Runs by itself once after a deploy; what it found
// is written next to the shared list as `recovery-<run>_<time>.json`.
const RECOVERY_RUN = 'recovery-v1';
const RECOVERY_DAYS = 8;
const RECOVERY_MAX = 80;

async function serviceHistory(sinceMs) {
  const key = process.env.WAVESPEED_API_KEY;
  if (!key) return { error: 'no image service key on this server' };
  const items = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await fetch('https://api.wavespeed.ai/api/v3/predictions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, page_size: 100, status: 'completed', created_after: new Date(sinceMs).toISOString() }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || !body.data) return { error: `history answered ${res.status}`, sample: JSON.stringify(body).slice(0, 300) };
    const got = Array.isArray(body.data.items) ? body.data.items : [];
    items.push(...got);
    if (got.length < 100) break;
  }
  return { items };
}

async function recoverBackdrops() {
  const report = { run: RECOVERY_RUN, at: new Date().toISOString(), total: 0, byModel: {}, candidates: 0, imported: 0, already: 0, failed: [] };
  const history = await serviceHistory(Date.now() - RECOVERY_DAYS * 86400000);
  if (history.error) return { ...report, error: history.error, sample: history.sample };
  report.total = history.items.length;
  history.items.forEach((it) => {
    const m = String(it.model || 'unknown');
    report.byModel[m] = (report.byModel[m] || 0) + 1;
  });
  if (history.items[0]) report.fields = Object.keys(history.items[0]);
  // a backdrop is a picture made from words alone (covers with a logo use the "edit" model)
  const wanted = history.items
    .filter((it) => /text-to-image/i.test(String(it.model || '')) && Array.isArray(it.outputs) && typeof it.outputs[0] === 'string' && /^https:\/\//.test(it.outputs[0]))
    .slice(0, RECOVERY_MAX);
  report.candidates = wanted.length;
  if (wanted[0]) report.outputHost = new URL(wanted[0].outputs[0]).host;
  if (!wanted.length) return report;
  const sharp = require('sharp');
  await inTurn(SHARED_DIR, async () => {
    let list = cleanShared(await readVersioned(SHARED_DIR, 'index', []));
    // oldest first, so the newest ends up at the front of the list
    for (const it of [...wanted].reverse()) {
      const from = `service:${it.id}`;
      if (list.some((b) => b.from === from)) {
        report.already += 1;
        continue;
      }
      if (list.length >= MAX_SHARED) break;
      try {
        const res = await fetch(it.outputs[0]);
        if (!res.ok) throw new Error(`file answered ${res.status}`);
        const original = Buffer.from(await res.arrayBuffer());
        if (original.length > 40 * 1024 * 1024) throw new Error('too large');
        const full = await sharp(original).flatten({ background: '#000000' }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
        const thumb = await sharp(original).flatten({ background: '#000000' }).resize(480, null, { withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
        const id = `b-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
        const item = { id, path: `${SHARED_DIR}/${id}.jpg`, thumbPath: `${SHARED_DIR}/${id}_t.jpg`, from, added: Date.parse(it.created_at) || Date.now() };
        await writeFile(item.path, full, 'image/jpeg', '31536000');
        await writeFile(item.thumbPath, thumb, 'image/jpeg', '31536000');
        list = [item, ...list];
        report.imported += 1;
      } catch (e) {
        report.failed.push(`${String(it.id).slice(0, 12)}: ${e.message}`);
      }
    }
    if (report.imported) await writeVersioned(SHARED_DIR, 'index', list);
  });
  return report;
}

// Once per RECOVERY_RUN: a short while after the server starts.
setTimeout(async () => {
  try {
    // only on the live server (it alone has the image service key); a local run must not mark the job as done
    if (!process.env.WAVESPEED_API_KEY || !getSupabaseClient()) return;
    if (versionsOf(await listFolder(SHARED_DIR), RECOVERY_RUN).length) return;
    const report = await recoverBackdrops();
    await writeVersioned(SHARED_DIR, RECOVERY_RUN, report);
    logger.info(`studio: backdrop recovery ${RECOVERY_RUN}: ${report.imported} brought back of ${report.candidates} found${report.error ? ` (${report.error})` : ''}`);
  } catch (e) {
    logger.warn(`studio: backdrop recovery did not run: ${e.message}`);
  }
}, 25000).unref();

// ---------------------------------------------------------------- drafts
const ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg' };
const TYPE = { png: 'image/png', jpg: 'image/jpeg' };

// The account's folder. Not the account id itself, so an id seen elsewhere
// does not give the address away.
const userDir = (uid) => `${DRAFTS_DIR}/${crypto.createHmac('sha256', 'genfinity-cover-studio-drafts-v1').update(String(uid)).digest('hex').slice(0, 40)}`;
// Whose drafts a signed-in person works with: their own, except that every
// owner account works in one shared space, so the owners see and edit the
// same drafts whichever of their logins they use.
const homeOf = (user) => (isOwner(user) ? 'space:owners' : user.uid);
const cleanIndex = (list) => (Array.isArray(list) ? list.filter((d) => d && d.id) : []);
const draftView = (d) => ({ id: d.id, name: d.name, profile: d.profile, created: d.created, updated: d.updated, thumb: d.thumb || '', width: d.width, height: d.height });

// An owner account that saved drafts in its own folder (before it was named an
// owner) gets them moved into the owners' shared space, once, the next time it
// lists its drafts. Nothing is copied over a draft already there.
async function adoptPersonalDrafts(user) {
  if (!isOwner(user)) return;
  const mine = userDir(user.uid);
  const shared = userDir(homeOf(user));
  if (mine === shared) return;
  if (!versionsOf(await listFolder(mine), 'index').length) return;
  const old = cleanIndex(await readVersioned(mine, 'index', []));
  if (!old.length) return;
  await inTurn(shared, async () => {
    const list = cleanIndex(await readVersioned(shared, 'index', []));
    const moved = [];
    for (const d of old) {
      if (list.some((x) => x.id === d.id)) continue;
      const files = await listFolder(`${mine}/${d.id}`);
      for (const n of files) {
        const { error } = await store().move(`${mine}/${d.id}/${n}`, `${shared}/${d.id}/${n}`);
        if (error) throw new Error(error.message || 'move failed');
      }
      moved.push(d);
    }
    if (moved.length) await writeVersioned(shared, 'index', [...moved, ...list]);
    await writeVersioned(mine, 'index', old.filter((d) => !moved.includes(d)));
    if (moved.length) logger.info(`studio: moved ${moved.length} draft(s) of an owner account into the owners' space`);
  });
}

router.get('/drafts', async (req, res) => {
  const user = await needUser(req, res);
  if (!user) return;
  try {
    await adoptPersonalDrafts(user).catch((e) => logger.warn(`studio: could not move an owner's own drafts: ${e.message}`));
    const list = cleanIndex(await readVersioned(userDir(homeOf(user)), 'index', []));
    const profile = req.query.profile ? String(req.query.profile) : null;
    res.json({ success: true, drafts: list.filter((d) => !profile || d.profile === profile).sort((a, b) => (b.updated || 0) - (a.updated || 0)).map(draftView) });
  } catch (e) {
    fail(res, e, 'Loading your drafts');
  }
});

router.get('/drafts/:id', async (req, res) => {
  const user = await needUser(req, res);
  if (!user) return;
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Bad draft id' });
  try {
    const cover = await readVersioned(`${userDir(homeOf(user))}/${req.params.id}`, 'cover', null);
    if (!cover) return res.status(404).json({ success: false, error: 'That draft was not found in your account.' });
    res.json({ success: true, cover });
  } catch (e) {
    fail(res, e, 'Opening the draft');
  }
});

// Which of these pictures does the draft not have yet?
router.post('/drafts/:id/pictures/check', async (req, res) => {
  const user = await needUser(req, res);
  if (!user) return;
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Bad draft id' });
  try {
    const want = (Array.isArray(req.body && req.body.hashes) ? req.body.hashes : []).filter((h) => HASH_RE.test(h)).slice(0, MAX_PICTURES);
    const have = new Set((await listFolder(`${userDir(homeOf(user))}/${req.params.id}`)).filter((n) => n.startsWith('p_')).map((n) => n.slice(2).replace(/\.[a-z]+$/, '')));
    res.json({ success: true, missing: want.filter((h) => !have.has(h)) });
  } catch (e) {
    fail(res, e, 'Checking the pictures');
  }
});

router.put('/drafts/:id/pictures/:hash', express.raw({ type: ['image/png', 'image/jpeg'], limit: MAX_PICTURE_BYTES }), async (req, res) => {
  const user = await needUser(req, res);
  if (!user) return;
  const ext = EXT[String(req.headers['content-type'] || '').split(';')[0].trim()];
  if (!ID_RE.test(req.params.id) || !HASH_RE.test(req.params.hash) || !ext || !Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ success: false, error: 'Bad picture upload' });
  }
  if (crypto.createHash('sha256').update(req.body).digest('hex') !== req.params.hash) {
    return res.status(400).json({ success: false, error: 'The picture did not arrive intact. Try again.' });
  }
  try {
    await writeFile(`${userDir(homeOf(user))}/${req.params.id}/p_${req.params.hash}.${ext}`, req.body, TYPE[ext], '31536000');
    res.json({ success: true });
  } catch (e) {
    fail(res, e, 'Saving a picture');
  }
});

router.get('/drafts/:id/pictures/:hash', async (req, res) => {
  const user = await needUser(req, res);
  if (!user) return;
  if (!ID_RE.test(req.params.id) || !HASH_RE.test(req.params.hash)) return res.status(400).json({ success: false, error: 'Bad picture id' });
  try {
    const dir = `${userDir(homeOf(user))}/${req.params.id}`;
    for (const ext of ['png', 'jpg']) {
      const buf = await readFile(`${dir}/p_${req.params.hash}.${ext}`);
      if (buf) {
        res.set('Content-Type', TYPE[ext]);
        res.set('Cache-Control', 'private, max-age=31536000, immutable');
        return res.send(buf);
      }
    }
    res.status(404).json({ success: false, error: 'Picture not found' });
  } catch (e) {
    fail(res, e, 'Loading a picture');
  }
});

// Save the draft itself. Its pictures were uploaded first (see above); the
// cover refers to them by hash. Pictures the cover no longer uses are removed.
router.put('/drafts/:id', async (req, res) => {
  const user = await needUser(req, res);
  if (!user) return;
  const id = req.params.id;
  const { meta, cover } = req.body || {};
  if (!ID_RE.test(id) || !cover || typeof cover !== 'object' || !Array.isArray(cover.objects)) {
    return res.status(400).json({ success: false, error: 'Bad draft' });
  }
  const pics = (Array.isArray(cover.pictures) ? cover.pictures : []).filter(Boolean);
  if (pics.length > MAX_PICTURES || pics.some((p) => !HASH_RE.test(p.hash || '') || !EXT[p.type])) {
    return res.status(400).json({ success: false, error: 'Bad draft pictures' });
  }
  try {
    const dir = `${userDir(homeOf(user))}/${id}`;
    const now = Date.now();
    const entry = await inTurn(userDir(homeOf(user)), async () => {
      const list = cleanIndex(await readVersioned(userDir(homeOf(user)), 'index', []));
      const old = list.find((d) => d.id === id);
      if (!old && list.length >= MAX_DRAFTS) throw new Error('limit');
      const have = await listFolder(dir);
      const need = new Set(pics.map((p) => `p_${p.hash}.${EXT[p.type]}`));
      const missing = [...need].filter((n) => !have.includes(n));
      if (missing.length) throw new Error('pictures');
      await writeVersioned(dir, 'cover', cover);
      const m = meta || {};
      const next = {
        id,
        name: String(m.name || 'Untitled cover').slice(0, 80),
        profile: m.profile === 'interview' ? 'interview' : 'cover',
        created: old && old.created ? old.created : Number(m.created) || now,
        updated: now,
        thumb: typeof m.thumb === 'string' && m.thumb.startsWith('data:image/') && m.thumb.length < 120000 ? m.thumb : '',
        width: Number(m.width) || null,
        height: Number(m.height) || null,
      };
      await writeVersioned(userDir(homeOf(user)), 'index', [next, ...list.filter((d) => d.id !== id)]);
      const stale = have.filter((n) => n.startsWith('p_') && !need.has(n)).map((n) => `${dir}/${n}`);
      if (stale.length) await removeFiles(stale).catch(() => null);
      return next;
    });
    res.json({ success: true, draft: draftView(entry) });
  } catch (e) {
    if (e.message === 'limit') return res.status(400).json({ success: false, error: `Your account already holds ${MAX_DRAFTS} drafts. Delete some first.` });
    if (e.message === 'pictures') return res.status(409).json({ success: false, error: 'Some pictures did not upload. Save again.' });
    fail(res, e, 'Saving the draft');
  }
});

router.delete('/drafts/:id', async (req, res) => {
  const user = await needUser(req, res);
  if (!user) return;
  const id = req.params.id;
  if (!ID_RE.test(id)) return res.status(400).json({ success: false, error: 'Bad draft id' });
  try {
    await inTurn(userDir(homeOf(user)), async () => {
      const dir = `${userDir(homeOf(user))}/${id}`;
      const list = cleanIndex(await readVersioned(userDir(homeOf(user)), 'index', []));
      await writeVersioned(userDir(homeOf(user)), 'index', list.filter((d) => d.id !== id));
      const files = await listFolder(dir);
      if (files.length) await removeFiles(files.map((n) => `${dir}/${n}`));
    });
    res.json({ success: true });
  } catch (e) {
    fail(res, e, 'Deleting the draft');
  }
});

// ---------------------------------------------------------------- bookmarks
// The news pages' bookmarks. The older routes in routes/firebase-auth.js need
// Firebase Admin with a service account, which this server has never had on
// Railway, so they answered 401 to everyone and the Bookmarks page bounced
// people to the login screen. These take over the same addresses
// (/api/firebase-auth/bookmarks) with the verified sign-in above and keep each
// account's bookmarks, article included, in storage.
const bookmarks = express.Router();
const MAX_BOOKMARKS = 500;
const marksDir = (uid) => `studio/bookmarks/${crypto.createHmac('sha256', 'genfinity-news-bookmarks-v1').update(String(uid)).digest('hex').slice(0, 40)}`;
const cleanMarks = (list) => (Array.isArray(list) ? list.filter((b) => b && b.id && b.articleId) : []);
const text = (v, max) => (v == null ? undefined : String(v).slice(0, max));
// only what a news card shows, so a bookmark stays small
function trimArticle(a, articleId) {
  const src = a && typeof a === 'object' ? a : {};
  return {
    id: text(src.id, 200) || articleId,
    title: text(src.title, 400) || 'Untitled article',
    url: text(src.url, 2000),
    source: text(src.source, 200),
    network: text(src.network, 100),
    category: text(src.category, 100),
    published_at: text(src.published_at || src.publishedAt, 60),
    image_url: text(src.image_url || src.cover_image || src.imageUrl, 2000),
    cover_image: text(src.cover_image || src.image_url, 2000),
    summary: text(src.summary || src.description || src.content, 800),
    description: text(src.description || src.summary, 800),
  };
}
// the page reads the article from `articles`; the card matches on `articleId`
const markView = (b) => ({ id: b.id, bookmarkId: b.id, articleId: b.articleId, createdAt: b.createdAt, url: b.article && b.article.url, articles: b.article });
const needMarkUser = async (req, res) => {
  const user = await whoIs(req);
  if (!user) res.status(401).json({ success: false, message: 'Sign in to use bookmarks.' });
  return user;
};

bookmarks.get('/bookmarks', async (req, res) => {
  const user = await needMarkUser(req, res);
  if (!user) return;
  try {
    const list = cleanMarks(await readVersioned(marksDir(user.uid), 'index', []));
    res.json({ success: true, bookmarks: list.map(markView) });
  } catch (e) {
    logger.error(`bookmarks: list: ${e.message}`);
    res.status(500).json({ success: false, message: 'Failed to get bookmarks' });
  }
});

bookmarks.post('/bookmarks', async (req, res) => {
  const user = await needMarkUser(req, res);
  if (!user) return;
  const body = req.body || {};
  const articleId = text(body.articleId || (body.article && (body.article.id || body.article.url)), 2000);
  if (!articleId) return res.status(400).json({ success: false, message: 'Article ID is required' });
  try {
    const dir = marksDir(user.uid);
    const mark = await inTurn(dir, async () => {
      const list = cleanMarks(await readVersioned(dir, 'index', []));
      const had = list.find((b) => b.articleId === articleId);
      if (had) return had;
      if (list.length >= MAX_BOOKMARKS) throw new Error('limit');
      let article = body.article;
      if (!article || !article.title) {
        // an article from the database can be looked up by its id
        try {
          const client = getSupabaseClient();
          const found = client ? await client.from('articles').select('*').eq('id', articleId).maybeSingle() : null;
          if (found && found.data) article = found.data;
        } catch (lookupError) {
          /* kept with what was sent */
        }
      }
      const next = { id: `m-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`, articleId, createdAt: new Date().toISOString(), article: trimArticle(article, articleId) };
      await writeVersioned(dir, 'index', [next, ...list]);
      return next;
    });
    res.status(201).json({ success: true, message: 'Article bookmarked successfully', bookmark: markView(mark) });
  } catch (e) {
    if (e.message === 'limit') return res.status(400).json({ success: false, message: `You already have ${MAX_BOOKMARKS} bookmarks. Remove some first.` });
    logger.error(`bookmarks: add: ${e.message}`);
    res.status(500).json({ success: false, message: 'Failed to add bookmark' });
  }
});

bookmarks.delete('/bookmarks/:bookmarkId', async (req, res) => {
  const user = await needMarkUser(req, res);
  if (!user) return;
  try {
    const dir = marksDir(user.uid);
    const removed = await inTurn(dir, async () => {
      const list = cleanMarks(await readVersioned(dir, 'index', []));
      const next = list.filter((b) => b.id !== req.params.bookmarkId);
      if (next.length === list.length) return false;
      await writeVersioned(dir, 'index', next);
      return true;
    });
    if (!removed) return res.status(404).json({ success: false, message: 'Bookmark not found' });
    res.json({ success: true, message: 'Bookmark removed successfully' });
  } catch (e) {
    logger.error(`bookmarks: remove: ${e.message}`);
    res.status(500).json({ success: false, message: 'Failed to remove bookmark' });
  }
});

module.exports = router;
module.exports.verifyIdToken = verifyIdToken;
module.exports.bookmarks = bookmarks;
