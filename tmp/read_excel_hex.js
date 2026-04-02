const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'd:/websiteborai/รายชื่อบุคลากร และข้อมูลของสถานศึกษา.xls';

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  const headers = json[0];
  console.log('Hex headers:');
  headers.forEach(h => {
    if (typeof h === 'string') {
      const buf = Buffer.from(h, 'binary');
      console.log(h, '->', buf.toString('hex'));
    } else {
      console.log(h);
    }
  });
} catch (err) {
  console.error('Error reading file:', err);
}
