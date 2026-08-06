const fs = require('fs');
let found = 0;
for (const file of fs.readdirSync('./baileys_auth_info')) {
  if (file.startsWith('session') || file.startsWith('pre-key') || file.startsWith('app-state')) {
     const content = fs.readFileSync('./baileys_auth_info/' + file, 'utf-8');
     if (content.includes('@lid') && content.includes('@s.whatsapp.net')) {
         console.log('File with lid and s.whatsapp.net:', file);
         found++;
     }
  }
}
if (!found) console.log('No mapping found in auth info');
