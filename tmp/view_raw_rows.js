const xlsx = require('xlsx');

const filePath = 'd:/websiteborai/รายชื่อบุคลากร และข้อมูลของสถานศึกษา.xls';

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log('--- Raw Rows (First 10) ---');
  json.slice(0, 10).forEach((row, i) => {
     console.log(`Row ${i}:`, JSON.stringify(row));
  });

} catch (err) {
  console.error('Error reading file:', err);
}
