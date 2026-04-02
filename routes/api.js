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
        images: imagesArr || []
      },
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error('[PR Create Error]', error);
    res.status(500).json({ 
      message: 'Failed to create PR item',
      error: error.message 
    });
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
        const parsed = typeof req.body.existingImages === 'string' 
          ? JSON.parse(req.body.existingImages) 
          : req.body.existingImages;
        keptImages = Array.isArray(parsed) ? parsed.filter(i => typeof i === 'string') : [];
      } catch (e) {
        keptImages = [];
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
        images: finalImages || []
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[PR Update Error]', error);
    res.status(500).json({ 
      message: 'Failed to update PR item',
      error: error.message 
    });
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

// GET /api/personnel/unique-duties
router.get('/personnel/unique-duties', async (req, res) => {
  try {
    const personnel = await prisma.personnel.findMany({
      select: { duties: true }
    });
    
    const allDuties = personnel.flatMap(p => {
      if (Array.isArray(p.duties)) return p.duties;
      if (typeof p.duties === 'string' && p.duties.startsWith('[')) {
        try { return JSON.parse(p.duties); } catch (e) { return []; }
      }
      return p.duties ? [p.duties] : [];
    });

    const uniqueDuties = [...new Set(allDuties)]
      .filter(d => d && typeof d === 'string')
      .sort((a, b) => a.localeCompare(b, 'th'));

    res.json(uniqueDuties);
  } catch (error) {
    console.error('[Unique Duties Error]', error);
    res.status(500).json({ message: 'Failed to fetch unique duties' });
  }
});

// POST /api/personnel (protected)
router.post('/personnel', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { prefix, firstName, lastName, position, academicStanding, positionNumber, department, phone, order } = req.body;
    
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
        academicStanding,
        positionNumber,
        department,
        duties: Array.isArray(duties) ? duties : [],
        phone,
        imageUrl,
        order: order ? parseInt(order) : 0
      }
    });

    res.status(201).json(newPerson);
  } catch (error) {
    console.error('[Personnel Create Error]', error);
    res.status(500).json({ message: 'Failed to create personnel', error: error.message });
  }
});

// PUT /api/personnel/:id (protected)
router.put('/personnel/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { prefix, firstName, lastName, position, academicStanding, positionNumber, department, phone, order } = req.body;
    
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
        academicStanding,
        positionNumber,
        department,
        duties: Array.isArray(duties) ? duties : [],
        phone,
        imageUrl,
        order: order ? parseInt(order) : existing.order
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[Personnel Update Error]', error);
    res.status(500).json({ message: 'Failed to update personnel', error: error.message });
  }
});

// DELETE /personnel/bulk (protected)
router.delete('/personnel/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ไม่มีรายการที่เลือก' });
    }

    // 1. Get all personnel to delete their images
    const personnelToDelete = await prisma.personnel.findMany({
      where: { id: { in: ids } }
    });

    for (const p of personnelToDelete) {
      if (p.imageUrl) deleteImage(p.imageUrl);
    }

    // 2. Perform bulk deletion
    const result = await prisma.personnel.deleteMany({
      where: { id: { in: ids } }
    });

    res.json({ message: `ลบสำเร็จ ${result.count} รายการ` });
  } catch (error) {
    console.error('[Personnel Bulk Delete Error]', error);
    res.status(500).json({ message: 'Failed to delete selected personnel', error: error.message });
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

const { splitThaiName } = require('../utils/nameSplitter');

// POST /api/personnel/import (protected)
router.post('/personnel/import', authenticateToken, upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    let contentString;
    const buffer = req.file.buffer;

    // Check if it's an HTML file (common for faked .xls exports)
    const isHtml = buffer.slice(0, 100).toString('ascii').toLowerCase().includes('<html') ||
                   buffer.slice(0, 100).toString('ascii').toLowerCase().includes('<!doctype');

    if (isHtml) {
      // Look for charset in the first few KB
      const head = buffer.slice(0, 2048).toString('ascii');
      if (head.toLowerCase().includes('charset=windows-874') || head.toLowerCase().includes('charset=tis-620')) {
        const decoder = new TextDecoder('windows-874');
        contentString = decoder.decode(buffer);
      } else {
        contentString = buffer.toString('utf8');
      }
    }

    const workbook = contentString 
      ? xlsx.read(contentString, { type: 'string' })
      : xlsx.read(buffer, { type: 'buffer' });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Using header: 1 to get raw array mapping for fixed position files
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (rawData.length < 2) return res.status(400).json({ message: 'File is empty or invalid' });

    const createdPersonnel = [];
    let addedCount = 0;
    let updatedCount = 0;

    // Skip the first 2-3 rows which are usually titles/headers in official exports
    // Based on diagnostic: Row 0/1 are metadata, Row 2 is typically the first data row
    // Start from Row 0 and use dynamic filtering to avoid skipping the first data row
    const dataRows = rawData; 

    for (const [idx, row] of dataRows.entries()) {
      // Skip empty or purely metadata rows
      if (!row || row.length < 3) continue;

      // Dynamic header skip: If row[2] (First Name column) contains the word 'ชื่อ', it's likely a header
      const checkTitle = String(row[2] || '');
      if (checkTitle.includes('ชื่อ') || checkTitle.includes('FullName')) continue;

      // บันทึกตำแหน่งคอลัมน์จากไฟล์จริงที่ตรวจสอบล่าสุด:
      // index 2: ชื่อ
      // index 3: นามสกุล
      // index 17: เลขที่ตำแหน่ง (Position Number)
      // index 18: ตำแหน่ง (Position)
      // index 19: วิทยฐานะ (Academic Standing)
      // index 21: เบอร์โทร (Phone) - มักอยู่ในเครื่องหมายคำพูด ""
      // index 52: หน้าที่รับผิดชอบ (Duties)
      
      const rawFullName = String(row[2] || '').trim();
      const rawLastName = String(row[3] || '').trim();
      const rawPos = String(row[18] || '').trim();
      const rawAcad = String(row[19] || '').trim();
      const rawPosNum = String(row[17] || '').trim();
      const rawPhone = String(row[21] || '').replace(/"/g, '').trim(); 
      const rawDuties = String(row[52] || '').trim();

      // 1. Process Name & Split Prefix
      const fullStringToSplit = `${rawFullName} ${rawLastName}`.trim();
      const { prefix, firstName, lastName } = splitThaiName(fullStringToSplit);
      
      if (!firstName && !lastName) continue;

      // 2. Process Duties & Detect Department
      // แยกข้อมูลโดยใช้ทั้ง Newline และเครื่องหมาย " - " เพื่อให้ได้แท็กที่ละเอียดขึ้นตั้งแต่ตอนนำเข้า
      let dutiesArr = rawDuties.split(/\n| - /)
        .map(d => d.replace(/^-/, '').trim())
        .filter(Boolean);

      // ดึงเฉพาะชื่อแผนกวิชา (ตัดหน้า-หลัง)
      let detectedLine = dutiesArr.find(d => d.includes('แผนกวิชา'));
      let detectedDept = "ฝ่ายสนับสนุนการสอน";
      
      if (detectedLine) {
        // ใช้ Regex เพื่อหาคำว่า แผนกวิชา ตามด้วยข้อความที่ไม่ใช่ช่องว่างหรือขีด
        const match = detectedLine.match(/แผนกวิชา[^\s-]+/);
        if (match) {
          detectedDept = match[0];
        }
      }

      // 3. Upsert Logic: Check if person exists by Name (First + Last)
      const existingPerson = await prisma.personnel.findFirst({
        where: { firstName, lastName }
      });

      const personData = {
        prefix,
        firstName,
        lastName,
        position: rawPos === 'ไม่มี' ? null : rawPos,
        academicStanding: rawAcad === 'ไม่มี' ? null : rawAcad,
        positionNumber: rawPosNum || null,
        department: detectedDept,
        duties: dutiesArr,
        phone: rawPhone === '""' ? null : rawPhone,
        order: idx + 1
      };

      if (existingPerson) {
        // Update existing record, preserve imageUrl and isDirector
        const updated = await prisma.personnel.update({
          where: { id: existingPerson.id },
          data: personData
        });
        updatedCount++;
        createdPersonnel.push(updated);
      } else {
        // Create new record
        const created = await prisma.personnel.create({
          data: personData
        });
        addedCount++;
        createdPersonnel.push(created);
      }
    }

    res.status(201).json({ 
      message: `นำเข้าสำเร็จ: เพิ่มใหม่ ${addedCount} รายการ, อัปเดต ${updatedCount} รายการ`,
      addedCount,
      updatedCount,
      total: addedCount + updatedCount 
    });
  } catch (error) {
    console.error('[Personnel Import Error]', error);
    res.status(500).json({ message: 'Failed to import personnel', error: error.message });
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
    console.error('[Doc Create Error]', error);
    res.status(500).json({ 
      message: 'Failed to create document',
      error: error.message 
    });
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
