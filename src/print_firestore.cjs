const http = require('https');
const fs = require('fs');

const url = 'https://firestore.googleapis.com/v1/projects/datacust-0404/databases/(default)/documents/store_data/pearlcrm';

http.get(url, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    fs.writeFileSync('C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch\\firestore_document.json', body);
    console.log("Downloaded Firestore document to firestore_document.json");
    try {
      const parsed = JSON.parse(body);
      if (parsed.fields) {
        console.log("newOrders field presence:", !!parsed.fields.newOrders);
        if (parsed.fields.newOrders) {
          console.log("newOrders value type:", Object.keys(parsed.fields.newOrders));
          if (parsed.fields.newOrders.arrayValue && parsed.fields.newOrders.arrayValue.values) {
            console.log("newOrders length:", parsed.fields.newOrders.arrayValue.values.length);
          } else {
            console.log("newOrders arrayValue.values is empty or undefined");
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  });
});
