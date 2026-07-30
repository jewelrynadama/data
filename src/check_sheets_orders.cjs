const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2elLCDbnJsEuXpde2jZ-4Mj_1AghwCk6hJjxfD7ZQduWsfZjH02cJjr2afGrEvNo3T3ZUk1D-cUkH/pub?gid=0&single=true&output=csv';

function fetchUrl(targetUrl) {
  https.get(targetUrl, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      fetchUrl(res.headers.location);
      return;
    }
    
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      const lines = body.split('\n');
      console.log("Searching in sheets CSV...");
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('lisa') || line.toLowerCase().includes('wulandari') || line.toLowerCase().includes('dayu juli')) {
          console.log(`Row ${idx}: ${line}`);
        }
      });
    });
  }).on('error', (e) => {
    console.error("HTTP Error:", e);
  });
}

fetchUrl(url);
