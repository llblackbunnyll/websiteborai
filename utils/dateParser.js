/**
 * Thai & ISO Date Parser Utility
 * Parses Thai text date formats (e.g. '๑๕ มี.ค. ๒๕๖๗', '15 - 18 มีนาคม 2567'),
 * Thai numerals, date ranges, DD/MM/YYYY, or ISO YYYY-MM-DD strings into a valid JS Date object.
 */

function convertThaiNumeralsToArabic(str) {
  if (!str) return '';
  const thaiNums = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(thaiNums[i], 'g'), String(i));
  }
  return res;
}

function parseThaiOrIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  
  // Convert Thai digits [๐-๙] to Arabic digits [0-9]
  let trimmed = convertThaiNumeralsToArabic(dateStr).trim();
  if (!trimmed) return new Date();

  // Remove common prefix words like "วันที่", "ระหว่างวันที่", "ประจำวันที่", "พ.ศ."
  let cleanText = trimmed
    .replace(/(ระหว่าง|ประจำ)?วันที่\s*/g, '')
    .replace(/พ\.ศ\./g, '')
    .replace(/พศ\./g, '')
    .trim();

  // Handle Date Ranges e.g. "15 - 18 มี.ค. 2567" or "15-18 มีนาคม 2567" or "15 ถึง 18 มีนาคม 2567"
  // Keep only the start day (15) for sorting
  cleanText = cleanText.replace(/^(\d{1,2})\s*[\-\–\—\~ถึง]+\s*\d{1,2}\s+/, '$1 ');

  // 1. Check ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = cleanText.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    if (year > 2400) year -= 543;
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = cleanText.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2500;
    if (year > 2400) year -= 543;
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Thai Month names (full names first, then abbreviations)
  const thaiMonths = [
    { names: ['มกราคม', 'ม.ค.'], index: 0 },
    { names: ['กุมภาพันธ์', 'ก.พ.'], index: 1 },
    { names: ['มีนาคม', 'มี.ค.'], index: 2 },
    { names: ['เมษายน', 'เม.ย.'], index: 3 },
    { names: ['พฤษภาคม', 'พ.ค.'], index: 4 },
    { names: ['มิถุนายน', 'มิ.ย.'], index: 5 },
    { names: ['กรกฎาคม', 'ก.ค.'], index: 6 },
    { names: ['สิงหาคม', 'ส.ค.'], index: 7 },
    { names: ['กันยายน', 'ก.ย.'], index: 8 },
    { names: ['ตุลาคม', 'ต.ค.'], index: 9 },
    { names: ['พฤศจิกายน', 'พ.ย.'], index: 10 },
    { names: ['ธันวาคม', 'ธ.ค.'], index: 11 }
  ];

  for (const item of thaiMonths) {
    const matchedName = item.names.find(n => cleanText.includes(n));
    if (matchedName) {
      const mIndex = item.index;
      const parts = cleanText.split(/[\s,]+/);
      let yearPart = parts.find(p => /^\d{4}$/.test(p));
      let dayPart = parts.find(p => /^\d{1,2}$/.test(p) && p !== yearPart);
      
      if (!yearPart) {
        const remainingDigits = parts.filter(p => /^\d{1,2}$/.test(p));
        if (remainingDigits.length >= 2) {
          dayPart = remainingDigits[0];
          yearPart = remainingDigits[1];
        } else if (remainingDigits.length === 1) {
          dayPart = remainingDigits[0];
        }
      }

      let day = dayPart ? parseInt(dayPart, 10) : 1;
      let year = new Date().getFullYear();
      if (yearPart) {
        let parsedY = parseInt(yearPart, 10);
        if (parsedY < 100) parsedY += 2500;
        if (parsedY > 2400) parsedY -= 543;
        year = parsedY;
      }
      
      const d = new Date(Date.UTC(year, mIndex, day, 12, 0, 0));
      if (!isNaN(d.getTime())) return d;
    }
  }

  const fallback = new Date(cleanText);
  return !isNaN(fallback.getTime()) ? fallback : new Date();
}

/**
 * Converts a JS Date object to Thai string format e.g. '15 มี.ค. 2569'
 */
function formatThaiDate(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const day = dateObj.getUTCDate ? dateObj.getUTCDate() : dateObj.getDate();
  const thaiMonthsAbbr = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthIdx = dateObj.getUTCMonth ? dateObj.getUTCMonth() : dateObj.getMonth();
  const monthStr = thaiMonthsAbbr[monthIdx];
  const yearNum = dateObj.getUTCFullYear ? dateObj.getUTCFullYear() : dateObj.getFullYear();
  const year = yearNum + 543;
  return `${day} ${monthStr} ${year}`;
}

/**
 * Converts a JS Date object to ISO YYYY-MM-DD string format
 */
function formatIsoDate(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const y = dateObj.getUTCFullYear ? dateObj.getUTCFullYear() : dateObj.getFullYear();
  const m = String((dateObj.getUTCMonth ? dateObj.getUTCMonth() : dateObj.getMonth()) + 1).padStart(2, '0');
  const d = String(dateObj.getUTCDate ? dateObj.getUTCDate() : dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = {
  parseThaiOrIsoDate,
  formatThaiDate,
  formatIsoDate,
  convertThaiNumeralsToArabic
};
