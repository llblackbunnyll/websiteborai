const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20101v8.pdf',
    order: 1
  },
  'electrical': {
    name: 'ช่างไฟฟ้ากำลัง',
    slug: 'electrical',
    icon: 'zap',
    type: 'Technology',
    pvcName: 'ช่างไฟฟ้ากำลัง',
    hvcName: 'ไฟฟ้า',
    imageUrl: '/images/dept-electric-new.png',
    description: 'สร้างผู้เชี่ยวชาญด้านระบบไฟฟ้าอาคารและอุตสาหกรรม การทำงานกับระบบพลังงานสะอาด และเทคโนโลยีควบคุมอัตโนมัติ (PLC) เพื่อรองรับตลาดแรงงานยุคอุตสาหกรรม 4.0',
    keywords: ['ไฟฟ้ากำลัง', 'ช่างไฟฟ้า'],
    skills: ['Home Wiring', 'Motor Control', 'PLC Systems'],
    jobs: ['ช่างไฟฟ้าอาคาร', 'ช่างควบคุมระบบไฟฟ้าโรงงาน', 'พนักงานรัฐวิสาหกิจการไฟฟ้า', 'ผู้ออกแบบระบบไฟฟ้า'],
    curriculum: {
      pvc: ['การติดตั้งไฟฟ้าในอาคาร', 'เครื่องกลไฟฟ้า', 'การควบคุมมอเตอร์', 'การวัดและวงจรไฟฟ้า', 'การติดตั้งไฟฟ้านอกอาคาร'],
      hvc: ['ระบบควบคุมอัตโนมัติ (PLC)', 'การออกแบบระบบไฟฟ้า', 'เครื่องกำเนิดไฟฟ้า', 'ระบบส่งจ่ายกำลังไฟฟ้า', 'พลังงานลมและแสงอาทิตย์']
    },
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20104v6.pdf',
    order: 2
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
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20105v6.pdf',
    order: 3
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
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20201v8.pdf',
    order: 4
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
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/21910v8.pdf',
    order: 5
  }
};

async function seed() {
  console.log('Seeding departments...');
  for (const slug in DEPARTMENTS_DATA) {
    const data = DEPARTMENTS_DATA[slug];
    await prisma.department.upsert({
      where: { slug: data.slug },
      update: {
        name: data.name,
        icon: data.icon,
        type: data.type,
        pvcName: data.pvcName,
        hvcName: data.hvcName,
        imageUrl: data.imageUrl,
        description: data.description,
        keywords: data.keywords,
        skills: data.skills,
        jobs: data.jobs,
        curriculumPvc: data.curriculum?.pvc || [],
        curriculumHvc: data.curriculum?.hvc || [],
        pdfUrl: data.pdfUrl,
        order: data.order
      },
      create: {
        slug: data.slug,
        name: data.name,
        icon: data.icon,
        type: data.type,
        pvcName: data.pvcName,
        hvcName: data.hvcName,
        imageUrl: data.imageUrl,
        description: data.description,
        keywords: data.keywords,
        skills: data.skills,
        jobs: data.jobs,
        curriculumPvc: data.curriculum?.pvc || [],
        curriculumHvc: data.curriculum?.hvc || [],
        pdfUrl: data.pdfUrl,
        order: data.order
      }
    });
    console.log(`Upserted ${data.slug}`);
  }
  console.log('Done.');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
