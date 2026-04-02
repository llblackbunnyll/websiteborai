const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing Prisma connection...');
    await prisma.$connect();
    console.log('✅ Connection successful!');
    
    // Check if tables exist by querying something
    const adminCount = await prisma.admin.count();
    console.log(`✅ Admin count: ${adminCount}`);
    
    const prCount = await prisma.pRItem.count();
    console.log(`✅ PR count: ${prCount}`);
    
    const personnelCount = await prisma.personnel.count();
    console.log(`✅ Personnel count: ${personnelCount}`);
    
  } catch (err) {
    console.error('❌ Connection failed!');
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
