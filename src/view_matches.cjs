const fs = require('fs');
const path = require('path');

const scratchDir = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch';

function main() {
  const files = fs.readdirSync(scratchDir);
  files.forEach(file => {
    if (file.startsWith('any_match_') && file.endsWith('.txt')) {
      const filePath = path.join(scratchDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.toLowerCase().includes('lisa') || content.toLowerCase().includes('wulandari') || content.toLowerCase().includes('dayu juli')) {
        console.log(`Found name in file: ${file}`);
        console.log(content.substring(0, 1000));
      }
    }
  });
}

main();
