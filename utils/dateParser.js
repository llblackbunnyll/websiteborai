/**
 * Thai & ISO Date Parser Utility
 * Parses Thai text date formats (e.g. '15 มี.ค. 2569', '15 มกราคม 2567'),
 * DD/MM/YYYY, or ISO YYYY-MM-DD strings into a valid JS Date object.
 */

function parseThaiOrIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  
  const trimmed = dateStr.trim();
  if (!trimmed) return new Date();

  // 1. Check ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    if (year > 2400) year -= 543;
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2500;
    if (year > 2400) year -= 543;
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Thai Month names (abbr & full)
  const thaiMonths = {
    'ม.ค.': 0, 'มกราคม': 0,
    'ก.พ.': 1, 'กุมภาพันธ์': 1,
    'มี.ค.': 2, 'มีนาคม': 2,
    'เม.ย.': 3, 'เมษายน': 3,
    'พ.ค.': 4, 'พฤษภาคม': 4,
    'มิ.ย.': 5, 'มิถุนายน': 5,
    'ก.ค.': 6, 'กรกฎาคม': 6,
    'ส.ค.': 7, 'สิงหาคม': 7,
    'ก.ย.': 8, 'กันยายน': 8,
    'ต.ค.': 9, 'ตุลาคม': 9,
    'พ.ย.': 10, 'พฤศจิกายน': 10,
    'ธ.ค.': 11, 'ธันวาคม': 11
  };

  const cleanText = trimmed.replace(/พ\.ศ\./g, '').trim();

  for (const [mName, mIndex] of Object.entries(thaiMonths)) {
    if (cleanText.includes(mName)) {
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

  const fallback = new Date(trimmed);
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
  formatIsoDate
};
