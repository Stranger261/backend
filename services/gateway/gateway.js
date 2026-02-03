import http from 'http';
import pkg from 'http-proxy';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import { socketHandler } from './sockets/socketHandler.js';
import { videoCallSocket } from './sockets/videoCallSocket.js';

dotenv.config();

const { createProxyServer } = pkg;
const proxy = createProxyServer({});

// Map of route prefixes → internal microservice URLs
const routes = {
  // auth
  '/api/v1/auth': 'http://127.0.0.1:56731',
  '/api/v1/registration': 'http://127.0.0.1:56731',

  // patient
  '/api/v1/faceplusplus': 'http://127.0.0.1:56732',
  '/api/v1/address': 'http://127.0.0.1:56732',
  '/api/v1/person': 'http://127.0.0.1:56732',
  '/api/v1/patients': 'http://127.0.0.1:56732',
  '/api/v1/allergies': 'http://127.0.0.1:56732',
  '/api/v1/updatePerson': 'http://127.0.0.1:56732',
  '/api/v1/medical-records': 'http://127.0.0.1:56732',
  '/api/v1/care-team': 'http://127.0.0.1:56732',

  // appointment
  '/api/v1/doctors': 'http://127.0.0.1:56733',
  '/api/v1/appointments': 'http://127.0.0.1:56733',
  '/api/v1/dashboard': 'http://127.0.0.1:56733',
  '/api/v1/appointment-vitals': 'http://127.0.0.1:56733',
  '/api/v1/appointment-diagnosis': 'http://127.0.0.1:56733',
  '/api/v1/appointment-consultation': 'http://127.0.0.1:56733',
  '/api/v1/prescriptions': 'http://127.0.0.1:56733',
  '/api/v1/lab': 'http://127.0.0.1:56733',

  // ibms
  '/api/v1/bed': 'http://127.0.0.1:56734',
  '/api/v1/bedAssignment': 'http://127.0.0.1:56734',
  '/api/v1/progressNote': 'http://127.0.0.1:56734',
  '/api/v1/doctorAdmission': 'http://127.0.0.1:56734',
  '/api/v1/bedStats': 'http://127.0.0.1:56734',

  // er
  '/api/v1/er': 'http://127.0.0.1:56735',

  // notif
  '/api/v1/notifications': 'http://127.0.0.1:56737',

  // online
  '/api/v1/online-video': 'http://127.0.0.1:56738',

  // kiosk
  '/api/v1/kiosk': 'http://127.0.0.1:56739',
};

// CORS configuration
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://192.168.100.11:5173',
  'https://core1.health-ease-hospital.com',
  'https://kiosk.face-scan.health-ease-hospital.com',
  'https://kiosk-er.vercel.app',
  'https://kiosk-ass.vercel.app',
];

// CORS handler function
function handleCORS(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Cookie, x-internal-api-key, X-internal-Api-key, face-service-key',
    );
  }
}

// Create HTTP server for the gateway
const server = http.createServer((req, res) => {
  const url = req.url;

  // Handle CORS for all requests
  handleCORS(req, res);

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle socket emit endpoints from microservices
  if (url === '/api/v1/gateway/socket/emit-room' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const { room, event, data } = JSON.parse(body);
        io.to(room).emit(event, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
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
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  if (url === '/api/v1/gateway/socket/broadcast' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const { event, data } = JSON.parse(body);

        io.emit(event, data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
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

  // Proxy the request with CORS headers preserved
  proxy.web(
    req,
    res,
    {
      target,
      changeOrigin: true, // Important for CORS
      xfwd: true,
    },
    error => {
      console.error('Proxy error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Gateway internal error' }));
    },
  );
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy error' }));
  }
});

const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cookie',
      'x-internal-api-key',
      'X-internal-Api-key',
      'face-service-key',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  },
  transports: ['websocket', 'polling'],
});

io.engine.on('connection_error', err => {
  console.error('Socket.IO connection error:', err);
});

global.emitToRoom = (room, event, data) => {
  io.to(room).emit(event, data);
};

global.emitToSocket = (socketId, event, data) => {
  io.to(socketId).emit(event, data);
};

global.io = io;
videoCallSocket(io);
socketHandler(io);

const PORT = process.env.GATEWAY_PORT || 56741;

server.listen(PORT, () => {
  console.log(`🚀 JS API Gateway running on port ${PORT}`);
  console.log(`📡 Socket.IO listening on ws://localhost:${PORT}`);
});
