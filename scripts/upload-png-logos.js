/**
 * Upload PNG logos to server for ControlNet testing
 * This script copies essential PNG logos from local desktop to server uploads directory
 */

const fs = require('fs').promises;
const path = require('path');

async function uploadPngLogos() {
  try {
    const localPngDir = '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS/PNG';
    const serverPngDir = path.join(__dirname, '../uploads/png-logos');
    
    console.log('🔄 Creating server PNG logos directory...');
    
    // Create server directory
    await fs.mkdir(serverPngDir, { recursive: true });
    console.log(`✅ Created: ${serverPngDir}`);
    
    // Get all PNG files from local directory
    console.log('🔍 Scanning for all PNG files...');
    const allFiles = await fs.readdir(localPngDir);
    const allPngLogos = allFiles.filter(file => file.toLowerCase().endsWith('.png'));
    
    console.log(`📁 Found ${allPngLogos.length} PNG files to copy`);
    
    let copiedCount = 0;
    let skippedCount = 0;
    
    for (const logo of allPngLogos) {
      try {
        const sourcePath = path.join(localPngDir, logo);
        const destPath = path.join(serverPngDir, logo);
        
        // Copy to server directory
        await fs.copyFile(sourcePath, destPath);
        
        const stats = await fs.stat(destPath);
        console.log(`✅ Copied: ${logo} (${(stats.size / 1024).toFixed(1)}KB)`);
        copiedCount++;
        
      } catch (error) {
        console.log(`⚠️  Skipped: ${logo} - ${error.message}`);
        skippedCount++;
      }
    }
    
    console.log(`\n🎉 Upload complete: ${copiedCount}/${allPngLogos.length} logos copied, ${skippedCount} skipped`);
    console.log(`📁 Server PNG directory: ${serverPngDir}`);
    
    // List all copied files
    console.log('\n📋 Available PNG logos on server:');
    const files = await fs.readdir(serverPngDir);
    const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
    
    for (const file of pngFiles) {
      const filePath = path.join(serverPngDir, file);
      const stats = await fs.stat(filePath);
      const symbol = file.replace('.png', '').toUpperCase();
      console.log(`   ${symbol}: ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
    }
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  uploadPngLogos();
}

module.exports = { uploadPngLogos };