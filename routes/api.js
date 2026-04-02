const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');
const { authenticateToken } = require('../middleware/auth');
const { processAndSaveImage, deleteImage } = require('../utils/imageProcessor');
const { saveFile, deleteFile } = require('../utils/fileProcessor');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Multer: store in memory for Sharp processing
const upload = multer({ storage: multer.memoryStorage() });

// ──────────────────────────────────────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────────────────────────────────────

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) return res.status(400).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(400).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { username: admin.username, role: admin.role } });
  } catch (error) {
    console.error('[Auth]', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/verify
router.get('/auth/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ──────────────────────────────────────────────────────────────────────────────
// PR ITEMS (NEWS & ANNOUNCEMENTS)
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/pr
router.get('/pr', async (req, res) => {
  try {
    const items = await prisma.pRItem.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch PR items' });
  }
});

// POST /api/pr (protected)
router.post('/pr', authenticateToken, upload.array('images', 10), async (req, res) => {
  try {
    const { title, date, category, departmentTag, content } = req.body;
    let coverImage = 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800';
    let imagesArr = [];

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file, idx) => processAndSaveImage(file.buffer, `pr-${idx}`));
      imagesArr = await Promise.all(uploadPromises);
      coverImage = imagesArr[0]; // first image is cover
    }

    const newItem = await prisma.pRItem.create({
      data: { 
        title, 
        date, 
        category, 
        departmentTag: departmentTag || null,
        content, 
        image: coverImage,
        images: imagesArr
      },
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error('[PR Create]', error);
    res.status(500).json({ message: 'Failed to create PR item' });
  }
});

// PUT /api/pr/:id (protected)
router.put('/pr/:id', authenticateToken, upload.array('images', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, category, departmentTag, content } = req.body;

    // Handle existing images passed from frontend to keep
    let keptImages = [];
    if (req.body.existingImages) {
      try {
        keptImages = JSON.parse(req.body.existingImages);
      } catch (e) {
        keptImages = Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages];
      }
    }

    const existing = await prisma.pRItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Item not found' });

    // Calculate which old images were deleted by user
    let oldImages = [];
    if (Array.isArray(existing.images)) {
      oldImages = existing.images;
    } else if (existing.image && existing.image.startsWith('/uploads/')) {
      oldImages = [existing.image];
    }

    oldImages.forEach(imgUrl => {
      if (!keptImages.includes(imgUrl) && imgUrl !== 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800') {
        deleteImage(imgUrl);
      }
    });

    // Process new uploaded images
    let newImagesUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file, idx) => processAndSaveImage(file.buffer, `pr-upd-${idx}`));
      newImagesUrls = await Promise.all(uploadPromises);
    }

    const finalImages = [...keptImages, ...newImagesUrls];
    const finalCover = finalImages.length > 0 ? finalImages[0] : (existing.image || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800');

    const updated = await prisma.pRItem.update({
      where: { id },
      data: { 
        title, 
        date, 
        category, 
        departmentTag: departmentTag || null,
        content, 
        image: finalCover,
        images: finalImages
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[PR Update]', error);
    res.status(500).json({ message: 'Failed to update PR item' });
  }
});

// DELETE /api/pr/:id (protected)
router.delete('/pr/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.pRItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // Delete all associated files
    let allImages = Array.isArray(item.images) ? item.images : [];
    if (item.image && !allImages.includes(item.image)) allImages.push(item.image);
    
    allImages.forEach(img => {
      if (img !== 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800') {
        deleteImage(img);
      }
    });

    await prisma.pRItem.delete({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete PR item' });
  }
});

// PATCH /api/pr/:id/pin (protected) — toggle isPinned
router.patch('/pr/:id/pin', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.pRItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // If pinning: check max 3 pinned items
    if (!item.isPinned) {
      const pinnedCount = await prisma.pRItem.count({ where: { isPinned: true } });
      if (pinnedCount >= 3) {
        return res.status(400).json({ message: 'สามารถ pin ได้สูงสุด 3 รายการ' });
      }
    }

    const updated = await prisma.pRItem.update({
      where: { id },
      data: { isPinned: !item.isPinned },
    });
    res.json(updated);
  } catch (error) {
    console.error('[PR Pin]', error);
    res.status(500).json({ message: 'Failed to toggle pin' });
  }
});


// ──────────────────────────────────────────────────────────────────────────────
// DEPARTMENTS
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/departments
router.get('/departments', async (req, res) => {
  try {
    const departments = await prisma.department.findMany({ orderBy: { order: 'asc' } });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch departments' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PERSONNEL
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/personnel
router.get('/personnel', async (req, res) => {
  try {
    const personnel = await prisma.personnel.findMany({ orderBy: { order: 'asc' } });
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch personnel' });
  }
});

// POST /api/personnel (protected)
router.post('/personnel', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { prefix, firstName, lastName, position, phone, order } = req.body;
    
    // Parse duties if sent as string
    let duties = [];
    if (req.body.duties) {
      try { duties = JSON.parse(req.body.duties); } 
      catch (e) { duties = [req.body.duties]; }
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await processAndSaveImage(req.file.buffer, 'personnel');
    }

    const newPerson = await prisma.personnel.create({
      data: {
        prefix,
        firstName,
        lastName,
        position,
        duties,
        phone,
        imageUrl,
        order: order ? parseInt(order) : 0
      }
    });

    res.status(201).json(newPerson);
  } catch (error) {
    console.error('[Personnel Create]', error);
    res.status(500).json({ message: 'Failed to create personnel' });
  }
});

// PUT /api/personnel/:id (protected)
router.put('/personnel/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { prefix, firstName, lastName, position, phone, order } = req.body;
    
    let duties = [];
    if (req.body.duties) {
      try { duties = JSON.parse(req.body.duties); } 
      catch (e) { duties = [req.body.duties]; }
    }

    const existing = await prisma.personnel.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Personnel not found' });

    let imageUrl = existing.imageUrl;
    if (req.file) {
      if (existing.imageUrl) deleteImage(existing.imageUrl);
      imageUrl = await processAndSaveImage(req.file.buffer, 'personnel');
    }

    const updated = await prisma.personnel.update({
      where: { id },
      data: {
        prefix,
        firstName,
        lastName,
        position,
        duties,
        phone,
        imageUrl,
        order: order ? parseInt(order) : existing.order
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[Personnel Update]', error);
    res.status(500).json({ message: 'Failed to update personnel' });
  }
});

// DELETE /api/personnel/:id (protected)
router.delete('/personnel/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.personnel.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Personnel not found' });
    
    if (existing.imageUrl) deleteImage(existing.imageUrl);
    await prisma.personnel.delete({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete personnel' });
  }
});

// POST /api/personnel/import (protected)
router.post('/personnel/import', authenticateToken, upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Expected columns: คำนำหน้า, ชื่อ, นามสกุล, ตำแหน่งหลัก, หน้าที่รับผิดชอบ(คั่นด้วยลูกน้ำ), เบอร์โทร
    const data = xlsx.utils.sheet_to_json(sheet);

    const createdPersonnel = [];

    // Simple bulk creation
    for (const [idx, row] of data.entries()) {
      // Map thai keys or english keys based on your excel template
      const prefix = row['คำนำหน้า'] || row['prefix'] || '';
      const firstName = row['ชื่อ'] || row['firstName'] || '';
      const lastName = row['นามสกุล'] || row['lastName'] || '';
      const position = row['ตำแหน่งหลัก'] || row['ตำแหน่ง'] || row['position'] || '';
      const phone = row['เบอร์โทร'] || row['เบอร์ติดต่อ'] || row['phone'] || '';
      
      const rawDuties = row['หน้าที่รับผิดชอบ'] || row['duties'] || '';
      const duties = rawDuties ? rawDuties.split(',').map(d => d.trim()).filter(Boolean) : [];

      if (!firstName && !lastName) continue; // Skip invalid rows

      const created = await prisma.personnel.create({
        data: {
          prefix,
          firstName,
          lastName,
          position,
          duties,
          phone,
          order: idx + 1
        }
      });
      createdPersonnel.push(created);
    }

    res.status(201).json({ message: `นำเข้าสำเร็จ ${createdPersonnel.length} รายการ`, data: createdPersonnel });
  } catch (error) {
    console.error('[Personnel Import]', error);
    res.status(500).json({ message: 'Failed to import personnel' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC DOCUMENTS & BIDDING
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/docs
router.get('/docs', async (req, res) => {
  try {
    const { type } = req.query; // optional filter by type
    const where = type ? { type } : {};
    const docs = await prisma.publicDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

// POST /api/docs (protected)
router.post('/docs', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { title, date, type } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const fileUrl = saveFile(req.file, type === 'bidding' ? 'bid' : 'doc');
    
    const newDoc = await prisma.publicDocument.create({
      data: { title, date, type, fileUrl }
    });

    res.status(201).json(newDoc);
  } catch (error) {
    console.error('[Doc Create]', error);
    res.status(500).json({ message: 'Failed to create document' });
  }
});

// DELETE /api/docs/:id (protected)
router.delete('/docs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await prisma.publicDocument.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (doc.fileUrl) deleteFile(doc.fileUrl);
    await prisma.publicDocument.delete({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete document' });
  }
});

module.exports = router;
