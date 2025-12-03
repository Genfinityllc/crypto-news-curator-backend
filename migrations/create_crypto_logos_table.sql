-- Migration: Create crypto_logos table for SVG logo storage and ControlNet integration
-- Created: 2025-11-25
-- Purpose: Store cryptocurrency logos as SVG data with preprocessed ControlNet conditioning images

CREATE TABLE IF NOT EXISTS crypto_logos (
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

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_crypto_logos_symbol ON crypto_logos(symbol);
CREATE INDEX IF NOT EXISTS idx_crypto_logos_name ON crypto_logos(name);
CREATE INDEX IF NOT EXISTS idx_crypto_logos_hash ON crypto_logos(svg_hash);

-- Insert initial cryptocurrency logos (placeholder data)
INSERT INTO crypto_logos (symbol, name, svg_data, svg_hash, brand_colors, dimensions, metadata) VALUES
('BTC', 'Bitcoin', '<svg></svg>', 'placeholder_hash', '{"primary": "#F7931A", "secondary": "#FFFFFF"}', '{"width": 100, "height": 100}', '{"type": "cryptocurrency", "category": "layer1"}'),
('ETH', 'Ethereum', '<svg></svg>', 'placeholder_hash', '{"primary": "#627EEA", "secondary": "#FFFFFF"}', '{"width": 100, "height": 100}', '{"type": "cryptocurrency", "category": "layer1"}'),
('HBAR', 'Hedera Hashgraph', '<svg></svg>', 'placeholder_hash', '{"primary": "#1E1E1E", "secondary": "#00D4AA"}', '{"width": 100, "height": 100}', '{"type": "cryptocurrency", "category": "layer1"}'),
('XRP', 'Ripple', '<svg></svg>', 'placeholder_hash', '{"primary": "#0085C3", "secondary": "#FFFFFF"}', '{"width": 100, "height": 100}', '{"type": "cryptocurrency", "category": "layer1"}'),
('ADA', 'Cardano', '<svg></svg>', 'placeholder_hash', '{"primary": "#0033AD", "secondary": "#FFFFFF"}', '{"width": 100, "height": 100}', '{"type": "cryptocurrency", "category": "layer1"}'),
('ALGO', 'Algorand', '<svg></svg>', 'placeholder_hash', '{"primary": "#000000", "secondary": "#FFFFFF"}', '{"width": 100, "height": 100}', '{"type": "cryptocurrency", "category": "layer1"}'),
('XDC', 'XDC Network', '<svg></svg>', 'placeholder_hash', '{"primary": "#6CACE4", "secondary": "#FFFFFF"}', '{"width": 100, "height": 100}', '{"type": "cryptocurrency", "category": "layer1"}'),
('DAG', 'Constellation', '<svg></svg>', 'placeholder_hash', '{"primary": "#FFFFFF", "secondary": "#000000"}', '{"width": 100, "height": 100}', '{"type": "cryptocurrency", "category": "layer0"}')
ON CONFLICT (symbol) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE crypto_logos IS 'Stores cryptocurrency logos as SVG data with preprocessed ControlNet conditioning images for precise logo adherence in AI image generation';
COMMENT ON COLUMN crypto_logos.svg_data IS 'Raw SVG content for the cryptocurrency logo';
COMMENT ON COLUMN crypto_logos.preprocessed_canny IS 'Base64 encoded Canny edge detection image for ControlNet conditioning';
COMMENT ON COLUMN crypto_logos.preprocessed_depth IS 'Base64 encoded depth map for ControlNet conditioning';
COMMENT ON COLUMN crypto_logos.preprocessed_pose IS 'Base64 encoded pose/structure map for ControlNet conditioning';
COMMENT ON COLUMN crypto_logos.brand_colors IS 'JSON object containing primary and secondary brand colors';
COMMENT ON COLUMN crypto_logos.dimensions IS 'JSON object containing SVG dimensions and viewBox information';