const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function testSharp() {
  try {
    console.log('Testing Sharp...');
    // Create a dummy buffer (1x1 transparent pixel)
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    
    const outputPath = path.join(__dirname, '..', 'tmp', 'test_sharp.webp');
    await sharp(buffer)
      .webp()
      .toFile(outputPath);
    
    console.log('✅ Sharp test successful! Saved to:', outputPath);
    fs.unlinkSync(outputPath);
  } catch (err) {
    console.error('❌ Sharp test failed!');
    console.error(err);
  }
}

testSharp();
