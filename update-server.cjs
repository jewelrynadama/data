
const fs = require('fs');
let content = fs.readFileSync('c:/Users/T470/Downloads/DataCustomer/customer-dashboard/server/index.js', 'utf8');
content = content.replace(/socket\.on\('get_chats',/g, \socket.on('check_status', () => {
    socket.emit('wa_status', { status: whatsappStatus, qr: currentQR });
  });

  socket.on('get_chats',\);
fs.writeFileSync('c:/Users/T470/Downloads/DataCustomer/customer-dashboard/server/index.js', content);

