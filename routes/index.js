const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET / — Homepage
router.get('/', async (req, res) => {
  try {
    // 1. Fetch pinned items (up to 3)
    const pinnedItems = await prisma.pRItem.findMany({
      where: { isPinned: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // 2. Fetch remaining recent items for main grid
    const recentItems = await prisma.pRItem.findMany({
      where: { id: { notIn: pinnedItems.map(p => p.id) } },
      orderBy: { createdAt: 'desc' },
      take: 6 - pinnedItems.length,
    });

    let newsItems = [...pinnedItems, ...recentItems];

    // 3. Fetch independent latest news for the sidebar (shows all recent, no exclusion)
    let sidebarNews = await prisma.pRItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 4. Fetch bidding news (category: 'bidding' from PublicDocument)
    let biddingNews = await prisma.publicDocument.findMany({
      where: { type: 'bidding' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // 5. Fetch published documents (category: 'general' from PublicDocument)
    let publishedDocs = await prisma.publicDocument.findMany({
      where: { type: 'general' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Mock data for these sections if empty
    if (biddingNews.length === 0) {
      biddingNews = [
        { id: 'mock-b-1', title: 'ประกาศประกวดราคาจ้างก่อสร้างปรับปรุงอาคารเรียน', date: '31 มี.ค. 2569' },
        { id: 'mock-b-2', title: 'ประกาศผู้ชนะการเสนอราคา ซื้อวัสดุฝึกการเรียนการสอน', date: '30 มี.ค. 2569' },
        { id: 'mock-b-3', title: 'ร่างขอบเขตของงาน (TOR) โครงการจัดซื้อครุภัณฑ์การศึกษา', date: '28 มี.ค. 2569' },
        { id: 'mock-b-4', title: 'ประกาศจัดซื้อวัสดุคอมพิวเตอร์และสำนักงาน', date: '25 มี.ค. 2569' },
        { id: 'mock-b-5', title: 'จ้างเหมาซ่อมแซมครุภัณฑ์ระบบเครือข่าย', date: '20 มี.ค. 2569' },
      ];
    }

    if (publishedDocs.length === 0) {
      publishedDocs = [
        { id: 'mock-d-1', title: 'รายงานการประเมินตนเองของสถานศึกษา (SAR) ประจำปี 2568', date: '25 มี.ค. 2569' },
        { id: 'mock-d-2', title: 'แผนปฏิบัติราชการประจำปีงบประมาณ 2569', date: '20 มี.ค. 2569' },
        { id: 'mock-d-3', title: 'คู่มือนักเรียน นักศึกษา และผู้ปกครอง ประจำปีการศึกษา 2569', date: '15 มี.ค. 2569' },
        { id: 'mock-d-4', title: 'คู่มือการปฏิบัติงานเจ้าหน้าที่งานกิจกรรม', date: '10 มี.ค. 2569' },
        { id: 'mock-d-5', title: 'ประกาศระเบียบการใช้ห้องปฏิบัติการคอมพิวเตอร์', date: '05 มี.ค. 2569' },
      ];
    }

    res.render('index', {
      title: 'วิทยาลัยการอาชีพบ่อไร่ | BICEC',
      newsItems,
      sidebarNews,
      biddingNews,
      publishedDocs,
      departments: DEPARTMENTS_DATA
    });
  } catch (error) {
    console.error(error);
    res.render('index', {
      title: 'วิทยาลัยการอาชีพบ่อไร่ | BICEC',
      newsItems: [],
      sidebarNews: [],
    });
  }
});

// GET /news — All News
router.get('/news', async (req, res) => {
  try {
    const newsItems = await prisma.pRItem.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.render('news-list', {
      title: 'ข่าวสารทั้งหมด | BICEC',
      newsItems,
    });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// GET /news/:id — News Detail
router.get('/news/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const news = await prisma.pRItem.findUnique({
      where: { id },
    });

    if (!news) {
      return res.status(404).render('404', { title: 'ไม่พบข่าวสาร' });
    }

    res.render('news-detail', {
      title: `${news.title} | BICEC`,
      news,
    });
  } catch (error) {
    console.error(error);
    res.redirect('/news');
  }
});

// GET /documents — All Public Documents & Bidding
router.get('/documents', async (req, res) => {
  try {
    const { type } = req.query; // 'bidding' or 'general'
    let docs = await prisma.publicDocument.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Mock data if empty
    if (docs.length === 0) {
      docs = [
        { id: 'm1', title: 'ประกาศประกวดราคาจ้างก่อสร้างปรับปรุงอาคารเรียน', date: '31 มี.ค. 2569', type: 'bidding', fileUrl: '#' },
        { id: 'm2', title: 'ประกาศผู้ชนะการเสนอราคา ซื้อวัสดุฝึกการเรียนการสอน', date: '30 มี.ค. 2569', type: 'bidding', fileUrl: '#' },
        { id: 'm3', title: 'ร่างขอบเขตของงาน (TOR) โครงการจัดซื้อครุภัณฑ์การศึกษา', date: '28 มี.ค. 2569', type: 'bidding', fileUrl: '#' },
        { id: 'm4', title: 'ประกาศจัดซื้อวัสดุคอมพิวเตอร์และสำนักงาน', date: '25 มี.ค. 2569', type: 'bidding', fileUrl: '#' },
        { id: 'm5', title: 'จ้างเหมาซ่อมแซมครุภัณฑ์ระบบเครือข่าย', date: '20 มี.ค. 2569', type: 'bidding', fileUrl: '#' },
        { id: 'm6', title: 'รายงานการประเมินตนเองของสถานศึกษา (SAR) ประจำปี 2568', date: '25 มี.ค. 2569', type: 'general', fileUrl: '#' },
        { id: 'm7', title: 'แผนปฏิบัติราชการประจำปีงบประมาณ 2569', date: '20 มี.ค. 2569', type: 'general', fileUrl: '#' },
        { id: 'm8', title: 'คู่มือนักเรียน นักศึกษา และผู้ปกครอง ประจำปีการศึกษา 2569', date: '15 มี.ค. 2569', type: 'general', fileUrl: '#' },
        { id: 'm9', title: 'คู่มือการปฏิบัติงานเจ้าหน้าที่งานกิจกรรม', date: '10 มี.ค. 2569', type: 'general', fileUrl: '#' },
        { id: 'm10', title: 'ประกาศระเบียบการใช้ห้องปฏิบัติการคอมพิวเตอร์', date: '05 มี.ค. 2569', type: 'general', fileUrl: '#' },
      ];
    }

    res.render('document-list', {
      title: 'เอกสารและประกวดราคา | BICEC',
      docs,
      activeType: type || 'all'
    });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// --- Department Data Mapping ---
const DEPARTMENTS_DATA = {
  'automotive': {
    name: 'ช่างยนต์',
    slug: 'automotive',
    icon: 'truck',
    type: 'Industrial',
    pvcName: 'ช่างยนต์',
    hvcName: 'เทคนิคยานยนต์',
    imageUrl: '/images/dept-auto.png',
    description: 'มุ่งเน้นการผลิตและพัฒนากำลังคนในสาขางานยานยนต์ ให้มีความรู้ความชำนาญทั้งในด้านทฤษฎีและปฏิบัติ ครอบคลุมระบบเครื่องยนต์ดีเซลและเบนซิน รวมถึงเทคโนโลยียานยนต์สมัยใหม่',
    keywords: ['ช่างยนต์', 'ยานยนต์'],
    skills: ['Engine Maintenance', 'Transmission Systems', 'Auto Electronics'],
    jobs: ['ช่างซ่อมบำรุงรักษาเครื่องยนต์', 'ที่ปรึกษาด้านบริการยานยนต์', 'เจ้าของกิจการอู่ซ่อมรถ', 'พนักงานตรวจสภาพรถ'],
    curriculum: {
      pvc: ['งานเครื่องยนต์แก๊สโซลีน', 'งานเครื่องยนต์ดีเซล', 'งานไฟฟ้ายานยนต์', 'งานส่งกำลังยานยนต์', 'งานบำรุงรักษารถยนต์'],
      hvc: ['เทคนิคยานยนต์', 'การวิเคราะห์ปัญหารถยนต์', 'เทคโนโลยีระบบฉีดเชื้อเพลิง', 'การจัดการศูนย์บริการ', 'งานเครื่องยนต์แก๊สโซลีนควบคุมด้วยอิเล็กทรอนิกส์']
    },
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20101v8.pdf'
  },
  'electrical': {
    name: 'ช่างไฟฟ้ากำลัง',
    slug: 'electrical',
    icon: 'zap',
    type: 'Technology',
    pvcName: 'ช่างไฟฟ้ากำลัง',
    hvcName: 'ไฟฟ้า',
    imageUrl: '/images/dept-electric.png',
    description: 'สร้างผู้เชี่ยวชาญด้านระบบไฟฟ้าอาคารและอุตสาหกรรม การทำงานกับระบบพลังงานสะอาด และเทคโนโลยีควบคุมอัตโนมัติ (PLC) เพื่อรองรับตลาดแรงงานยุคอุตสาหกรรม 4.0',
    keywords: ['ไฟฟ้ากำลัง', 'ช่างไฟฟ้า'],
    skills: ['Home Wiring', 'Motor Control', 'PLC Systems'],
    jobs: ['ช่างไฟฟ้าอาคาร', 'ช่างควบคุมระบบไฟฟ้าโรงงาน', 'พนักงานรัฐวิสาหกิจการไฟฟ้า', 'ผู้ออกแบบระบบไฟฟ้า'],
    curriculum: {
      pvc: ['การติดตั้งไฟฟ้าในอาคาร', 'เครื่องกลไฟฟ้า', 'การควบคุมมอเตอร์', 'การวัดและวงจรไฟฟ้า', 'การติดตั้งไฟฟ้านอกอาคาร'],
      hvc: ['ระบบควบคุมอัตโนมัติ (PLC)', 'การออกแบบระบบไฟฟ้า', 'เครื่องกำเนิดไฟฟ้า', 'ระบบส่งจ่ายกำลังไฟฟ้า', 'พลังงานลมและแสงอาทิตย์']
    },
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20104v6.pdf'
  },
  'electronics': {
    name: 'ช่างอิเล็กทรอนิกส์',
    slug: 'electronics',
    icon: 'cpu',
    type: 'Technology',
    pvcName: 'ช่างอิเล็กทรอนิกส์',
    hvcName: 'อิเล็กทรอนิกส์',
    imageUrl: '/images/dept-electro.png',
    description: 'ศึกษาการทำงานของเทคโนโลยีสมองกลฝังตัว (Embedded Systems) ระบบสื่อสารโทรคมนาคม และงานซ่อมบำรุงระบบควบคุมอิเล็กทรอนิกส์ รวมถึงเทคโนโลยี IoT สู่บ้านอัจฉริยะ',
    keywords: ['อิเล็กทรอนิกส์', 'ช่างอิเล็ก'],
    skills: ['Microcontroller', 'IoT Systems', 'PCB Design'],
    jobs: ['ช่างซ่อมบำรุงอุปกรณ์อิเล็กทรอนิกส์', 'ช่างเทคนิคระบบสื่อสาร', 'ผู้ออกแบบวงจร PCB', 'ที่ปรึกษาด้านระบบรักษาความปลอดภัย'],
    curriculum: {
      pvc: ['วงจรไฟฟ้าและวิเคราะห์วงจร', 'อุปกรณ์อิเล็กทรอนิกส์และวงจร', 'การวัดและเครื่องวัดไฟฟ้า', 'งานเชื่อมโลหะพื้นฐาน', 'งานนิวแมติกส์และไฮดรอลิกส์เบื้องต้น'],
      hvc: ['ไมโครคอนโทรลเลอร์ (Microcontroller)', 'เทคโนโลยี IoT (Internet of Things)', 'ระบบควบคุมในอุตสาหกรรม', 'การออกแบบวงจรด้วยคอมพิวเตอร์', 'การเขียนโปรแกรมควบคุมคอมพิวเตอร์']
    },
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20105v6.pdf'
  },
  'accounting': {
    name: 'การบัญชี',
    slug: 'accounting',
    icon: 'book',
    type: 'Business',
    pvcName: 'การบัญชี',
    hvcName: 'การบัญชี',
    imageUrl: '/images/dept-acc.png',
    description: 'เตรียมความพร้อมสู่สายงานบริหารจัดการการเงิน การรายงานบัญชีที่แม่นยำ และการใช้ซอฟต์แวร์ทางธุรกิจระดับสากล รวมถึงการวางแผนภาษีอากรอย่างมืออาชีพ',
    keywords: ['การบัญชี', 'บัญชี', 'Accounting'],
    skills: ['Financial Accounting', 'Taxation', 'ERP Systems'],
    jobs: ['พนักงานบัญชีประจำบริษัท', 'เจ้าหน้าที่ธุรการการเงิน', 'ผู้ช่วยผู้ตรวจสอบบัญชี', 'ที่ปรึกษาด้านภาษีอากร'],
    curriculum: {
      pvc: ['การเขียนโปรแกรมบัญชี', 'การบัญชีเบื้องต้น 1-2', 'การบัญชีเดี่ยวและระบบใบสำคัญ', 'คณิตศาสตร์พาณิชยกรรม', 'กฎหมายธุรกิจ'],
      hvc: ['การบัญชีชั้นสูง', 'การตรวจสอบบัญชี', 'การบัญชีเพื่อการจัดการ', 'โปรแกรมสำเร็จรูปเพื่องานบัญชี', 'การภาษีอากร']
    },
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20201v8.pdf'
  },
  'digital-business': {
    name: 'เทคโนโลยีธุรกิจดิจิทัล',
    slug: 'digital-business',
    icon: 'briefcase',
    type: 'Digital & Business',
    pvcName: 'เทคโนโลยีธุรกิจดิจิทัล',
    hvcName: 'เทคโนโลยีธุรกิจดิจิทัล',
    imageUrl: '/images/dept-it.png',
    description: 'มุ่งเน้นการสร้างนักบริหารจัดการดิจิทัลยุคใหม่ พัฒนาทักษะด้านพาณิชย์อิเล็กทรอนิกส์ การตลาดออนไลน์ และการจัดการนวัตกรรมธุรกิจด้วยเทคโนโลยีที่ทันสมัย',
    keywords: ['เทคโนโลยีธุรกิจดิจิทัล', 'คอมพิวเตอร์ธุรกิจ', 'ธุรกิจดิจิทัล', 'DBT', 'ไอที', 'IT'],
    skills: ['Digital Marketing', 'E-Commerce', 'Data Analysis'],
    jobs: ['เจ้าของธุรกิจออนไลน์', 'นักการตลาดดิจิทัล (Digital Marketer)', 'Social Media Admin', 'เจ้าหน้าที่กราฟิกธุรกิจ', 'นักวิเคราะห์ข้อมูลธุรกิจ'],
    curriculum: {
      pvc: ['การเริ่มต้นธุรกิจดิจิทัล', 'การตลาดดิจิทัลเบื้องต้น', 'การใช้โปรแกรมสำนักงานขั้นสูง', 'ธุรกิจและการเป็นผู้ประกอบการ', 'พื้นฐานกราฟิกคอมพิวเตอร์'],
      hvc: ['พาณิชย์อิเล็กทรอนิกส์ขั้นสูง', 'การวิเคราะห์ข้อมูลขนาดใหญ่ (Big Data)', 'ความปลอดภัยในอาชญากรรมทางคอมพิวเตอร์', 'การจัดการสื่อสังคมออนไลน์', 'การเขียนแผนธุรกิจดิจิทัล']
    },
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/21910v8.pdf'
  }
};


// GET /curriculum — Main Curriculum Hub
router.get('/curriculum', async (req, res) => {
  try {
    res.render('curriculum', {
      title: 'หลักสูตรที่เปิดสอน | วิทยาลัยการอาชีพบ่อไร่',
      departments: DEPARTMENTS_DATA
    });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// GET /curriculum/:slug — Department Detail Page (Dynamic)
router.get('/curriculum/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const departmentInfo = DEPARTMENTS_DATA[slug];

    if (!departmentInfo) {
      return res.status(404).render('404', { title: 'ไม่พบสาขาวิชานี้' });
    }

    // Smart Integration: Fetch teachers for this department using multiple possible keywords
    const keywords = [departmentInfo.name, ...(departmentInfo.keywords || [])];
    const faculty = await prisma.personnel.findMany({
      where: {
        OR: keywords.map(k => ({
          department: { contains: k }
        }))
      },
      orderBy: { order: 'asc' }
    });

    res.render('department-detail', {
      title: `${departmentInfo.name} | วิทยาลัยการอาชีพบ่อไร่`,
      dept: departmentInfo,
      faculty
    });
  } catch (error) {
    console.warn('[Database Offline] Rendering department detail without faculty data.');
    res.render('department-detail', {
      title: `${departmentInfo.name} | วิทยาลัยการอาชีพบ่อไร่`,
      dept: departmentInfo,
      faculty: [] // Fallback to empty list instead of crashing
    });
  }
});

// GET /admission — Admission Page
router.get('/admission', async (req, res) => {
  try {
    res.render('admission', {
      title: 'รับสมัครนักเรียนนักศึกษาใหม่ | วิทยาลัยการอาชีพบ่อไร่',
    });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// GET /about — About College
router.get('/about', async (req, res) => {
  try {
    const allPersonnel = await prisma.personnel.findMany({
      orderBy: [{ order: 'asc' }, { firstName: 'asc' }]
    });
    const settings = await prisma.siteSettings.findMany({
      where: { key: { in: ['current_semester', 'academic_year'] } }
    });
    
    const semesterSetting = settings.find(s => s.key === 'current_semester');
    const yearSetting = settings.find(s => s.key === 'academic_year');
    
    const currentSemester = semesterSetting ? semesterSetting.value : '1';
    const academicYear = yearSetting ? yearSetting.value : '2567';

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        academicYear: String(academicYear),
        semester: String(currentSemester)
      }
    });

    res.render('about', {
      title: 'ข้อมูลวิทยาลัย | วิทยาลัยการอาชีพบ่อไร่',
      departments: DEPARTMENTS_DATA,
      allPersonnel,
      enrollments,
      currentSemester,
      academicYear,
      budgetData: null // Set to null to show 'No Data' state as requested
    });
  } catch (error) {
    console.error(error);
    res.render('about', {
      title: 'ข้อมูลวิทยาลัย | วิทยาลัยการอาชีพบ่อไร่',
      departments: DEPARTMENTS_DATA,
      allPersonnel: [],
      enrollments: [],
      currentSemester: '1',
      academicYear: '2567'
    });
  }
});

// GET /personnel — Personnel Page
router.get('/personnel', async (req, res) => {
  try {
    const allPersonnel = await prisma.personnel.findMany({
      orderBy: [{ order: 'asc' }, { firstName: 'asc' }]
    });

    // 1. Executives (Director + Deputies + Positions labeled 'ผู้บริหาร')
    const executives = allPersonnel.filter(p => 
      p.isDirector || 
      (p.position && (
        p.position.includes('ผู้อำนวยการ') || 
        p.position.includes('ผู้บริหาร')
      )) ||
      (p.department && (p.department.includes('บริหาร') && !p.position?.includes('ครู')))
    );

    // 2. All Teachers (Professional + Assistant + Gov + Contract Teachers only)
    // Note: 'ลูกจ้างอัตราจ้าง' must NOT be included here — they belong in Support Staff
    const teachers = allPersonnel.filter(p => 
      !executives.includes(p) && 
      p.position && (
        p.position.includes('ครู') || 
        p.position.includes('อาจารย์') || 
        p.position.includes('พนักงานราชการ')
      ) &&
      !p.position.includes('ลูกจ้างอัตราจ้าง')
    );

    // Sort teachers by seniority/rank
    teachers.sort((a, b) => {
      const getRankIndex = (p) => {
        const text = (p.academicStanding || '') + (p.position || '');
        if (text.includes('เชี่ยวชาญพิเศษ')) return 0;
        if (text.includes('เชี่ยวชาญ')) return 1;
        if (text.includes('ชำนาญการพิเศษ')) return 2;
        if (text.includes('ชำนาญการ')) return 3;
        if (text.includes('ครูผู้ช่วย')) return 5;
        if (text.includes('ครู')) return 4;
        if (text.includes('พนักงานราชการ')) return 6;
        if (text.includes('อัตราจ้าง')) return 7;
        return 99;
      };
      
      const rankA = getRankIndex(a);
      const rankB = getRankIndex(b);
      
      if (rankA !== rankB) return rankA - rankB;
      // Secondary sort by order field or name
      return (a.order || 0) - (b.order || 0) || (a.firstName || '').localeCompare(b.firstName || '', 'th');
    });

    // 3. Support Staff (Everyone else)
    const supportStaff = allPersonnel.filter(p => 
      !executives.includes(p) && !teachers.includes(p)
    );

    // Sort Support Staff
    supportStaff.sort((a, b) => {
      const getRankIndex = (p) => {
        const text = (p.position || '') + (p.academicStanding || '');
        if (text.includes('เจ้าหน้าที่')) return 0;
        if (text.includes('ลูกจ้างอัตราจ้าง')) return 1;
        return 99;
      };
      const rankA = getRankIndex(a);
      const rankB = getRankIndex(b);
      if (rankA !== rankB) return rankA - rankB;
      return (a.order || 0) - (b.order || 0) || (a.firstName || '').localeCompare(b.firstName || '', 'th');
    });

    res.render('personnel', {
      title: 'บุคลากร | วิทยาลัยการอาชีพบ่อไร่',
      executives,
      teachers,
      supportStaff,
      total: allPersonnel.length
    });
  } catch (error) {
    console.warn('[Database Offline] Rendering personnel page without data.', error.message);
    res.render('personnel', {
      title: 'บุคลากร | วิทยาลัยการอาชีพบ่อไร่',
      executives: [],
      teachers: [],
      supportStaff: [],
      total: 0
    });
  }
});


// GET /org-chart — Administrative Org Chart
router.get('/org-chart', async (req, res) => {
  try {
    const allPersonnel = await prisma.personnel.findMany({
      orderBy: [{ order: 'asc' }, { firstName: 'asc' }]
    });

    // Fetch ITA O3 (Administrative Orders/Powers)
    const itaO3 = await prisma.iTAItem.findUnique({
      where: { code: 'O3' }
    });

    // Pass attachments from O3 if found, otherwise empty array
    const orders = itaO3 && Array.isArray(itaO3.attachments) ? itaO3.attachments : [];
    const ordersUpdateDate = itaO3 && itaO3.updatedAt 
      ? new Date(itaO3.updatedAt).toLocaleDateString('th-TH') 
      : null;

    res.render('org-chart', {
      title: 'ผังการบริหาร | วิทยาลัยการอาชีพบ่อไร่',
      allPersonnel,
      orders,
      ordersUpdateDate
    });
  } catch (error) {
    console.warn('[Database Offline] Rendering org-chart without personnel data.');
    res.render('org-chart', {
      title: 'ผังการบริหาร | วิทยาลัยการอาชีพบ่อไร่',
      allPersonnel: []
    });
  }
});


module.exports = router;

