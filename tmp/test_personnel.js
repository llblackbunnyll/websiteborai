const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing Personnel creation...');
    const newPerson = await prisma.personnel.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        position: 'Teacher',
        duties: ['Duty 1', 'Duty 2'],
        phone: '0812345678',
        order: 1
      }
    });
    console.log('✅ Personnel created successful!');
    console.log(newPerson);
  } catch (err) {
    console.error('❌ Creation failed!');
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
