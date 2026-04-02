const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'docs');

// Ensure uploads/docs directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Handle saving an uploaded file (generic)
 * @param {object} file - The file object from multer (using disk or memory)
 * @param {string} prefix - Filename prefix (e.g., 'doc', 'bidding')
 * @returns {string} The public URL path to the saved file
 */
function saveFile(file, prefix = 'doc') {
  if (!file) return null;
  
  // If using memory storage, we need to write the buffer
  const extension = path.extname(file.originalname).toLowerCase();
  const filename = `${prefix}-${Date.now()}${extension}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  if (file.buffer) {
    fs.writeFileSync(filepath, file.buffer);
  } else if (file.path) {
    // If using disk storage, move/rename it
    fs.renameSync(file.path, filepath);
  } else {
    throw new Error('Unsupported file storage type (no buffer or path found)');
  }

  return `/uploads/docs/${filename}`;
}

/**
 * Delete a file by its URL path
 * @param {string} fileUrl - The /uploads/docs/filename path
 */
function deleteFile(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/docs/')) return;
  const filename = path.basename(fileUrl);
  const filepath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

module.exports = { saveFile, deleteFile };
