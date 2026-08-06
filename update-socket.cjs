const fs = require('fs');
const files = [
  'c:/Users/T470/Downloads/DataCustomer/customer-dashboard/src/pages/WhatsAppInboxPage.tsx',
  'c:/Users/T470/Downloads/DataCustomer/customer-dashboard/src/pages/WhatsAppScannerPage.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const replaceStr = `
    let apiUrl = 'http://localhost:3001';
    try {
      const savedSettings = localStorage.getItem('pearlcrm_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.waApiUrl) apiUrl = parsed.waApiUrl;
      }
    } catch (e) {}
    const newSocket = io(apiUrl);
  `;
  content = content.replace(/const newSocket = io\('http:\/\/localhost:3001'\);/g, replaceStr);
  fs.writeFileSync(file, content);
});
console.log('socket urls updated');
