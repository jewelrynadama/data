const fs = require('fs');
const path = require('path');

const scratchDir = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch';

function main() {
  const files = fs.readdirSync(scratchDir);
  let bestFile = '';
  let maxOrders = 0;
  let bestOrdersList = null;

  files.forEach(file => {
    if (file.startsWith('any_match_') && file.endsWith('.txt')) {
      const filePath = path.join(scratchDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      try {
        // The file might contain a JSON line representing a step in transcript.jsonl
        const step = JSON.parse(content);
        
        // Let's search inside step for anything containing newOrders
        // We can inspect step.content, step.tool_calls, etc.
        const searchObj = (obj) => {
          if (!obj) return;
          if (typeof obj === 'string') {
            // Try to find a JSON substring inside the string
            const firstBrace = obj.indexOf('{');
            const lastBrace = obj.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              try {
                const inner = JSON.parse(obj.substring(firstBrace, lastBrace + 1));
                searchObj(inner);
              } catch (e) {}
            }
            // Try to find array
            const firstBracket = obj.indexOf('[');
            const lastBracket = obj.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
              try {
                const inner = JSON.parse(obj.substring(firstBracket, lastBracket + 1));
                searchObj(inner);
              } catch (e) {}
            }
          } else if (Array.isArray(obj)) {
            obj.forEach(searchObj);
          } else if (typeof obj === 'object') {
            if (obj.newOrders && Array.isArray(obj.newOrders) && obj.newOrders.length > 0) {
              if (obj.newOrders.length > maxOrders) {
                maxOrders = obj.newOrders.length;
                bestFile = file;
                bestOrdersList = obj.newOrders;
              }
            }
            if (obj.fields && obj.fields.newOrders && obj.fields.newOrders.arrayValue && obj.fields.newOrders.arrayValue.values) {
              const count = obj.fields.newOrders.arrayValue.values.length;
              if (count > maxOrders) {
                maxOrders = count;
                bestFile = file;
                // We'll have to parse the Firestore API format back to normal JSON
                bestOrdersList = obj.fields.newOrders.arrayValue.values;
              }
            }
            Object.values(obj).forEach(searchObj);
          }
        };

        searchObj(step);
      } catch (e) {
        // Not valid JSON
      }
    }
  });

  console.log(`Best file: ${bestFile}`);
  console.log(`Max orders found: ${maxOrders}`);
  if (bestOrdersList) {
    const backupPath = path.join(scratchDir, 'recovered_orders.json');
    fs.writeFileSync(backupPath, JSON.stringify(bestOrdersList, null, 2));
    console.log(`Saved recovered orders to ${backupPath}`);
  }
}

main();
