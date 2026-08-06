/**
 * PEOPLE REGISTRY — real public figures for the collage "People" subject group.
 *
 * Each entry has a real reference PORTRAIT stored in our own Supabase storage at
 * `logos/people/<slug>.jpg`. When a person is chosen as a collage subject, that
 * portrait is passed to the generator as a guarded reference image (the same
 * additive, style-preserving path as the seals) so the collage renders an
 * accurate, recognizable likeness instead of the model guessing.
 *
 * Editorial use: these are public figures depicted in a stylized news-cover
 * collage. Portraits are freely-licensed (Wikimedia) or user-provided.
 *
 * To add a person: upload `logos/people/<slug>.jpg` to Supabase and add an entry.
 */

const PEOPLE_IMAGE_BASE = 'https://daqxnvcfmepjzcgfdrdf.supabase.co/storage/v1/object/public/logos/people';

const PEOPLE = [
  { slug: 'trump', name: 'Donald Trump', org: 'U.S. President' },
  { slug: 'musk', name: 'Elon Musk', org: 'Tesla / X' },
  { slug: 'garlinghouse', name: 'Brad Garlinghouse', org: 'Ripple' },
  { slug: 'monicalong', name: 'Monica Long', org: 'Ripple' },
  { slug: 'schwartz', name: 'David Schwartz', org: 'Ripple' },
  { slug: 'hoskinson', name: 'Charles Hoskinson', org: 'Cardano' },
  { slug: 'baird', name: 'Leemon Baird', org: 'Hedera' },
  { slug: 'harmon', name: 'Mance Harmon', org: 'Hedera' },
  { slug: 'piscini', name: 'Eric Piscini', org: 'Hedera' },
  { slug: 'vitalik', name: 'Vitalik Buterin', org: 'Ethereum' },
  { slug: 'armstrong', name: 'Brian Armstrong', org: 'Coinbase' },
  { slug: 'saylor', name: 'Michael Saylor', org: 'Strategy (MicroStrategy)' },
  { slug: 'cz', name: 'Changpeng Zhao (CZ)', org: 'Binance' },
  { slug: 'justinsun', name: 'Justin Sun', org: 'Tron' },
  { slug: 'yakovenko', name: 'Anatoly Yakovenko', org: 'Solana' },
  { slug: 'denelledixon', name: 'Denelle Dixon', org: 'Stellar' },
  { slug: 'andreessen', name: 'Marc Andreessen', org: 'a16z' },
  { slug: 'dixon', name: 'Chris Dixon', org: 'a16z' },
  { slug: 'cameron', name: 'Cameron Winklevoss', org: 'Gemini' },
  { slug: 'tyler', name: 'Tyler Winklevoss', org: 'Gemini' },
  { slug: 'winklevoss', name: 'Winklevoss Twins', org: 'Gemini' },
  { slug: 'sbf', name: 'Sam Bankman-Fried', org: 'FTX' },
];

const PEOPLE_INDEX = PEOPLE.reduce((m, p) => { m[p.slug] = p; return m; }, {});

function getPerson(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return PEOPLE_INDEX[slug.trim().toLowerCase()] || null;
}

function listPeople() {
  return PEOPLE.map(p => ({
    slug: p.slug,
    name: p.name,
    org: p.org,
    imageUrl: `${PEOPLE_IMAGE_BASE}/${p.slug}.jpg`,
  }));
}

module.exports = { PEOPLE, getPerson, listPeople, PEOPLE_IMAGE_BASE };
