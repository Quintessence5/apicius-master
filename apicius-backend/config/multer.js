const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('./db');

// Path to assets
const frontendAssetsPath = path.join(__dirname, '../../apicius-frontend/src/assets/produce-icons');

if (!fs.existsSync(frontendAssetsPath)) {
  fs.mkdirSync(frontendAssetsPath, { recursive: true });
}

// Storage for Excel files
const excelStorage = multer.memoryStorage();
const uploadExcel = multer({
  storage: excelStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed!'), false);
    }
  }
});

// Storage for images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, frontendAssetsPath);
  },
  filename: async (req, file, cb) => {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT name FROM ingredients WHERE id = $1', [id]);
      const ingredient = result.rows[0];
      
      if (!ingredient) throw new Error('Ingredient not found');
      
      // Sanitize filename
      const cleanName = ingredient.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      
      const extension = path.extname(file.originalname);
      const newFilename = `${cleanName}${extension}`;
      const fullPath = path.join(frontendAssetsPath, newFilename);
      
      // Delete existing file if exists
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      
      cb(null, newFilename);
    } catch (error) {
      cb(error);
    }
  }
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

module.exports = {
  uploadExcel,
  uploadImage
};