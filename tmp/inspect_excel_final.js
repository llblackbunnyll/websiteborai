const fs = require('fs');
const xlsx = require('xlsx');

const filePath = 'd:/websiteborai/รายชื่อบุคลากร และข้อมูลของสถานศึกษา.xls';

try {
  const buffer = fs.readFileSync(filePath);
  const decoder = new TextDecoder('windows-874');
  const content = decoder.decode(buffer);
  
  const workbook = xlsx.read(content, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  console.log('--- Full Row Inspection (Rows 0-10) ---');
  for (let i = 0; i < 10; i++) {
    const row = rawData[i];
    if (!row) {
        console.log(`Row ${i}: EMPTY`);
        continue;
    }
    console.log(`Row ${i} length: ${row.length}`);
    row.forEach((val, idx) => {
        if (val !== null && val !== undefined && val !== '') {
            console.log(`  [${idx}]: ${val}`);
        }
    });
    console.log('---------------------------');
  }

} catch (err) {
  console.error('Error:', err);
}
