const xlsx = require('xlsx');
const { splitThaiName } = require('../utils/nameSplitter');
const fs = require('fs');

const filePath = 'd:/websiteborai/รายชื่อบุคลากร และข้อมูลของสถานศึกษา.xls';

async function testImport() {
  try {
    const buffer = fs.readFileSync(filePath);
    
    let content;
    const isHtml = buffer.slice(0, 100).toString('ascii').toLowerCase().includes('<html') ||
                   buffer.slice(0, 100).toString('ascii').toLowerCase().includes('<!doctype');
    
    if (isHtml) {
      const decoder = new TextDecoder('windows-874');
      content = decoder.decode(buffer);
    } else {
      content = buffer;
    }

    const workbook = xlsx.read(content, { type: isHtml ? 'string' : 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`Total rows found: ${rawData.length}`);
    
    // Skip 3 rows like in api.js logic (index 3 is where the first real data starts in my previous view)
    const dataRows = rawData.slice(3);
    const sample = dataRows.slice(0, 5);
    const results = [];

    for (const [idx, row] of sample.entries()) {
      if (!row || row.length < 3) continue;

      const rawFullName = String(row[2] || '').trim();
      const rawLastName = String(row[3] || '').trim();
      const rawPos = String(row[18] || '').trim();
      const rawAcad = String(row[19] || '').trim();
      const rawPhone = String(row[21] || '').trim();
      const rawDuties = String(row[53] || '').trim();

      const { prefix, firstName, lastName } = splitThaiName(`${rawFullName} ${rawLastName}`.trim());
      
      let dutiesCount = 0;
      if (rawDuties) {
        dutiesCount = rawDuties.split('\n').filter(Boolean).length;
      }

      results.push({
        origName: rawFullName,
        origLast: rawLastName,
        split: { prefix, firstName, lastName },
        pos: rawPos,
        acad: rawAcad,
        phonePosNum: rawPhone,
        dutiesCount
      });
    }

    console.log('--- Import Test Results (First 5 Actual Data Rows) ---');
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Test failed:', err);
  }
}

testImport();
