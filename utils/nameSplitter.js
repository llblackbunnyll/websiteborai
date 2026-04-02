/**
 * Thai Name Splitter Utility
 * Splits combined full names into Prefix, First Name, and Last Name.
 */

const THAI_PREFIXES = [
  'นาย', 'นางสาว', 'นาง', 
  'เด็กชาย', 'เด็กหญิง',
  'พระมหา', 'พระ',
  'ดร.', 'ศาสตราจารย์', 'ศ.', 'รองศาสตราจารย์', 'รศ.', 'ผู้ช่วยศาสตราจารย์', 'ผศ.',
  'พลเอก', 'พลโท', 'พลตรี', 'พันเอก', 'พันโท', 'พันตรี', 'ร้อยเอก', 'ร้อยโท', 'ร้อยตรี',
  'พลตำรวจเอก', 'พลตำรวจโท', 'พลตำรวจตรี', 'พันตำรวจเอก', 'พันตำรวจโท', 'พันตำรวจตรี', 'ร้อยตำรวจเอก', 'ร้อยตำรวจโท', 'ร้อยตำรวจตรี',
  'ว่าที่ร้อยตรี', 'ว่าที่ ร.ต.', 'ว่าที่ร้อยโท', 'ว่าที่ร้อยเอก',
  'หม่อมราชวงศ์', 'ม.ร.ว.', 'หม่อมหลวง', 'ม.ล.'
];

/**
 * Splits a Thai full name into prefix, first name, and last name.
 * @param {string} fullName 
 * @returns {object} { prefix, firstName, lastName }
 */
function splitThaiName(fullName) {
  if (!fullName) return { prefix: '', firstName: '', lastName: '' };

  let cleanName = fullName.trim().replace(/\s+/g, ' ');
  let prefix = '';
  let firstName = '';
  let lastName = '';

  // 1. Try to extract prefix
  for (const pf of THAI_PREFIXES) {
    if (cleanName.startsWith(pf)) {
      prefix = pf;
      cleanName = cleanName.substring(pf.length).trim();
      break;
    }
  }

  // 2. Split remaining by space
  const parts = cleanName.split(' ');
  if (parts.length >= 2) {
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  } else if (parts.length === 1) {
    firstName = parts[0];
  }

  return { prefix, firstName, lastName };
}

module.exports = { splitThaiName };
