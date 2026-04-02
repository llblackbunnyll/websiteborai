const fs = require('fs');

const filePath = 'd:/websiteborai/รายชื่อบุคลากร และข้อมูลของสถานศึกษา.xls';

try {
  const buf = fs.readFileSync(filePath);
  
  // Try to find the charset in the first 2KB
  const head = buf.slice(0, 2048).toString('ascii');
  console.log('--- File Head ---');
  console.log(head);
  
  const charsetMatch = head.match(/charset=([^"'>\s]+)/i);
  console.log('Detected Charset:', charsetMatch ? charsetMatch[1] : 'None');
  
  // Test decoding with windows-874 if possible
  try {
    const decoder = new TextDecoder('windows-874');
    const decoded = decoder.decode(buf.slice(0, 5000));
    console.log('--- Decoded Sample (windows-874) ---');
    console.log(decoded.slice(0, 1000));
  } catch (e) {
    console.log('windows-874 TextDecoder not supported');
  }

} catch (err) {
  console.error('Error:', err);
}
