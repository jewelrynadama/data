const fs = require('fs');
const path = require('path');

const scratchDir = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch';

function searchObj(obj, filename) {
  if (!obj) return false;
  if (typeof obj === 'object') {
    if (obj.newOrders && Array.isArray(obj.newOrders) && obj.newOrders.length > 0) {
      console.log(`FOUND in ${filename}: newOrders count = ${obj.newOrders.length}`);
      console.log('Sample order:', JSON.stringify(obj.newOrders[0], null, 2));
      return true;
    }
    if (Array.isArray(obj)) {
      const hasWa = obj.some(item => item && item.id && String(item.id).startsWith('wa-'));
      if (hasWa) {
        console.log(`FOUND wa- array in ${filename}: count = ${obj.length}`);
        console.log('Sample item:', JSON.stringify(obj.find(item => item && item.id && String(item.id).startsWith('wa-')), null, 2));
        return true;
      }
      return obj.some(item => searchObj(item, filename));
    }
    return Object.values(obj).some(val => searchObj(val, filename));
  }
  return false;
}

function main() {
  const files = fs.readdirSync(scratchDir);
  files.forEach(file => {
    if (file.endsWith('.txt') || file.endsWith('.json')) {
      const filePath = path.join(scratchDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Try parsing as JSON
      try {
        const parsed = JSON.parse(content);
        searchObj(parsed, file);
      } catch (e) {
        // Try finding JSON inside text
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const parsed = JSON.parse(content.substring(firstBrace, lastBrace + 1));
            searchObj(parsed, file);
          } catch (e) {}
        }
        
        const firstBracket = content.indexOf('[');
        const lastBracket = content.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          try {
            const parsed = JSON.parse(content.substring(firstBracket, lastBracket + 1));
            searchObj(parsed, file);
          } catch (e) {}
        }
      }
    }
  });
}

main();
