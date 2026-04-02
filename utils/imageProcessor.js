const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Process and save an uploaded image buffer using Sharp
 * @param {Buffer} buffer - The raw image buffer from multer
 * @param {string} prefix - Filename prefix (e.g., 'pr', 'personnel')
 * @returns {string} The public URL path to the saved image
 */
async function processAndSaveImage(buffer, prefix = 'img') {
  const filename = `${prefix}-${Date.now()}.webp`;
  const filepath = path.join(UPLOADS_DIR, filename);

  await sharp(buffer)
    .resize(900, 600, {
      fit: sharp.fit.inside,
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toFile(filepath);

  return `/uploads/${filename}`;
}

/**
 * Delete an uploaded image by its URL path
 * @param {string} imageUrl - The /uploads/filename.webp path
 */
function deleteImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  const filepath = path.join(UPLOADS_DIR, path.basename(imageUrl));
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

module.exports = { processAndSaveImage, deleteImage };
