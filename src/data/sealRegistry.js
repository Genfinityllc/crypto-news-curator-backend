/**
 * GOVERNMENT / REGULATORY SEAL REGISTRY
 *
 * Every `grounded: true` entry corresponds to a REAL seal image stored in our
 * own Supabase storage at `logos/seals/<slug>.png` (public-domain U.S.
 * government works, plus the freely-usable EU emblem). Those images were
 * fetched from Wikimedia Commons, visually verified, and uploaded once. The
 * `description` for each grounded entry was written by reading the actual seal
 * (its central emblem, ring text, and colours) — it is NOT guessed.
 *
 * The seal is never fed to the image model as a literal reference image
 * (doing so would force the locked /generate handler into reference-mode and
 * discard the chosen style). Instead the `description` is injected as a faded
 * background-watermark instruction, which works on ANY style and keeps the
 * render faithful to the real seal while staying subtle and behind the scene.
 *
 * `grounded: false` entries are international regulators whose logos are NOT
 * public domain, so we do not store their image. Their `description` is a
 * best-effort, recognisable approximation for the faded-background use only.
 *
 * To add a real seal: drop a PNG into `logos/seals/<slug>.png` on Supabase and
 * add an entry here with grounded: true.
 */

const SEAL_IMAGE_BASE = 'https://daqxnvcfmepjzcgfdrdf.supabase.co/storage/v1/object/public/logos/seals';

const SEALS = [
  // ================= U.S. FEDERAL — financial & markets regulators =================
  { slug: 'sec', name: 'U.S. Securities and Exchange Commission (SEC)', region: 'U.S. Federal', grounded: true,
    description: "the circular navy-and-gold seal of the U.S. Securities and Exchange Commission: a spread-winged American eagle over a striped shield at the centre, the ring lettered 'U.S. SECURITIES AND EXCHANGE COMMISSION' with the date 'MCMXXXIV', deep navy field, gold engraving and a gold rope border" },
  { slug: 'cftc', name: 'Commodity Futures Trading Commission (CFTC)', region: 'U.S. Federal', grounded: true,
    description: "the circular seal of the Commodity Futures Trading Commission: an eagle perched above balanced scales of justice on a shield, rendered mostly in fine black-and-white line engraving with dark red accents, the ring lettered 'COMMODITY FUTURES TRADING COMMISSION 1975'" },
  { slug: 'federal-reserve', name: 'U.S. Federal Reserve', region: 'U.S. Federal', grounded: true,
    description: "the circular black-and-white seal of the Federal Reserve System: an American eagle clutching a shield and keys at the centre in fine monochrome engraving, the ring lettered 'FEDERAL RESERVE SYSTEM'" },
  { slug: 'federal-reserve-board', name: 'Federal Reserve Board of Governors', region: 'U.S. Federal', grounded: true,
    description: "the circular seal of the Board of Governors of the Federal Reserve System: a full-colour American eagle spreading its wings over a red-white-and-blue striped shield with an olive branch, navy ring lettered 'BOARD OF GOVERNORS OF THE FEDERAL RESERVE SYSTEM'" },
  { slug: 'treasury', name: 'U.S. Department of the Treasury', region: 'U.S. Federal', grounded: true,
    description: "the circular navy-and-gold seal of the U.S. Department of the Treasury: a gold chevron shield bearing balanced scales of justice above and a key below, thirteen stars across the chevron, the ring lettered 'THE DEPARTMENT OF THE TREASURY 1789'" },
  { slug: 'fincen', name: 'Financial Crimes Enforcement Network (FinCEN)', region: 'U.S. Federal', grounded: true,
    description: "the circular navy-and-gold seal of FinCEN: a gold chevron shield with balanced scales of justice and a key (Treasury lineage) on a deep navy field, the ring lettered 'FINANCIAL CRIMES ENFORCEMENT NETWORK'" },
  { slug: 'occ', name: 'Office of the Comptroller of the Currency (OCC)', region: 'U.S. Federal', grounded: true,
    description: "the circular blue-and-gold seal of the Office of the Comptroller of the Currency: gold scales of justice above a chevron shield with a key, the ring lettered 'OFFICE OF THE COMPTROLLER OF THE CURRENCY'" },
  { slug: 'fdic', name: 'Federal Deposit Insurance Corporation (FDIC)', region: 'U.S. Federal', grounded: true,
    description: "the circular black-and-white seal of the FDIC: an eagle-crested heraldic shield in monochrome engraving, the ring lettered 'FEDERAL DEPOSIT INSURANCE CORPORATION 1933'" },
  { slug: 'ofac', name: 'Office of Foreign Assets Control (OFAC)', region: 'U.S. Federal', grounded: true,
    description: "the circular navy-and-gold Treasury seal used by the Office of Foreign Assets Control: a gold chevron shield with scales and a key, the ring lettered 'THE DEPARTMENT OF THE TREASURY 1789' with 'OFAC' beneath" },
  { slug: 'irs', name: 'Internal Revenue Service (IRS)', region: 'U.S. Federal', grounded: true,
    description: "the circular navy-and-gold seal of the Internal Revenue Service: gold scales of justice above a chevron shield with a key (Treasury lineage), the ring lettered 'TREASURY · INTERNAL REVENUE SERVICE'" },
  { slug: 'cfpb', name: 'Consumer Financial Protection Bureau (CFPB)', region: 'U.S. Federal', grounded: true,
    description: "the circular navy-and-gold seal of the Consumer Financial Protection Bureau: a stylised eagle with balanced scales and the year 2010, the ring lettered 'BUREAU OF CONSUMER FINANCIAL PROTECTION · UNITED STATES OF AMERICA'" },
  { slug: 'ftc', name: 'Federal Trade Commission (FTC)', region: 'U.S. Federal', grounded: true,
    description: "the circular seal of the Federal Trade Commission: a teal-blue heraldic shield with gold scales of justice at the centre, navy ring lettered 'FEDERAL TRADE COMMISSION · UNITED STATES OF AMERICA · MCMXV'" },
  { slug: 'commerce', name: 'U.S. Department of Commerce', region: 'U.S. Federal', grounded: true,
    description: "the circular blue-and-gold seal of the U.S. Department of Commerce: a gold eagle above a shield showing a full-rigged sailing ship and a lighthouse, the ring lettered 'DEPARTMENT OF COMMERCE · UNITED STATES OF AMERICA'" },
  { slug: 'doj', name: 'U.S. Department of Justice (DOJ)', region: 'U.S. Federal', grounded: true,
    description: "the circular seal of the U.S. Department of Justice: an American eagle over a striped shield in brown and gold tones, navy ring lettered 'DEPARTMENT OF JUSTICE' with the Latin motto 'QUI PRO DOMINA JUSTITIA SEQUITUR'" },
  { slug: 'fbi', name: 'Federal Bureau of Investigation (FBI)', region: 'U.S. Federal', grounded: true,
    description: "the circular seal of the FBI: a red-white-and-blue striped shield on a blue field ringed by a gold laurel wreath with the motto 'FIDELITY BRAVERY INTEGRITY', outer ring lettered 'DEPARTMENT OF JUSTICE · FEDERAL BUREAU OF INVESTIGATION'" },
  { slug: 'gao', name: 'Government Accountability Office (GAO)', region: 'U.S. Federal', grounded: true,
    description: "the circular parchment-and-gold seal of the Government Accountability Office: an eagle above a shield bearing the U.S. Capitol dome, the ring lettered 'UNITED STATES GOVERNMENT ACCOUNTABILITY OFFICE'" },

  // ================= U.S. — political branches =================
  { slug: 'white-house', name: 'The White House / President of the United States', region: 'U.S. Federal', grounded: true,
    description: "the circular Seal of the President of the United States: an American eagle clutching an olive branch and a bundle of arrows over a striped shield, encircled by a ring of stars and a gold border lettered 'SEAL OF THE PRESIDENT OF THE UNITED STATES'" },
  { slug: 'senate', name: 'U.S. Senate', region: 'U.S. Federal', grounded: true,
    description: "the circular seal of the United States Senate: an ornate shield of stars and stripes draped in red and framed by olive branches, navy ring lettered 'UNITED STATES SENATE' with 'E PLURIBUS UNUM'" },
  { slug: 'house', name: 'U.S. House of Representatives', region: 'U.S. Federal', grounded: true,
    description: "the circular seal of the U.S. House of Representatives: an American eagle over a striped shield with an olive branch and arrows, navy ring lettered 'U.S. HOUSE OF REPRESENTATIVES'" },
  { slug: 'supreme-court', name: 'U.S. Supreme Court', region: 'U.S. Federal', grounded: true,
    description: "the circular seal of the Supreme Court of the United States: an American eagle over a striped shield in muted gold and olive tones, cream ring lettered 'SEAL OF THE SUPREME COURT OF THE UNITED STATES'" },

  // ================= U.S. — state financial regulators =================
  { slug: 'nydfs', name: 'New York State Dept. of Financial Services (NYDFS)', region: 'U.S. State', grounded: true,
    description: "the circular Great Seal of the State of New York (used by the NY Department of Financial Services): the figures of Liberty and Justice flanking a shield with a Hudson River scene, a sunrise and two ships, the motto 'EXCELSIOR', blue ring lettered 'THE GREAT SEAL OF THE STATE OF NEW YORK'" },
  { slug: 'ca-dfpi', name: 'California Dept. of Financial Protection & Innovation (DFPI)', region: 'U.S. State', grounded: true,
    description: "the circular Great Seal of the State of California (used by the Department of Financial Protection & Innovation): the seated goddess Minerva beside a grizzly bear and San Francisco Bay with ships, the word 'EUREKA', gold border lettered 'THE GREAT SEAL OF THE STATE OF CALIFORNIA'" },
  { slug: 'wyoming', name: 'State of Wyoming', region: 'U.S. State', grounded: true,
    description: "the circular Great Seal of the State of Wyoming: a draped female figure holding a banner reading 'EQUAL RIGHTS' between two pillars, flanked by a rancher and a miner, in blue and gold, the ring lettered 'GREAT SEAL OF THE STATE OF WYOMING'" },
  { slug: 'texas', name: 'State of Texas', region: 'U.S. State', grounded: true,
    description: "the circular Seal of the State of Texas: a single white five-pointed lone star encircled by olive and live-oak branches on a blue field, gold border lettered 'THE STATE OF TEXAS'" },

  // ================= International — grounded (freely-usable emblem) =================
  { slug: 'european-union', name: 'European Union (EU / MiCA / ESMA context)', region: 'International', grounded: true,
    description: "the emblem of the European Union: a circle of twelve five-pointed gold stars on a deep azure-blue field" },

  // ================= International — described approximations (logos not public domain) =================
  { slug: 'imf', name: 'International Monetary Fund (IMF)', region: 'International', grounded: false,
    description: "the circular gold-on-blue emblem of the International Monetary Fund: a globe centred over crossed olive branches, ringed by the words 'INTERNATIONAL MONETARY FUND · WASHINGTON'" },
  { slug: 'ecb', name: 'European Central Bank (ECB)', region: 'International', grounded: false,
    description: "the emblem of the European Central Bank: a bold blue euro sign '€' as the central mark with the wordmark 'EUROPEAN CENTRAL BANK', clean modern institutional styling in European blue" },
  { slug: 'uk-fca', name: 'UK Financial Conduct Authority (FCA)', region: 'International', grounded: false,
    description: "the mark of the UK Financial Conduct Authority: the letters 'FCA' in a clean modern sans-serif on a plain field, understated British-regulator styling" },
  { slug: 'singapore-mas', name: 'Monetary Authority of Singapore (MAS)', region: 'International', grounded: false,
    description: "the mark of the Monetary Authority of Singapore: the letters 'MAS' in a modern sans-serif with a small red emblem, minimalist Singaporean-institution styling" },
];

const SEAL_INDEX = SEALS.reduce((m, s) => { m[s.slug] = s; return m; }, {});

function getSeal(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return SEAL_INDEX[slug.trim().toLowerCase()] || null;
}

// Public list for the dropdown (no internal fields the client does not need).
function listSeals() {
  return SEALS.map(s => ({
    slug: s.slug,
    name: s.name,
    region: s.region,
    description: s.description,
    grounded: s.grounded,
    imageUrl: s.grounded ? `${SEAL_IMAGE_BASE}/${s.slug}.png` : null,
  }));
}

module.exports = { SEALS, getSeal, listSeals, SEAL_IMAGE_BASE };
