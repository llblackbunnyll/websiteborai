const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creating admin user...');
  const username = 'admin';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.upsert({
    where: { username: username },
    update: {
      passwordHash: passwordHash
    },
    create: {
      username: username,
      passwordHash: passwordHash,
      role: 'admin'
    }
  });
  console.log(`✅ Admin user: ${username}, Pass: ${password}`);

  // Seed default settings
  const defaultSettings = [
    { key: 'current_semester', value: '1' },
    { key: 'academic_year', value: '2567' }
  ];

  for (const s of defaultSettings) {
    await prisma.siteSettings.upsert({
      where: { key: s.key },
      update: {},
      create: s
    });
  }
  console.log('✅ Default settings initialized (1/2567)');
}

main()
  .catch((e) => {
    console.error('❌ Error creating admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
