const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

/**
 * Working LoRA-Style Generator - Recreation of the working FastAPI system
 * Generates professional crypto covers using SVG techniques (no Canvas dependencies)
 */
class WorkingLoraGenerator {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp/working-lora');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory:', error);
    }
  }

  getClientColors(client) {
    const colors = {
      'hedera': {
        primary: [138, 43, 226],    // Purple
        secondary: [75, 0, 130],    // Dark purple  
        accent: [186, 85, 211],     // Light purple
        energy: [255, 0, 255]       // Magenta
      },
      'algorand': {
        primary: [0, 120, 140],     // Teal
        secondary: [0, 85, 100],    // Dark teal
        accent: [75, 163, 224],     // Light teal  
        energy: [0, 255, 255]       // Cyan
      },
      'constellation': {
        primary: [72, 61, 139],     // Dark slate blue
        secondary: [25, 25, 112],   // Midnight blue
        accent: [106, 90, 205],     // Slate blue
        energy: [255, 255, 255]     // White
      },
      'bitcoin': {
        primary: [247, 147, 26],    // Bitcoin orange
        secondary: [204, 102, 0],   // Dark orange
        accent: [255, 193, 7],      // Light orange
        energy: [255, 255, 0]       // Yellow
      },
      'ethereum': {
        primary: [98, 126, 234],    // Ethereum blue
        secondary: [55, 71, 133],   // Dark blue
        accent: [129, 140, 248],    // Light blue
        energy: [0, 255, 255]       // Cyan
      },
      'solana': {
        primary: [153, 69, 255],    // Solana purple
        secondary: [102, 46, 170],  // Dark purple
        accent: [186, 104, 255],    // Light purple
        energy: [255, 0, 255]       // Magenta
      }
    };
    
    return colors[client.toLowerCase()] || colors['hedera'];
  }

  createEnergyFieldsSVG(width, height, colors) {
    let defs = '';
    let elements = '';
    
    // Create flowing energy patterns
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 80 + 20;
      
      // Create energy orb with gradient effect
      const gradientId = `energyGrad${i}`;
      defs += `
        <radialGradient id="${gradientId}" cx="50%" cy="50%" r="100%">
          <stop offset="0%" style="stop-color:rgb(${colors.energy[0]}, ${colors.energy[1]}, ${colors.energy[2]});stop-opacity:0.3" />
          <stop offset="50%" style="stop-color:rgb(${colors.accent[0]}, ${colors.accent[1]}, ${colors.accent[2]});stop-opacity:0.2" />
          <stop offset="100%" style="stop-color:rgb(${colors.primary[0]}, ${colors.primary[1]}, ${colors.primary[2]});stop-opacity:0.1" />
        </radialGradient>
      `;
      
      elements += `<circle cx="${x}" cy="${y}" r="${size}" fill="url(#${gradientId})" />`;
    }
    
    return { defs, elements };
  }

  createNetworkNodesSVG(width, height, colors) {
    let defs = '';
    let elements = '';
    const nodes = [];
    
    // Create nodes
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * (width - 100) + 50;
      const y = Math.random() * (height - 100) + 50;
      const nodeSize = Math.random() * 12 + 8;
      
      nodes.push({ x, y, size: nodeSize });
      
      // Draw node
      elements += `<circle cx="${x}" cy="${y}" r="${nodeSize}" fill="rgb(${colors.accent[0]}, ${colors.accent[1]}, ${colors.accent[2]})" />`;
      
      // Draw glow
      const glowGradId = `nodeGlow${i}`;
      defs += `
        <radialGradient id="${glowGradId}" cx="50%" cy="50%" r="100%">
          <stop offset="0%" style="stop-color:rgb(${colors.primary[0]}, ${colors.primary[1]}, ${colors.primary[2]});stop-opacity:0.5" />
          <stop offset="100%" style="stop-color:rgb(${colors.primary[0]}, ${colors.primary[1]}, ${colors.primary[2]});stop-opacity:0" />
        </radialGradient>
      `;
      
      elements += `<circle cx="${x}" cy="${y}" r="${nodeSize + 15}" fill="url(#${glowGradId})" />`;
    }
    
    // Connect some nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < Math.min(i + 4, nodes.length); j++) {
        if (Math.random() < 0.3) {
          elements += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="rgba(${colors.secondary[0]}, ${colors.secondary[1]}, ${colors.secondary[2]}, 0.6)" stroke-width="2" />`;
        }
      }
    }
    
    return { defs, elements };
  }

  createParticleWavesSVG(width, height, colors) {
    let elements = '';
    
    // Create particle wave patterns
    for (let wave = 0; wave < 5; wave++) {
      const yOffset = wave * (height / 5);
      const amplitude = Math.random() * 50 + 30;
      const frequency = Math.random() * 0.02 + 0.01;
      
      // Draw wave with particles
      for (let x = 0; x < width; x += 10) {
        const y = yOffset + amplitude * Math.sin(frequency * x);
        
        if (Math.random() < 0.7) { // 70% chance for particle
          const particleSize = Math.random() * 5 + 3;
          const alpha = Math.random() * 0.6 + 0.2;
          
          elements += `<circle cx="${x}" cy="${y}" r="${particleSize}" fill="rgba(${colors.accent[0]}, ${colors.accent[1]}, ${colors.accent[2]}, ${alpha})" />`;
        }
      }
    }
    
    return { defs: '', elements };
  }

  async generateCover(title, subtitle = "CRYPTO NEWS", client = "hedera", style = "energy_fields") {
    try {
      logger.info(`🎨 Generating working LoRA cover: ${title} (${client}, ${style})`);
      
      const width = 1800;
      const height = 900;
      
      // Get client colors
      const colors = this.getClientColors(client);
      
      // Create style-specific background
      let backgroundDefs = '';
      let backgroundElements = '';
      
      switch (style) {
        case 'energy_fields':
          const energyResult = this.createEnergyFieldsSVG(width, height, colors);
          backgroundDefs += energyResult.defs;
          backgroundElements += energyResult.elements;
          break;
        case 'network_nodes':
          const nodeResult = this.createNetworkNodesSVG(width, height, colors);
          backgroundDefs += nodeResult.defs;
          backgroundElements += nodeResult.elements;
          break;
        case 'particle_waves':
          const waveResult = this.createParticleWavesSVG(width, height, colors);
          backgroundDefs += waveResult.defs;
          backgroundElements += waveResult.elements;
          break;
        default:
          const defaultResult = this.createEnergyFieldsSVG(width, height, colors);
          backgroundDefs += defaultResult.defs;
          backgroundElements += defaultResult.elements;
      }
      
      // Add gradient overlay
      const overlayGradId = 'overlayGrad';
      backgroundDefs += `
        <linearGradient id="${overlayGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${colors.primary[0]}, ${colors.primary[1]}, ${colors.primary[2]});stop-opacity:0.1" />
          <stop offset="100%" style="stop-color:rgb(${colors.secondary[0]}, ${colors.secondary[1]}, ${colors.secondary[2]});stop-opacity:0.2" />
        </linearGradient>
      `;
      
      // Prepare title text
      const titleY = height / 3;
      let titleElements = '';
      
      if (title) {
        const titleText = title.toUpperCase();
        // Simple line breaking for long titles
        const words = titleText.split(' ');
        let titleLines = [titleText];
        
        if (words.length > 3) {
          const mid = Math.ceil(words.length / 2);
          titleLines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
        }
        
        titleLines.forEach((line, index) => {
          const y = titleY + (index * 130);
          
          // Multiple shadow layers for depth
          titleElements += `
            <text x="50%" y="${y + 4}" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="rgba(0, 0, 0, 1)" text-anchor="middle" dominant-baseline="middle">${line}</text>
            <text x="50%" y="${y + 2}" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="rgba(0, 0, 0, 0.7)" text-anchor="middle" dominant-baseline="middle">${line}</text>
            <text x="50%" y="${y}" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${line}</text>
          `;
        });
        
        // Subtitle with rounded box
        if (subtitle) {
          const subtitleY = titleY + (titleLines.length * 130) + 50;
          const subtitleWidth = subtitle.length * 32; // Approximate width
          const boxPadding = 25;
          const boxX = (width - subtitleWidth) / 2 - boxPadding;
          const boxY = subtitleY - boxPadding / 2;
          const boxWidth = subtitleWidth + (boxPadding * 2);
          const boxHeight = 70 + boxPadding;
          
          titleElements += `
            <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="15" ry="15" fill="rgba(0, 0, 0, 0.7)" />
            <rect x="${boxX + 2}" y="${boxY + 2}" width="${boxWidth - 4}" height="${boxHeight - 4}" rx="13" ry="13" fill="none" stroke="rgba(255, 255, 255, 0.3)" stroke-width="1" />
            <text x="50%" y="${subtitleY + 2}" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="rgba(0, 0, 0, 0.8)" text-anchor="middle" dominant-baseline="middle">${subtitle}</text>
            <text x="50%" y="${subtitleY}" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${subtitle}</text>
          `;
        }
      }
      
      // Create complete SVG
      const svgContent = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            ${backgroundDefs}
          </defs>
          
          <!-- Black background -->
          <rect width="100%" height="100%" fill="#000000"/>
          
          <!-- Background elements -->
          ${backgroundElements}
          
          <!-- Gradient overlay -->
          <rect width="100%" height="100%" fill="url(#${overlayGradId})"/>
          
          <!-- Text elements -->
          ${titleElements}
          
          <!-- Genfinity watermark -->
          <text x="${width - 40}" y="${height - 40}" font-family="Arial, sans-serif" font-size="24" fill="rgba(255, 255, 255, 0.6)" text-anchor="end" dominant-baseline="bottom">Genfinity</text>
        </svg>
      `;
      
      // Create a simplified PNG-like base64 data URL for exact pixel control
      // Since we can't use Canvas, create a clean SVG with explicit dimensions
      const optimizedSvg = `<svg width="1800" height="900" viewBox="0 0 1800 900" xmlns="http://www.w3.org/2000/svg">${svgContent.replace(/<svg[^>]*>/, '').replace('</svg>', '')}</svg>`;
      const base64SVG = Buffer.from(optimizedSvg).toString('base64');
      const dataUrl = `data:image/svg+xml;base64,${base64SVG}`;
      
      logger.info(`✅ Working LoRA cover generated as optimized SVG (1800x900px exact)`);
      
      return {
        success: true,
        coverUrl: dataUrl,
        generationMethod: 'working_lora_optimized_svg',
        metadata: {
          client,
          style,
          title,
          subtitle,
          resolution: '1800x900',
          format: 'svg_optimized',
          width: 1800,
          height: 900,
          viewBox: '0 0 1800 900'
        }
      };
      
    } catch (error) {
      logger.error('Working LoRA generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = WorkingLoraGenerator;