import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';

import sequelize from '../../shared/config/db.config.js';
import app from './app.js';
import { socketHandler } from './sockets/socketHandler.js';

dotenv.config();

const PORT = process.env.PORT || 56734;
const server = http.createServer(app);

const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: [
      'https://core1.health-ease-hospital.com',
      'http://localhost:5173',
      'http://192.168.100.11:5173',
    ],
  },
});

io.engine.on('connection_error', err => {
  console.error('❌ Socket connection error: ', err.message);
});

global.io = io;
socketHandler(io);

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force: false });
      console.log('✅ Database synced.');
    }

    server.listen(PORT, () => {
      console.log(`IBMS server is working at PORT: ${PORT}`);
    });
  } catch (error) {
    console.log('START ERROR: ', error);
  }
})();
