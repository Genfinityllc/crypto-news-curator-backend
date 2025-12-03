# SVG Logo ControlNet Integration Design

## Database Schema for Cryptocurrency Logos

### New Table: `crypto_logos`

```sql
CREATE TABLE crypto_logos (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE, -- BTC, ETH, HBAR, XRP, etc.
  name VARCHAR(100) NOT NULL, -- Bitcoin, Ethereum, HBAR, Ripple
  svg_data TEXT NOT NULL, -- Raw SVG content
  svg_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for version control
  preprocessed_canny TEXT, -- Base64 encoded Canny edge image
  preprocessed_depth TEXT, -- Base64 encoded depth map
  preprocessed_pose TEXT, -- Base64 encoded pose/structure map
  brand_colors JSONB, -- Primary colors extracted from logo
  dimensions JSONB, -- Original SVG dimensions and viewBox
  metadata JSONB, -- Additional logo metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_crypto_logos_symbol ON crypto_logos(symbol);
CREATE INDEX idx_crypto_logos_name ON crypto_logos(name);
```

## Implementation Architecture

### 1. SVG-to-ControlNet Preprocessing Pipeline

```
SVG Input → Rasterization → Edge Detection → ControlNet Conditioning
    ↓            ↓              ↓               ↓
  Parse SVG   Convert to     Canny/Depth    Create Control
  Extract     PNG/JPEG       Processing      Image Tensor
  Metadata    (1024x1024)   
```

### 2. Component Structure

```
src/
├── services/
│   ├── svgLogoService.js          # SVG CRUD operations
│   ├── svgPreprocessor.js         # SVG → ControlNet preprocessing
│   └── controlNetService.js       # SDXL + ControlNet generation
├── controllers/
│   └── logoController.js          # API endpoints for logo management
├── routes/
│   └── logos.js                   # Logo management routes
└── utils/
    ├── svgParser.js               # SVG parsing and validation
    └── imagePreprocessor.js       # Image preprocessing utilities
```

### 3. Technology Stack

- **SVG Processing**: `sharp`, `svg2png`, `jsdom`
- **ControlNet**: `@huggingface/transformers`, `diffusers` Python bridge
- **Edge Detection**: `opencv4nodejs` or Python `cv2` bridge
- **Image Processing**: `sharp`, `canvas`
- **SDXL**: ControlNet Union SDXL 1.0 model

### 4. Workflow Integration

```javascript
// New generation workflow
1. Detect cryptocurrency from article title/content
2. Query crypto_logos table for SVG data
3. Preprocess SVG to ControlNet conditioning image
4. Generate image with SDXL + ControlNet + LoRA
5. Apply watermark and return final image
```

## API Endpoints

### Logo Management
- `GET /api/logos` - List all logos
- `GET /api/logos/:symbol` - Get specific logo
- `POST /api/logos` - Upload new logo SVG
- `PUT /api/logos/:symbol` - Update logo
- `DELETE /api/logos/:symbol` - Delete logo

### Generation with ControlNet
- `POST /api/news/generate-controlnet-image/:articleId` - Generate with SVG guidance
- `POST /api/news/generate-controlnet-image` - Generate from article data

## Expected Benefits

1. **Precise Logo Adherence**: SVG data ensures exact logo shapes
2. **No More Bitcoin Bias**: Each crypto gets its proper logo
3. **Scalable**: Easy to add new cryptocurrencies
4. **Version Control**: SVG hash tracking for logo updates
5. **Multiple Control Types**: Canny, depth, pose for different effects

## Implementation Priority

1. Database schema creation
2. SVG logo service (CRUD)
3. SVG → ControlNet preprocessing
4. SDXL ControlNet integration
5. Article → logo detection
6. Frontend logo management interface