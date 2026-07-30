const fs = require('fs');
const Papa = require('papaparse');

const filePath = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\.system_generated\\steps\\12759\\content.md';
const content = fs.readFileSync(filePath, 'utf8');

// strip metadata
const csvText = content.split('---')[1].trim();

const parsed = Papa.parse(csvText, {
  header: false
});

const data = parsed.data;

for (let i = 0; i < data.length; i++) {
  // column 7 is WA
  if (data[i] && data[i].length > 7) {
    let phone = data[i][7];
    if (phone && typeof phone === 'string' && /[0-9]/.test(phone) && phone.toLowerCase() !== 'wa') {
      phone = phone.replace(/[^0-9+]/g, '');
      if (phone.startsWith('0')) {
        phone = '+62' + phone.substring(1);
      } else if (phone.startsWith('62')) {
        phone = '+' + phone;
      } else if (phone.length > 5 && !phone.startsWith('+')) {
        phone = '+62' + phone;
      }
      data[i][7] = phone;
    }
  }
}

const outCsv = Papa.unparse(data);
const outPath = 'C:\\Users\\T470\\Desktop\\Data_Customer_WA_Cleaned.csv';
fs.writeFileSync(outPath, outCsv);
console.log('Successfully saved to ' + outPath);
