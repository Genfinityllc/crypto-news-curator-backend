/**
 * Genfinity's clients: THE one list.
 *
 * Everything that needs to know who the clients are reads it from here:
 * tagging articles as they come in (newsService), how long they are kept
 * (intelligentArticleManager, articlePurgeService, supabase.getArticles),
 * the client feed and its counts (routes/client-news.js) and the buttons the
 * site shows (routes/client-networks.js).
 *
 * To add or remove a client, change CLIENTS and nothing else.
 * Current list set by the owner on 2026-11-18: Hedera, HashPack, XDC, Solana, Canton.
 */

const GOOGLE = (q) => `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;

const CLIENTS = [
  {
    id: 'hedera',
    name: 'Hedera', // the value stored in articles.network
    displayName: 'Hedera',
    symbol: 'HBAR',
    logoSymbol: 'HBAR', // /api/cover-generator/logo-preview/<logoSymbol>
    color: '#8259EF',
    description: 'Enterprise hashgraph network',
    website: 'https://hedera.com',
    words: ['hedera', 'hbar', 'hashgraph'],
    feeds: [
      { url: 'https://hedera.com/blog/feed/', official: true, label: 'Hedera blog' },
      { url: 'https://crypto.news/tag/hedera/feed/' },
      { url: 'https://cointelegraph.com/rss/tag/hedera' },
      { url: GOOGLE('Hedera+OR+HBAR+OR+Hashgraph+when:14d') }
    ]
  },
  {
    id: 'hashpack',
    name: 'HashPack',
    displayName: 'HashPack',
    symbol: 'PACK',
    logoSymbol: 'PACK',
    color: '#5B7CFA',
    description: 'Hedera wallet',
    website: 'https://www.hashpack.app',
    words: ['hashpack', 'hash pack'],
    patterns: [/\$pack\b/i],
    feeds: [
      // HashPack's own blog has no feed (404 on 2026-11-18), so a search is all there is.
      { url: GOOGLE('HashPack+when:30d') }
    ]
  },
  {
    id: 'xdc',
    name: 'XDC Network',
    displayName: 'XDC',
    symbol: 'XDC',
    logoSymbol: 'XDC',
    color: '#2A9FD6',
    description: 'Trade finance and payments network',
    website: 'https://xdc.org',
    words: ['xdc', 'xinfin'],
    feeds: [
      { url: 'https://medium.com/feed/xdcnetwork', official: true, label: 'XDC Network on Medium' },
      { url: 'https://crypto.news/tag/xdc-network/feed/' },
      { url: GOOGLE('%22XDC+Network%22+OR+XinFin+OR+%22XDC+price%22+when:30d') }
    ]
  },
  {
    id: 'solana',
    name: 'Solana',
    displayName: 'Solana',
    symbol: 'SOL',
    logoSymbol: 'SOLANA',
    color: '#14F195',
    description: 'High-throughput smart contract network',
    website: 'https://solana.com',
    words: ['solana'],
    patterns: [/\$SOL\b/, /\bSOL\b/], // capitals only: "sol" is also a word
    // Solana is written about all day, so a passing mention in the opening
    // lines is not enough: the headline has to name it.
    headlineOnly: true,
    feeds: [
      { url: 'https://crypto.news/tag/solana/feed/' },
      { url: 'https://cointelegraph.com/rss/tag/solana' }
    ]
  },
  {
    id: 'canton',
    name: 'Canton',
    displayName: 'Canton',
    symbol: 'CC',
    logoSymbol: 'CANTON',
    color: '#F3FF97',
    description: 'Institutional network by Digital Asset',
    website: 'https://www.canton.network',
    words: [
      'canton network', 'canton coin', 'canton foundation', 'canton protocol',
      'canton blockchain', 'canton ledger', 'canton token', 'canton ecosystem',
      'canton mainnet', 'canton validator', 'canton summit', 'canton-based'
    ],
    // "Canton" alone is also a city, a fair and a Swiss region. Count it only
    // next to words that place it in finance or crypto, and never next to a place.
    loose: {
      word: 'canton',
      near: [
        'digital asset', 'daml', 'tokeniz', 'blockchain', 'crypto', 'stablecoin',
        'on-chain', 'onchain', 'ledger', 'validator', 'settlement', 'collateral',
        'treasur', 'dtcc', 'institutional', 'defi', 'rwa'
      ],
      not: [
        'ohio', 'guangzhou', 'canton fair', 'swiss', 'switzerland', 'zug', 'ticino',
        'canton of', 'township', 'michigan', 'mississippi', 'massachusetts', 'georgia'
      ]
    },
    feeds: [
      { url: 'https://www.canton.network/blog/rss.xml', official: true, label: 'Canton Network blog' },
      { url: 'https://www.canton.network/canton-network-press-releases/rss.xml', official: true, label: 'Canton Network press release' },
      { url: GOOGLE('%22Canton+Network%22+OR+%22Canton+Coin%22+when:30d') }
    ]
  }
];

// When a headline names two clients, the narrower one wins the stored tag
// (a HashPack story nearly always says Hedera too). The feed still lists the
// article under every client it names.
const TAG_ORDER = ['hashpack', 'canton', 'xdc', 'hedera', 'solana'];

// A client's stories are far rarer than general news, so they are kept longer.
const CLIENT_RETENTION_DAYS = 30;
const GENERAL_RETENTION_DAYS = 4;

const CLIENT_NETWORK_NAMES = CLIENTS.map((c) => c.name);
// "Not a client's" as a database filter, for .or(): a plain NOT IN silently
// skips rows whose network is empty, which then are never counted or cleaned up.
const NOT_CLIENT_FILTER = `network.is.null,network.not.in.(${CLIENT_NETWORK_NAMES.map((n) => `"${n}"`).join(',')})`;
const byId = new Map(CLIENTS.map((c) => [c.id, c]));
const byName = new Map(CLIENTS.map((c) => [c.name.toLowerCase(), c]));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = new Map();
function hasWord(text, word) {
  if (!wordRe.has(word)) wordRe.set(word, new RegExp(`(^|[^a-z0-9])${esc(word)}(?![a-z0-9])`, 'i'));
  return wordRe.get(word).test(text);
}

// The client is named outright in this text.
function named(client, text) {
  if (!text) return false;
  if (client.words.some((w) => hasWord(text, w))) return true;
  return !!client.patterns && client.patterns.some((re) => re.test(text));
}

// The client's loose word is in `where`, and the whole article places it.
function namedLoosely(client, where, whole) {
  if (!client.loose || !where || !hasWord(where, client.loose.word)) return false;
  const low = whole.toLowerCase();
  if (client.loose.not.some((n) => low.includes(n))) return false;
  return client.loose.near.some((n) => low.includes(n));
}

/**
 * Which clients an article is about.
 * -> { ids: every client it names (CLIENTS order), tag: the one client to store, inHeadline }
 */
function matchClients(title, body) {
  const head = String(title || '');
  const rest = String(body || '').replace(/<[^>]*>/g, ' ');
  const whole = `${head} ${rest}`;
  const inHead = [];
  const inBody = [];
  for (const c of CLIENTS) {
    if (named(c, head) || namedLoosely(c, head, whole)) inHead.push(c.id);
    else if (!c.headlineOnly && (named(c, rest) || namedLoosely(c, rest, whole))) inBody.push(c.id);
  }
  const ids = CLIENTS.map((c) => c.id).filter((id) => inHead.includes(id) || inBody.includes(id));
  const pick = (list) => TAG_ORDER.find((id) => list.includes(id)) || null;
  const tag = pick(inHead) || pick(inBody);
  return { ids, tag, inHeadline: inHead.length > 0 };
}

// Search results that are not articles: price pages, "how to buy" pages, share tickers.
const NOT_NEWS = [
  /\blive price\b/i, /\bprice today\b/i, /\bprice \([a-z]{2,6}\/[a-z]{3}\)/i, /market cap (&|and) chart/i,
  /\bhow to buy\b/i, /\bbuy\b.{1,60}\bwith (a )?(credit|debit)/i, /\blive share prices?\b/i,
  /\bconverter\b/i, /\bto usd\b/i, /\bprice,? charts?\b/i,
  // paid token-sale promotion that names a client to get into searches
  /\bpresale\b/i, /\btokens sold\b/i, /\b\d{2,}x (gains?|returns?|potential)\b/i, /\b\d{3,}% roi\b/i
];
const isNotNews = (title) => NOT_NEWS.some((re) => re.test(String(title || '')));

const isClientNetwork = (network) => !!network && byName.has(String(network).toLowerCase());

// The feeds read on every run for the clients, each marked with whose it is.
const CLIENT_FEEDS = CLIENTS.flatMap((c) => c.feeds.map((f) => ({ ...f, client: c.id })));
const feedByUrl = new Map(CLIENT_FEEDS.map((f) => [f.url, f]));

// Extra headline words that let a client story through the crypto-only gate.
const CLIENT_HEADLINE_SIGNALS = [
  'canton network', 'canton coin', 'canton foundation', 'hashpack', 'xdc', 'xinfin',
  'hedera', 'hbar', 'hashgraph', 'solana'
];

module.exports = {
  CLIENTS,
  CLIENT_NETWORK_NAMES,
  NOT_CLIENT_FILTER,
  CLIENT_FEEDS,
  CLIENT_HEADLINE_SIGNALS,
  CLIENT_RETENTION_DAYS,
  GENERAL_RETENTION_DAYS,
  matchClients,
  isNotNews,
  isClientNetwork,
  clientById: (id) => byId.get(String(id || '').toLowerCase()) || null,
  clientByName: (name) => byName.get(String(name || '').toLowerCase()) || null,
  clientFeed: (url) => feedByUrl.get(url) || null
};
