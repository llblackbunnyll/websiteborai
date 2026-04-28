const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'docs');

// Ensure uploads/docs directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Handle saving an uploaded file (generic)
 * @param {object} file - The file object from multer
 * @param {string} prefix - Filename prefix (e.g., 'doc', 'dl')
 * @param {string} nameHint - Optional title to make filename descriptive
 * @returns {string} The public URL path to the saved file
 */
function saveFile(file, prefix = 'doc', nameHint = null) {
  if (!file) return null;
  
  const extension = path.extname(file.originalname).toLowerCase();
  let namePart = `${prefix}-${Date.now()}`;
  
  if (nameHint) {
    // Sanitize: Keep Thai, English, Numbers, replace others with hyphen
    const sanitized = nameHint
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    if (sanitized) {
      namePart = `${prefix}-${sanitized.slice(0, 50)}-${Date.now()}`;
    }
  }

  const filename = `${namePart}${extension}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  if (file.buffer) {
    fs.writeFileSync(filepath, file.buffer);
  } else if (file.path) {
    fs.renameSync(file.path, filepath);
  } else {
    throw new Error('Unsupported file storage type');
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
