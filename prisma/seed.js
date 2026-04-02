const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin
  const passwordHash = await bcrypt.hash('admin1234', 10);
  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      role: 'admin',
    },
  });
  console.log('✅ Admin user created (username: admin, password: admin1234)');

  // Seed sample PR items
  await prisma.pRItem.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'seed-pr-1',
        title: 'เปิดรับสมัครนักเรียนใหม่ ปีการศึกษา 2569',
        date: 'มี.ค. 2569',
        category: 'ประกาศ',
        image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800',
        content: 'วิทยาลัยการอาชีพบ่อไร่เปิดรับสมัครนักเรียนใหม่ระดับ ปวช. และ ปวส. ปีการศึกษา 2569',
      },
      {
        id: 'seed-pr-2',
        title: 'กิจกรรมวันสถาปนาวิทยาลัย ครบรอบ 30 ปี',
        date: 'ก.พ. 2569',
        category: 'กิจกรรม',
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800',
        content: 'จัดกิจกรรมฉลองครบรอบ 30 ปี วิทยาลัยการอาชีพบ่อไร่',
      },
      {
        id: 'seed-pr-3',
        title: 'นักเรียนคว้ารางวัลชนะเลิศการแข่งขันทักษะวิชาชีพ',
        date: 'ม.ค. 2569',
        category: 'กิจกรรม',
        image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=800',
        content: 'นักเรียนแผนกคอมพิวเตอร์คว้ารางวัลชนะเลิศการแข่งขันทักษะวิชาชีพระดับภาค',
      },
    ],
  });
  console.log('✅ Sample PR items created');

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
