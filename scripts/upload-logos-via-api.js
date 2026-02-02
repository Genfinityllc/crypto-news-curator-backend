/**
 * Upload logos via the deployed API endpoint
 * This uses the working Railway server which is already connected to Supabase
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE = 'https://crypto-news-curator-backend-production.up.railway.app';
const LOGOS_DIR = path.join(__dirname, '../uploads/png-logos');
const ADMIN_KEY = 'valor-master-2024';

// Network symbol mapping
const NETWORK_SYMBOLS = new Set([
  'ALGO', 'APT', 'ARB', 'AVAX', 'AXELAR', 'BNB', 'BTC', 'TAO', 'CANTON', 'ADA',
  'TIA', 'LINK', 'DAG', 'ATOM', 'CRO', 'DOGE', 'ETH', 'FIL', 'HBAR', 'IMX',
  'INJ', 'LTC', 'MONAD', 'XMR', 'NEAR', 'ONDO', 'OP', 'PEPE', 'DOT', 'MATIC',
  'QNT', 'SEI', 'SHIB', 'SOL', 'XLM', 'SUI', 'USDT', 'RUNE', 'TON', 'TRX',
  'UNI', 'USDC', 'XDC', 'XRP', 'ZEC', 'BITCOIN', 'ETHEREUM', 'SOLANA', 'CARDANO',
  'POLKADOT', 'AVALANCHE', 'CHAINLINK', 'LITECOIN', 'DOGECOIN', 'POLYGON',
  'STELLAR', 'COSMOS', 'ALGORAND', 'FILECOIN', 'HEDERA', 'CRONOS', 'CELESTIA',
  'TRON', 'TONCOIN', 'UNISWAP', 'ARBITRUM', 'OPTIMISM', 'RIPPLE', 'MONERO',
  'ZCASH', 'QUANT', 'INJECTIVE', 'BITTENSOR', 'THORCHAIN', 'CONSTELLATION'
]);

async function uploadLogo(filePath) {
  const filename = path.basename(filePath);
  const baseName = filename.replace(/\.png$/i, '');
  const symbol = baseName.toUpperCase().replace(/[\s-]+/g, '');

  // Determine type based on known networks
  const type = NETWORK_SYMBOLS.has(symbol) ? 'network' : 'company';

  try {
    const FormData = (await import('form-data')).default;
    const fetch = (await import('node-fetch')).default;

    const form = new FormData();
    form.append('logo', fs.createReadStream(filePath));
    form.append('symbol', symbol);
    form.append('name', baseName);
    form.append('type', type);
    form.append('adminKey', ADMIN_KEY);

    const response = await fetch(`${API_BASE}/api/cover-generator/upload-logo`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ ${symbol} (${type}) - ${data.data?.supabaseUrl ? 'saved to Supabase' : 'saved locally'}`);
      return true;
    } else {
      console.log(`⚠️ ${symbol}: ${data.error}`);
      return false;
    }
  } catch (e) {
    console.error(`❌ ${symbol}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Uploading logos via API...\n');

  const files = fs.readdirSync(LOGOS_DIR);
  const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));

  console.log(`📁 Found ${pngFiles.length} PNG files\n`);

  let success = 0;
  let failed = 0;

  for (const file of pngFiles) {
    const filePath = path.join(LOGOS_DIR, file);
    const result = await uploadLogo(filePath);
    if (result) success++;
    else failed++;

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Done! ${success} uploaded, ${failed} failed`);
}

main().catch(console.error);
