const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(cors());
app.get('/debug', async (req, res) => {
    if (!waClient) return res.send('no client');
    try {
        const chats = await waClient.getAllChats();
        const mappedChats = await Promise.all(chats.filter(c => !c.isGroup).map(async c => {
            let phoneNumber = null;
            if (c.id._serialized.includes('@lid')) {
               try {
                  if (c.contact?.id?.user && !String(c.contact.id.user).includes('@lid') && c.contact.id.server === 'c.us') {
                      phoneNumber = c.contact.id.user;
                  } else if (typeof waClient.getPnLidEntry === 'function') {
                      const pnInfo = await waClient.getPnLidEntry(c.id._serialized);
                      if (pnInfo && pnInfo.phoneNumber && pnInfo.phoneNumber.id) {
                          phoneNumber = String(pnInfo.phoneNumber.id);
                      }
                  }
               } catch (e) {}
            }
            let name = c.contact?.name || c.contact?.pushname || c.id._serialized;
            return {
              id: c.id._serialized,
              phoneNumber: phoneNumber,
              name: name,
              timestamp: c.t || 0,
              unreadCount: c.unreadCount || 0,
              isGroup: c.isGroup,
              lastMessage: {
                 body: c.lastReceivedKey?.id || 'Pesan',
                 type: 'chat',
                 timestamp: c.t || 0
              }
            };
        }));
        
        res.json({ success: true, chats: mappedChats });
    } catch (e) {
        res.send(e.toString());
    }
});

app.get('/debug_messages', async (req, res) => {
    if (!waClient) return res.send('no client');
    try {
        const chatId = req.query.chatId || '622150996855@c.us';
        const messages = await waClient.getMessages(chatId, { count: 3 });
        const debugMsgs = messages.map(msg => {
            const allKeys = Object.keys(msg);
            const result = {};
            for (const key of allKeys) {
                const val = msg[key];
                if (val === null || val === undefined || val === '' || val === false) continue;
                if (typeof val === 'string' && val.length > 300) {
                    result[key] = val.substring(0, 100) + '...[truncated, length=' + val.length + ']';
                } else if (typeof val === 'object') {
                    try { result[key] = JSON.parse(JSON.stringify(val)); } catch(e) { result[key] = '[object]'; }
                } else {
                    result[key] = val;
                }
            }
            return result;
        });
        res.json(debugMsgs);
    } catch (e) {
        res.send(e.toString());
    }
});

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 50 * 1024 * 1024, // 50 MB
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let whatsappStatus = 'DISCONNECTED';
let currentQR = '';
let waClient = null;

async function startClient() {
  try {
    waClient = await wppconnect.create({
      session: 'pearl-crm',
      catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
        whatsappStatus = 'WAITING_FOR_SCAN';
        currentQR = urlCode || base64Qr;
        console.log('Emitting QR. urlCode provided?', !!urlCode, 'Length:', currentQR.length);
        io.emit('wa_status', { status: whatsappStatus, qr: currentQR });
        console.log('QR code received, waiting for scan...');
      },
      statusFind: (statusSession, session) => {
        console.log('Status Session: ', statusSession); // return isLogged || notLogged || browserClose || qrReadSuccess || qrReadFail || autocloseCalled || desconnectedMobile || deleteToken
        if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess' || statusSession === 'inChat') {
          whatsappStatus = 'CONNECTED';
          currentQR = '';
          io.emit('wa_status', { status: whatsappStatus, qr: currentQR });
          console.log('WhatsApp Client is ready!');
        } else if (statusSession === 'browserClose' || statusSession === 'autocloseCalled') {
          whatsappStatus = 'DISCONNECTED';
          currentQR = '';
          io.emit('wa_status', { status: whatsappStatus, qr: currentQR });
        }
      },
      autoClose: 0,
      puppeteerOptions: {
        executablePath: process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    whatsappStatus = 'CONNECTED';
    currentQR = '';
    io.emit('wa_status', { status: whatsappStatus, qr: currentQR });
    console.log('WhatsApp Authenticated and Ready!');

    waClient.onMessage(async (msg) => {
      try {
        if (msg.isGroupMsg) return;

        let senderName = msg.sender?.name || msg.sender?.pushname || msg.sender?.shortName || msg.from;
        
        let base64 = null;
        const hasInteractiveMedia = (msg.type === 'interactive' || msg.interactiveType) && msg.interactiveHeader?.hasMediaAttachment;
        if (msg.isMedia || msg.type === 'image' || msg.type === 'video' || msg.type === 'document' || hasInteractiveMedia) {
            try {
                base64 = await waClient.downloadMedia(msg.id);
            } catch (err) {
                console.error('Failed to download media for msg', msg.id, err);
            }
        }
        
        // For interactive messages (Shopee, etc.): body contains base64 image, caption contains text
        let extractedBody = '';
        let footer = '';
        let buttons = [];
        
        if (msg.type === 'interactive' || msg.interactiveType) {
            if (!base64 && msg.body && typeof msg.body === 'string' && msg.body.startsWith('/9j/')) {
                base64 = `data:image/jpeg;base64,${msg.body}`;
            }
            extractedBody = msg.caption || '';
            footer = msg.footer || '';
            if (msg.interactivePayload?.buttons) {
                buttons = msg.interactivePayload.buttons.map(btn => {
                    try {
                        const params = JSON.parse(btn.buttonParamsJson || '{}');
                        return { text: params.display_text || btn.name, url: params.landing_page_url || params.url || '' };
                    } catch(e) { return { text: btn.name, url: '' }; }
                });
            }
        } else if (msg.type === 'image' || msg.isMedia) {
            extractedBody = msg.caption || '';
        } else {
            extractedBody = msg.body || msg.caption || '';
        }

        console.log('Incoming message from', senderName, ':', extractedBody.length > 50 ? extractedBody.substring(0, 50) + '...' : (extractedBody || '[Media]'));

        io.emit('wa_message_received', {
            from: msg.from,
            to: msg.to,
            senderName: senderName,
            body: extractedBody,
            timestamp: msg.t,
            type: msg.type,
            base64: base64,
            footer: footer,
            buttons: buttons
        });
      } catch (err) {
        console.error('Error handling onMessage:', err);
      }
    });

  } catch (error) {
    console.error('Failed to create wppconnect client:', error);
    whatsappStatus = 'DISCONNECTED';
    io.emit('wa_status', { status: whatsappStatus, qr: '' });
    console.log('Retrying in 5 seconds...');
    setTimeout(startClient, 5000);
  }
}

startClient();

io.on('connection', (socket) => {
  console.log('A frontend client connected:', socket.id);
  
  socket.emit('wa_status', { status: whatsappStatus, qr: currentQR });
  
  socket.on('check_status', () => {
    socket.emit('wa_status', { status: whatsappStatus, qr: currentQR });
  });

  socket.on('get_chats', async (callback) => {
    if (whatsappStatus !== 'CONNECTED' || !waClient) {
      return callback({ success: false, error: 'WhatsApp not connected' });
    }
    try {
      const chats = await waClient.getAllChats();
      
      const mappedChats = await Promise.all(chats.filter(c => !c.isGroup).map(async c => {
        let phoneNumber = null;
        let pnContactName = null;
        if (c.id._serialized.includes('@lid')) {
           try {
              if (c.contact?.id?.user && !String(c.contact.id.user).includes('@lid') && c.contact.id.server === 'c.us') {
                  phoneNumber = c.contact.id.user;
              } else if (typeof waClient.getPnLidEntry === 'function') {
                  const pnInfo = await waClient.getPnLidEntry(c.id._serialized);
                  if (pnInfo && pnInfo.phoneNumber && pnInfo.phoneNumber.id) {
                      phoneNumber = String(pnInfo.phoneNumber.id);
                  } else if (pnInfo && pnInfo.phoneNumber) {
                      phoneNumber = String(pnInfo.phoneNumber);
                  }
                  if (pnInfo && pnInfo.contact) {
                      pnContactName = pnInfo.contact.name || pnInfo.contact.verifiedName || pnInfo.contact.pushname;
                  }
              }
           } catch (e) {}
        }
        
        let name = c.contact?.name || c.contact?.verifiedName || c.contact?.pushname || pnContactName || phoneNumber || c.id._serialized;
        
        return {
          id: c.id._serialized,
          phoneNumber: phoneNumber,
          name: name,
          timestamp: c.t || 0,
          unreadCount: c.unreadCount || 0,
          isGroup: c.isGroup,
          lastMessage: {
             body: c.lastReceivedKey?.id || 'Pesan',
             type: 'chat',
             timestamp: c.t || 0
          }
        };
      }));
      
      callback({ success: true, chats: mappedChats });
    } catch (err) {
      console.error('Failed to get chats:', err);
      callback({ success: false, error: err.message });
    }
  });

  socket.on('get_messages', async ({ chatId, limit = 50 }, callback) => {
    if (whatsappStatus !== 'CONNECTED' || !waClient) {
      return callback({ success: false, error: 'WhatsApp not connected' });
    }
    try {
      // Mark chat as read
      waClient.sendSeen(chatId).catch(() => {});
      
      const messages = await waClient.getMessages(chatId, { count: limit });
      
      const mappedMessages = await Promise.all(messages.map(async msg => {
        let senderName = '';
        if (!msg.fromMe) {
            senderName = msg.sender?.name || msg.sender?.pushname || msg.from;
        }
        
        let status = 'PENDING';
        if (msg.ack === 3) status = 'READ';
        else if (msg.ack === 2) status = 'DELIVERED';
        else if (msg.ack === 1) status = 'SENT';

        let base64 = null;
        const hasInteractiveMedia = (msg.type === 'interactive' || msg.interactiveType) && msg.interactiveHeader?.hasMediaAttachment;
        if (msg.isMedia || msg.type === 'image' || msg.type === 'video' || msg.type === 'document' || hasInteractiveMedia) {
            try {
                base64 = await waClient.downloadMedia(msg.id);
            } catch (err) { }
        }

        // For interactive messages (Shopee, etc.): body contains base64 image, caption contains text
        let extractedBody = '';
        let footer = '';
        let buttons = [];
        
        if (msg.type === 'interactive' || msg.interactiveType) {
            // If downloadMedia failed, fall back to body thumbnail
            if (!base64 && msg.body && typeof msg.body === 'string' && msg.body.startsWith('/9j/')) {
                base64 = `data:image/jpeg;base64,${msg.body}`;
            }
            extractedBody = msg.caption || '';
            footer = msg.footer || '';
            // Extract CTA buttons
            if (msg.interactivePayload?.buttons) {
                buttons = msg.interactivePayload.buttons.map(btn => {
                    try {
                        const params = JSON.parse(btn.buttonParamsJson || '{}');
                        return { text: params.display_text || btn.name, url: params.landing_page_url || params.url || '' };
                    } catch(e) { return { text: btn.name, url: '' }; }
                });
            }
        } else if (msg.type === 'image' || msg.isMedia) {
            extractedBody = msg.caption || '';
        } else {
            extractedBody = msg.body || msg.caption || '';
        }

        return {
            id: msg.id,
            fromMe: msg.fromMe,
            body: extractedBody,
            timestamp: msg.t,
            from: msg.from,
            to: msg.to,
            type: msg.type || 'chat',
            status: status,
            senderName: senderName,
            base64: base64,
            footer: footer,
            buttons: buttons
        };
      }));
      
      callback({ success: true, messages: mappedMessages });
    } catch (err) {
      console.error('Failed to get messages for chat:', chatId, err);
      callback({ success: false, error: err.message });
    }
  });

  socket.on('delete_message', async ({ chatId, messageId, onlyLocal = false }, callback) => {
    if (whatsappStatus !== 'CONNECTED' || !waClient) {
      return callback({ success: false, error: 'WhatsApp not connected' });
    }
    try {
      await waClient.deleteMessage(chatId, messageId, onlyLocal);
      callback({ success: true });
    } catch (err) {
      console.error('Failed to delete message:', err);
      callback({ success: false, error: err.message });
    }
  });

  socket.on('clear_chat', async ({ chatId }, callback) => {
    if (whatsappStatus !== 'CONNECTED' || !waClient) {
      return callback({ success: false, error: 'WhatsApp not connected' });
    }
    try {
      await waClient.clearChat(chatId);
      callback({ success: true });
    } catch (err) {
      console.error('Failed to clear chat:', err);
      callback({ success: false, error: err.message });
    }
  });

  socket.on('delete_chat', async ({ chatId }, callback) => {
    if (whatsappStatus !== 'CONNECTED' || !waClient) {
      return callback({ success: false, error: 'WhatsApp not connected' });
    }
    try {
      await waClient.deleteChat(chatId);
      callback({ success: true });
    } catch (err) {
      console.error('Failed to delete chat:', err);
      callback({ success: false, error: err.message });
    }
  });

  socket.on('send_message', async ({ to, message }, callback) => {
    if (whatsappStatus !== 'CONNECTED' || !waClient) {
      return callback({ success: false, error: 'WhatsApp not connected' });
    }
    try {
      const response = await waClient.sendText(to, message);
      callback({
        success: true,
        message: {
          id: response.id,
          body: message,
          timestamp: Math.floor(Date.now() / 1000),
          fromMe: true,
          status: 'SENT'
        }
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      callback({ success: false, error: err.message });
    }
  });

  socket.on('send_media', async ({ to, base64, filename, mimeType }, callback) => {
    console.log(`Received send_media for ${to}, filename: ${filename}, mime: ${mimeType}, base64 length: ${base64?.length}`);
    if (whatsappStatus !== 'CONNECTED' || !waClient) {
      return callback({ success: false, error: 'WhatsApp not connected' });
    }
    try {
      let response;
      if (mimeType && mimeType.startsWith('image/')) {
         console.log('Sending as image...');
         response = await waClient.sendImageFromBase64(to, base64, filename, '');
      } else {
         console.log('Sending as file...');
         response = await waClient.sendFileFromBase64(to, base64, filename, '');
      }
      console.log('Send media response:', response);
      callback({
        success: true,
        message: {
          id: response.id || Date.now().toString(),
          body: `[File Terkirim: ${filename}]`,
          timestamp: Math.floor(Date.now() / 1000),
          fromMe: true,
          status: 'SENT'
        }
      });
    } catch (err) {
      console.error('Failed to send media:', err);
      callback({ success: false, error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Frontend client disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
