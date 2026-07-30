const fs = require('fs');
const path = require('path');

const scratchDir = 'C:\\Users\\T470\\.gemini\\]antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch';

// Wait, the path has a typo `\\]`. Let's use the correct path:
const correctedScratchDir = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch';

function main() {
  const files = fs.readdirSync(correctedScratchDir);
  files.forEach(file => {
    if (file.startsWith('any_match_') && file.endsWith('.txt')) {
      const filePath = path.join(correctedScratchDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Look for the "newOrders" substring and print its surroundings
      const idx = content.indexOf('newOrders');
      if (idx !== -1) {
        console.log(`--- File: ${file} (length: ${content.length}) ---`);
        console.log(content.substring(idx - 100, idx + 1000));
      }
    }
  });
}

main();
