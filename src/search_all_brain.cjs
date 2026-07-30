const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

function main() {
  walkDir(brainDir, (filePath) => {
    if (filePath.endsWith('.log') || filePath.endsWith('.jsonl') || filePath.endsWith('.txt') || filePath.endsWith('.json')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('Lisa Herliana')) {
        console.log(`Found "Lisa Herliana" in: ${filePath} (length: ${content.length})`);
        // If it's a JSON file, parse and print
        if (filePath.endsWith('.json')) {
          console.log('File Content:', content);
        } else {
          const idx = content.indexOf('Lisa Herliana');
          console.log('Snippet:', content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 500)));
        }
        console.log('======================================================');
      }
    }
  });
}

main();
