const fs = require('fs');
const readline = require('readline');

const transcriptPath = 'C:\\Users\\T470\\.gemini\\antigravity\\brain\\0923bc33-7f34-4040-ab77-f39bbb4e2375\\.system_generated\\logs\\transcript.jsonl';

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('wa-') && line.length > 1000) {
      console.log('Line length:', line.length);
      try {
        const parsed = JSON.parse(line);
        console.log('Keys:', Object.keys(parsed));
        if (parsed.type) console.log('Type:', parsed.type);
        
        // Print snippet of content or tool_calls
        if (parsed.content) {
          console.log('Content snippet:', parsed.content.substring(0, 500));
        }
        if (parsed.tool_calls) {
          console.log('Tool calls snippet:', JSON.stringify(parsed.tool_calls).substring(0, 500));
        }
      } catch (e) {
        console.log('Failed to parse line:', e.message);
      }
      console.log('-------------------------------------------');
    }
  }
}

main().catch(console.error);
