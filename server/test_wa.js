const { Client, LocalAuth } = require('whatsapp-web.js');
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './wa_session' }),
  puppeteer: {
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});
client.on('ready', async () => {
    console.log('Client is ready!');
    try {
        const chats = await window.WWebJS.getChats();
    } catch (e) {
        // ignore
    }
    const chats = await client.getChats();
    console.log('Chats fetched:', chats.length);
    process.exit(0);
});
client.initialize();
