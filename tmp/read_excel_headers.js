const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'd:/websiteborai/รายชื่อบุคลากร และข้อมูลของสถานศึกษา.xls';

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  fs.writeFileSync('d:/websiteborai/tmp/excel_headers.json', JSON.stringify(json, null, 2), 'utf8');
  console.log('JSON written to d:/websiteborai/tmp/excel_headers.json');
} catch (err) {
  console.error('Error reading file:', err);
}
