const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SUPABASE_URL = 'https://mubvqsigupaxrhxgqqpv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function uploadSVGLogos() {
    const svgDir = '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS';
    const files = fs.readdirSync(svgDir).filter(file => file.endsWith('.svg'));
    
    console.log(`📁 Found ${files.length} SVG files to upload`);
    
    for (const file of files) {
        try {
            const filePath = path.join(svgDir, file);
            const svgContent = fs.readFileSync(filePath, 'utf8');
            
            // Extract symbol from filename (remove .svg)
            let symbol = file.replace('.svg', '').toUpperCase();
            
            // Handle special cases
            if (symbol.includes('-TEXTMARK')) {
                symbol = symbol.replace('-TEXTMARK', '');
            }
            if (symbol === 'IMMUTABLE IMX') {
                symbol = 'IMX';
            }
            
            const logoData = {
                symbol: symbol,
                name: symbol,
                svg_data: svgContent
            };
            
            console.log(`📤 Uploading ${symbol}...`);
            
            const response = await axios.post(`${SUPABASE_URL}/rest/v1/crypto_logos`, logoData, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
            });
            
            console.log(`✅ Uploaded ${symbol} successfully`);
            
        } catch (error) {
            console.error(`❌ Failed to upload ${file}:`, error.response?.data || error.message);
        }
    }
    
    console.log('🎉 SVG upload complete!');
}

uploadSVGLogos();