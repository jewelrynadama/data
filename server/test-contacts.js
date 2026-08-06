const io = require('socket.io-client');
const fs = require('fs');
const socket = io('http://localhost:3001');
socket.on('connect', () => {
  socket.emit('get_contacts', (response) => {
    try {
      const basic = response.contacts.map(c => c.id);
      fs.writeFileSync('contacts.json', JSON.stringify(basic, null, 2));
      process.exit(0);
    } catch(e) {
      console.error(e);
      process.exit(1);
    }
  });
});
