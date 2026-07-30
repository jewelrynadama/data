const fs = require('fs');
const readline = require('readline');

const transcriptPath = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\.system_generated\\logs\\transcript.jsonl';

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let stepIdx = 0;
  for await (const line of rl) {
    stepIdx++;
    if (line.includes('SUCCESSFULLY FETCHED') || line.includes('fetch_db.js')) {
      console.log(`Step ${stepIdx}: Match found!`);
      const tempPath = `C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch\\db_dump_${stepIdx}.txt`;
      fs.writeFileSync(tempPath, line);
      console.log(`Saved step to ${tempPath}`);
      
      // Let's print a part of it
      console.log(line.substring(0, 1000));
    }
  }
}

main().catch(console.error);
