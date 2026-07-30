const fs = require('fs');
const path = 'src/pages/SettingsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/ðŸ›¡ï¸ /g, '🛡️');
content = content.replace(/ðŸ” /g, '🔍');
content = content.replace(/ðŸŽ /g, '🎁');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed remaining encoding in SettingsPage.tsx');
