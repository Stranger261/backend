import http from 'http';
import pkg from 'http-proxy';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import { socketHandler } from './sockets/socketHandler.js';
import { json } from 'stream/consumers';

dotenv.config();

const { createProxyServer } = pkg;
const proxy = createProxyServer({});
// Map of route prefixes → internal microservice URLs
const routes = {
  '/api/v1/auth': 'http://127.0.0.1:56731',
  '/api/v1/registration': 'http://127.0.0.1:56731',
  '/api/v1/faceplusplus': 'http://127.0.0.1:56732',
  '/api/v1/address': 'http://127.0.0.1:56732',
  '/api/v1/person': 'http://127.0.0.1:56732',
  '/api/v1/doctors': 'http://127.0.0.1:56733',
  '/api/v1/appointments': 'http://127.0.0.1:56733',
  '/api/v1/notifications': 'http://127.0.0.1:56737',
};

// Create HTTP server for the gateway
const server = http.createServer((req, res) => {
  const url = req.url;

  // Handle socket emit endpoints from microservices
  if (url === '/api/v1/gateway/socket/emit-room' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const { room, event, data } = JSON.parse(body);
        io.to(room).emit(event, data);
        console.log(`📤 Emitted ${event} to room ${room}`);
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  if (url === '/api/v1/gateway/socket/emit-socket' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const { socketId, event, data } = JSON.parse(body);
        io.to(socketId).emit(event, data);
        console.log(`📤 Emitted ${event} to room ${socketId}`);
        req.writeHead(200, { 'Content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // Find the matching route prefix
  const route = Object.keys(routes).find(prefix => url.startsWith(prefix));
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Route not found in gateway' }));
  }
  const target = routes[route];
  proxy.web(req, res, { target }, error => {
    console.error('🚨 Gateway proxy error:', error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gateway internal error' }));
  });
});

const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: [
      'http://localhost:5173',
      'http://192.168.100.11:5173',
      'https://core1.health-ease-hospital.com',
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'UPDATE'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.engine.on('connection_error', err => {
  console.error('❌ Socket connection error:', err.message);
});

global.emitToRoom = (room, event, data) => {
  console.log(`📤 Emitting ${event} to room ${room}:`, data);
  io.to(room).emit(event, data);
};

global.emitToSocket = (socketId, event, data) => {
  console.log(`📤 Emitting ${event} to socket ${socketId}:`, data);
  io.to(socketId).emit(event, data);
};

global.io = io;
socketHandler(io);

const PORT = process.env.GATEWAY_PORT || 56741;

server.listen(PORT, () => {
  console.log(`🚀 JS API Gateway running on port ${PORT}`);
  console.log(`📡 Socket.IO listening on ws://localhost:${PORT}`);
});
