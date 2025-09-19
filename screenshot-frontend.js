const { chromium } = require('playwright');

async function takeScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport size
  await page.setViewportSize({ width: 1280, height: 720 });
  
  try {
    console.log('📸 Taking screenshot of frontend...');
    
    // Navigate to your frontend URL
    const frontendUrl = 'https://crypto-news-frontend-ruddy.vercel.app';
    console.log(`🌐 Loading: ${frontendUrl}`);
    
    await page.goto(frontendUrl, { waitUntil: 'load', timeout: 15000 });
    
    // Wait a bit more for images to load
    await page.waitForTimeout(3000);
    
    // Take full page screenshot
    await page.screenshot({ 
      path: 'frontend-full.png', 
      fullPage: true 
    });
    console.log('✅ Full page screenshot saved as frontend-full.png');
    
    // Take viewport screenshot
    await page.screenshot({ 
      path: 'frontend-viewport.png',
      fullPage: false 
    });
    console.log('✅ Viewport screenshot saved as frontend-viewport.png');
    
    // Check for missing images
    console.log('\n🔍 Checking for image loading issues...');
    
    // Get all images on the page
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => ({
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        alt: img.alt || '',
        className: img.className || ''
      }));
    });
    
    console.log(`\n📊 Found ${images.length} images on the page:`);
    
    images.forEach((img, index) => {
      const status = img.complete && img.naturalWidth > 0 ? '✅' : '❌';
      console.log(`${status} Image ${index + 1}:`);
      console.log(`   URL: ${img.src}`);
      console.log(`   Size: ${img.naturalWidth}x${img.naturalHeight}`);
      console.log(`   Complete: ${img.complete}`);
      console.log(`   Alt: ${img.alt}`);
      console.log(`   Class: ${img.className}`);
      console.log('');
    });
    
    // Check network requests for failed image loads
    console.log('\n🌐 Network analysis...');
    page.on('response', response => {
      if (response.url().includes('.jpg') || response.url().includes('.png') || response.url().includes('.webp')) {
        console.log(`${response.status() >= 400 ? '❌' : '✅'} ${response.status()} - ${response.url()}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error taking screenshots:', error.message);
  } finally {
    await browser.close();
  }
}

takeScreenshots();