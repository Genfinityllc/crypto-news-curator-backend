const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const logger = require('../utils/logger');

const LOGO_DIR = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../../uploads/png-logos')
  : '/Users/valorkopeny/Desktop/crypto-news-curator-backend/uploads/png-logos';

const SYMBOL_ALIASES = {
  TAO: 'BITTENSOR',
  ADA: 'CARDANO',
  RUNE: 'THORCHAIN',
  TIA: 'CELESTIA',
  ATOM: 'COSMOS',
  DOT: 'POLKADOT',
  MATIC: 'POLYGON',
  AVAX: 'AVALANCHE',
  HBAR: 'HEDERA',
  BNB: 'BNB',
  SOL: 'SOLANA',
  BTC: 'BITCOIN',
  ETH: 'ETHEREUM',
};

const cache = new Map();

// Explicit overrides: when the standard PNG is monochrome but a color
// variant exists in the same directory, prefer the color variant for palette
// extraction. (The standard PNG is still used for compositing.)
const COLOR_VARIANT_OVERRIDES = {
  UPHOLD: 'Uphold-1.png',
  BITCOIN: 'BTC.png',
  BTC: 'BTC.png',
};

function resolveLogoPath(symbol) {
  if (!symbol) return null;
  const upper = symbol.toUpperCase();
  const aliased = SYMBOL_ALIASES[upper] || upper;

  let files;
  try { files = fs.readdirSync(LOGO_DIR); } catch (_) { return null; }

  // 1) Explicit color-variant override
  if (COLOR_VARIANT_OVERRIDES[upper]) {
    const override = files.find(f => f.toLowerCase() === COLOR_VARIANT_OVERRIDES[upper].toLowerCase());
    if (override) return path.join(LOGO_DIR, override);
  }

  // 2) Try common color-variant suffixes: SYMBOL_FULL, SYMBOL_COLOR, SYMBOL-1
  const colorSuffixes = ['_FULL', '_COLOR', '-1'];
  for (const base of [aliased, upper, symbol]) {
    for (const suf of colorSuffixes) {
      const match = files.find(f => f.toLowerCase() === `${base.toLowerCase()}${suf.toLowerCase()}.png`);
      if (match) return path.join(LOGO_DIR, match);
    }
  }

  // 3) Plain SYMBOL.png
  for (const base of [aliased, upper, symbol]) {
    const match = files.find(f => f.toLowerCase() === `${base.toLowerCase()}.png`);
    if (match) return path.join(LOGO_DIR, match);
  }

  return null;
}

function rgbToHex(r, g, b) {
  const h = n => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r: h = 60 * (((g - b) / d) % 6); break;
      case g: h = 60 * ((b - r) / d + 2); break;
      case b: h = 60 * ((r - g) / d + 4); break;
    }
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

function describeColor(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  // Achromatic
  if (s < 0.12) {
    if (l < 0.12) return 'black';
    if (l < 0.3) return 'dark gray';
    if (l > 0.88) return 'white';
    if (l > 0.7) return 'light gray';
    return 'gray';
  }
  // Lightness modifier
  let lightMod = '';
  if (l < 0.25) lightMod = 'deep ';
  else if (l < 0.4) lightMod = 'dark ';
  else if (l > 0.75) lightMod = 'light ';
  else if (s > 0.7 && l > 0.4 && l < 0.65) lightMod = 'vivid ';
  // Hue name
  let name;
  if (h < 15 || h >= 345) name = 'red';
  else if (h < 35) name = 'orange';
  else if (h < 50) name = 'amber';
  else if (h < 70) name = 'yellow';
  else if (h < 95) name = 'lime';
  else if (h < 150) name = 'green';
  else if (h < 175) name = 'teal';
  else if (h < 200) name = 'cyan';
  else if (h < 235) name = 'blue';
  else if (h < 270) name = 'indigo';
  else if (h < 300) name = 'purple';
  else if (h < 330) name = 'magenta';
  else name = 'pink';
  return `${lightMod}${name}`.trim();
}

/**
 * Quantize a pixel to a 32-step grid per channel for clustering.
 */
function quantizeKey(r, g, b) {
  const q = v => v >> 5; // 32 buckets per channel = 32768 total
  return (q(r) << 10) | (q(g) << 5) | q(b);
}

function bucketCenter(key) {
  const b = (key & 31) << 5;
  const g = ((key >> 5) & 31) << 5;
  const r = ((key >> 10) & 31) << 5;
  return { r: r | 16, g: g | 16, b: b | 16 };
}

/**
 * Extract the top N dominant non-background colors from a PNG logo.
 * Ignores: fully transparent pixels, near-white, near-black, near-gray.
 * Returns: [{ hex, rgb, name, share }] sorted by share descending.
 */
async function extractPaletteFromPath(pngPath, { maxColors = 4 } = {}) {
  const cacheKey = `${pngPath}|${maxColors}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let image;
  try {
    image = sharp(pngPath).resize(64, 64, { fit: 'inside', withoutEnlargement: false }).ensureAlpha();
  } catch (e) {
    logger.warn(`logoPalette: failed to open ${pngPath}: ${e.message}`);
    return [];
  }

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = info.channels === 4 ? data[i + 3] : 255;
    if (a < 64) continue; // skip transparent
    // skip near-white / near-black
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 16 && g < 16 && b < 16) continue;
    // skip near-gray (low saturation)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 16) continue;

    const key = quantizeKey(r, g, b);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  if (counts.size === 0) {
    cache.set(cacheKey, []);
    return [];
  }

  // Sort buckets by frequency
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, c]) => s + c, 0);

  // Pick top N, but suppress very-close duplicates (within ~40 RGB distance)
  const picked = [];
  for (const [key, count] of sorted) {
    const { r, g, b } = bucketCenter(key);
    const tooClose = picked.some(p => {
      const dr = p.rgb.r - r, dg = p.rgb.g - g, db = p.rgb.b - b;
      return Math.sqrt(dr * dr + dg * dg + db * db) < 40;
    });
    if (tooClose) continue;
    picked.push({
      hex: rgbToHex(r, g, b),
      rgb: { r, g, b },
      name: describeColor(r, g, b),
      share: count / total,
    });
    if (picked.length >= maxColors) break;
  }

  cache.set(cacheKey, picked);
  return picked;
}

/**
 * Extract palette by crypto symbol. Returns [] if no PNG exists.
 */
async function extractPaletteForSymbol(symbol, opts) {
  const pngPath = resolveLogoPath(symbol);
  if (!pngPath) {
    logger.info(`🎨 logoPalette: no PNG for ${symbol}`);
    return [];
  }
  try {
    const palette = await extractPaletteFromPath(pngPath, opts);
    if (palette.length === 0) {
      logger.info(`🎨 logoPalette ${symbol}: no significant colors found`);
    } else {
      const summary = palette.map(p => `${p.name}(${p.hex}, ${(p.share * 100).toFixed(0)}%)`).join(', ');
      logger.info(`🎨 logoPalette ${symbol}: ${summary}`);
    }
    return palette;
  } catch (e) {
    logger.warn(`logoPalette: extract failed for ${symbol}: ${e.message}`);
    return [];
  }
}

/**
 * Build a short prompt fragment that names the brand colors.
 * e.g. "preserve the brand palette of XRP: deep gray (#2a2a2a), vivid orange (#ff6b1c)"
 */
function paletteToPromptFragment(symbol, palette) {
  if (!palette || palette.length === 0) return '';
  const parts = palette.map(p => `${p.name} ${p.hex}`).join(', ');
  return `preserve the exact brand palette of ${symbol.toUpperCase()} (${parts}) on the logo — do not shift hues`;
}

module.exports = {
  extractPaletteForSymbol,
  extractPaletteFromPath,
  paletteToPromptFragment,
  describeColor,
  resolveLogoPath,
};
