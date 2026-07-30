const fs = require('fs');
const path = 'src/pages/SettingsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacements = {
  'ðŸŽ‚': '🎂',
  'ðŸŽ‰': '🎉',
  'ðŸ’Ž': '💎',
  'âœ¨': '✨',
  'ðŸ›¡ï¸ ': '🛡️',
  'ðŸ” ': '🔍',
  'ðŸ“±': '📱',
  'ðŸ“¸': '📸',
  'ðŸŽ ': '🎁'
};

for (const [bad, good] of Object.entries(replacements)) {
  content = content.split(bad).join(good);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed encoding in SettingsPage.tsx');
