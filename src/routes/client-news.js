/**
 * Client News: one feed for the clients in ../data/clients.js.
 *
 *   GET /api/client-news               every client's articles, newest first
 *   GET /api/client-news?client=hedera one client's
 *   GET /api/client-news/clients       just the client list with counts
 *
 * Reads the articles table directly (no live RSS run, no "must have a
 * picture" filter), so it answers quickly and the counts always match the
 * list. An article is listed under every client it names, whatever single
 * network it was stored under.
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();
const logger = require('../utils/logger');
const { getSupabaseClient } = require('../config/supabase');
const {
  CLIENTS, CLIENT_NETWORK_NAMES, NOT_CLIENT_FILTER, CLIENT_RETENTION_DAYS, GENERAL_RETENTION_DAYS,
  matchClients, isNotNews, clientFeed
} = require('../data/clients');

const COLUMNS = 'id,title,content,summary,url,source,author,published_at,category,network,tags,is_breaking,cover_image,viral_score,readability_score,created_at,metadata';
const FRESH_MS = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

let cache = null; // { at, articles }
let loading = null;

const realPicture = (url) => !!url && /^https?:\/\//.test(url) && !/placehold|placeholder/.test(url);

// "Story - Publisher" and "Story" are the same story
const storyKey = (title) =>
  String(title || '')
    .replace(/\s[-|]\s[^-|]{2,40}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// The stored source is often the feed's address. Show a name instead.
function sourceName(source) {
  const raw = String(source || '').replace(/\s*\(via Google News\)\s*$/i, '').trim();
  if (!/^https?:\/\//i.test(raw)) return raw || 'Unknown';
  const feed = clientFeed(raw);
  if (feed && feed.label) return feed.label;
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch (e) {
    return raw;
  }
}

async function readArticles() {
  const db = getSupabaseClient();
  if (!db) throw new Error('The article store is not available.');
  const since = (days) => new Date(Date.now() - days * DAY).toISOString();

  const [tagged, general] = await Promise.all([
    // stored under a client
    db.from('articles').select(COLUMNS)
      .in('network', CLIENT_NETWORK_NAMES)
      .gte('published_at', since(CLIENT_RETENTION_DAYS))
      .order('published_at', { ascending: false })
      .limit(1000),
    // stored under something else, but may still name a client
    db.from('articles').select(COLUMNS)
      .or(NOT_CLIENT_FILTER)
      .gte('published_at', since(GENERAL_RETENTION_DAYS))
      .order('published_at', { ascending: false })
      .limit(1000)
  ]);
  if (tagged.error) throw new Error(tagged.error.message);
  if (general.error) throw new Error(general.error.message);

  const out = [];
  const seen = new Map(); // story -> index in out
  const add = (row, ids) => {
    if (!ids.length || isNotNews(row.title)) return;
    const { metadata, ...rest } = row;
    const article = {
      ...rest,
      source: sourceName(row.source),
      cover_image: realPicture(row.cover_image) ? row.cover_image : null,
      image_url: realPicture(row.cover_image) ? row.cover_image : null,
      clients: ids
    };
    const key = storyKey(row.title);
    if (key && seen.has(key)) {
      const at = seen.get(key);
      const kept = out[at];
      const clients = CLIENTS.map((c) => c.id).filter((id) => kept.clients.includes(id) || ids.includes(id));
      // the same story twice: keep the copy that has a picture
      out[at] = !kept.cover_image && article.cover_image ? { ...article, clients } : { ...kept, clients };
      return;
    }
    if (key) seen.set(key, out.length);
    out.push(article);
  };

  for (const row of tagged.data || []) {
    const named = matchClients(row.title, row.content || row.summary).ids;
    // A post from a client's own blog belongs to that client even when it
    // never says the name. Anything else has to name the client: the stored
    // network alone is not proof (older rows were tagged by looser rules).
    const feed = clientFeed((row.metadata && row.metadata.feedUrl) || row.source);
    const own = feed && feed.official ? feed.client : null;
    add(row, CLIENTS.map((c) => c.id).filter((id) => named.includes(id) || id === own));
  }
  for (const row of general.data || []) {
    add(row, matchClients(row.title, row.content || row.summary).ids);
  }

  out.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  return out;
}

async function load() {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.articles;
  if (!loading) {
    loading = readArticles()
      .then((articles) => {
        cache = { at: Date.now(), articles };
        fillPictures().catch(() => {});
        return articles;
      })
      .finally(() => {
        loading = null;
      });
  }
  try {
    return await loading;
  } catch (error) {
    if (cache) return cache.articles; // an older answer beats none
    throw error;
  }
}

const clientList = (articles, base) =>
  CLIENTS.map((c) => ({
    id: c.id,
    name: c.name,
    displayName: c.displayName,
    symbol: c.symbol,
    color: c.color,
    description: c.description,
    website: c.website,
    logo: `${base}/api/cover-generator/logo-preview/${c.logoSymbol}`,
    count: articles.filter((a) => a.clients.includes(c.id)).length
  }));

const baseOf = (req) => `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;

const list = async (req, res) => {
  try {
    const all = await load();
    const want = String(req.query.client || 'all').toLowerCase();
    if (want !== 'all' && !CLIENTS.some((c) => c.id === want)) {
      return res.status(404).json({ success: false, message: `No client called "${want}".`, clients: CLIENTS.map((c) => c.id) });
    }
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 500));
    const mine = want === 'all' ? all : all.filter((a) => a.clients.includes(want));
    const base = baseOf(req);
    const logoOf = new Map(CLIENTS.map((c) => [c.id, `${base}/api/cover-generator/logo-preview/${c.logoSymbol}`]));
    res.json({
      success: true,
      // an article without a picture shows its client's logo instead
      data: mine.slice(0, limit).map((a) => ({
        ...a,
        fallback_logo: logoOf.get(want !== 'all' ? want : a.clients[0])
      })),
      total: mine.length,
      clients: clientList(all, base),
      meta: {
        client: want,
        keptDays: CLIENT_RETENTION_DAYS,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Client news failed:', error.message);
    res.status(500).json({ success: false, message: 'Client news could not be read.', error: error.message, data: [] });
  }
};

router.get('/', list);
router.get('/cached', list); // the old address the site used for the same thing

router.get('/clients', async (req, res) => {
  try {
    const all = await load();
    res.json({ success: true, data: clientList(all, baseOf(req)), total: all.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Client news could not be read.', error: error.message, data: [] });
  }
});

// ---------------------------------------------------------------------------
// Pictures. Search results and some blogs come without one. For client
// articles that have none, read the page's own preview picture (og:image),
// a few at a time, and store it. Each article is tried once per server start.
// ---------------------------------------------------------------------------

const tried = new Set();
let filling = false;
let lastFill = 0;

async function previewPicture(url) {
  const response = await axios.get(url, {
    timeout: 8000,
    maxRedirects: 4,
    maxContentLength: 2 * 1024 * 1024,
    responseType: 'text',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GenfinityNews/1.0; link preview)',
      Accept: 'text/html'
    },
    validateStatus: (s) => s >= 200 && s < 300
  });
  const head = String(response.data || '').slice(0, 300000);
  const tag =
    head.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*>/i);
  if (!tag) return null;
  const content = tag[0].match(/content=["']([^"']+)["']/i);
  if (!content) return null;
  let picture = content[1].replace(/&amp;/g, '&').trim();
  if (picture.startsWith('//')) picture = `https:${picture}`;
  else if (picture.startsWith('/')) picture = new URL(picture, url).href;
  if (!/^https:\/\//.test(picture)) return null;
  if (/googleusercontent\.com|gstatic\.com|news\.google\.com/.test(picture)) return null; // Google's generic tile
  return picture;
}

async function fillPictures() {
  if (filling || Date.now() - lastFill < 5 * 60 * 1000) return;
  const db = getSupabaseClient();
  if (!db) return;
  filling = true;
  lastFill = Date.now();
  try {
    const { data, error } = await db.from('articles').select('id,url,title')
      .in('network', CLIENT_NETWORK_NAMES)
      .is('cover_image', null)
      .order('published_at', { ascending: false })
      .limit(200);
    if (error || !data) return;
    const todo = data
      .filter((a) => !tried.has(a.id) && /^https?:\/\//.test(a.url || '') && !/news\.google\.com/.test(a.url))
      .slice(0, 12);
    let found = 0;
    for (const article of todo) {
      tried.add(article.id);
      try {
        // eslint-disable-next-line no-await-in-loop
        const picture = await previewPicture(article.url);
        if (picture) {
          // eslint-disable-next-line no-await-in-loop
          await db.from('articles').update({ cover_image: picture }).eq('id', article.id);
          found += 1;
        }
      } catch (e) {
        // the page would not load: leave the article without a picture
      }
    }
    if (found) {
      cache = null; // show them on the next read
      logger.info(`Client news: stored ${found} preview picture(s) of ${todo.length} tried`);
    }
  } finally {
    filling = false;
  }
}

module.exports = router;
module.exports.loadClientNews = load;
module.exports.clientList = clientList;
