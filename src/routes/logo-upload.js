const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'logos');
    
    // Ensure uploads/logos directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Use the client network name from the request or generate a name
    const clientName = req.body.clientName || 'unknown';
    const fileExtension = path.extname(file.originalname);
    const fileName = `${clientName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_logo${fileExtension}`;
    cb(null, fileName);
  }
});

// File filter to only accept images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

/**
 * 📁 UPLOAD CLIENT LOGO
 * POST /api/logo-upload/client
 * 
 * Upload a logo for a specific client network
 */
router.post('/client', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No logo file provided'
      });
    }

    const { clientName, displayName, color } = req.body;
    
    if (!clientName) {
      return res.status(400).json({
        success: false,
        error: 'Client name is required'
      });
    }

    // Generate the URL for the uploaded logo
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    
    console.log(`📁 Logo uploaded for ${clientName}: ${logoUrl}`);
    
    res.json({
      success: true,
      message: `Logo uploaded successfully for ${clientName}`,
      data: {
        clientName,
        displayName: displayName || clientName,
        logoUrl,
        color: color || '#007bff',
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
    
  } catch (error) {
    console.error('❌ Logo upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload logo',
      details: error.message
    });
  }
});

/**
 * 📋 LIST UPLOADED LOGOS
 * GET /api/logo-upload/list
 * 
 * Get a list of all uploaded logos
 */
router.get('/list', (req, res) => {
  try {
    const logosDir = path.join(__dirname, '..', '..', 'uploads', 'logos');
    
    if (!fs.existsSync(logosDir)) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const files = fs.readdirSync(logosDir);
    const logos = files
      .filter(file => /\.(jpeg|jpg|png|gif|svg|webp)$/i.test(file))
      .map(file => {
        const stats = fs.statSync(path.join(logosDir, file));
        return {
          filename: file,
          url: `/uploads/logos/${file}`,
          size: stats.size,
          modified: stats.mtime
        };
      });
    
    res.json({
      success: true,
      data: logos
    });
    
  } catch (error) {
    console.error('❌ Error listing logos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list logos',
      details: error.message
    });
  }
});

/**
 * 🗑️ DELETE LOGO
 * DELETE /api/logo-upload/:filename
 * 
 * Delete a specific logo file
 */
router.delete('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const logoPath = path.join(__dirname, '..', '..', 'uploads', 'logos', filename);
    
    if (!fs.existsSync(logoPath)) {
      return res.status(404).json({
        success: false,
        error: 'Logo file not found'
      });
    }
    
    fs.unlinkSync(logoPath);
    
    console.log(`🗑️ Logo deleted: ${filename}`);
    
    res.json({
      success: true,
      message: `Logo ${filename} deleted successfully`
    });
    
  } catch (error) {
    console.error('❌ Error deleting logo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete logo',
      details: error.message
    });
  }
});

module.exports = router;