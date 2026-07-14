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

// Global Middleware for Visitor Tracking
router.use(async (req, res, next) => {
  try {
    // Get YYYY-MM-DD in local time if possible, or UTC fallback
    const now = new Date();
    const today = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const userAgent = req.headers['user-agent'] || '';
    const isBot = /bot|googlebot|crawler|spider|robot|crawling/i.test(userAgent);

    let todayStat = await prisma.visitorStat.findUnique({ where: { date: today } });
    if (!todayStat) {
      todayStat = await prisma.visitorStat.create({ data: { date: today, count: 0 } });
    }

    let totalSetting = await prisma.siteSettings.findUnique({ where: { key: 'total_visitors' } });
    if (!totalSetting) {
      totalSetting = await prisma.siteSettings.create({ data: { key: 'total_visitors', value: '0' } });
    }

    if (!isBot && !req.path.startsWith('/admin') && !req.path.startsWith('/api') && req.session.visitedDate !== today) {
      req.session.visitedDate = today;

      todayStat = await prisma.visitorStat.update({
        where: { date: today },
        data: { count: { increment: 1 } }
      });

      const newTotal = parseInt(totalSetting.value, 10) + 1;
      totalSetting = await prisma.siteSettings.update({
        where: { key: 'total_visitors' },
        data: { value: newTotal.toString() }
      });
    }

    // Format numbers with commas safely
    res.locals.visitorDaily = todayStat.count.toLocaleString();
    res.locals.visitorTotal = parseInt(totalSetting.value, 10).toLocaleString();
  } catch (err) {
    console.error('[Visitor Tracking Error]', err);
    res.locals.visitorDaily = 0;
    res.locals.visitorTotal = 0;
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

    // 8. Load FAQs for the homepage
    const faqs = await prisma.fAQ.findMany({
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
      achievements,
      faqs: faqs.length > 0 ? faqs : [
        { id: '1', question: 'วิทยาลัยการอาชีพบ่อไร่ตั้งอยู่ที่ไหน?', answer: 'ตั้งอยู่ที่เลขที่ 25 หมู่ 3 ต.บ่อพลอย อ.บ่อไร่ จ.ตราด ท่านสามารถติดต่อสอบถามข้อมูลเพิ่มเติมได้ที่เบอร์โทรศัพท์ 039-591-104 หรือตามแผนที่ Google Maps ด้านล่างเว็บไซต์ครับ' },
        { id: '2', question: 'เปิดรับสมัครนักศึกษาใหม่ช่วงเวลาใดบ้าง?', answer: 'โดยปกติจะเปิดรับสมัครในช่วงเดือนมกราคม - เมษายน ของทุกปี ทั้งในระดับประกาศนียบัตรวิชาชีพ (ปวช.) และประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.) ครับ' },
        { id: '3', question: 'เรียนที่นี่มีทุนการศึกษาหรือไม่?', answer: 'มีครับ วิทยาลัยมีทุน กยศ. และทุนสนับสนุนจากสถานประกอบการสำหรับนักเรียนที่มีความประพฤติดีแต่ขาดแคลนทุนทรัพย์ รวมถึงทุนการศึกษาจากผู้มีจิตศรัทธาที่บริจาคมาอย่างต่อเนื่องครับ' },
        { id: '4', question: 'การเรียนแบบ "ทวิภาคี" คืออะไร?', answer: 'คือการจัดการเรียนการสอนที่เน้นการเรียนรู้ผ่านการปฏิบัติงานจริงในสถานประกอบการ หรือบริษัทคู่พัฒนา โดยนักศึกษาจะได้รับประสบการณ์ตรง โอกาสในการจ้างงานสูง และมีเบี้ยเลี้ยงระหว่างฝึกงานด้วยครับ' }
      ]
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

// GET /downloads — Dedicated Download Center for Divisions
router.get('/downloads', async (req, res) => {
  try {
    const docs = await prisma.downloadDocument.findMany({
      orderBy: [
        { division: 'asc' },
        { subDivision: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.render('downloads', {
      title: 'ดาวน์โหลดเอกสาร | BICEC',
      docs
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

    // Fetch ITA O3 (Strategic Plan) for current year 2569
    const itaO3 = await prisma.iTAItem.findUnique({
      where: {
        code_year: {
          code: 'O3',
          year: '2569'
        }
      }
    });
    const strategicPlans = itaO3 && Array.isArray(itaO3.attachments) ? itaO3.attachments : [];

    res.render('about', {
      title: 'ข้อมูลวิทยาลัย | วิทยาลัยการอาชีพบ่อไร่',
      departments: await getDepartments(),
      allPersonnel,
      enrollments,
      currentSemester,
      academicYear,
      budgetInfoStatus,
      budgetData: null, // Set to null to show 'No Data' state as requested
      strategicPlans
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
      budgetData: null,
      strategicPlans: []
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

    // Fetch ITA O1 (Administrative Orders/Powers) for current year 2569
    const itaO1 = await prisma.iTAItem.findUnique({
      where: {
        code_year: {
          code: 'O1',
          year: '2569'
        }
      }
    });

    // Pass attachments from O1 if found, otherwise empty array
    const orders = itaO1 && Array.isArray(itaO1.attachments) ? itaO1.attachments : [];
    const ordersUpdateDate = itaO1 && itaO1.updatedAt 
      ? new Date(itaO1.updatedAt).toLocaleDateString('th-TH') 
      : null;

    res.render('org-chart', {
      title: 'ผังการบริหาร | วิทยาลัยการอาชีพบ่อไร่',
      allPersonnel,
      orders,
      ordersUpdateDate
    });
  } catch (error) {
    console.warn('[Database Offline] Rendering org-chart without personnel data.', error);
    res.render('org-chart', {
      title: 'ผังการบริหาร | วิทยาลัยการอาชีพบ่อไร่',
      allPersonnel: [],
      orders: [],
      ordersUpdateDate: null
    });
  }
});


// GET /ita — Public ITA OIT Dashboard (Redirect to current year 2569)
router.get('/ita', async (req, res) => {
  res.redirect('/ita/2569');
});

// GET /ita/:year — Public ITA OIT Dashboard for specific year
router.get('/ita/:year', async (req, res) => {
  const { year } = req.params;
  try {
    const items = await prisma.iTAItem.findMany({
      where: { year, isPublic: true },
      orderBy: { code: 'asc' }
    });

    // Custom sorting helper for O1, O2, ... O10, O11... (natural sorting)
    items.sort((a, b) => {
      const getNum = (code) => parseInt(code.replace(/\D/g, ''), 10) || 0;
      return getNum(a.code) - getNum(b.code);
    });

    // Smart Auto-binding for O15, O18, O19 items
    items.forEach(item => {
      let atts = [];
      if (item.attachments) {
        try {
          atts = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
        } catch (e) {
          atts = [];
        }
      }
      if (!Array.isArray(atts)) {
        atts = [];
      }

      if (item.code === 'O1') {
        const exists = atts.some(a => a.url === '/org-chart');
        if (!exists) {
          atts.unshift({
            label: 'แผนผังโครงสร้างการแบ่งส่วนราชการและผังการบริหาร',
            url: '/org-chart',
            type: 'link'
          });
        }
      } else if (item.code === 'O2') {
        const exists = atts.some(a => a.url === '/personnel');
        if (!exists) {
          atts.unshift({
            label: 'ข้อมูลผู้บริหารสถานศึกษาและบุคลากรวิทยาลัย',
            url: '/personnel',
            type: 'link'
          });
        }
      } else if (item.code === 'O3') {
        const exists = atts.some(a => a.url === '/about#strategic-plan');
        if (!exists) {
          atts.unshift({
            label: 'แผนพัฒนาสถานศึกษาและแผนยุทธศาสตร์ (ระยะยาว)',
            url: '/about#strategic-plan',
            type: 'link'
          });
        }
      } else if (item.code === 'O4') {
        const exists = atts.some(a => a.url === '/#contact');
        if (!exists) {
          atts.unshift({
            label: 'ข้อมูลการติดต่อของสถานศึกษา (ที่อยู่ เบอร์โทรศัพท์ Social Media และแผนที่ที่ตั้ง)',
            url: '/#contact',
            type: 'link'
          });
        }
      } else if (item.code === 'O9') {
        const exists = atts.some(a => a.url === '/news');
        if (!exists) {
          atts.unshift({
            label: 'ข่าวประชาสัมพันธ์ของสถานศึกษา',
            url: '/news',
            type: 'link'
          });
        }
      } else if (item.code === 'O10') {
        const exists = atts.some(a => a.url === '/documents?type=bidding');
        if (!exists) {
          atts.unshift({
            label: 'ประกาศการจัดซื้อจัดจ้างและการจัดหาพัสดุ (ประกวดราคา)',
            url: '/documents?type=bidding',
            type: 'link'
          });
        }
      } else if (item.code === 'O12') {
        const exists = atts.some(a => a.url === '/downloads');
        if (!exists) {
          atts.unshift({
            label: 'คู่มือและขั้นตอนการปฏิบัติงานภายใน (ศูนย์ดาวน์โหลดเอกสาร)',
            url: '/downloads',
            type: 'link'
          });
        }
      } else if (item.code === 'O13') {
        const exists = atts.some(a => a.url === '/downloads');
        if (!exists) {
          atts.unshift({
            label: 'คู่มือหรือมาตรฐานขั้นตอนการให้บริการประชาชน (ศูนย์ดาวน์โหลดเอกสาร)',
            url: '/downloads',
            type: 'link'
          });
        }
      } else if (item.code === 'O15') {
        const exists = atts.some(a => a.url === '/feedback');
        if (!exists) {
          atts.unshift({
            label: 'ช่องทางแสดงความคิดเห็นและประเมินความพึงพอใจการให้บริการ',
            url: '/feedback',
            type: 'link'
          });
        }
      } else if (item.code === 'O18') {
        const existsComplaints = atts.some(a => a.url === '/complaints');
        if (!existsComplaints) {
          atts.unshift({
            label: 'ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบออนไลน์',
            url: '/complaints',
            type: 'link'
          });
        }
        const existsTrack = atts.some(a => a.url === '/complaints/track');
        if (!existsTrack) {
          atts.push({
            label: 'ระบบติดตามสถานะเรื่องร้องเรียนการทุจริต',
            url: '/complaints/track',
            type: 'link'
          });
        }
      } else if (item.code === 'O19') {
        const exists = atts.some(a => a.url === '/complaints/stats');
        if (!exists) {
          atts.unshift({
            label: 'รายงานข้อมูลเชิงสถิติเรื่องร้องเรียนการทุจริตประจำปี (เรียลไทม์)',
            url: '/complaints/stats',
            type: 'link'
          });
        }
      }

      item.attachments = atts;
    });

    // Group items into indices for better representation (O1-O23 mapped into standard sections)
    const categories = {
      'ข้อมูลพื้นฐาน': items.filter(i => {
        const num = parseInt(i.code.replace(/\D/g, ''), 10) || 0;
        return num >= 1 && num <= 5;
      }),
      'การบริหารงาน': items.filter(i => {
        const num = parseInt(i.code.replace(/\D/g, ''), 10) || 0;
        return num >= 6 && num <= 9;
      }),
      'การจัดซื้อจัดจ้าง': items.filter(i => {
        const num = parseInt(i.code.replace(/\D/g, ''), 10) || 0;
        return num >= 10 && num <= 11;
      }),
      'การปฏิบัติหน้าที่': items.filter(i => {
        const num = parseInt(i.code.replace(/\D/g, ''), 10) || 0;
        return num >= 12 && num <= 15;
      }),
      'การบริหารทรัพยากรบุคคล': items.filter(i => {
        const num = parseInt(i.code.replace(/\D/g, ''), 10) || 0;
        return num >= 16 && num <= 17;
      }),
      'การจัดการเรื่องร้องเรียน': items.filter(i => {
        const num = parseInt(i.code.replace(/\D/g, ''), 10) || 0;
        return num >= 18 && num <= 19;
      }),
      'มาตรการป้องกันการทุจริต': items.filter(i => {
        const num = parseInt(i.code.replace(/\D/g, ''), 10) || 0;
        return num >= 20 && num <= 23;
      })
    };

    // Calculate progress stats
    const totalCount = items.length;
    const completedCount = items.filter(i => {
      const atts = Array.isArray(i.attachments) ? i.attachments : [];
      return atts.length > 0 || (i.description && i.description.trim().length > 0);
    }).length;

    // Available years for filter selector
    const yearsResult = await prisma.iTAItem.groupBy({
      by: ['year'],
      orderBy: { year: 'desc' }
    });
    const availableYears = yearsResult.map(y => y.year);

    res.render('ita', {
      title: `OIT การเปิดเผยข้อมูลสาธารณะ ประจำปีงบประมาณ พ.ศ. ${year} | วิทยาลัยการอาชีพบ่อไร่`,
      year,
      items,
      categories,
      totalCount,
      completedCount,
      availableYears: availableYears.length > 0 ? availableYears : ['2569']
    });
  } catch (error) {
    console.error('[ITA Route Error]', error);
    res.redirect('/');
  }
});


// GET /complaints — Public complaint submission page
router.get('/complaints', (req, res) => {
  res.render('complaints', {
    title: 'ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ | วิทยาลัยการอาชีพบ่อไร่'
  });
});

// GET /complaints/track — Public complaint tracking page
router.get('/complaints/track', (req, res) => {
  res.render('complaint-track', {
    title: 'ติดตามสถานะเรื่องร้องเรียนการทุจริต | วิทยาลัยการอาชีพบ่อไร่'
  });
});

// GET /complaints/stats — Public complaints statistics page
router.get('/complaints/stats', async (req, res) => {
  try {
    const total = await prisma.complaint.count();
    const pending = await prisma.complaint.count({ where: { status: 'pending' } });
    const investigating = await prisma.complaint.count({ where: { status: 'investigating' } });
    const resolved = await prisma.complaint.count({ where: { status: 'resolved' } });
    const rejected = await prisma.complaint.count({ where: { status: 'rejected' } });

    const catFraud = await prisma.complaint.count({ where: { category: 'ทุจริตประพฤติมิชอบ' } });
    const catService = await prisma.complaint.count({ where: { category: 'บริการไม่โปร่งใส' } });
    const catGeneral = await prisma.complaint.count({ where: { category: 'ทั่วไป' } });

    res.render('complaint-stats', {
      title: 'รายงานสรุปสถิติเรื่องร้องเรียนการทุจริตประจำปี | วิทยาลัยการอาชีพบ่อไร่',
      stats: {
        total,
        pending,
        investigating,
        resolved,
        rejected,
        category: {
          fraud: catFraud,
          service: catService,
          general: catGeneral
        }
      }
    });
  } catch (error) {
    console.error('[Route Complaint Stats Error]', error);
    res.redirect('/complaints');
  }
});

// GET /feedback — Public feedback submission page with App Store reviews styling
router.get('/feedback', async (req, res) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const totalCount = feedbacks.length;

    let averageRating = 0;
    if (totalCount > 0) {
      const sum = feedbacks.reduce((acc, curr) => acc + curr.rating, 0);
      averageRating = parseFloat((sum / totalCount).toFixed(2));
    }

    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    feedbacks.forEach(fb => {
      if (starCounts[fb.rating] !== undefined) {
        starCounts[fb.rating]++;
      }
    });

    const starPercentages = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (totalCount > 0) {
      for (let s = 1; s <= 5; s++) {
        starPercentages[s] = Math.round((starCounts[s] / totalCount) * 100);
      }
    }

    const recentReviews = feedbacks.slice(0, 6);

    res.render('feedback', {
      title: 'ช่องทางรับฟังความคิดเห็นและข้อเสนอแนะออนไลน์ | วิทยาลัยการอาชีพบ่อไร่',
      stats: {
        totalCount,
        averageRating,
        starCounts,
        starPercentages
      },
      recentReviews
    });
  } catch (error) {
    console.error('[Route Feedback Page Error]', error);
    res.render('feedback', {
      title: 'ช่องทางรับฟังความคิดเห็นและข้อเสนอแนะออนไลน์ | วิทยาลัยการอาชีพบ่อไร่',
      stats: {
        totalCount: 0,
        averageRating: 0.00,
        starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        starPercentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      },
      recentReviews: []
    });
  }
});

module.exports = router;

