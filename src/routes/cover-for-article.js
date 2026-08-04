const express = require('express');
const router = express.Router();
const axios = require('axios');
const sharp = require('sharp');
const logger = require('../utils/logger');
const { detectCryptocurrency, networkToSymbol } = require('../services/cryptoDetectionService');
const { deriveVisualSubject, artDirect } = require('../services/articlePipelineService');
const { getSupabaseClient } = require('../config/supabase');
const coverJobService = require('../services/coverJobService');

/**
 * COVER FOR ARTICLE
 *
 * Thin, additive wrapper around the LIVE cover generator
 * (POST /api/cover-generator/generate). It exists so the AI Rewrite flow can
 * reuse the production Wavespeed cover generator instead of the deprecated
 * LoRA / HF Spaces path, WITHOUT modifying the generator itself.
 *
 * What it adds on top of a plain generate call:
 *  1. Network/company detection from the article title/content, so the right
 *     real logo is used.
 *  2. Graceful handling of the STRICT LOGO GUARD 422: if the detected symbol
 *     has no uploaded PNG (or nothing is detected), it falls back to
 *     background-only mode so the caller never sees a 422 dead-end.
 *  3. The source article image is passed as a style_reference only, so it
 *     guides palette and mood and never copies the source's branding.
 *  4. An X-ready copy: exactly 1800x900 and under 1 MB, for x.com to pull.
 *
 * The generator path itself is never edited; we call it over localhost.
 */

const GENERATE_URL = `http://localhost:${process.env.PORT || 3001}/api/cover-generator/generate`;
const STYLE_CATALOG_URL = `http://localhost:${process.env.PORT || 3001}/api/style-catalog`;
const X_MAX_BYTES = 1000000; // x.com pulls images reliably under 1 MB
const COVERS_BUCKET = 'covers';

// Style rotation. When NO reference image is used, we rotate through the
// curated style catalog so rewrite covers have variety instead of the random
// default. When a reference image IS used, the generator runs in
// style_reference mode and ignores styleId (the source image drives the look),
// so rotation only applies to the no-reference case.
let STYLE_IDS = null;
let styleRotationIndex = 0;

async function nextStyleId() {
  try {
    if (!STYLE_IDS) {
      const resp = await axios.get(STYLE_CATALOG_URL, { timeout: 15000 });
      const data = resp.data || {};
      const list = Array.isArray(data) ? data : (data.styles || data.data || data.catalog || []);
      // Exclude internal styles (e.g. the text-enabled news collage) from the
      // no-reference rotation; they render text and are only requested explicitly.
      STYLE_IDS = list.filter(s => s && !s.internal).map(s => s.id || s.styleId || s.slug).filter(Boolean);
    }
    if (!STYLE_IDS || STYLE_IDS.length === 0) return null;
    const id = STYLE_IDS[styleRotationIndex % STYLE_IDS.length];
    styleRotationIndex = (styleRotationIndex + 1) % STYLE_IDS.length;
    return id;
  } catch (e) {
    logger.warn(`Could not load style catalog for rotation: ${e.message}`);
    return null;
  }
}

// Cached logo library (networks + companies, ~184 entries). The crypto detector
// only knows ~50 tickers, so it misses company logos like Coinbase. Matching the
// article text against the real library is what actually finds the right logo.
const NETWORKS_URL = `http://localhost:${process.env.PORT || 3001}/api/cover-generator/networks`;
let LIBRARY = null;

async function getLibrary() {
  if (LIBRARY) return LIBRARY;
  try {
    const resp = await axios.get(NETWORKS_URL, { timeout: 15000 });
    const j = resp.data || {};
    const all = [...(j.networks || []), ...(j.companies || [])];
    LIBRARY = all
      .map(x => ({ symbol: String(x.symbol || '').toUpperCase(), name: String(x.name || '').toLowerCase(), hasLogo: !!x.hasLogo }))
      .filter(x => x.symbol && x.name.length >= 3);
  } catch (e) {
    logger.warn(`Could not load logo library: ${e.message}`);
    LIBRARY = [];
  }
  return LIBRARY;
}

async function matchLibrarySymbol(text) {
  const t = ` ${(text || '').toLowerCase()} `;
  const lib = await getLibrary();
  const hits = lib.filter(e => new RegExp(`\\b${e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t));
  if (!hits.length) return null;
  // Prefer entries that have a logo, then the most specific (longest) name.
  hits.sort((a, b) => (b.hasLogo - a.hasLogo) || (b.name.length - a.name.length));
  return hits[0].symbol;
}

// Two-accent-color palettes for the Editorial Collage style, drawn from the
// reference examples. The collage uses exactly two colors that pair well; the
// rest of the image is black and white. Palettes rotate by default; the caller
// can pass paletteColors [c1, c2] to pick a preset or custom pair.
const COLLAGE_PALETTES = [
  ['#ff2d9b', '#c6ff00'], // magenta + lime
  ['#ffd400', '#ff3b30'], // yellow + red
  ['#00e5ff', '#ff2d9b'], // cyan + magenta
  ['#00e676', '#2979ff'], // green + blue
  ['#2979ff', '#ff4fa3'], // blue + pink
  ['#ff7a00', '#00e5ff']  // orange + teal
];
// Pick a RANDOM pairing each time so consecutive Article Studio covers get
// different colours (the palette is not tied to the story). The Cover Generator
// passes explicit paletteColors from the user's selector, which wins over this.
function nextCollagePalette() {
  return COLLAGE_PALETTES[Math.floor(Math.random() * COLLAGE_PALETTES.length)];
}
function isHexColor(v) {
  return typeof v === 'string' && /^#?[0-9a-f]{3,8}$/i.test(v.trim());
}

/**
 * Resolve a logo symbol from an explicit network tag, the full logo library, or
 * the crypto detector (in that order). Returns an uppercase symbol or null.
 */
async function resolveSymbol(network, title, content) {
  if (network && typeof network === 'string' && network.trim()) {
    const sym = networkToSymbol(network.trim());
    if (sym) return String(sym).toUpperCase();
  }
  const libSym = await matchLibrarySymbol(`${title || ''} ${content || ''}`);
  if (libSym) return libSym;
  const detection = detectCryptocurrency(title || '', content || '');
  if (detection && detection.crypto && (detection.confidence === undefined || detection.confidence > 0)) {
    return String(detection.crypto).toUpperCase();
  }
  return null;
}

/**
 * Call the live generator. Returns the parsed success body, or throws with a
 * `.status` property so the caller can detect the 422 missing_logo case.
 */
async function callGenerator(body) {
  try {
    const resp = await axios.post(GENERATE_URL, body, {
      // Generous: the news collage (concept + text + Wavespeed + watermark +
      // upload) can be slow; a short timeout was dropping finished images.
      timeout: 300000,
      headers: { 'Content-Type': 'application/json' },
      // Do not throw on 4xx so we can inspect a 422 ourselves.
      validateStatus: (s) => s < 500
    });
    if (resp.status === 200 && resp.data && resp.data.success) {
      return resp.data;
    }
    const err = new Error(resp.data && resp.data.error ? resp.data.error : `generate failed (${resp.status})`);
    err.status = resp.status;
    err.body = resp.data;
    throw err;
  } catch (e) {
    if (e.status) throw e;
    // Network/timeout/5xx
    const err = new Error(e.message || 'generate request failed');
    err.status = e.response ? e.response.status : 500;
    throw err;
  }
}

/**
 * Download the generated cover and produce an X-ready copy: 1800x900, under
 * 1 MB. Default format JPEG (keeps gradients smooth at small size and is the
 * most reliably scraped by social cards). `format: 'png'` uses palette
 * quantization instead, for callers who prefer PNG and accept some banding.
 * Returns { buffer, contentType, ext } or null on failure.
 */
async function buildXReadyCopy(imageUrl, format = 'jpeg') {
  try {
    const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
    const input = Buffer.from(resp.data);

    // Ensure exact 1800x900 (the generator already does this via watermarkService,
    // but we enforce it here so the X copy is always correct).
    const base = sharp(input).resize(1800, 900, { fit: 'cover' });

    if (format === 'png') {
      // Palette-quantized PNG: step colours/quality down until under the cap.
      for (const colours of [256, 192, 128, 96, 64]) {
        const buf = await base.clone().png({ palette: true, colours, effort: 8, dither: 1.0 }).toBuffer();
        if (buf.length <= X_MAX_BYTES) return { buffer: buf, contentType: 'image/png', ext: 'png' };
      }
      // Could not get PNG under the cap; fall through to JPEG.
      logger.warn('X-ready PNG could not get under 1 MB; falling back to JPEG');
    }

    let last = null;
    for (let q = 88; q >= 40; q -= 6) {
      const buf = await base.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer();
      last = buf;
      if (buf.length <= X_MAX_BYTES) return { buffer: buf, contentType: 'image/jpeg', ext: 'jpg' };
    }
    // Even at the lowest quality it was too big (very unlikely at 1800x900).
    return last ? { buffer: last, contentType: 'image/jpeg', ext: 'jpg' } : null;
  } catch (e) {
    logger.warn(`Failed to build X-ready copy: ${e.message}`);
    return null;
  }
}

/**
 * Upload a buffer to Supabase storage with the correct content type and return
 * its public URL, or null on failure. Done inline (not via uploadImageToStorage)
 * because that helper hardcodes image/png.
 */
async function uploadXReady(buffer, contentType, ext) {
  try {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      await client.storage.createBucket(COVERS_BUCKET, { public: true, fileSizeLimit: 10485760 });
    } catch (e) { /* already exists is fine */ }
    const filename = `x-ready/cover-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    const { error } = await client.storage
      .from(COVERS_BUCKET)
      .upload(filename, buffer, { contentType, cacheControl: '31536000', upsert: true });
    if (error) {
      logger.warn(`X-ready upload failed: ${JSON.stringify(error)}`);
      return null;
    }
    const { data } = client.storage.from(COVERS_BUCKET).getPublicUrl(filename);
    return data && data.publicUrl ? data.publicUrl : null;
  } catch (e) {
    logger.warn(`X-ready upload threw: ${e.message}`);
    return null;
  }
}

/**
 * POST /api/cover-generator/for-article
 * Body: { title, content, sourceImageUrl?, network?, xFormat?, styleId?, useReference? }
 *   - useReference: false skips the source image even if provided (poor source images)
 *   - styleId: pin a specific style; omit to rotate through the catalog (no-ref only)
 * Returns: { success, imageUrl, xReadyUrl, symbolUsed, mode, styleUsed, usedReference }
 */
router.post('/for-article', async (req, res) => {
  const started = Date.now();
  try {
    const { title, content, sourceImageUrl, network, xFormat, styleId, useReference, useSubject, bgColor, subject, buildings, paletteColors, textElements, concept } = req.body || {};
    if (!title && !sourceImageUrl && !network) {
      return res.status(400).json({ success: false, error: 'Provide at least a title, network, or sourceImageUrl' });
    }

    // Background color override. When black is requested we also add a strong
    // customPrompt directive (which the generator gives priority) so even styles
    // with a hardcoded colored background come out black.
    const blackBg = typeof bgColor === 'string' && /(^#?0{3,6}$)|black/i.test(bgColor.trim());
    const bgDirective = blackBg ? 'The background must be solid pure black, ignore any other background color.' : '';
    let bgFields = bgColor ? { bgColor } : {};

    let symbol = await resolveSymbol(network, title, content);
    // Source referencing is OFF by default: it pulled too much from the source
    // image and produced derivative covers. Covers now rotate through the
    // curated styles instead. A caller must explicitly pass useReference: true
    // (and a sourceImageUrl) to opt back in; nothing does today.
    const wantReference = useReference === true;
    const refUrls = (wantReference && sourceImageUrl && typeof sourceImageUrl === 'string') ? [sourceImageUrl] : [];
    const usingReference = refUrls.length > 0;

    // With a reference image the generator uses style_reference mode and ignores
    // styleId, so only rotate a curated style when NOT using a reference.
    const chosenStyle = usingReference ? null : (styleId || await nextStyleId());

    // The Article-Studio news collage renders real factual text clippings; the
    // plain collage (Cover Generator) never does. Both share the flat layout,
    // palette and subject handling.
    const isCollageNews = chosenStyle === '32b_editorial_collage_news';
    const isCollage = chosenStyle === '32_editorial_collage' || isCollageNews;

    // Glass styles: fill the {{3D_ELEMENTS}} slot (customSubject). A caller
    // `subject` wins, else auto-derive. The collage fills the same slot from its
    // picked buildings + subjects instead (below), so skip the glass derive here.
    const wantSubject = useSubject !== false && !isCollage;
    let visualSubject = null;
    if (wantSubject && chosenStyle) {
      if (subject && typeof subject === 'string' && subject.trim()) {
        visualSubject = subject.trim();
      } else if (title) {
        visualSubject = await deriveVisualSubject(title, content);
      }
    }

    // Flat collage: subjects (picked buildings + typed/focal subjects) fill the
    // {{3D_ELEMENTS}} slot via customSubject, unified with the Cover Generator
    // path. The article theme, the bespoke concept, and the truthful text
    // clippings (news style only) go through customPrompt.
    let collageDirective = '';
    if (isCollage) {
      const items = [];
      if (Array.isArray(buildings)) items.push(...buildings.filter(b => typeof b === 'string' && b.trim()).slice(0, 4).map(b => b.trim()));
      if (subject && typeof subject === 'string' && subject.trim()) items.push(subject.trim());
      if (items.length) visualSubject = items.join(', ');
      // News collage is fully art-directed: signal CONCEPT mode so getStylePrompt
      // defers the layout to the scene below instead of a random template.
      if (isCollageNews) visualSubject = `CONCEPT|${visualSubject || ''}`;

      if (isCollageNews && concept && typeof concept === 'string' && concept.trim()) {
        collageDirective += ` SCENE (build the entire composition exactly from this): ${concept.trim()}.`;
      }
      if (title) {
        collageDirective += isCollageNews
          ? ` Story context, do NOT render this sentence as visible text in the image: ${title}.`
          : ` Thematically reflect this specific news topic, without rendering any text or words: ${title}.`;
      }
      // Text clippings for the news collage. When none are supplied (text off),
      // force a purely visual cover so the title never leaks in as text.
      const textList = (isCollageNews && Array.isArray(textElements))
        ? textElements.map(e => (typeof e === 'string' ? { text: e, emphasis: false } : e))
            .filter(e => e && e.text && String(e.text).trim()).slice(0, 5)
        : [];
      if (isCollageNews && textList.length) {
        const phrases = textList.map(e => `"${String(e.text).trim()}"`).join(', ');
        collageDirective += ` Render EXACTLY these short factual text clippings, each on its own torn paper scrap, spelled exactly as written and adding no other text: ${phrases}. Each phrase appears ONCE only — never duplicate or repeat any clipping, headline, or phrase anywhere in the image.`;
        const emph = textList.filter(e => e.emphasis).map(e => `"${String(e.text).trim()}"`);
        if (emph.length) collageDirective += ` Highlight or underline these key figures in an accent color: ${emph.join(', ')}.`;
      } else if (isCollageNews) {
        collageDirective += ` This is a PURELY VISUAL cover: render NO text, NO words, NO letters, NO numbers, and NO headlines anywhere in the image.`;
      }
      collageDirective = collageDirective.trim();

      // Two-accent-color palette: custom pair or a rotating preset. Black bg + 2 pops, rest B&W.
      const pal = (Array.isArray(paletteColors) && paletteColors.length === 2 && paletteColors.every(isHexColor))
        ? paletteColors
        : nextCollagePalette();
      bgFields = { bgColor: '#000000', elementColor: pal[0], accentLightColor: pal[1] };
    }

    const coverCustomPrompt = [bgDirective, collageDirective].filter(Boolean).join(' ');

    let generated = null;
    let mode = null;
    let symbolUsed = null;

    // Attempt logo mode first when we have a symbol.
    if (symbol) {
      const logoBody = {
        network: symbol,
        title: title || '',
        referenceImageUrls: refUrls,
        referenceMode: 'style_reference',
        ...(chosenStyle ? { styleId: chosenStyle } : {}),
        ...(visualSubject ? { customSubject: visualSubject } : {}),
        ...bgFields,
        ...(coverCustomPrompt ? { customPrompt: coverCustomPrompt } : {})
      };
      try {
        generated = await callGenerator(logoBody);
        mode = 'logo';
        symbolUsed = symbol;
      } catch (e) {
        if (e.status === 422) {
          logger.info(`for-article: no logo for ${symbol}, falling back to background-only`);
        } else {
          throw e; // real failure, surface it
        }
      }
    }

    // Background-only fallback (also the path when no symbol was detected).
    if (!generated) {
      const bgBody = {
        network: '', // empty string, NOT omitted (avoids the generate 500 at network.toUpperCase)
        title: title || '',
        referenceImageUrls: refUrls,
        referenceMode: 'style_reference',
        customPrompt: [coverCustomPrompt, (!isCollage && title) ? `Editorial crypto news cover reflecting: ${title}` : ''].filter(Boolean).join(' '),
        ...(chosenStyle ? { styleId: chosenStyle } : {}),
        ...(visualSubject ? { customSubject: visualSubject } : {}),
        ...bgFields
      };
      generated = await callGenerator(bgBody);
      mode = 'background';
      symbolUsed = null;
    }

    const imageUrl = generated.imageUrl;

    // Build + host the X-ready copy. Never fail the request if this part fails.
    let xReadyUrl = null;
    if (imageUrl) {
      // Default to PNG (palette-quantized to fit under 1 MB); JPEG only if asked.
      const xCopy = await buildXReadyCopy(imageUrl, xFormat === 'jpeg' ? 'jpeg' : 'png');
      if (xCopy) {
        xReadyUrl = await uploadXReady(xCopy.buffer, xCopy.contentType, xCopy.ext);
      }
    }

    const duration = `${((Date.now() - started) / 1000).toFixed(1)}s`;
    logger.info(`for-article cover ready (mode=${mode}, symbol=${symbolUsed || 'none'}, xReady=${xReadyUrl ? 'yes' : 'no'}) in ${duration}`);

    return res.json({
      success: true,
      imageUrl,
      xReadyUrl,
      symbolUsed,
      mode,
      styleUsed: chosenStyle,
      subjectUsed: visualSubject,
      usedReference: usingReference,
      duration
    });
  } catch (error) {
    logger.error(`for-article failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ASYNC COVER GENERATION (persistence for the Cover Generator tab)
 *
 * These wrap the LIVE /generate path as a background job so a generation is
 * never lost when the user refreshes or leaves the page. The generator itself is
 * unchanged; we forward the exact same body over localhost and store the result
 * on a job the client can poll.
 */
async function runCoverJob(jobId, body) {
  try {
    // Editorial Collage with a title: derive a bespoke interacting-metaphor
    // concept from the title so the elements tell a story instead of being
    // placed side by side. Scoped to the collage; other styles are untouched.
    const centeredRequested = /^\s*CENTERED_LOGO\|/.test(String((body && body.customSubject) || ''));
    if (body && body.styleId === '32_editorial_collage' && body.title && String(body.title).trim() && !centeredRequested) {
      try {
        coverJobService.updateJob(jobId, { progress: 15, stepLabel: 'Art-directing the composition' });
        const rawSubj = String(body.customSubject || '').replace(/^(?:\s*[A-Z_]+\|)+/, '').trim();
        const ad = await artDirect({ title: body.title, subjects: rawSubj, logoSymbol: body.network, withText: false });
        if (ad && ad.image_prompt) {
          const sceneText = `SCENE (build the entire composition exactly from this): ${ad.image_prompt}${ad.logo_treatment ? ` The ${body.network || 'brand'} logo: ${ad.logo_treatment}.` : ''}`;
          body.customPrompt = [body.customPrompt, sceneText].filter(Boolean).join(' ');
          // Subjects fill {{3D_ELEMENTS}}: user-typed subjects win, else the art-director's.
          const subjParts = [ad.focal_subject, ...(ad.supporting_subjects || [])].filter(Boolean).join(', ');
          // CONCEPT sentinel makes getStylePrompt defer the layout to this scene.
          body.customSubject = `CONCEPT|${rawSubj || subjParts}`;
        }
      } catch (ce) { logger.warn(`art-direction failed (${jobId}): ${ce.message}`); }
    }
    coverJobService.updateJob(jobId, { progress: 30, stepLabel: 'Generating' });
    const data = await callGenerator(body); // throws on failure (incl. 422)
    coverJobService.updateJob(jobId, {
      status: 'completed', progress: 100, stepLabel: 'Complete', result: data
    });
  } catch (e) {
    // Surface the strict-logo-guard case in a friendly way; otherwise the error.
    const msg = e.status === 422
      ? 'No uploaded logo for the selected network. Upload the logo first, or pick another.'
      : (e.message || 'Generation failed');
    logger.warn(`cover job failed (${jobId}): ${msg}`);
    coverJobService.updateJob(jobId, { status: 'failed', error: msg });
  }
}

/**
 * POST /api/cover-generator/generate-async
 * Body: identical to /generate. Returns { success, jobId } immediately.
 */
router.post('/generate-async', async (req, res) => {
  try {
    const body = req.body || {};
    const title = body.title || (Array.isArray(body.networks) ? body.networks.join(', ') : body.network) || 'Cover';
    const job = coverJobService.createJob({ title });
    runCoverJob(job.id, body).catch((e) => {
      logger.error(`cover job ${job.id} crashed: ${e.message}`);
      coverJobService.updateJob(job.id, { status: 'failed', error: e.message });
    });
    return res.json({ success: true, jobId: job.id });
  } catch (error) {
    logger.error(`generate-async failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cover-generator/job/:jobId
 * Returns the job status and, when completed, the full generate result.
 */
router.get('/job/:jobId', async (req, res) => {
  const job = await coverJobService.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'job not found' });
  return res.json({ success: true, ...coverJobService.publicView(job) });
});

module.exports = router;
