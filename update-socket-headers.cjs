
const fs = require('fs');
const files = [
  'c:/Users/T470/Downloads/DataCustomer/customer-dashboard/src/pages/WhatsAppInboxPage.tsx',
  'c:/Users/T470/Downloads/DataCustomer/customer-dashboard/src/pages/WhatsAppScannerPage.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const newSocket = io\(apiUrl\);/g, \const newSocket = io(apiUrl, {
      extraHeaders: {
        'Bypass-Tunnel-Reminder': 'true'
      }
    });\);
  fs.writeFileSync(file, content);
});
console.log('socket headers updated');

