const fs = require('fs');
const path = require('path');
const readline = require('readline');

const transcriptPath = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\.system_generated\\logs\\transcript.jsonl';

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let matchCount = 0;
  for await (const line of rl) {
    if (line.includes('"newOrders"') && (line.includes('customerName') || line.includes('namaInstagram'))) {
      matchCount++;
      console.log(`Match #${matchCount}: Line length = ${line.length}`);
      // Write matches to a temporary file for analysis
      const tempPath = `C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch\\match_${matchCount}.txt`;
      fs.writeFileSync(tempPath, line);
      console.log(`Saved match to ${tempPath}`);
    }
  }
  console.log(`Completed search. Total matches found: ${matchCount}`);
}

main().catch(console.error);
