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

// GET /api/ita — Fetch all ITA items for a year
router.get('/ita', async (req, res) => {
  const year = req.query.year || '2569';
  try {
    const items = await prisma.iTAItem.findMany({
      where: { year },
      orderBy: { code: 'asc' }
    });
    // Sort logically (O1, O2, ... O10, O11...)
    const sorted = items.sort((a, b) => {
      const numA = parseInt(a.code.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.code.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ITA items' });
  }
});

// GET /api/ita/nogift-settings/:year — Fetch No Gift Policy settings for a specific year
router.get('/ita/nogift-settings/:year', async (req, res) => {
  const { year } = req.params;
  try {
    const settingKey = `nogift_settings_${year}`;
    const [setting, itaO20] = await Promise.all([
      prisma.siteSettings.findUnique({ where: { key: settingKey } }),
      prisma.iTAItem.findUnique({ where: { code_year: { code: 'O20', year } } })
    ]);

    const attachments = itaO20 && Array.isArray(itaO20.attachments) ? itaO20.attachments : [];

    if (setting) {
      const parsed = JSON.parse(setting.value);
      return res.json({
        ...parsed,
        attachments
      });
    }

    // Return default values if not configured yet for this year
    res.json({
      bannerUrl: '/images/no_gift_policy_banner.png',
      statementTh: 'วิทยาลัยการอาชีพบ่อไร่ ประกาศเจตนารมณ์ในการไม่รับของขวัญและของกำนัลทุกชนิดจากการปฏิบัติหน้าที่ (No Gift Policy) โดยผู้บริหาร ครู และบุคลากรทางการศึกษาทุกคน จะต้องไม่แสวงหาหรือรับของขวัญ ของกำนัล หรือผลประโยชน์ใดๆ ที่ส่งผลให้เกิดความไม่โปร่งใส หรือก่อให้เกิดการเลือกปฏิบัติ เพื่อร่วมกันขับเคลื่อนสถานศึกษาที่มีคุณธรรม มีความโปร่งใส และมุ่งมั่นให้บริการประชาชนอย่างเท่าเทียม',
      statementEn: 'Bo Rai Industrial and Community Education College declares its commitment to the "No Gift Policy". All executives, teachers, and staff members shall not seek or accept any gifts, rewards, or favors of any kind from performing their duties, either before, during, or after their operations, to foster an organizational culture of integrity, transparency, and equal treatment for all.',
      attachments
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch No Gift Policy settings' });
  }
});

// POST /api/ita/nogift-settings/:year — Save/Update No Gift Policy settings for a specific year
router.post('/ita/nogift-settings/:year', authenticateToken, upload.fields([
  { name: 'banner', maxCount: 1 },
  { name: 'knowledge', maxCount: 10 },
  { name: 'attachments', maxCount: 10 }
]), async (req, res) => {
  const { year } = req.params;
  const { statementTh, statementEn, existingKnowledgeImages, existingAttachments, attachmentLabels } = req.body;
  try {
    const settingKey = `nogift_settings_${year}`;
    const existingSetting = await prisma.siteSettings.findUnique({
      where: { key: settingKey }
    });

    let bannerUrl = '/images/no_gift_policy_banner.png';
    let oldBannerUrl = null;
    let oldKnowledgeImages = [];
    let currentKnowledgeImages = [];

    if (existingSetting) {
      const parsed = JSON.parse(existingSetting.value);
      bannerUrl = parsed.bannerUrl || bannerUrl;
      oldBannerUrl = parsed.bannerUrl;
      oldKnowledgeImages = parsed.knowledgeImages || [];
    }

    // Parse existing knowledge images list passed back from front-end
    if (existingKnowledgeImages) {
      try {
        currentKnowledgeImages = JSON.parse(existingKnowledgeImages);
      } catch (e) {
        currentKnowledgeImages = [];
      }
    } else {
      currentKnowledgeImages = oldKnowledgeImages;
    }

    // Process new banner upload if any
    const bannerFiles = req.files && req.files['banner'] ? req.files['banner'] : [];
    if (bannerFiles.length > 0) {
      bannerUrl = await processAndSaveImage(bannerFiles[0].buffer, 'nogift');
      if (oldBannerUrl && oldBannerUrl.startsWith('/uploads/')) {
        deleteImage(oldBannerUrl);
      }
    }

    // Process new knowledge images upload if any
    const knowledgeFiles = req.files && req.files['knowledge'] ? req.files['knowledge'] : [];
    if (knowledgeFiles.length > 0) {
      for (const file of knowledgeFiles) {
        const savedUrl = await processAndSaveImage(file.buffer, 'nogift-edu');
        currentKnowledgeImages.push(savedUrl);
      }
    }

    // Identify deleted knowledge images and remove them from disk
    const deletedImages = oldKnowledgeImages.filter(img => !currentKnowledgeImages.includes(img));
    for (const img of deletedImages) {
      if (img.startsWith('/uploads/')) {
        deleteImage(img);
      }
    }

    // Save SiteSettings JSON
    const valuePayload = JSON.stringify({
      bannerUrl,
      statementTh,
      statementEn,
      knowledgeImages: currentKnowledgeImages
    });

    const updatedSetting = await prisma.siteSettings.upsert({
      where: { key: settingKey },
      update: { value: valuePayload },
      create: { key: settingKey, value: valuePayload }
    });

    // --- NOW MANAGE ATTACHMENTS FOR O20 ---
    const itaO20 = await prisma.iTAItem.findUnique({
      where: { code_year: { code: 'O20', year } }
    });
    
    let oldAttachments = [];
    if (itaO20 && Array.isArray(itaO20.attachments)) {
      oldAttachments = itaO20.attachments;
    }

    let parsedExistingAttachments = [];
    if (existingAttachments) {
      try {
        parsedExistingAttachments = JSON.parse(existingAttachments);
      } catch (e) {
        parsedExistingAttachments = [];
      }
    } else {
      parsedExistingAttachments = oldAttachments;
    }

    // Handle new PDF files upload
    const attachmentFiles = req.files && req.files['attachments'] ? req.files['attachments'] : [];
    let parsedAttachmentLabels = [];
    if (attachmentLabels) {
      try {
        parsedAttachmentLabels = JSON.parse(attachmentLabels);
      } catch (e) {
        parsedAttachmentLabels = [];
      }
    }

    const savedNewAttachments = [];
    attachmentFiles.forEach((file, idx) => {
      const fileUrl = saveFile(file, 'ita');
      const label = parsedAttachmentLabels[idx] || file.originalname.split('.')[0];
      savedNewAttachments.push({
        label: label,
        url: fileUrl,
        type: 'file'
      });
    });

    // Merge existing and new attachments
    const finalAttachments = [...parsedExistingAttachments, ...savedNewAttachments];

    // Clean up deleted files from disk
    const deletedAttachments = oldAttachments.filter(oldAtt => {
      if (oldAtt.type !== 'file') return false;
      return !finalAttachments.some(newAtt => newAtt.url === oldAtt.url);
    });

    deletedAttachments.forEach(att => {
      if (att.url && att.url.startsWith('/uploads/')) {
        deleteFile(att.url);
      }
    });

    // Save back to ITAItem O20
    await prisma.iTAItem.upsert({
      where: { code_year: { code: 'O20', year } },
      update: {
        attachments: finalAttachments,
        updatedAt: new Date()
      },
      create: {
        code: 'O20',
        year,
        title: 'ประกาศนโยบายไม่รับของขวัญ (No Gift Policy)',
        description: 'แสดงประกาศเจตนารมณ์ No Gift Policy ที่ลงนามโดยผู้บริหาร และภาพกิจกรรมการมีส่วนร่วมในนโยบายนี้',
        attachments: finalAttachments,
        isPublic: true,
        updatedAt: new Date()
      }
    });

    res.json({ 
      message: 'บันทึกการตั้งค่า No Gift Policy สำเร็จ', 
      data: JSON.parse(updatedSetting.value),
      attachments: finalAttachments 
    });
  } catch (error) {
    console.error('[No Gift Settings POST Error]', error);
    res.status(500).json({ message: 'Failed to save No Gift Policy settings', error: error.message });
  }
});


// GET /api/ita/smart-options — Fetch options for Smart Link dropdown
router.get('/ita/smart-options', authenticateToken, async (req, res) => {
  try {
    // 1. Fetch latest PR News
    const prs = await prisma.pRItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, title: true }
    });
    const prOptions = prs.map(p => ({
      label: `[ข่าวประชาสัมพันธ์] ${p.title}`,
      url: `/news/${p.id}`,
      id: p.id
    }));

    // 2. Fetch latest Public Documents
    const docs = await prisma.publicDocument.findMany({
      orderBy: { createdAt: 'desc' },
      take: 35,
      select: { id: true, title: true, fileUrl: true, type: true }
    });
    const docOptions = docs.map(d => ({
      label: `[เอกสารเผยแพร่-${d.type === 'bidding' ? 'จัดซื้อจัดจ้าง' : 'ทั่วไป'}] ${d.title}`,
      url: d.fileUrl,
      id: d.id
    }));

    // 3. Fetch latest Download Documents
    const downloads = await prisma.downloadDocument.findMany({
      orderBy: { createdAt: 'desc' },
      take: 35,
      select: { id: true, title: true, fileUrl: true, division: true }
    });
    const downloadOptions = downloads.map(dl => ({
      label: `[เอกสารดาวน์โหลด-${dl.division}] ${dl.title}`,
      url: dl.fileUrl,
      id: dl.id
    }));

    // 4. Fetch FAQs
    const faqs = await prisma.fAQ.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, question: true }
    });
    const faqOptions = faqs.map(f => ({
      label: `[FAQ] ${f.question}`,
      url: `/#faq`,
      id: f.id
    }));

    res.json({
      prs: prOptions,
      docs: docOptions,
      downloads: downloadOptions,
      faqs: faqOptions
    });
  } catch (error) {
    console.error('[ITA Smart Options Error]', error);
    res.status(500).json({ message: 'Failed to fetch Smart Link options' });
  }
});

// POST /api/ita/init — Initialize O1-O37 if they don't exist for the specified year
router.post('/ita/init', authenticateToken, async (req, res) => {
  const year = req.body.year || '2569';
  try {
    const itaList = [
      { code: 'O1', title: 'โครงสร้างและอำนาจหน้าที่', description: 'แสดงแผนผังโครงสร้างการแบ่งส่วนราชการภายใน และแสดงข้อมูลหน้าที่/อำนาจของสถานศึกษาตามที่กฎหมายกำหนด' },
      { code: 'O2', title: 'ข้อมูลผู้บริหารสถานศึกษา', description: 'แสดงข้อมูลผู้อำนวยการและรองผู้อำนวยการ โดยมี ชื่อ-สกุล, ตำแหน่ง, รูปถ่าย และช่องทางการติดต่อโดยตรง' },
      { code: 'O3', title: 'แผนพัฒนาสถานศึกษา', description: 'แสดงแผนพัฒนาที่มีระยะมากกว่า 1 ปี โดยระบุรายละเอียด ยุทธศาสตร์/แนวทาง, กลยุทธ์, เป้าหมาย และตัวชี้วัด' },
      { code: 'O4', title: 'ข้อมูลการติดต่อ', description: 'แสดงที่อยู่, เบอร์โทรศัพท์, อีเมลงานสารบรรณ, พิกัดที่ตั้ง (Google Maps) และช่องทาง Social Media อย่างน้อย 1 ช่องทาง' },
      { code: 'O5', title: 'กฎหมายที่เกี่ยวข้อง', description: 'แสดงกฎหมายหรือระเบียบที่เกี่ยวข้องกับการดำเนินงานของสถานศึกษา ไม่น้อยกว่า 5 ฉบับ' },
      { code: 'O6', title: 'แผนปฏิบัติราชการและแผนการใช้จ่ายงบประมาณ', description: 'สรุปผลการใช้จ่ายปีงบประมาณที่ผ่านมา, ประมาณการรายรับ, สรุปรายจ่ายปีปัจจุบัน และรายละเอียดโครงการ/งบประมาณ' },
      { code: 'O7', title: 'รายงานผลการดำเนินงานประจำปี', description: 'แสดงรายงานย้อนหลัง 1 ปี ที่ระบุผลการทำโครงการ, งบประมาณที่ใช้ และปัญหา/อุปสรรค/ข้อเสนอแนะ' },
      { code: 'O8', title: 'รายงานผลการประเมินตนเอง (SAR)', description: 'แสดงรายงาน SAR ย้อนหลัง 1 ปีการศึกษา ที่ประกอบด้วย ผลสัมฤทธิ์, จุดเด่น, จุดที่ควรพัฒนา และข้อเสนอแนะ' },
      { code: 'O9', title: 'ข่าวประชาสัมพันธ์', description: 'แสดงข่าวสารการดำเนินงานหรือภารกิจของสถานศึกษาที่เกิดขึ้นในปีงบประมาณปัจจุบัน' },
      { code: 'O10', title: 'ประกาศการจัดซื้อจัดจ้าง', description: 'แสดงประกาศตาม พ.ร.บ. จัดซื้อจัดจ้างฯ ปี 2560 (เช่น ประกาศเชิญชวน, ประกาศผู้ชนะ) ในปีงบประมาณปัจจุบัน' },
      { code: 'O11', title: 'รายงานผลการจัดซื้อจัดจ้างประจำปี', description: 'แสดงสรุปรายงานผลการจัดซื้อจัดจ้างย้อนหลัง 1 ปีงบประมาณ' },
      { code: 'O12', title: 'คู่มือ/ขั้นตอนการปฏิบัติงานภายใน', description: 'แสดงคู่มือหรือขั้นตอนการปฏิบัติงานของฝ่ายต่างๆ อย่างน้อย 4 เล่ม (ฝ่ายละ 1 เล่ม)' },
      { code: 'O13', title: 'คู่มือ/ขั้นตอนการให้บริการ', description: 'แสดงคู่มือสำหรับประชาชนหรือนักเรียนที่มาติดต่อ อย่างน้อย 2 คู่มือ (เช่น คู่มือนักเรียน, คู่มือการลงทะเบียน)' },
      { code: 'O14', title: 'E-Service', description: 'ช่องทางบริการออนไลน์บนเว็บไซต์หลักที่ผู้รับบริการไม่ต้องเดินทางมาเอง (เช่น ระบบ ศธ. 02)' },
      { code: 'O15', title: 'ข้อมูลเชิงสถิติและความพึงพอใจ', description: 'แสดงข้อมูลสถิติและผลความพึงพอใจการให้บริการ ย้อนหลัง 1 ปี อย่างน้อย 3 โครงการ/กิจกรรม' },
      { code: 'O16', title: 'การบริหารและพัฒนาทรัพยากรบุคคล', description: 'แสดงหลักเกณฑ์ 4 ด้าน ได้แก่ การสรรหา/บรรจุ, การพัฒนาบุคลากร, การประเมินผลปฏิบัติงาน และการสร้างขวัญกำลังใจ' },
      { code: 'O17', title: 'ประมวลจริยธรรม', description: 'แสดงแนวปฏิบัติ Do’s & Don’t (สิ่งที่ควรและไม่ควรทำ) และผลการจัดกิจกรรม/อบรมที่สอดแทรกด้านจริยธรรมให้แก่ครูและบุคลากร' },
      { code: 'O18', title: 'แนวทางปฏิบัติการจัดการร้องเรียน', description: 'แสดงคู่มือ/ขั้นตอนการร้องเรียนการทุจริต (ระบุวิธีการร้องเรียน, ขั้นตอนจัดการ, ฝ่ายรับผิดชอบ, ระยะเวลา และช่องทางแจ้งเรื่อง)' },
      { code: 'O19', title: 'ข้อมูลเชิงสถิติเรื่องร้องเรียน', description: 'แสดงสถิติการร้องเรียนการทุจริต (จำนวนเรื่องทั้งหมด, ดำเนินการแล้วเสร็จ, อยู่ระหว่างดำเนินการ) ให้ครอบคลุมระยะเวลา 6 เดือนแรก' },
      { code: 'O20', title: 'ประกาศนโยบายไม่รับของขวัญ (No Gift Policy)', description: 'แสดงประกาศเจตนารมณ์ No Gift Policy ที่ลงนามโดยผู้บริหาร และภาพกิจกรรมการมีส่วนร่วมในนโยบายนี้' },
      { code: 'O21', title: 'การประเมินผลควบคุมภายใน', description: 'แสดงรายงานประเมินควบคุมภายในย้อนหลัง 1 ปี ใน 4 ด้าน (สภาพแวดล้อม, ความเสี่ยง, สารสนเทศ, การติดตามประเมินผล)' },
      { code: 'O22', title: 'การเสริมสร้างวัฒนธรรมองค์กรให้ซื่อสัตย์สุจริต', description: 'แสดงหลักเกณฑ์การนำหลักสูตรต้านทุจริตศึกษาไปใช้ มีแผนการเรียนรู้ และการวัดผลครบ 4 ด้าน หรือกิจกรรมทดแทน' },
      { code: 'O23', title: 'มาตรการส่งเสริมคุณธรรมและความโปร่งใส', description: 'แสดงโครงการ กิจกรรม หรือคำสั่งแต่งตั้งคณะกรรมการประเมิน ITA ประจำปีงบประมาณปัจจุบัน' }
    ];

    // Delete any old items for this year that are not in O1-O23
    const validCodes = itaList.map(item => item.code);
    await prisma.iTAItem.deleteMany({
      where: {
        year: year,
        code: { notIn: validCodes }
      }
    });

    for (const item of itaList) {
      await prisma.iTAItem.upsert({
        where: {
          code_year: {
            code: item.code,
            year: year
          }
        },
        update: {
          title: item.title,
          description: item.description
        },
        create: {
          code: item.code,
          year: year,
          title: item.title,
          description: item.description,
          attachments: []
        }
      });
    }

    res.json({ message: `ITA initialization for year ${year} successful` });
  } catch (error) {
    console.error('[ITA Init]', error);
    res.status(500).json({ message: 'Failed to initialize ITA data' });
  }
});

// PUT /api/ita/:code/:year — Update ITA item (files + links + description + title + isPublic)
router.put('/ita/:code/:year', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { code, year } = req.params;
    const { existingAttachments, description, title, isPublic } = req.body;
    
    let currentData = [];
    if (existingAttachments) {
      try {
        currentData = typeof existingAttachments === 'string' ? JSON.parse(existingAttachments) : existingAttachments;
      } catch (e) {
        currentData = [];
      }
    }

    // Process new file uploads
    if (req.files && req.files.length > 0) {
      let fileLabels = [];
      if (req.body.fileLabels) {
        try {
          fileLabels = typeof req.body.fileLabels === 'string'
            ? JSON.parse(req.body.fileLabels)
            : req.body.fileLabels;
        } catch (e) {
          fileLabels = [];
        }
      }

      req.files.forEach((file, idx) => {
        const fileUrl = saveFile(file, 'ita');
        const customLabel = Array.isArray(fileLabels) && fileLabels[idx] ? fileLabels[idx] : file.originalname.split('.')[0];
        currentData.push({ 
          label: customLabel,
          url: fileUrl, 
          type: 'file' 
        });
      });
    }

    // Add new link items if sent in batch
    if (req.body.newLinks) {
       let newLinks = [];
       try { newLinks = JSON.parse(req.body.newLinks); } catch(e) {}
       if (Array.isArray(newLinks)) {
          currentData = [...currentData, ...newLinks];
       }
    }

    const updated = await prisma.iTAItem.upsert({
      where: {
        code_year: {
          code,
          year
        }
      },
      update: {
        title: title || undefined,
        description: description !== undefined ? description : undefined,
        attachments: currentData,
        isPublic: isPublic !== undefined ? (isPublic === 'true' || isPublic === true || isPublic === '1') : undefined,
        updatedAt: new Date()
      },
      create: {
        code,
        year,
        title: title || `หัวข้อ ${code}`,
        description: description || '',
        attachments: currentData,
        isPublic: isPublic !== undefined ? (isPublic === 'true' || isPublic === true || isPublic === '1') : true,
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

// POST /api/pr/webhook (public, but secured by secret token)
router.post('/pr/webhook', async (req, res) => {
  const secret = req.query.secret || req.headers['x-webhook-secret'];
  const expectedSecret = process.env.WEBHOOK_SECRET || 'borai_fb_webhook_secret_2026';
  
  if (!secret || secret !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized webhook request' });
  }

  try {
    const { message, created_time, full_picture, permalink_url } = req.body;

    // 1. Format date to Thai Buddhist Era format (e.g., "7 ก.ค. 2569")
    let formattedDate = '';
    try {
      const d = new Date(created_time || new Date());
      const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const day = d.getDate();
      const month = thaiMonthsShort[d.getMonth()];
      const year = d.getFullYear() + 543;
      formattedDate = `${day} ${month} ${year}`;
    } catch (e) {
      formattedDate = 'ข่าวประชาสัมพันธ์';
    }

    // 2. Process / download image if present
    let coverImage = 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800';
    let imagesArr = [];

    if (full_picture) {
      if (typeof fetch === 'function') {
        try {
          const response = await fetch(full_picture);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const savedPath = await processAndSaveImage(buffer, 'fb-sync');
            coverImage = savedPath;
            imagesArr.push(savedPath);
          } else {
            coverImage = full_picture;
            imagesArr.push(full_picture);
          }
        } catch (err) {
          console.error('[Webhook Download Image Error]', err);
          coverImage = full_picture;
          imagesArr.push(full_picture);
        }
      } else {
        coverImage = full_picture;
        imagesArr.push(full_picture);
      }
    }

    // 3. Construct content (include permalink if present)
    let content = message || '';
    if (permalink_url) {
      content += `\n\nอ่านต่อบน Facebook: ${permalink_url}`;
    }

    // 4. Construct title (take first line or first 100 characters)
    let title = 'ข่าวประชาสัมพันธ์จาก Facebook';
    if (message) {
      const lines = message.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        title = lines[0];
        if (title.length > 100) {
          title = title.substring(0, 100) + '...';
        }
      }
    }

    // 5. Save to Prisma DB
    const newItem = await prisma.pRItem.create({
      data: {
        title,
        date: formattedDate,
        category: 'ข่าวประชาสัมพันธ์',
        image: coverImage,
        images: imagesArr,
        content: content,
        departmentTag: null
      }
    });

    res.status(201).json({
      message: 'PR item created via webhook successfully',
      item: newItem
    });
  } catch (error) {
    console.error('[Webhook Sync Error]', error);
    res.status(500).json({ message: 'Failed to create PR item via webhook', error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// COMPLAINT RESOURCES (คู่มือ + เอกสารสรุปการร้องเรียน)
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/complaint-resources — Fetch complaint resources (manual + summary docs)
router.get('/complaint-resources', async (req, res) => {
  const year = req.query.year || '2569';
  try {
    const settingKey = `complaint_resources_${year}`;
    const setting = await prisma.siteSettings.findUnique({ where: { key: settingKey } });
    if (setting) {
      return res.json(JSON.parse(setting.value));
    }
    res.json({ manuals: [], summaryDocs: [] });
  } catch (error) {
    console.error('[API Get Complaint Resources]', error);
    res.status(500).json({ message: 'Failed to fetch complaint resources' });
  }
});

// POST /api/complaint-resources — Save/Update complaint resources (admin only)
router.post('/complaint-resources', authenticateToken, upload.fields([
  { name: 'manuals', maxCount: 10 },
  { name: 'summaryDocs', maxCount: 20 }
]), async (req, res) => {
  const year = req.body.year || '2569';
  const { existingManuals, existingSummaryDocs, manualLabels, summaryDocLabels } = req.body;
  try {
    const settingKey = `complaint_resources_${year}`;

    // Load existing data
    const existingSetting = await prisma.siteSettings.findUnique({ where: { key: settingKey } });
    let currentData = { manuals: [], summaryDocs: [] };
    let oldManuals = [];
    let oldSummaryDocs = [];
    if (existingSetting) {
      currentData = JSON.parse(existingSetting.value);
      oldManuals = currentData.manuals || [];
      oldSummaryDocs = currentData.summaryDocs || [];
    }

    // --- Manuals ---
    let keepManuals = [];
    try { keepManuals = JSON.parse(existingManuals || '[]'); } catch { keepManuals = []; }
    if (!Array.isArray(keepManuals)) keepManuals = [];

    // Delete manuals that were removed
    const removedManuals = oldManuals.filter(old => !keepManuals.some(k => k.url === old.url));
    for (const m of removedManuals) {
      if (m.url && m.url.startsWith('/uploads/')) {
        deleteFile(m.url);
      }
    }

    // Upload new manual files
    const newManuals = [];
    const manualFiles = (req.files && req.files['manuals']) || [];
    const manualLabelArr = manualFiles.map((_, i) => {
      const labels = typeof manualLabels === 'string' ? [manualLabels] : (manualLabels || []);
      return labels[i] || `คู่มือร้องเรียน ${i + 1}`;
    });
    for (let i = 0; i < manualFiles.length; i++) {
      const fileUrl = await saveFile(manualFiles[i]);
      newManuals.push({ label: manualLabelArr[i], url: fileUrl, type: 'file' });
    }

    const finalManuals = [...keepManuals, ...newManuals];

    // --- Summary Documents ---
    let keepSummaryDocs = [];
    try { keepSummaryDocs = JSON.parse(existingSummaryDocs || '[]'); } catch { keepSummaryDocs = []; }
    if (!Array.isArray(keepSummaryDocs)) keepSummaryDocs = [];

    // Delete summary docs that were removed
    const removedSummaryDocs = oldSummaryDocs.filter(old => !keepSummaryDocs.some(k => k.url === old.url));
    for (const d of removedSummaryDocs) {
      if (d.url && d.url.startsWith('/uploads/')) {
        deleteFile(d.url);
      }
    }

    // Upload new summary doc files
    const newSummaryDocs = [];
    const summaryFiles = (req.files && req.files['summaryDocs']) || [];
    const summaryLabelArr = summaryFiles.map((_, i) => {
      const labels = typeof summaryDocLabels === 'string' ? [summaryDocLabels] : (summaryDocLabels || []);
      return labels[i] || `รายงานสรุปผลการร้องเรียน ${i + 1}`;
    });
    for (let i = 0; i < summaryFiles.length; i++) {
      const fileUrl = await saveFile(summaryFiles[i]);
      newSummaryDocs.push({ label: summaryLabelArr[i], url: fileUrl, type: 'file' });
    }

    const finalSummaryDocs = [...keepSummaryDocs, ...newSummaryDocs];

    // Save to SiteSettings
    const newValue = JSON.stringify({ manuals: finalManuals, summaryDocs: finalSummaryDocs });
    await prisma.siteSettings.upsert({
      where: { key: settingKey },
      update: { value: newValue },
      create: { key: settingKey, value: newValue }
    });

    res.json({ message: 'บันทึกเอกสารการร้องเรียนสำเร็จ', manuals: finalManuals, summaryDocs: finalSummaryDocs });
  } catch (error) {
    console.error('[API Save Complaint Resources]', error);
    res.status(500).json({ message: 'Failed to save complaint resources' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// FRAUD COMPLAINTS API
// ──────────────────────────────────────────────────────────────────────────────


// POST /api/complaints — Submit a new complaint
router.post('/complaints', async (req, res) => {
  try {
    const { title, category, detail, isAnonymous, reporterName, reporterPhone, reporterEmail } = req.value || req.body;
    
    if (!title || !category || !detail) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (หัวข้อ, หมวดหมู่, รายละเอียด)' });
    }

    // Generate unique tracking token (e.g., COMP-XXXXXX)
    let token = '';
    let isUnique = false;
    while (!isUnique) {
      const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      token = `COMP-${randStr}`;
      const existing = await prisma.complaint.findUnique({ where: { token } });
      if (!existing) isUnique = true;
    }

    const isAnon = isAnonymous === true || isAnonymous === 'true' || isAnonymous === '1';

    const complaint = await prisma.complaint.create({
      data: {
        token,
        title,
        category,
        detail,
        isAnonymous: isAnon,
        reporterName: isAnon ? null : reporterName,
        reporterPhone: isAnon ? null : reporterPhone,
        reporterEmail: isAnon ? null : reporterEmail,
        status: 'pending'
      }
    });

    res.status(201).json({
      message: 'ส่งเรื่องร้องเรียนสำเร็จ',
      token: complaint.token
    });
  } catch (error) {
    console.error('[API Submit Complaint]', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเรื่องร้องเรียน' });
  }
});

// GET /api/complaints/track/:token — Track status of a complaint by token
router.get('/complaints/track/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const complaint = await prisma.complaint.findUnique({
      where: { token },
      select: {
        token: true,
        title: true,
        category: true,
        detail: true,
        status: true,
        adminNote: true,
        createdAt: true
      }
    });

    if (!complaint) {
      return res.status(404).json({ message: 'ไม่พบรหัสติดตามความคืบหน้านี้' });
    }

    res.json(complaint);
  } catch (error) {
    console.error('[API Track Complaint]', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูล' });
  }
});

// GET /api/admin/complaints — Admin: Get all complaints
router.get('/admin/complaints', authenticateToken, async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(complaints);
  } catch (error) {
    console.error('[API Admin Get Complaints]', error);
    res.status(500).json({ message: 'Failed to fetch complaints' });
  }
});

// PUT /api/admin/complaints/:id — Admin: Update status and notes for a complaint
router.put('/admin/complaints/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, adminNote } = req.body;
  try {
    if (!['pending', 'investigating', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' });
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        status,
        adminNote,
        updatedAt: new Date()
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[API Admin Update Complaint]', error);
    res.status(500).json({ message: 'Failed to update complaint' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC FEEDBACK API
// ──────────────────────────────────────────────────────────────────────────────

// POST /api/feedback — Submit public feedback
router.post('/feedback', async (req, res) => {
  try {
    const { title, category, detail, rating, reporterName, reporterEmail } = req.body;

    if (!title || !category || !detail || !rating) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (หัวข้อ, หมวดหมู่, รายละเอียด, คะแนนพึงพอใจ)' });
    }

    const ratingVal = parseInt(rating, 10);
    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      return res.status(400).json({ message: 'คะแนนระดับความพึงพอใจไม่ถูกต้อง' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        title,
        category,
        detail,
        rating: ratingVal,
        reporterName: reporterName || null,
        reporterEmail: reporterEmail || null
      }
    });

    res.status(201).json({
      message: 'ส่งข้อมูลข้อคิดเห็นสำเร็จ ขอบพระคุณสำหรับข้อเสนอแนะ',
      id: feedback.id
    });
  } catch (error) {
    console.error('[API Submit Feedback]', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อคิดเห็น' });
  }
});

// GET /api/admin/feedbacks — Admin: Get all feedbacks with analytics
router.get('/admin/feedbacks', authenticateToken, async (req, res) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Calculate average rating
    let averageRating = 0;
    if (feedbacks.length > 0) {
      const sum = feedbacks.reduce((acc, curr) => acc + curr.rating, 0);
      averageRating = parseFloat((sum / feedbacks.length).toFixed(2));
    }

    res.json({
      feedbacks,
      averageRating,
      totalCount: feedbacks.length
    });
  } catch (error) {
    console.error('[API Admin Get Feedbacks]', error);
    res.status(500).json({ message: 'Failed to fetch feedbacks' });
  }
});

// DELETE /api/admin/feedbacks/:id — Admin: Delete a feedback
router.delete('/admin/feedbacks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.feedback.delete({
      where: { id }
    });
    res.json({ message: 'ลบข้อคิดเห็นเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('[API Admin Delete Feedback]', error);
    res.status(500).json({ message: 'Failed to delete feedback' });
  }
});

module.exports = router;


