const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Global Middleware for Navigation (Departments dropdown)
router.use(async (req, res, next) => {
  try {
    res.locals.globalNavDepartments = await prisma.department.findMany({
      orderBy: { order: 'asc' },
      select: { name: true, slug: true }
    });
  } catch (err) {
    console.error('[Nav Middleware Error]', err);
    res.locals.globalNavDepartments = [];
  }
  next();
});

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

    // 6. Load site images (hero + sub-banner)
    const siteImgSettings = await prisma.siteSettings.findMany({
      where: { key: { in: ['hero_images', 'sub_banner_images'] } }
    });
    const heroImgSetting = siteImgSettings.find(s => s.key === 'hero_images');
    const subBannerImgSetting = siteImgSettings.find(s => s.key === 'sub_banner_images');
    const heroImages = heroImgSetting ? JSON.parse(heroImgSetting.value) : [];
    const subBannerImages = subBannerImgSetting ? JSON.parse(subBannerImgSetting.value) : [];

    // 7. Load achievements (outstanding works)
    const achievements = await prisma.achievement.findMany({
      orderBy: { order: 'asc' }
    });

    res.render('index', {
      title: 'วิทยาลัยการอาชีพบ่อไร่ | BICEC',
      newsItems,
      sidebarNews,
      biddingNews,
      publishedDocs,
      departments: await getDepartments(),
      heroImage: heroImages.length > 0 ? heroImages[0] : '/bannerImage.webp',
      subBannerImages: subBannerImages.length > 0 ? subBannerImages : ['/subbannerImage.png'],
      achievements
    });
  } catch (error) {
    console.error(error);
    res.render('index', {
      title: 'วิทยาลัยการอาชีพบ่อไร่ | BICEC',
      newsItems: [],
      sidebarNews: [],
      heroImage: '/bannerImage.webp',
      subBannerImages: ['/subbannerImage.png'],
      achievements: [],
      departments: await getDepartments()
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

// --- Department Data Helper ---
async function getDepartments() {
  const depts = await prisma.department.findMany({ orderBy: { order: 'asc' } });
  const dict = {};
  for (const d of depts) {
    dict[d.slug] = {
      ...d,
      curriculum: {
        pvc: d.curriculumPvc || [],
        hvc: d.curriculumHvc || []
      }
    };
  }
  return dict;
}


router.get('/curriculum', async (req, res) => {
  try {
    const departmentsData = await getDepartments();
    res.render('curriculum', {
      title: 'หลักสูตรที่เปิดสอน | วิทยาลัยการอาชีพบ่อไร่',
      departments: departmentsData
    });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// GET /curriculum/:slug — Department Detail Page (Dynamic)
router.get('/curriculum/:slug', async (req, res) => {
  let departmentInfo = null;
  try {
    const { slug } = req.params;
    const departmentsData = await getDepartments();
    departmentInfo = departmentsData[slug];

    if (!departmentInfo) {
      return res.status(404).render('404', { title: 'ไม่พบสาขาวิชานี้' });
    }

    // Smart Integration: Fetch teachers for this department using multiple possible keywords
    const keywords = [departmentInfo.name, ...(departmentInfo.keywords || [])];
    let faculty = await prisma.personnel.findMany({
      where: {
        OR: keywords.map(k => ({
          department: { contains: k }
        }))
      },
      orderBy: { order: 'asc' }
    });

    // Smart Sorting Hierarchy: 
    // 1. Head of Dept (หัวหน้าแผนก)
    // 2. Regular Teachers (sorted by Academic Standing)
    // 3. Government Employees (พนักงานราชการ)
    // 4. Contract Teachers (ครูอัตราจ้าง)
    const getPriority = (p) => {
      const pos = p.position || '';
      const stand = p.academicStanding || '';
      const duties = Array.isArray(p.duties) ? p.duties : [];
      
      const hasHeadDuty = pos.includes('หัวหน้าแผนก') || duties.some(d => d.includes('หัวหน้าแผนก'));

      // Level 1: Head of Department
      if (hasHeadDuty) return 0;
      
      // Level 2: Regular Teachers by Academic Standing
      if (stand.includes('เชี่ยวชาญพิเศษ')) return 10;
      if (stand.includes('เชี่ยวชาญ')) return 11;
      if (stand.includes('ชำนาญการพิเศษ')) return 12;
      if (stand.includes('ชำนาญการ')) return 13;
      // Regular Teacher (no standing yet)
      if (pos.includes('ครู') && !pos.includes('พนักงาน') && !pos.includes('อัตรา')) return 14; 
      
      // Level 3: Government Employees
      if (pos.includes('พนักงานราชการ')) return 50;
      
      // Level 4: Contract Teachers
      if (pos.includes('ครูอัตราจ้าง')) return 60;
      
      return 100; // Fallback
    };

    faculty.sort((a, b) => {
      const toolA = getPriority(a);
      const toolB = getPriority(b);
      if (toolA !== toolB) return toolA - toolB;
      return a.order - b.order; // Fallback to custom order if priority is same
    });

    res.render('department-detail', {
      title: `${departmentInfo.name} | วิทยาลัยการอาชีพบ่อไร่`,
      dept: departmentInfo,
      faculty
    });
  } catch (error) {
    console.warn('[Database Offline] Rendering department detail without faculty data.', error);
    res.render('department-detail', {
      title: departmentInfo ? `${departmentInfo.name} | วิทยาลัยการอาชีพบ่อไร่` : 'หลักสูตร | วิทยาลัยการอาชีพบ่อไร่',
      dept: departmentInfo || {},
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
      where: { key: { in: ['current_semester', 'academic_year', 'budget_info_status'] } }
    });
    
    const semesterSetting = settings.find(s => s.key === 'current_semester');
    const yearSetting = settings.find(s => s.key === 'academic_year');
    const budgetStatusSetting = settings.find(s => s.key === 'budget_info_status');
    
    const currentSemester = semesterSetting ? semesterSetting.value : '1';
    const academicYear = yearSetting ? yearSetting.value : '2567';
    const budgetInfoStatus = budgetStatusSetting ? budgetStatusSetting.value : 'active';

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        academicYear: String(academicYear),
        semester: String(currentSemester)
      }
    });

    res.render('about', {
      title: 'ข้อมูลวิทยาลัย | วิทยาลัยการอาชีพบ่อไร่',
      departments: await getDepartments(),
      allPersonnel,
      enrollments,
      currentSemester,
      academicYear,
      budgetInfoStatus,
      budgetData: null // Set to null to show 'No Data' state as requested
    });
  } catch (error) {
    console.error(error);
    res.render('about', {
      title: 'ข้อมูลวิทยาลัย | วิทยาลัยการอาชีพบ่อไร่',
      departments: await getDepartments(),
      allPersonnel: [],
      enrollments: [],
      currentSemester: '1',
      academicYear: '2567',
      budgetInfoStatus: 'active',
      budgetData: null
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

