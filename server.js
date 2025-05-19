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

// Store user names and their socket IDs
const users = new Map();

// Socket.IO connection
io.on('connection', (socket) => {
  // Handle user joining with name
  socket.on('join', (name) => {
    if (name && typeof name === 'string' && name.trim()) {
      users.set(socket.id, name.trim());
      logger.info(`User ${name} connected: ${socket.id}`);
      // Send updated user list to all clients
      io.emit('user list', Array.from(users.values()));
      io.emit('chat message', { type: 'system', content: `${name} has joined the chat` });
    } else {
      socket.emit('error', 'Invalid name');
    }
  });

  // Handle private messages
  socket.on('private message', ({ target, content, mediaType, mediaData }) => {
    const senderName = users.get(socket.id);
    const targetSocketId = [...users.entries()].find(([id, name]) => name === target)?.[0];
    if (targetSocketId) {
      const timestamp = new Date().toISOString();
      const formattedMsg = {
        type: mediaType ? 'media' : 'user',
        name: senderName,
        content: content || (mediaType === 'image' ? 'Image' : 'Voice note'),
        timestamp,
        senderId: socket.id,
        targetId: targetSocketId,
        mediaType,
        mediaData
      };
      logger.info(`Private message from ${senderName} to ${target}: ${content || mediaType}`);
      io.to(targetSocketId).emit('chat message', formattedMsg); // Send to target
      socket.emit('chat message', formattedMsg); // Echo back to sender
    } else {
      socket.emit('error', 'User not found');
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const name = users.get(socket.id) || 'Anonymous';
    logger.info(`User ${name} disconnected: ${socket.id}`);
    users.delete(socket.id);
    io.emit('user list', Array.from(users.values()));
    io.emit('chat message', { type: 'system', content: `${name} has left the chat` });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});