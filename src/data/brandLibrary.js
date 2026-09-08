/**
 * BRAND LIBRARY — the brands/tokens/companies we have logos for, so the art
 * director can auto-detect the ones a story mentions and weave them into the
 * cover as SUBTLE, CREATIVELY-integrated background details (never the hero,
 * never a flat logo slapped on top). Keep in rough sync with the generator's
 * NETWORKS_LIST / COMPANIES_LIST in server.js.
 *
 * Each entry: { name, aliases? }. Detection is a case-insensitive whole-word
 * match of the name or any alias against the article text.
 */

const BRANDS = [
  // Networks / tokens
  { name: 'Bitcoin', aliases: ['BTC'] },
  { name: 'Ethereum', aliases: ['ETH', 'Ether'] },
  { name: 'Ripple', aliases: ['XRP'] },
  { name: 'Solana', aliases: ['SOL'] },
  { name: 'Hedera', aliases: ['HBAR', 'Hashgraph'] },
  { name: 'Cardano', aliases: ['ADA'] },
  { name: 'Avalanche', aliases: ['AVAX'] },
  { name: 'Polkadot', aliases: ['DOT'] },
  { name: 'Polygon', aliases: ['MATIC'] },
  { name: 'Chainlink', aliases: ['LINK'] },
  { name: 'Uniswap', aliases: ['UNI'] },
  { name: 'Dogecoin', aliases: ['DOGE'] },
  { name: 'Litecoin', aliases: ['LTC'] },
  { name: 'Cosmos', aliases: ['ATOM'] },
  { name: 'NEAR Protocol', aliases: ['NEAR'] },
  { name: 'Algorand', aliases: ['ALGO'] },
  { name: 'Stellar', aliases: ['XLM'] },
  { name: 'Sui' },
  { name: 'Aptos', aliases: ['APT'] },
  { name: 'Arbitrum', aliases: ['ARB'] },
  { name: 'Optimism' },
  { name: 'Injective', aliases: ['INJ'] },
  { name: 'Celestia', aliases: ['TIA'] },
  { name: 'Shiba Inu', aliases: ['SHIB'] },
  { name: 'Binance', aliases: ['BNB'] },
  { name: 'Tron', aliases: ['TRX'] },
  { name: 'Toncoin', aliases: ['TON'] },
  { name: 'Filecoin', aliases: ['FIL'] },
  { name: 'Monero', aliases: ['XMR'] },
  { name: 'Cronos', aliases: ['CRO'] },
  { name: 'THORChain', aliases: ['RUNE'] },
  { name: 'Bittensor', aliases: ['TAO'] },
  { name: 'Quant', aliases: ['QNT'] },
  { name: 'Ondo' },
  { name: 'Immutable' },
  { name: 'Constellation', aliases: ['DAG'] },
  { name: 'XDC Network', aliases: ['XDC'] },
  { name: 'USD Coin', aliases: ['USDC'] },
  { name: 'Tether', aliases: ['USDT'] },
  { name: 'Zcash', aliases: ['ZEC'] },
  { name: 'Canton' },
  { name: 'Monad' },
  { name: 'Axelar' },
  // Companies / institutions
  { name: 'BlackRock' },
  { name: 'Grayscale' },
  { name: '21Shares' },
  { name: 'World Liberty Financial', aliases: ['WLFI'] },
  { name: 'Bitmine' },
  { name: 'MoonPay' },
  { name: 'NVIDIA', aliases: ['Nvidia'] },
  { name: 'Paxos' },
  { name: 'Robinhood' },
  { name: 'HashPack' },
  { name: 'Kraken' },
  { name: 'KuCoin' },
  { name: 'BitGo' },
  { name: 'MetaMask' },
  { name: 'Magic Eden' },
  { name: 'Uphold' },
  { name: 'Franklin Templeton' },
  { name: 'Western Union' },
  { name: 'Coinbase' },
  { name: 'Boeing' },
  { name: 'Dell' },
  { name: 'Dentons' },
  { name: 'Deutsche Telekom' },
  { name: 'DLA Piper' },
  { name: 'Google' },
  { name: 'Hitachi' },
  { name: 'IBM' },
  { name: 'LG Electronics' },
  { name: 'Nomura' },
  { name: 'ServiceNow' },
  { name: 'Shinhan Bank' },
  { name: 'Swirlds Labs' },
  { name: 'Tata Communications' },
  { name: 'Ubisoft' },
  { name: 'Worldpay' },
  { name: 'Mondelez' },
  { name: 'Aberdeen' },
  { name: 'Archax' },
  { name: 'Avery Dennison' },
  { name: 'Brale' },
];

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Detect which library brands are named in the given text. Returns up to `cap`
 * brand display names, most-frequently-mentioned first, excluding any whose
 * name/alias matches an entry in excludeNames (e.g. the primary logo already
 * used as the hero).
 */
function detectBrands(text, excludeNames = [], cap = 3) {
  if (!text || typeof text !== 'string') return [];
  const hay = text;
  const exclude = new Set((excludeNames || []).map(s => String(s || '').toLowerCase().replace(/_full$/i, '').trim()));
  const scored = [];
  for (const b of BRANDS) {
    const terms = [b.name, ...(b.aliases || [])];
    if (terms.some(t => exclude.has(t.toLowerCase()))) continue;
    let count = 0;
    for (const t of terms) {
      // Whole-word, case-insensitive. Short all-caps tickers (<=4) match only
      // as standalone uppercase tokens to avoid matching inside common words.
      const isTicker = /^[A-Z0-9]{2,5}$/.test(t);
      const re = isTicker
        ? new RegExp(`\\b${escapeRe(t)}\\b`, 'g')
        : new RegExp(`\\b${escapeRe(t)}\\b`, 'gi');
      const m = hay.match(re);
      if (m) count += m.length;
    }
    if (count > 0) scored.push({ name: b.name, count });
  }
  scored.sort((a, b) => b.count - a.count);
  return scored.slice(0, cap).map(s => s.name);
}

module.exports = { BRANDS, detectBrands };
