const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const multer  = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const PORT = process.env.PORT || 3000;

// Multer Storage: Dateien landen in /public/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Statische Dateien in /public bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// File Upload Endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if(req.file) {
    res.json({ success: true, fileUrl: '/uploads/' + req.file.filename });
  } else {
    res.json({ success: false });
  }
});

// In-Memory-Speicher für Chat-Nachrichten
let messages = [];

// Auto-Cleanup: Nachrichten, die älter als 24 Stunden sind, alle Minute entfernen
setInterval(() => {
  const now = Date.now();
  messages = messages.filter(msg => now - msg.time < 24 * 60 * 60 * 1000);
}, 60 * 1000);

io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;
    // Vorherige Nachrichten aus diesem Raum an den neuen User senden
    messages.filter(m => m.room === room)
      .forEach(m => socket.emit('message', `${m.username}: ${m.text}`));
    io.to(room).emit('message', `${username} ist dem Chat beigetreten.`);
  });
  
  socket.on('chatMessage', (msg) => {
    const messageObj = { username: socket.username, room: socket.room, text: msg, time: Date.now() };
    messages.push(messageObj);
    io.to(socket.room).emit('message', `${socket.username}: ${msg}`);
  });
  
  socket.on('disconnect', () => {
    io.to(socket.room).emit('message', `${socket.username} hat den Chat verlassen.`);
  });
});

server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
