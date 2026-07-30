const fs = require('fs');
const path = require('path');

const tasksDir = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\.system_generated\\tasks';
const targetNames = ['Lisa Herliana', 'Ary Wulandari', 'Dayu Juli', 'Karina', 'Liza Napitupulu'];

function main() {
  const files = fs.readdirSync(tasksDir);
  files.forEach(file => {
    if (file.endsWith('.log') || file.endsWith('.txt')) {
      const filePath = path.join(tasksDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      targetNames.forEach(name => {
        if (content.includes(name)) {
          console.log(`Found "${name}" in file: ${file} (length: ${content.length})`);
          // Print a snippet around the match
          const idx = content.indexOf(name);
          console.log('Snippet:', content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 500)));
          console.log('======================================================');
        }
      });
    }
  });
}

main();
