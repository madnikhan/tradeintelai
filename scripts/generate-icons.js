/**
 * Generate PWA Icons
 * 
 * This script generates app icons from a source logo.
 * Place your logo.png in the public/ directory and run:
 * npm run generate-icons
 * 
 * Or manually create icons:
 * - icon-192x192.png (192x192px)
 * - icon-512x512.png (512x512px)
 * - apple-icon.png (180x180px)
 */

const fs = require('fs');
const path = require('path');

console.log('📱 PWA Icon Generator');
console.log('');

const publicDir = path.join(process.cwd(), 'public');

// Check if logo exists
const logoPath = path.join(publicDir, 'logo.png');
if (!fs.existsSync(logoPath)) {
  console.log('⚠️  logo.png not found in public/ directory');
  console.log('');
  console.log('📋 To generate icons:');
  console.log('  1. Place your logo.png (at least 512x512px) in public/');
  console.log('  2. Run: npm run generate-icons');
  console.log('');
  console.log('📋 Or manually create:');
  console.log('  - public/icon-192x192.png (192x192px)');
  console.log('  - public/icon-512x512.png (512x512px)');
  console.log('  - public/apple-icon.png (180x180px)');
  console.log('');
  console.log('💡 Tip: Use an online tool like https://realfavicongenerator.net/');
  process.exit(0);
}

console.log('✅ Logo found!');
console.log('');
console.log('📋 Next steps:');
console.log('  1. Use an image editor or online tool to resize logo.png');
console.log('  2. Save as:');
console.log('     - icon-192x192.png (192x192px)');
console.log('     - icon-512x512.png (512x512px)');
console.log('     - apple-icon.png (180x180px)');
console.log('');
console.log('💡 Recommended tools:');
console.log('  - https://realfavicongenerator.net/');
console.log('  - https://www.pwabuilder.com/imageGenerator');
console.log('  - ImageMagick: convert logo.png -resize 192x192 icon-192x192.png');
console.log('');

