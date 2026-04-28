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

// Helper for safe JSON parsing
function safeJsonParse(data, fallback = []) {
  if (!data) return fallback;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('[JSON Parse Error]', e, 'Data:', data);
    return fallback;
  }
}

// POST /api/departments (protected)
router.post('/departments', authenticateToken, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'pdfUrl', maxCount: 1 },
  { name: 'studyPlanUrl', maxCount: 1 },
  { name: 'activityImages', maxCount: 10 }
]), async (req, res) => {
  try {
    const {
      slug, name, icon, type, jobGroup, description, color, order
    } = req.body;

    const keywords = safeJsonParse(req.body.keywords);
    const skills = safeJsonParse(req.body.skills);
    const jobs = safeJsonParse(req.body.jobs);
    const curriculumPvc = safeJsonParse(req.body.curriculumPvc);
    const curriculumHvc = safeJsonParse(req.body.curriculumHvc);

    let imageUrl = null;
    let pdfUrl = req.body.pdfUrlText || null;
    let studyPlanUrl = null;
    let activityImages = [];

    if (req.files?.['image']) {
      imageUrl = await processAndSaveImage(req.files['image'][0].buffer, `dept-${slug}`);
    }
    if (req.files?.['pdfUrl']) {
      pdfUrl = saveFile(req.files['pdfUrl'][0], `curriculum-${slug}`);
    }
    if (req.files?.['studyPlanUrl']) {
      studyPlanUrl = saveFile(req.files['studyPlanUrl'][0], `studyplan-${slug}`);
    }
    if (req.files?.['activityImages']) {
      const uploadPromises = req.files['activityImages'].map((file, idx) => 
        processAndSaveImage(file.buffer, `dept-${slug}-act-${idx}`)
      );
      activityImages = await Promise.all(uploadPromises);
    }

    const newDept = await prisma.department.create({
      data: {
        slug, name, icon, type, jobGroup, description, color,
        keywords, skills, jobs, curriculumPvc, curriculumHvc,
        imageUrl, pdfUrl, studyPlanUrl, activityImages,
        order: parseInt(order) || 0
      }
    });

    res.status(201).json(newDept);
  } catch (error) {
    console.error('[Create Department Error]', error);
    res.status(500).json({ message: 'Failed to create department', error: error.message });
  }
});

// PUT /api/departments/:id (protected)
router.put('/departments/:id', authenticateToken, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'pdfUrl', maxCount: 1 },
  { name: 'studyPlanUrl', maxCount: 1 },
  { name: 'activityImages', maxCount: 10 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      slug, name, icon, type, jobGroup, description, color, order
    } = req.body;

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Department not found' });

    const keywords = req.body.keywords ? safeJsonParse(req.body.keywords, existing.keywords) : existing.keywords;
    const skills = req.body.skills ? safeJsonParse(req.body.skills, existing.skills) : existing.skills;
    const jobs = req.body.jobs ? safeJsonParse(req.body.jobs, existing.jobs) : existing.jobs;
    const curriculumPvc = req.body.curriculumPvc ? safeJsonParse(req.body.curriculumPvc, existing.curriculumPvc) : existing.curriculumPvc;
    const curriculumHvc = req.body.curriculumHvc ? safeJsonParse(req.body.curriculumHvc, existing.curriculumHvc) : existing.curriculumHvc;

    let imageUrl = existing.imageUrl;
    let pdfUrl = req.body.pdfUrlText !== undefined ? req.body.pdfUrlText : existing.pdfUrl;
    let studyPlanUrl = existing.studyPlanUrl;
    
    // Activity Images Gallery logic
    let activityImages = [];
    if (req.body.existingActivityImages) {
      activityImages = safeJsonParse(req.body.existingActivityImages, existing.activityImages || []);
    } else {
      activityImages = existing.activityImages || [];
    }

    // Identify deleted images to cleanup storage
    const oldActList = Array.isArray(existing.activityImages) ? existing.activityImages : [];
    oldActList.forEach(img => {
      if (!activityImages.includes(img)) deleteImage(img);
    });

    if (req.files?.['image']) {
      if (imageUrl) deleteImage(imageUrl);
      imageUrl = await processAndSaveImage(req.files['image'][0].buffer, `dept-${slug || existing.slug}`);
    }
    if (req.files?.['pdfUrl']) {
      if (existing.pdfUrl && existing.pdfUrl.startsWith('/uploads')) deleteFile(existing.pdfUrl);
      pdfUrl = saveFile(req.files['pdfUrl'][0], `curriculum-${slug || existing.slug}`);
    }
    if (req.files?.['studyPlanUrl']) {
      if (studyPlanUrl && studyPlanUrl.startsWith('/uploads')) deleteFile(studyPlanUrl);
      studyPlanUrl = saveFile(req.files['studyPlanUrl'][0], `studyplan-${slug || existing.slug}`);
    }
    if (req.files?.['activityImages']) {
      const uploadPromises = req.files['activityImages'].map((file, idx) => 
        processAndSaveImage(file.buffer, `dept-${slug || existing.slug}-act-${Date.now()}-${idx}`)
      );
      const newUrls = await Promise.all(uploadPromises);
      activityImages = [...activityImages, ...newUrls];
    }

    const updated = await prisma.department.update({
      where: { id },
      data: {
        slug: slug || existing.slug,
        name, icon, type, jobGroup, description, color,
        keywords, skills, jobs, curriculumPvc, curriculumHvc,
        imageUrl, pdfUrl, studyPlanUrl, activityImages,
        order: parseInt(order) || existing.order
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[Update Department Error]', error);
    res.status(500).json({ message: 'Failed to update department' });
  }
});

// DELETE /api/departments/:id (protected)
router.delete('/departments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.department.findUnique({ where: { id } });
    if (existing) {
      if (existing.imageUrl) deleteImage(existing.imageUrl);
      if (existing.pdfUrl && existing.pdfUrl.startsWith('/uploads')) deleteFile(existing.pdfUrl);
      if (existing.studyPlanUrl && existing.studyPlanUrl.startsWith('/uploads')) deleteFile(existing.studyPlanUrl);
      await prisma.department.delete({ where: { id } });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('[Delete Department Error]', error);
    res.status(500).json({ message: 'Failed to delete department' });
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
    const { prefix, firstName, lastName, position, academicStanding, positionNumber, department, phone, email, order } = req.body;
    
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
        email,
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
    const { prefix, firstName, lastName, position, academicStanding, positionNumber, department, phone, email, order } = req.body;
    
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
        email,
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
    let emailColIdx = 22; // Default fallback

    for (const [idx, row] of dataRows.entries()) {
      // Skip empty or purely metadata rows
      if (!row || row.length < 3) continue;

      // Dynamic header skip: If row[2] (First Name column) contains the word 'ชื่อ', it's likely a header
      const checkTitle = String(row[2] || '');
      if (checkTitle.includes('ชื่อ') || checkTitle.includes('FullName')) {
        // Search for specific column indices in the header row
        row.forEach((cell, cellIdx) => {
          const val = String(cell || '').trim();
          if (val.includes('เมลล์') || val.includes('Email') || val.includes('อีเมล')) emailColIdx = cellIdx;
        });
        continue;
      }

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
      let rawPos = String(row[18] || '').trim();
      const rawAcad = String(row[19] || '').trim();
      const rawPosNum = String(row[17] || '').trim();
      const rawPhone = String(row[21] || '').replace(/"/g, '').trim(); 
      const rawEmail = String(row[emailColIdx] || '').trim();
      const rawDuties = String(row[52] || '').trim();

      // -- Position Normalization & Hidden Position Extraction --
      // If primary position is empty or generic, check duties or normalize known strings
      // We prioritize more specific roles and avoid misclassifying 'Staff' who have 'Advisor' duties.
      let finalPos = rawPos;
      const searchTarget = (rawPos + " " + rawDuties).toLowerCase();

      // Order of checks is critical: More specific first, 'Staff' before generic 'Teacher'
      if (searchTarget.includes('พนักงานราชการ(สอน)') || searchTarget.includes('พนักงานราชการ')) {
        finalPos = 'พนักงานราชการ';
      } else if (searchTarget.includes('ครูอัตราจ้าง')) {
        finalPos = 'ครูอัตราจ้าง';
      } else if (searchTarget.includes('ลูกจ้างอัตราจ้าง')) {
        finalPos = 'ลูกจ้างอัตราจ้าง';
      } else if (searchTarget.includes('เจ้าหน้าที่')) {
        finalPos = 'เจ้าหน้าที่';
      } else if (searchTarget.includes('ครูประจำ') || searchTarget.includes('หัวหน้าแผนก') || searchTarget.includes('ครู')) {
        finalPos = 'ครู';
      }

      // Fallback if still empty but is in a known department
      if (!finalPos && rawDuties.includes('แผนกวิชา')) finalPos = 'ครู';

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
        position: finalPos || rawPos || '-', 
        academicStanding: rawAcad === 'ไม่มี' ? null : rawAcad,
        positionNumber: rawPosNum || null,
        department: detectedDept,
        duties: dutiesArr,
        phone: rawPhone === '""' ? null : rawPhone,
        email: rawEmail || '-',
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

    const fileUrl = saveFile(req.file, type === 'bidding' ? 'bid' : 'doc', title);
    
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

// PUT /api/docs/:id (protected)
router.put('/docs/:id', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, type } = req.body;

    const existing = await prisma.publicDocument.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Document not found' });

    let fileUrl = existing.fileUrl;

    // If a new file is uploaded, replace old one
    if (req.file) {
      if (existing.fileUrl) deleteFile(existing.fileUrl);
      fileUrl = saveFile(req.file, type === 'bidding' ? 'bid' : 'doc', title);
    }

    const updated = await prisma.publicDocument.update({
      where: { id },
      data: { title, date, type, fileUrl }
    });

    res.json(updated);
  } catch (error) {
    console.error('[Doc Update Error]', error);
    res.status(500).json({ message: 'Failed to update document', error: error.message });
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

// ──────────────────────────────────────────────────────────────────────────────
// DOWNLOAD CENTER (Division Documents)
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/downloads
router.get('/downloads', async (req, res) => {
  try {
    const docs = await prisma.downloadDocument.findMany({
      orderBy: [
        { division: 'asc' },
        { subDivision: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch download documents' });
  }
});

// POST /api/downloads (protected)
router.post('/downloads', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { title, division, subDivision } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Use saveFile function to write buffer to disk
    const fileUrl = saveFile(req.file, 'dl', title);
    
    const newDoc = await prisma.downloadDocument.create({
      data: { title, division, subDivision, fileUrl }
    });

    res.status(201).json(newDoc);
  } catch (error) {
    console.error('[Download Create Error]', error);
    res.status(500).json({ message: 'Failed to create document', error: error.message });
  }
});

// PUT /api/downloads/:id (protected)
router.put('/downloads/:id', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, division, subDivision } = req.body;

    const existing = await prisma.downloadDocument.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Document not found' });

    let fileUrl = existing.fileUrl;
    if (req.file) {
      if (existing.fileUrl) deleteFile(existing.fileUrl);
      fileUrl = saveFile(req.file, 'dl', title);
    }

    const updated = await prisma.downloadDocument.update({
      where: { id },
      data: { title, division, subDivision, fileUrl }
    });

    res.json(updated);
  } catch (error) {
    console.error('[Download Update Error]', error);
    res.status(500).json({ message: 'Failed to update document', error: error.message });
  }
});

// DELETE /api/downloads/:id (protected)
router.delete('/downloads/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await prisma.downloadDocument.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (doc.fileUrl) deleteFile(doc.fileUrl);
    await prisma.downloadDocument.delete({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete document' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// ITA ASSESSMENT (O1 - O37)
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/ita — Fetch all ITA items
router.get('/ita', async (req, res) => {
  try {
    const items = await prisma.iTAItem.findMany({
      orderBy: { code: 'asc' }
    });
    // Sort logically (O1, O2, ... O10, O11...)
    const sorted = items.sort((a, b) => {
      const numA = parseInt(a.code.substring(1));
      const numB = parseInt(b.code.substring(1));
      return numA - numB;
    });
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ITA items' });
  }
});

// POST /api/ita/init — Initialize O1-O37 if they don't exist
router.post('/ita/init', authenticateToken, async (req, res) => {
  try {
    const itaList = [
      { code: 'O1', title: 'โครงสร้างสถานศึกษา', description: 'แผนผังแสดงโครงสร้างการแบ่งส่วนราชการภายในสถานศึกษา หรือคำสั่งแบ่งงาน' },
      { code: 'O2', title: 'ข้อมูลผู้บริหาร', description: 'รายนามผู้บริหาร รูปถ่าย ตำแหน่ง และช่องทางการติดต่อ' },
      { code: 'O3', title: 'อำนาจหน้าที่', description: 'หน้าที่และอำนาจตามกฎหมาย หรือคำสั่งมอบหมายงานที่ระบุภารกิจชัดเจน' },
      { code: 'O4', title: 'แผนพัฒนาสถานศึกษา', description: 'ยุทธศาสตร์ แผนพัฒนา หรือแผนปฏิบัติราชการประจำปี' },
      { code: 'O5', title: 'ข้อมูลการติดต่อ', description: 'ที่อยู่ เบอร์โทรศัพท์ อีเมล และแผนที่ตั้งสถานศึกษา' },
      { code: 'O6', title: 'กฎหมายที่เกี่ยวข้อง', description: 'กฎหมาย ระเบียบ หรือข้อบังคับที่เกี่ยวข้องกับการดำเนินงานหลัก' },
      { code: 'O7', title: 'ข่าวประชาสัมพันธ์', description: 'รวมข่าวภารกิจ กิจกรรม และความเคลื่อนไหวล่าสุดในปีปัจจุบัน' },
      { code: 'O8', title: 'Q&A (คำถาม-คำตอบ)', description: 'เมนูคำถามที่พบบ่อย หรือช่องทางที่คนภายนอกสามารถสอบถามข้อมูลได้' },
      { code: 'O9', title: 'Social Network', description: 'ลิงก์สื่อสังคมออนไลน์ เช่น Facebook, YouTube หรือ Line' },
      { code: 'O10', title: 'แผนการดำเนินงานประจำปี', description: 'แผนปฏิบัติราชการประจำปี (Action Plan) ของปีงบประมาณปัจจุบัน' },
      { code: 'O11', title: 'รายงานผลการดำเนินงานประจำปี', description: 'รายงานสรุปผลการดำเนินงานของปีงบประมาณที่ผ่านมา' },
      { code: 'O12', title: 'คู่มือหรือมาตรฐานการปฏิบัติงาน', description: 'คู่มือสำหรับเจ้าหน้าที่ (Internal Workflow) สำหรับงานแต่ละฝ่าย' },
      { code: 'O13', title: 'คู่มือหรือมาตรฐานการให้บริการ', description: 'คู่มือสำหรับนักเรียนหรือประชาชนที่มาติดต่อรับบริการ' },
      { code: 'O14', title: 'ข้อมูลเชิงสถิติการให้บริการ', description: 'รายงานจำนวนผู้มาติดต่อรับบริการจำแนกตามรายเดือนหรือรายปี' },
      { code: 'O15', title: 'รายงานผลความพึงพอใจการให้บริการ', description: 'สรุปผลการประเมินความพึงพอใจจากผู้รับบริการในปีปัจจุบัน' },
      { code: 'O16', title: 'E-Service (ระบบบริการออนไลน์)', description: 'ลิงก์ไปยังระบบรับสมัครออนไลน์ ระบบลงทะเบียน หรือบริการอื่นๆ' },
      { code: 'O17', title: 'แผนการใช้จ่ายงบประมาณประจำปี', description: 'รายละเอียดการจัดสรรและแผนใช้จ่ายงบประมาณของสถานศึกษา' },
      { code: 'O18', title: 'รายงานผลการใช้จ่ายงบประมาณประจำปี', description: 'สรุปผลการใช้จ่ายงบประมาณจริงเทียบกับแผน' },
      { code: 'O19', title: 'แผนการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ', description: 'แผนการจัดซื้อจัดจ้างประจำปีงบประมาณล่าสุด' },
      { code: 'O20', title: 'ประกาศตารางการจัดซื้อจัดจ้าง', description: 'รวมประกาศเชิญชวน ประกาศผู้ชนะ และการจัดหาพัสดุต่างๆ' },
      { code: 'O21', title: 'สรุปผลการจัดซื้อจัดจ้างรายเดือน (สขร.1)', description: 'สรุปผลการจัดหาพัสดุในแต่ละเดือนที่ต้องเผยแพร่' },
      { code: 'O22', title: 'รายงานผลการจัดซื้อจัดจ้างประจำปี', description: 'สรุปผลการดำเนินงานจัดซื้อจัดจ้างในรอบปีงบประมาณที่ผ่านมา' },
      { code: 'O23', title: 'กิจกรรมพัฒนาทรัพยากรบุคคล', description: 'กิจกรรมอบรมสัมมนา หรือโครงการพัฒนาบุคลากรในปีปัจจุบัน' },
      { code: 'O24', title: 'หลักเกณฑ์การบริหารทรัพยากรบุคคล', description: 'ระเบียบการให้คุณให้โทษ การเลื่อนขั้น หรือหลักเกณฑ์ที่เกี่ยวข้อง' },
      { code: 'O25', title: 'รายงานผลพัฒนาทรัพยากรบุคคลประจำปี', description: 'สรุปผลการพัฒนาและความก้าวหน้าของบุคลากรในรอบปี' },
      { code: 'O26', title: 'แนวปฏิบัติการจัดการเรื่องร้องเรียนทุจริต', description: 'ขั้นตอนการจัดการและกระบวนการเมื่อได้รับเรื่องร้องเรียนการทุจริต' },
      { code: 'O27', title: 'ช่องทางการแจ้งเรื่องร้องเรียนทุจริต', description: 'ลิงก์หรือหน้าเพจสำหรับส่งข้อมูลร้องเรียนการทุจริตโดยตรง' },
      { code: 'O28', title: 'สถิติเรื่องร้องเรียนการทุจริตประจำปี', description: 'สรุปจำนวนเรื่องที่ได้รับการร้องเรียนและการดำเนินการในปีที่ผ่านมา' },
      { code: 'O29', title: 'การเปิดโอกาสให้เกิดการมีส่วนร่วม', description: 'กิจกรรมที่เปิดให้ชุมชนหรือผู้มีส่วนได้ส่วนเสียเข้ามาร่วมวางแผน/ตรวจสอบ' },
      { code: 'O30', title: 'เจตจำนงสุจริตของผู้บริหาร (No Gift Policy)', description: 'ประกาศนโยบายไม่รับของขวัญและของกำนัลจากการปฏิบัติหน้าที่' },
      { code: 'O31', title: 'การมีส่วนร่วมของผู้บริหาร', description: 'กิจกรรมที่ผู้บริหารแสดงออกถึงการต่อต้านการทุจริต' },
      { code: 'O32', title: 'การประเมินความเสี่ยงการทุจริตประจำปี', description: 'รายงานการประเมินโอกาสที่จะเกิดการทุจริตภายในหน่วยงาน' },
      { code: 'O33', title: 'การดำเนินการจัดการความเสี่ยงทุจริต', description: 'มาตรการหรือกิจกรรมที่ใช้ลดความเสี่ยงจากการทุจริต' },
      { code: 'O34', title: 'การเสริมสร้างวัฒนธรรมองค์กร', description: 'กิจกรรมปลูกฝังความซื่อสัตย์สุจริตและจริยธรรมให้แก่คนในวิทยาลัย' },
      { code: 'O35', title: 'แผนปฏิบัติการป้องกันการทุจริต', description: 'แผนโครงการส่งเสริมความโปร่งใสและป้องกันทุจริตประจำปี' },
      { code: 'O36', title: 'รายงานผลการป้องกันการทุจริตประจำปี', description: 'สรุปผลการดำเนินงานตามแผนป้องกันทุจริตในปีที่ผ่านมา' },
      { code: 'O37', title: 'มาตรการส่งเสริมคุณธรรมและความโปร่งใส', description: 'มาตรการหรือกลไกภายในที่ใช้ควบคุมความโปร่งใสและจริยธรรม' }
    ];

    for (const item of itaList) {
      await prisma.iTAItem.upsert({
        where: { code: item.code },
        update: { 
          title: item.title,
          description: item.description 
        },
        create: { 
          code: item.code, 
          title: item.title, 
          description: item.description,
          attachments: [] 
        }
      });
    }

    res.json({ message: 'ITA initialization with descriptions successful' });
  } catch (error) {
    console.error('[ITA Init]', error);
    res.status(500).json({ message: 'Failed to initialize ITA data' });
  }
});

// PUT /api/ita/:code — Update ITA item (files + links)
router.put('/ita/:code', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { code } = req.params;
    // attachments are sent as a JSON string describing current/remaining docs + links
    const { existingAttachments } = req.body;
    
    let currentData = [];
    if (existingAttachments) {
      try { currentData = JSON.parse(existingAttachments); } catch (e) { currentData = []; }
    }

    // Process new file uploads
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Find label in req.body for this specific file if provided, else use filename
        const fileUrl = saveFile(file, 'ita');
        currentData.push({ 
          label: file.originalname.split('.')[0], // fallback label
          url: fileUrl, 
          type: 'file' 
        });
      }
    }

    // Explicitly add any new link items if sent in a batch (client logic)
    if (req.body.newLinks) {
       let newLinks = [];
       try { newLinks = JSON.parse(req.body.newLinks); } catch(e) {}
       if (Array.isArray(newLinks)) {
          currentData = [...currentData, ...newLinks];
       }
    }

    const updated = await prisma.iTAItem.update({
      where: { code },
      data: { 
        attachments: currentData,
        updatedAt: new Date()
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[ITA Update]', error);
    res.status(500).json({ message: 'Failed to update ITA item' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// STUDENT ENROLLMENT & SETTINGS
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/students (protected)
router.get('/students', authenticateToken, async (req, res) => {
  try {
    const { year, semester } = req.query;
    
    // Fetch current settings as defaults
    const siteSettings = await prisma.siteSettings.findMany({
      where: { key: { in: ['current_semester', 'academic_year', 'budget_info_status'] } }
    });
    
    const academicYear = year || siteSettings.find(s => s.key === 'academic_year')?.value || '2567';
    const currentSemester = semester || siteSettings.find(s => s.key === 'current_semester')?.value || '1';
    const budgetStatus = siteSettings.find(s => s.key === 'budget_info_status')?.value || 'active';

    const enrollments = await prisma.studentEnrollment.findMany({
      where: { 
        academicYear: String(academicYear), 
        semester: String(currentSemester) 
      }
    });

    res.json({ 
      enrollments, 
      settings: {
        academic_year: academicYear,
        current_semester: currentSemester,
        budget_info_status: budgetStatus
      }
    });
  } catch (error) {
    console.error('[Student Fetch Error]', error);
    res.status(500).json({ message: 'Failed to fetch student data' });
  }
});

// POST /api/students (protected)
router.post('/students', authenticateToken, async (req, res) => {
  try {
    const { enrollments, settings, targetYear, targetSemester } = req.body;
    
    // Which year/semester are we SAVING the table records to?
    const saveYear = targetYear || settings?.academic_year;
    const saveSemester = targetSemester || settings?.current_semester;

    // Only require year/semester if we are actually saving enrollment data
    if (enrollments && Array.isArray(enrollments) && enrollments.length > 0) {
      if (!saveYear || !saveSemester) {
        return res.status(400).json({ message: 'Missing target academic year or semester for enrollment data' });
      }
    }

    // 1. Update enrollments for the specific target year/semester
    if (enrollments && Array.isArray(enrollments)) {
      for (const en of enrollments) {
        await prisma.studentEnrollment.upsert({
          where: {
            departmentSlug_academicYear_semester: {
              departmentSlug: en.departmentSlug,
              academicYear: String(saveYear),
              semester: String(saveSemester)
            }
          },
          update: {
            pvc1: parseInt(en.pvc1) || 0,
            pvc2: parseInt(en.pvc2) || 0,
            pvc3: parseInt(en.pvc3) || 0,
            pvs1: parseInt(en.pvs1) || 0,
            pvs2: parseInt(en.pvs2) || 0
          },
          create: {
            departmentSlug: en.departmentSlug,
            academicYear: String(saveYear),
            semester: String(saveSemester),
            pvc1: parseInt(en.pvc1) || 0,
            pvc2: parseInt(en.pvc2) || 0,
            pvc3: parseInt(en.pvc3) || 0,
            pvs1: parseInt(en.pvs1) || 0,
            pvs2: parseInt(en.pvs2) || 0
          }
        });
      }
    }

    // Update global settings
    if (settings && typeof settings === 'object') {
      for (const [key, value] of Object.entries(settings)) {
        await prisma.siteSettings.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) }
        });
      }
    }

    res.json({ message: 'Saved successfully' });
  } catch (error) {
    console.error('[Student Update Error]', error);
    res.status(500).json({ message: 'Failed to save student data' });
  }
});

// GET /api/students/years (protected)
router.get('/students/years', authenticateToken, async (req, res) => {
  try {
    const rawYears = await prisma.studentEnrollment.findMany({
      select: { academicYear: true },
      distinct: ['academicYear']
    });
    // Extract strings and sort descending
    const years = rawYears.map(y => y.academicYear).sort((a, b) => b.localeCompare(a));
    res.json(years);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch years' });
  }
});

// DELETE /api/students/period (protected)
router.delete('/students/period', authenticateToken, async (req, res) => {
  try {
    const { year, semester } = req.query;
    if (!year || !semester) return res.status(400).json({ message: 'Missing year or semester' });

    await prisma.studentEnrollment.deleteMany({
      where: {
        academicYear: String(year),
        semester: String(semester)
      }
    });

    res.json({ message: 'Period data deleted successfully' });
  } catch (error) {
    console.error('[Student Delete Error]', error);
    res.status(500).json({ message: 'Failed to delete period data' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// SITE IMAGES (Hero + Sub-Banner)
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/site-images — fetch hero + sub-banner image lists
router.get('/site-images', async (req, res) => {
  try {
    const settings = await prisma.siteSettings.findMany({
      where: { key: { in: ['hero_images', 'sub_banner_images'] } }
    });
    const heroSetting = settings.find(s => s.key === 'hero_images');
    const subSetting  = settings.find(s => s.key === 'sub_banner_images');
    const heroImages    = heroSetting   ? JSON.parse(heroSetting.value)  : [];
    const subBannerImages = subSetting  ? JSON.parse(subSetting.value)   : [];
    res.json({ heroImages, subBannerImages });
  } catch (error) {
    console.error('[SiteImages GET]', error);
    res.status(500).json({ message: 'Failed to fetch site images' });
  }
});

// POST /api/site-images/hero — upload a hero image
router.post('/site-images/hero', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const newUrl = await processAndSaveImage(req.file.buffer, 'hero');

    const existing = await prisma.siteSettings.findUnique({ where: { key: 'hero_images' } });
    const list = existing ? JSON.parse(existing.value) : [];
    list.push(newUrl);

    await prisma.siteSettings.upsert({
      where: { key: 'hero_images' },
      update: { value: JSON.stringify(list) },
      create: { key: 'hero_images', value: JSON.stringify(list) }
    });
    res.json({ url: newUrl, heroImages: list });
  } catch (error) {
    console.error('[SiteImages Hero Upload]', error);
    res.status(500).json({ message: 'Failed to upload hero image' });
  }
});

// DELETE /api/site-images/hero/:index — delete a hero image by index
router.delete('/site-images/hero/:index', authenticateToken, async (req, res) => {
  try {
    const idx = parseInt(req.params.index);
    const existing = await prisma.siteSettings.findUnique({ where: { key: 'hero_images' } });
    let list = existing ? JSON.parse(existing.value) : [];
    if (idx < 0 || idx >= list.length) return res.status(404).json({ message: 'Index out of range' });

    const removed = list.splice(idx, 1)[0];
    deleteImage(removed);

    await prisma.siteSettings.upsert({
      where: { key: 'hero_images' },
      update: { value: JSON.stringify(list) },
      create: { key: 'hero_images', value: JSON.stringify(list) }
    });
    res.json({ heroImages: list });
  } catch (error) {
    console.error('[SiteImages Hero Delete]', error);
    res.status(500).json({ message: 'Failed to delete hero image' });
  }
});

// POST /api/site-images/subbanner — upload a sub-banner image
router.post('/site-images/subbanner', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const newUrl = await processAndSaveImage(req.file.buffer, 'subbanner');

    const existing = await prisma.siteSettings.findUnique({ where: { key: 'sub_banner_images' } });
    const list = existing ? JSON.parse(existing.value) : [];
    list.push(newUrl);

    await prisma.siteSettings.upsert({
      where: { key: 'sub_banner_images' },
      update: { value: JSON.stringify(list) },
      create: { key: 'sub_banner_images', value: JSON.stringify(list) }
    });
    res.json({ url: newUrl, subBannerImages: list });
  } catch (error) {
    console.error('[SiteImages SubBanner Upload]', error);
    res.status(500).json({ message: 'Failed to upload sub-banner image' });
  }
});

// DELETE /api/site-images/subbanner/:index — delete a sub-banner image by index
router.delete('/site-images/subbanner/:index', authenticateToken, async (req, res) => {
  try {
    const idx = parseInt(req.params.index);
    const existing = await prisma.siteSettings.findUnique({ where: { key: 'sub_banner_images' } });
    let list = existing ? JSON.parse(existing.value) : [];
    if (idx < 0 || idx >= list.length) return res.status(404).json({ message: 'Index out of range' });

    const removed = list.splice(idx, 1)[0];
    deleteImage(removed);

    await prisma.siteSettings.upsert({
      where: { key: 'sub_banner_images' },
      update: { value: JSON.stringify(list) },
      create: { key: 'sub_banner_images', value: JSON.stringify(list) }
    });
    res.json({ subBannerImages: list });
  } catch (error) {
    console.error('[SiteImages SubBanner Delete]', error);
    res.status(500).json({ message: 'Failed to delete sub-banner image' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// ACHIEVEMENTS (Outstanding Works)
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/achievements
router.get('/achievements', async (req, res) => {
  try {
    const list = await prisma.achievement.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(list);
  } catch (error) {
    console.error('[Achievements GET]', error);
    res.status(500).json({ message: 'Failed to fetch achievements' });
  }
});

// POST /api/achievements
router.post('/achievements', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    let imageUrl = null;
    if (req.file) {
      imageUrl = await processAndSaveImage(req.file.buffer, 'achieve');
    }

    const { title, description, awardLabel, awardText, order } = req.body;
    const newItem = await prisma.achievement.create({
      data: {
        title,
        description,
        awardLabel,
        awardText,
        imageUrl,
        order: parseInt(order) || 0
      }
    });

    res.json(newItem);
  } catch (error) {
    console.error('[Achievements POST]', error);
    res.status(500).json({ message: 'Failed to create achievement' });
  }
});

// PUT /api/achievements/:id
router.put('/achievements/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, awardLabel, awardText, order } = req.body;

    const existing = await prisma.achievement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Achievement not found' });

    let imageUrl = existing.imageUrl;
    if (req.file) {
      // Delete old image if exists
      if (existing.imageUrl) deleteImage(existing.imageUrl);
      imageUrl = await processAndSaveImage(req.file.buffer, 'achieve');
    }

    const updated = await prisma.achievement.update({
      where: { id },
      data: {
        title,
        description,
        awardLabel,
        awardText,
        imageUrl,
        order: parseInt(order) || 0
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[Achievements PUT]', error);
    res.status(500).json({ message: 'Failed to update achievement' });
  }
});

// DELETE /api/achievements/:id
router.delete('/achievements/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.achievement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Achievement not found' });

    if (existing.imageUrl) deleteImage(existing.imageUrl);

    await prisma.achievement.delete({ where: { id } });
    res.json({ message: 'Achievement deleted' });
  } catch (error) {
    console.error('[Achievements DELETE]', error);
    res.status(500).json({ message: 'Failed to delete achievement' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// FAQ
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/faqs
router.get('/faqs', async (req, res) => {
  try {
    const items = await prisma.fAQ.findMany({ orderBy: { order: 'asc' } });
    
    // If empty, return initial dummy data as a fallback or to help seeding
    if (items.length === 0) {
      return res.json([
        { id: '1', category: 'การรับสมัคร', question: 'เปิดรับสมัครนักศึกษาใหม่ช่วงไหน?', answer: 'ปกติจะเปิดรับสมัครในช่วงเดือนมกราคม - เมษายน ของทุกปี ผ่านระบบออนไลน์และที่วิทยาลัย' },
        { id: '2', category: 'หลักสูตรและการเรียน', question: 'ระบบทวิภาคีคืออะไร?', answer: 'เป็นการเรียนที่ร่วมมือกับสถานประกอบการ นักศึกษาจะได้เข้าฝึกประสบการณ์การทำงานจริงในบริษัท และได้รับเบี้ยเลี้ยงระหว่างเรียน' },
        { id: '3', category: 'ทุนการศึกษา', question: 'มีทุนการศึกษาสำหรับนักเรียนที่ขาดแคลนหรือไม่?', answer: 'มีทุน กยศ. และทุนจากเครือข่ายความร่วมมือจากภาคเอกชนสนับสนุนนักเรียนที่มีความประพฤติดี' }
      ]);
    }
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch FAQs' });
  }
});

// POST /api/faqs (protected)
router.post('/faqs', authenticateToken, async (req, res) => {
  try {
    const { question, answer, category, order } = req.body;
    const newItem = await prisma.fAQ.create({
      data: {
        question,
        answer,
        category: category || 'ทั่วไป',
        order: parseInt(order) || 0
      }
    });
    res.status(201).json(newItem);
  } catch (error) {
    console.error('[FAQ Create Error]', error);
    res.status(500).json({ message: 'Failed to create FAQ' });
  }
});

// PUT /api/faqs/:id (protected)
router.put('/faqs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, category, order } = req.body;
    const updated = await prisma.fAQ.update({
      where: { id },
      data: {
        question,
        answer,
        category,
        order: parseInt(order) || 0
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('[FAQ Update Error]', error);
    res.status(500).json({ message: 'Failed to update FAQ' });
  }
});

// DELETE /api/faqs/:id (protected)
router.delete('/faqs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.fAQ.delete({ where: { id } });
    res.json({ message: 'FAQ deleted' });
  } catch (error) {
    console.error('[FAQ Delete Error]', error);
    res.status(500).json({ message: 'Failed to delete FAQ' });
  }
});

module.exports = router;

