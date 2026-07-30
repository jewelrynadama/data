const fs = require('fs');
const path = require('path');

const tasksDir = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\.system_generated\\tasks';

function main() {
  const files = fs.readdirSync(tasksDir);
  let matchCount = 0;

  files.forEach(file => {
    if (file.endsWith('.log')) {
      const filePath = path.join(tasksDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      const searchObj = (obj) => {
        if (!obj) return false;
        if (typeof obj === 'object') {
          if (obj.newOrders && Array.isArray(obj.newOrders) && obj.newOrders.length > 0) {
            console.log(`FOUND valid newOrders in ${file}: count = ${obj.newOrders.length}`);
            fs.writeFileSync(`C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch\\recovered_from_${file}.json`, JSON.stringify(obj.newOrders, null, 2));
            return true;
          }
          if (obj.fields && obj.fields.newOrders && obj.fields.newOrders.arrayValue && obj.fields.newOrders.arrayValue.values) {
            const count = obj.fields.newOrders.arrayValue.values.length;
            if (count > 0) {
              console.log(`FOUND valid Firestore fields.newOrders in ${file}: count = ${count}`);
              fs.writeFileSync(`C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch\\recovered_fields_from_${file}.json`, JSON.stringify(obj.fields.newOrders.arrayValue.values, null, 2));
              return true;
            }
          }
          return Object.values(obj).some(searchObj);
        }
        if (typeof obj === 'string' && (obj.includes('{') || obj.includes('['))) {
          try {
            const parsed = JSON.parse(obj);
            return searchObj(parsed);
          } catch (e) {
            // Find JSON substrings
            const firstBrace = obj.indexOf('{');
            const lastBrace = obj.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              try {
                const inner = JSON.parse(obj.substring(firstBrace, lastBrace + 1));
                if (searchObj(inner)) return true;
              } catch (e) {}
            }
          }
        }
        return false;
      };

      try {
        const parsed = JSON.parse(content);
        searchObj(parsed);
      } catch (e) {
        // Try to parse substrings or do regex search
        const idx = content.indexOf('newOrders');
        if (idx !== -1) {
          // console.log(`newOrders substring found in ${file}`);
          // Let's search if it contains any items
          const arrayValueIdx = content.indexOf('arrayValue', idx);
          if (arrayValueIdx !== -1 && arrayValueIdx - idx < 200) {
            const valuesIdx = content.indexOf('values', arrayValueIdx);
            if (valuesIdx !== -1 && valuesIdx - arrayValueIdx < 200) {
              console.log(`Potential non-empty newOrders in raw text of ${file}`);
              // Try to parse the parent JSON
              const start = content.lastIndexOf('{', idx);
              const end = content.indexOf('}', valuesIdx);
              if (start !== -1 && end !== -1 && end > start) {
                try {
                  const sub = JSON.parse(content.substring(start, end + 1));
                  searchObj(sub);
                } catch (e) {}
              }
            }
          }
        }
      }
    }
  });

  console.log("Done scanning all log files.");
}

main();
