const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCategories() {
  const categories = await prisma.pRItem.groupBy({
    by: ['category'],
    _count: {
      category: true,
    },
  });
  console.log('Categories:', JSON.stringify(categories, null, 2));
  await prisma.$disconnect();
}

checkCategories().catch(console.error);
