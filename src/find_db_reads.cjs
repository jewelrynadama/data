const fs = require('fs');
const path = require('path');

const tasksDir = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\.system_generated\\tasks';

function main() {
  const files = fs.readdirSync(tasksDir);
  files.forEach(file => {
    if (file.endsWith('.log')) {
      const filePath = path.join(tasksDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      const idx = content.indexOf('newOrders');
      if (idx !== -1) {
        // Find if it has array elements by looking for "mapValue" or objects
        console.log(`newOrders keyword found in log file: ${file} (size: ${content.length})`);
        
        // Print snippet around the match
        const snippet = content.substring(idx - 50, idx + 600);
        console.log("Snippet:");
        console.log(snippet);
        console.log("-----------------------------------------");
      }
    }
  });
}

main();
