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
    if (line.includes('task-9478')) {
      console.log(`Step ${stepIdx}: Match found!`);
      const tempPath = `C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\scratch\\task_9478_output_${stepIdx}.txt`;
      fs.writeFileSync(tempPath, line);
      console.log(`Saved step to ${tempPath}`);
      console.log(line.substring(0, 1000));
    }
  }
}

main().catch(console.error);
