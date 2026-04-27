const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEPARTMENTS_DATA = [
  {
    name: 'ช่างยนต์',
    slug: 'automotive',
    icon: 'truck',
    type: 'Industrial',
    pvcName: 'สาขาวิชาช่างยนต์',
    hvcName: 'สาขาวิชาเทคนิคยานยนต์',
    imageUrl: '/images/dept-auto.png',
    description: 'มุ่งเน้นการผลิตและพัฒนากำลังคนในสาขางานยานยนต์ ให้มีความรู้ความชำนาญทั้งในด้านทฤษฎีและปฏิบัติ ครอบคลุมระบบเครื่องยนต์ดีเซลและเบนซิน รวมถึงเทคโนโลยียานยนต์สมัยใหม่ และยานยนต์ไฟฟ้า (EV)',
    keywords: ['ช่างยนต์', 'ยานยนต์', 'เทคนิคยานยนต์', 'ซ่อมรถ'],
    skills: ['Engine Overhaul', 'Automotive Electrical Systems', 'Drive Train Maintenance', 'EV Basics', 'Diagnostic Tools'],
    jobs: ['ช่างซ่อมบำรุงยานยนต์', 'ช่างเทคนิคประจำศูนย์บริการ', 'เจ้าของอู่ซ่อมรถยนต์', 'ที่ปรึกษาด้านบริการ (Service Advisor)', 'พนักงานตรวจสภาพรถ (ตรอ.)'],
    curriculumPvc: [
      { name: 'งานเครื่องยนต์แก๊สโซลีน', desc: 'ศึกษากลไกและการซ่อมบำรุงเครื่องยนต์เบนซินเบื้องต้น' },
      { name: 'งานเครื่องยนต์ดีเซล', desc: 'เรียนรู้ระบบการทำงานและการบำรุงรักษาเครื่องยนต์ดีเซล' },
      { name: 'งานเครื่องล่างรถยนต์', desc: 'การตรวจซ่อมระบบช่วงล่าง เบรก และระบบบังคับเลี้ยว' },
      { name: 'งานส่งกำลังรถยนต์', desc: 'เจาะลึกระบบเกียร์ คลัตช์ และเพลาขับเคลื่อน' },
      { name: 'งานไฟฟ้ายานยนต์', desc: 'ระบบไฟแสงสว่าง แบตเตอรี่ และระบบสตาร์ทรถยนต์' },
      { name: 'งานจักรยานยนต์', desc: 'เทคนิคการซ่อมบำรุงและปรับจูนเครื่องยนต์จักรยานยนต์' },
      { name: 'งานสีและตัวถังรถยนต์เบื้องต้น', desc: 'พื้นฐานการเคาะพ่นสีและการซ่อมแซมตัวถัง' }
    ],
    curriculumHvc: [
      { name: 'เทคโนโลยีระบบไฟฟ้ายานยนต์', desc: 'ระบบอิเล็กทรอนิกส์ควบคุมขั้นสูงในรถยนต์สมัยใหม่' },
      { name: 'การวิเคราะห์ปัญหายานยนต์', desc: 'การใช้เครื่องมือสแกนและคอมพิวเตอร์วิเคราะห์อาการเสีย' },
      { name: 'งานเครื่องยนต์แก๊สโซลีนควบคุมด้วยอิเล็กทรอนิกส์', desc: 'ระบบหัวฉีด EFI และการจูนนิ่งเครื่องยนต์' },
      { name: 'งานเครื่องยนต์ดีเซลควบคุมด้วยอิเล็กทรอนิกส์', desc: 'ระบบ Common Rail และการลดมลพิษในเครื่องยนต์ดีเซล' },
      { name: 'การจัดการศูนย์บริการยานยนต์', desc: 'การบริหารงานรับรถ อะไหล่ และการบริการลูกค้า' },
      { name: 'เทคโนโลยียานยนต์ไฟฟ้าพื้นฐาน', desc: 'โครงสร้างรถยนต์ EV และระบบขับเคลื่อนด้วยมอเตอร์ไฟฟ้า' }
    ],
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20101v8.pdf',
    order: 1
  },
  {
    name: 'ช่างไฟฟ้ากำลัง',
    slug: 'electrical',
    icon: 'zap',
    type: 'Technology',
    pvcName: 'สาขาวิชาช่างไฟฟ้ากำลัง',
    hvcName: 'สาขาวิชาไฟฟ้า',
    imageUrl: '/images/dept-electric-new.png',
    description: 'สร้างผู้เชี่ยวชาญด้านระบบไฟฟ้าอาคารและอุตสาหกรรม การทำงานกับระบบพลังงานสะอาด Solar Cell และเทคโนโลยีควบคุมอัตโนมัติ (PLC) เพื่อรองรับตลาดแรงงานอุตสาหกรรมยุคใหม่',
    keywords: ['ไฟฟ้ากำลัง', 'ช่างไฟฟ้า', 'ติดตั้งไฟฟ้า', 'PLC', 'Solar Cell'],
    skills: ['Electrical Installation', 'Motor Control', 'PLC Programming', 'Solar System Design', 'Industrial Wiring'],
    jobs: ['ช่างไฟฟ้าประจำอาคาร/โรงงาน', 'พนักงานรัฐวิสาหกิจ (กฟภ./กฟผ.)', 'ผู้รับเหมาติดตั้งระบบไฟฟ้า', 'พนักงานซ่อมบำรุงระบบไฟฟ้า', 'นักออกแบบระบบไฟฟ้าเบื้องต้น'],
    curriculumPvc: [
      { name: 'งานไฟฟ้าและอิเล็กทรอนิกส์เบื้องต้น', desc: 'พื้นฐานกระแสไฟฟ้า วงจร และอุปกรณ์พื้นฐาน' },
      { name: 'งานเขียนแบบไฟฟ้า', desc: 'การอ่านและเขียนแบบวงจรไฟฟ้ามาตรฐานสากล' },
      { name: 'งานติดตั้งไฟฟ้าในอาคาร', desc: 'การเดินสายไฟและติดตั้งอุปกรณ์ไฟฟ้าในบ้านเรือน' },
      { name: 'เครื่องกลไฟฟ้า', desc: 'หลักการทำงานของมอเตอร์และไดนาโมชนิดต่างๆ' },
      { name: 'การควบคุมมอเตอร์ไฟฟ้า', desc: 'เทคนิคการออกแบบวงจรควบคุมมอเตอร์ในงานช่าง' },
      { name: 'เครื่องวัดไฟฟ้า', desc: 'การใช้มัลติมิเตอร์และเครื่องมือวัดค่าทางไฟฟ้า' },
      { name: 'งานติดตั้งไฟฟ้านอกอาคาร', desc: 'ระบบสายส่งและหม้อแปลงไฟฟ้าแรงสูง' }
    ],
    curriculumHvc: [
      { name: 'การออกแบบระบบไฟฟ้า', desc: 'การคำนวณโหลดและการวางระบบไฟฟ้าอาคารขนาดใหญ่' },
      { name: 'ระบบควบคุมอัตโนมัติในอุตสาหกรรม (PLC)', desc: 'การเขียนโปรแกรมควบคุมแขนกลและระบบโรงงาน' },
      { name: 'งานติดตั้งไฟฟ้าอุตสาหกรรม', desc: 'การเดินท่อร้อยสายและตู้ควบคุม MDB ในโรงงาน' },
      { name: 'การส่องสว่าง', desc: 'การคำนวณแสงสว่างและเลือกใช้หลอดไฟให้มีประสิทธิภาพ' },
      { name: 'ระบบประหยัดพลังงานในอาคาร', desc: 'เทคนิคการลดค่าไฟและตรวจสอบการใช้พลังงาน' },
      { name: 'งานเทคนิคพลังงานสะอาด (Solar Cell)', desc: 'การติดตั้งและการบำรุงรักษาระบบโซลาร์เซลล์' }
    ],
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20104v6.pdf',
    order: 2
  },
  {
    name: 'ช่างอิเล็กทรอนิกส์',
    slug: 'electronics',
    icon: 'cpu',
    type: 'Technology',
    pvcName: 'สาขาวิชาช่างอิเล็กทรอนิกส์',
    hvcName: 'สาขาวิชาอิเล็กทรอนิกส์',
    imageUrl: '/images/dept-electro.png',
    description: 'ศึกษาการทำงานของเทคโนโลยีสมองกลฝังตัว (Embedded Systems) ระบบสื่อสารโทรคมนาคม งานซ่อมบำรุงระบบควบคุมอิเล็กทรอนิกส์ รวมถึงเทคโนโลยี IoT และอุปกรณ์ Smart Home',
    keywords: ['อิเล็กทรอนิกส์', 'ช่างอิเล็ก', 'Microcontroller', 'IoT', 'Smart Home'],
    skills: ['Circuit Design & Simulation', 'PCB Fabrication', 'Microcontroller Programming', 'IoT Integration', 'Electronic Repair'],
    jobs: ['ช่างเทคนิคอิเล็กทรอนิกส์', 'พนักงานฝ่ายผลิตอุตสาหกรรมไฮเทค', 'ช่างซ่อมอุปกรณ์สื่อสาร', 'ผู้ช่วยวิศวกรระบบสมองกล', 'เจ้าของกิจการซ่อมเครื่องใช้ไฟฟ้า'],
    curriculumPvc: [
      { name: 'วงจรไฟฟ้าและการวิเคราะห์', desc: 'การคำนวณกระแส แรงดัน ในวงจร DC และ AC' },
      { name: 'อุปกรณ์อิเล็กทรอนิกส์และวงจร', desc: 'คุณสมบัติของทรานซิสเตอร์ ไดโอด และ IC' },
      { name: 'เครื่องวัดไฟฟ้าและอิเล็กทรอนิกส์', desc: 'การใช้ออสซิลโลสโคปและเครื่องกำเนิดสัญญาณ' },
      { name: 'ดิจิทัลเบื้องต้น', desc: 'ระบบเลขฐาน ลอจิกเกต และวงจรนับตัวเลข' },
      { name: 'ไมโครคอนโทรลเลอร์เบื้องต้น', desc: 'การเขียนโปรแกรมควบคุมบอร์ด Arduino ขั้นพื้นฐาน' },
      { name: 'งานเชื่อมและประกอบผลิตภัณฑ์อิเล็กทรอนิกส์', desc: 'ทักษะการบัดกรีและการประกอบลายวงจรพิมพ์ (PCB)' },
      { name: 'การโปรแกรมคอมพิวเตอร์ในงานควบคุม', desc: 'ภาษา C และ Python สำหรับงานอิเล็กทรอนิกส์' }
    ],
    curriculumHvc: [
      { name: 'อิเล็กทรอนิกส์อุตสาหกรรม', desc: 'ระบบเซนเซอร์และตัวตรวจจับในกระบวนการผลิต' },
      { name: 'ระบบสื่อสารโทรคมนาคม', desc: 'การส่งสัญญาณวิทยุ ไมโครเวฟ และใยแก้วนำแสง' },
      { name: 'ไมโครคอนโทรลเลอร์และการประยุกต์ใช้งาน', desc: 'การออกแบบระบบสมองกลฝังตัวเพื่อแก้ปัญหาจริง' },
      { name: 'ระบบเครือข่ายคอมพิวเตอร์', desc: 'การวางระบบ LAN, WiFi และความปลอดภัยเครือข่าย' },
      { name: 'งานเทคนิคระบบภาพและเสียงดิจิทัล', desc: 'การซ่อมบำรุงสมาร์ททีวีและระบบเครื่องเสียงสมัยใหม่' },
      { name: 'ระบบเทคโนโลยีสมาร์ทโฮม (Smart Home)', desc: 'การติดตั้งระบบ IoT ควบคุมบ้านผ่านแอปมือถือ' }
    ],
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20105v6.pdf',
    order: 3
  },
  {
    name: 'การบัญชี',
    slug: 'accounting',
    icon: 'book',
    type: 'Business',
    pvcName: 'สาขาวิชาการบัญชี',
    hvcName: 'สาขาวิชาการบัญชี',
    imageUrl: '/images/dept-acc.png',
    description: 'เตรียมความพร้อมสู่สายงานบริหารจัดการการเงิน การรายงานบัญชีที่แม่นยำ และการใช้ซอฟต์แวร์ทางธุรกิจระดับสากล รวมถึงการวางแผนภาษีอากรและผู้ช่วยผู้ตรวจสอบบัญชี',
    keywords: ['การบัญชี', 'บัญชี', 'Accounting', 'ภาษีอากร', 'ตรวจสอบบัญชี'],
    skills: ['Financial Recording', 'Tax Filing', 'QuickBooks/AutoFlight', 'Auditing Basics', 'Excel for Accountants'],
    jobs: ['พนักงานบัญชีประจำบริษัท', 'เจ้าหน้าที่ธุรการการเงิน', 'พนักงานธนาคาร', 'ผู้ช่วยผู้ตรวจสอบบัญชี', 'พนักงานภาษีอากร'],
    curriculumPvc: [
      { name: 'การบัญชีเบื้องต้น', desc: 'พื้นฐานการบันทึกบัญชีแยกประเภทและสมุดรายวัน' },
      { name: 'การบัญชีธุรกิจซื้อขายสินค้า', desc: 'การคำนวณต้นทุนสินค้าคงเหลือและภาษีมูลค่าเพิ่ม' },
      { name: 'การบัญชีห้างหุ้นส่วน', desc: 'การบันทึกเงินทุนและการแบ่งผลกำไรขาดทุน' },
      { name: 'การบัญชีบริษัทจำกัด', desc: 'การออกหุ้น การจ่ายเงินปันผล และงบการเงิน' },
      { name: 'การบัญชีอุตสาหกรรม', desc: 'การคำนวณต้นทุนการผลิต วัตถุดิบ และค่าแรง' },
      { name: 'การบัญชีภาษีอากร', desc: 'การจัดทำรายงานภาษีซื้อ-ภาษีขาย และภาษีหัก ณ ที่จ่าย' },
      { name: 'การใช้คอมพิวเตอร์ในงานบัญชี', desc: 'การใช้ Excel และโปรแกรมบัญชีสำเร็จรูปพื้นฐาน' }
    ],
    curriculumHvc: [
      { name: 'การบัญชีชั้นสูง 1-2', desc: 'การบัญชีสำนักงานใหญ่และสาขา งบการเงินรวม' },
      { name: 'การบัญชีต้นทุน 1-2', desc: 'การวิเคราะห์ต้นทุนมาตรฐานและจุดคุ้มทุน' },
      { name: 'การตรวจสอบบัญชี', desc: 'มาตรฐานการสอบบัญชีและเทคนิคการตรวจสอบภายใน' },
      { name: 'ระบบสารสนเทศทางการบัญชี', desc: 'การออกแบบระบบไหลเวียนเอกสารทางการเงิน' },
      { name: 'การวางแผนภาษีอากร', desc: 'เทคนิคการใช้สิทธิประโยชน์ทางภาษีอย่างถูกกฎหมาย' },
      { name: 'สัมมนาการบัญชี', desc: 'วิเคราะห์กรณีศึกษาและมาตรฐานการรายงานทางการเงินใหม่ๆ' }
    ],
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20201v8.pdf',
    order: 4
  },
  {
    name: 'เทคโนโลยีธุรกิจดิจิทัล',
    slug: 'digital-business',
    icon: 'briefcase',
    type: 'Digital & Business',
    pvcName: 'สาขาวิชาเทคโนโลยีธุรกิจดิจิทัล',
    hvcName: 'สาขาวิชาเทคโนโลยีธุรกิจดิจิทัล',
    imageUrl: '/images/dept-it.png',
    description: 'มุ่งเน้นการสร้างนักบริหารจัดการดิจิทัลยุคใหม่ พัฒนาทักษะด้านการตลาดออนไลน์ พาณิชย์อิเล็กทรอนิกส์ และการจัดการนวัตกรรมธุรกิจด้วยเทคโนโลยีที่ทันสมัย (AI & Big Data)',
    keywords: ['ธุรกิจดิจิทัล', 'คอมพิวเตอร์ธุรกิจ', 'IT Business', 'Digital Marketing', 'Content Creator'],
    skills: ['Digital Marketing Strategy', 'E-Commerce Management', 'Graphic Design for Business', 'Data Analytics Basics', 'Online Brand Management'],
    jobs: ['เจ้าหน้าที่การตลาดดิจิทัล', 'ผู้ดูแลสื่อสังคมออนไลน์ (Social Media Admin)', 'เจ้าของธุรกิจออนไลน์', 'นักสร้างสรรค์เนื้อหา (Content Creator)', 'เจ้าหน้าที่ธุรการดิจิทัล'],
    curriculumPvc: [
      { name: 'พื้นฐานธุรกิจดิจิทัล', desc: 'ความรู้เบื้องต้นเกี่ยวกับโมเดลธุรกิจในยุคออนไลน์' },
      { name: 'การใช้โปรแกรมสำเร็จรูปในงานธุรกิจ', desc: 'Word, Excel, PowerPoint เพื่อการบริหารงานสำนักงาน' },
      { name: 'การสร้างเว็บไซต์ทางธุรกิจ', desc: 'การเขียนเว็บเบื้องต้นและใช้งาน CMS เช่น WordPress' },
      { name: 'การตลาดดิจิทัลเบื้องต้น', desc: 'การยิงโฆษณา Facebook, Google และการวิเคราะห์กลุ่มเป้าหมาย' },
      { name: 'การใช้โปรแกรมกราฟิก', desc: 'การใช้ Photoshop และ Canva เพื่อออกแบบสื่อโฆษณา' },
      { name: 'ธุรกิจและการเป็นผู้ประกอบการ', desc: 'การวางแผนธุรกิจ แผนการเงิน และการวิเคราะห์ SWOT' },
      { name: 'การสื่อสารดิจิทัลในงานธุรกิจ', desc: 'การเขียนอีเมลและการสื่อสารผ่านสื่อโซเชียลอย่างมืออาชีพ' }
    ],
    curriculumHvc: [
      { name: 'การวิเคราะห์และออกแบบระบบธุรกิจดิจิทัล', desc: 'การวางโครงสร้างระบบ IT สำหรับองค์กร' },
      { name: 'พาณิชย์อิเล็กทรอนิกส์ในยุคดิจิทัล', desc: 'การบริหารจัดการ Marketplace และระบบชำระเงิน' },
      { name: 'กฎหมายและจริยธรรมคอมพิวเตอร์', desc: 'พรบ. คอมพิวเตอร์ และการคุ้มครองข้อมูลส่วนบุคคล (PDPA)' },
      { name: 'นวัตกรรมเทคโนโลยีธุรกิจดิจิทัล', desc: 'การใช้ Blockchain และนวัตกรรมใหม่ๆ ในเชิงธุรกิจ' },
      { name: 'การจัดการข้อมูลขนาดใหญ่ (Big Data Basics)', desc: 'การเก็บข้อมูลและนำมาวิเคราะห์เพื่อตัดสินใจ' },
      { name: 'เทคโนโลยีปัญญาประดิษฐ์ในงานธุรกิจ (AI)', desc: 'การใช้ ChatGPT และ AI Tools เพื่อเพิ่มประสิทธิภาพงาน' }
    ],
    pdfUrl: 'https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/21910v8.pdf',
    order: 5
  }
];

async function seed() {
  console.log('🌱 Seeding departments with updated accurate data...');
  for (const data of DEPARTMENTS_DATA) {
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
        curriculumPvc: data.curriculumPvc,
        curriculumHvc: data.curriculumHvc,
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
        curriculumPvc: data.curriculumPvc,
        curriculumHvc: data.curriculumHvc,
        pdfUrl: data.pdfUrl,
        order: data.order
      }
    });
    console.log(`✅ Upserted department: ${data.name} (${data.slug})`);
  }

  // Also seed some mock enrollment data for all departments
  console.log('📊 Seeding mock enrollment data...');
  const years = ['2566', '2567', '2568'];
  const semesters = ['1', '2'];

  for (const dept of DEPARTMENTS_DATA) {
    for (const year of years) {
      for (const semester of semesters) {
        await prisma.studentEnrollment.upsert({
          where: {
            departmentSlug_academicYear_semester: {
              departmentSlug: dept.slug,
              academicYear: year,
              semester: semester
            }
          },
          update: {},
          create: {
            departmentSlug: dept.slug,
            academicYear: year,
            semester: semester,
            pvc1: Math.floor(Math.random() * 40) + 10,
            pvc2: Math.floor(Math.random() * 40) + 10,
            pvc3: Math.floor(Math.random() * 40) + 10,
            pvs1: Math.floor(Math.random() * 30) + 5,
            pvs2: Math.floor(Math.random() * 30) + 5,
          }
        });
      }
    }
  }
  console.log('✅ Enrollment seeding complete!');
  console.log('✨ All mock data seeded successfully!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
