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

// GET /about — About College
router.get('/about', async (req, res) => {
  try {
    res.render('about', {
      title: 'ข้อมูลวิทยาลัย | วิทยาลัยการอาชีพบ่อไร่',
    });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

module.exports = router;
