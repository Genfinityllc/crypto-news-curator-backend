const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('./src/config/supabase');

async function bulkUploadSVGs() {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error('❌ Supabase client not available');
        return;
    }

    const svgDir = '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS';
    const files = fs.readdirSync(svgDir).filter(file => file.endsWith('.svg'));
    
    console.log(`📁 Found ${files.length} SVG files to upload`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
        try {
            const filePath = path.join(svgDir, file);
            const svgContent = fs.readFileSync(filePath, 'utf8');
            
            // Extract symbol from filename
            let symbol = file.replace('.svg', '').toUpperCase();
            
            // Handle special cases
            if (symbol.includes('-TEXTMARK')) {
                continue; // Skip textmark versions
            }
            if (symbol === 'IMMUTABLE IMX') {
                symbol = 'IMX';
            }
            if (symbol === 'BITMINE') {
                symbol = 'BTCM'; // Assuming this is Bitcoin mining
            }
            
            console.log(`📤 Uploading ${symbol}...`);
            
            // Use upsert to handle duplicates
            const { data, error } = await supabase
                .from('crypto_logos')
                .upsert({
                    symbol: symbol,
                    name: symbol,
                    svg_data: svgContent,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'symbol'
                });
            
            if (error) {
                console.error(`❌ Failed to upload ${symbol}:`, error.message);
                errorCount++;
            } else {
                console.log(`✅ Uploaded ${symbol} successfully`);
                successCount++;
            }
            
        } catch (error) {
            console.error(`❌ Failed to process ${file}:`, error.message);
            errorCount++;
        }
    }
    
    console.log(`\n🎉 Upload complete!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
}

bulkUploadSVGs();