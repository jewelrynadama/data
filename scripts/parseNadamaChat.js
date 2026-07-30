// scripts/parseNadamaChat.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chatFilePath = 'C:\\Users\\T470\\Downloads\\WhatsApp Chat - Data Penjualan Nadama\\_chat.txt';

if (!fs.existsSync(chatFilePath)) {
  console.error('File chat tidak ditemukan di:', chatFilePath);
  process.exit(1);
}

console.log('Membaca file chat dari:', chatFilePath);
const rawText = fs.readFileSync(chatFilePath, 'utf8');

const lines = rawText.replace(/\r\n/g, '\n').split('\n');
console.log(`Total ${lines.length} baris dibaca.`);

// WA line regex: [DD/MM/YY, HH.MM.SS] Sender: Message
const WA_LINE_REGEX = /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})[,\s]+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)\]\s*(.+?):\s*(.*)$/;

const messages = [];
let currentMsg = null;
const senderCounts = {};

for (const line of lines) {
  const match = line.match(WA_LINE_REGEX);
  if (match) {
    if (currentMsg) {
      messages.push(currentMsg);
    }
    const [, dateStr, timeStr, sender, text] = match;
    const cleanSender = sender.replace(/[\u200e\u200f]/g, '').trim();
    senderCounts[cleanSender] = (senderCounts[cleanSender] || 0) + 1;
    currentMsg = {
      id: `msg_${messages.length + 1}`,
      dateStr: `${dateStr}, ${timeStr}`,
      sender: cleanSender,
      text: text.trim(),
    };
  } else if (currentMsg && line.trim()) {
    currentMsg.text += '\n' + line.trim();
  }
}
if (currentMsg) {
  messages.push(currentMsg);
}

console.log(`Total ${messages.length} pesan berhasil di-parse!`);
console.log('Pengirim yang terdeteksi:', senderCounts);

// Store file as JSON pre-parsed artifact for fast loading
const outDir = path.join(__dirname, '../public/data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outFile = path.join(outDir, 'nadama_chat.json');
fs.writeFileSync(outFile, JSON.stringify({
  fileName: '_chat.txt',
  totalMessages: messages.length,
  senders: senderCounts,
  messages: messages,
}, null, 2));

console.log('Saved parsed chat data to:', outFile);
