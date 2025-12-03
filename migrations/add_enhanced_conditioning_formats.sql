-- Migration: Add enhanced conditioning formats for maximum accuracy
-- Created: 2024-12-02  
-- Purpose: Add normal maps and masks for enhanced ControlNet conditioning accuracy

-- Add new conditioning format columns
ALTER TABLE crypto_logos ADD COLUMN IF NOT EXISTS preprocessed_normal TEXT;
ALTER TABLE crypto_logos ADD COLUMN IF NOT EXISTS preprocessed_mask TEXT;

-- Update existing metadata structure to track conditioning formats
UPDATE crypto_logos SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"version": "2.0", "enhanced": true}'::jsonb WHERE metadata IS NULL OR (metadata->'version') IS NULL;

-- Add comments for new columns
COMMENT ON COLUMN crypto_logos.preprocessed_normal IS 'Base64 encoded normal map for surface detail ControlNet conditioning';
COMMENT ON COLUMN crypto_logos.preprocessed_mask IS 'Base64 encoded high-contrast mask for region ControlNet conditioning';

-- Update table comment
COMMENT ON TABLE crypto_logos IS 'Stores cryptocurrency logos with enhanced multi-format ControlNet conditioning for maximum geometric accuracy in AI image generation';