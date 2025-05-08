const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const winston = require('winston');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/app.log' }),
    new winston.transports.Console()
  ]
});

// Serve static files
app.use(express.static('public'));

// Store user names
const users = new Map();

// Socket.IO connection
io.on('connection', (socket) => {
  // Handle user joining with name
  socket.on('join', (name) => {
    if (name && typeof name === 'string' && name.trim()) {
      users.set(socket.id, name.trim());
      logger.info(`User ${name} connected: ${socket.id}`);
      io.emit('chat message', { type: 'system', content: `${name} has joined the chat` });
    } else {
      socket.emit('error', 'Invalid name');
    }
  });

  // Broadcast message to all clients
  socket.on('chat message', (msg) => {
    const name = users.get(socket.id) || 'Anonymous';
    if (msg && msg.content) {
      const timestamp = new Date().toISOString();
      const formattedMsg = { 
        type: msg.type || 'user', 
        name, 
        content: msg.content, 
        timestamp, 
        senderId: socket.id,
        mediaType: msg.mediaType,
        mediaData: msg.mediaData
      };
      logger.info(`Message from ${name} (${socket.id}): ${msg.type} - ${msg.content || msg.mediaType}`);
      io.emit('chat message', formattedMsg);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const name = users.get(socket.id) || 'Anonymous';
    logger.info(`User ${name} disconnected: ${socket.id}`);
    io.emit('chat message', { type: 'system', content: `${name} has left the chat` });
    users.delete(socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});