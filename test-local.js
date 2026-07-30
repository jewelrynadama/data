// test-local.js
import fs from 'fs';

function cleanDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  const slashParts = dateStr.split('/');
  if (slashParts.length === 3) {
    let day = slashParts[0].trim();
    let month = slashParts[1].trim();
    let year = slashParts[2].trim();
    if (year.length === 2) {
      year = '20' + year;
    }
    if (day.length === 1) day = '0' + day;
    if (month.length === 1) month = '0' + month;
    return `${year}-${month}-${day}`;
  }

  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

function filterChatByYear(chatText, selectedYear) {
  const yearSuffix = selectedYear.substring(2);
  const lines = chatText.split(/\r?\n/);
  const filteredLines = [];
  let isCurrentMessageInYear = false;

  const dateRegex = /^\[(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4}),/;

  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      const year = match[3];
      const matchYear = year.length === 4 ? year.substring(2) : year;
      if (matchYear === yearSuffix) {
        isCurrentMessageInYear = true;
        filteredLines.push(line);
      } else {
        isCurrentMessageInYear = false;
      }
    } else {
      if (isCurrentMessageInYear) {
        filteredLines.push(line);
      }
    }
  }
  return filteredLines.join('\n');
}

function chunkChatText(text, maxChunkSize = 40000) {
  const lines = text.split(/\r?\n/);
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const line of lines) {
    if (currentSize + line.length > maxChunkSize && currentChunk.length > 0 && line.trim().startsWith('[')) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(line);
    currentSize += line.length + 1;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }
  return chunks;
}

const rawText = fs.readFileSync("c:\\Users\\T470\\Downloads\\WhatsApp Chat - Data Penjualan Volla\\_chat.txt", "utf-8");
console.log("Raw text length:", rawText.length);

const cleanedText = rawText.replace(/[\u200e\u200f\u202a\u202b\u202c\ufeff\u200b\u200c\u200d]/g, '');
console.log("Cleaned text length:", cleanedText.length);

const filtered = filterChatByYear(cleanedText, "2026");
console.log("Filtered 2026 length:", filtered.length);
console.log("Filtered 2026 line count:", filtered.split('\n').length);

const chunks = chunkChatText(filtered, 40000);
console.log("Number of chunks:", chunks.length);
if (chunks.length > 0) {
  console.log("First chunk length:", chunks[0].length);
  console.log("First chunk snippet (first 10 lines):\n", chunks[0].split('\n').slice(0, 10).join('\n'));
  console.log("Last chunk snippet (first 10 lines):\n", chunks[chunks.length - 1].split('\n').slice(0, 10).join('\n'));
}
