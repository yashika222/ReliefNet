const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*'}
  });
  io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
  });
}

function emitUrgentAlert(payload) {
  if (io) {
    io.emit('urgent_alert', payload);
  }
}

module.exports = { initSocket, emitUrgentAlert };
