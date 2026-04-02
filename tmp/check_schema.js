const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    console.log('Checking PRItem table structure...');
    // Query RAW to see columns (MySQL specific)
    const columns = await prisma.$queryRawUnsafe("DESCRIBE PRItem");
    console.log('Columns in PRItem:');
    console.table(columns);
    
    console.log('Checking Personnel table structure...');
    const pColumns = await prisma.$queryRawUnsafe("DESCRIBE Personnel");
    console.log('Columns in Personnel:');
    console.table(pColumns);
  } catch (err) {
    console.error('❌ Schema check failed!');
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
