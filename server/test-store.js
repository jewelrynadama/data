const io = require('socket.io-client');
const socket = io('http://localhost:3001');
socket.on('connect', () => {
  socket.emit('get_chats', (response) => {
    console.log(JSON.stringify(response.chats, null, 2));
    process.exit(0);
  });
});
