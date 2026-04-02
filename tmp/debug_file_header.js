const fs = require('fs');

const filePath = 'd:/websiteborai/รายชื่อบุคลากร และข้อมูลของสถานศึกษา.xls';

try {
  const buf = fs.readFileSync(filePath, { length: 200 });
  console.log('Hex dump (First 100 bytes):');
  console.log(buf.slice(0, 100).toString('hex'));
  console.log('--- String representation (various encodings) ---');
  console.log('UTF8:', buf.slice(0, 100).toString('utf8'));
  console.log('ASCII:', buf.slice(0, 100).toString('ascii'));
} catch (err) {
  console.error('Error reading file:', err);
}
