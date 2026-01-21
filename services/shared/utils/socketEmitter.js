import axios from 'axios';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:56741';
console.log(GATEWAY_URL);

/**
 * Emit socket event through gateway
 * @param {string} room - Room name to emit
 * @param {string} event - Event name to emit
 * @param {object} data - Data to emit
 */

export const emitToRoom = async (room, event, data) => {
  try {
    await axios.post(`${GATEWAY_URL}/api/v1/gateway/socket/emit-room`, {
      room,
      event,
      data,
    });
  } catch (error) {
    console.log(error.stack || error);
    console.error('❌ Failed to emit socket event:', error.message);
  }
};

// for specified socket id
export const emitToSocket = async (socketId, event, data) => {
  try {
    await axios.post(`${GATEWAY_URL}/api/v1/gateway/socket/emit-socket`, {
      socketId,
      event,
      data,
    });
  } catch (error) {
    console.error('❌ Failed to emit socket event:', error.message);
  }
};

/**
 * Broadcast to ALL connected clients (use sparingly!)
 * Perfect for notifications that everyone should see
 */
export const broadcastToAll = async (event, data) => {
  try {
    await axios.post(`${GATEWAY_URL}/api/v1/gateway/socket/broadcast`, {
      event,
      data,
    });
  } catch (error) {
    console.error(`❌ Failed to broadcast ${event}:`, error.message);
  }
};

// Emit to multiple rooms at once
export const emitToMultipleRooms = async (rooms, event, data) => {
  try {
    const promises = rooms.map(room => emitToRoom(room, event, data));
    await Promise.all(promises);
  } catch (error) {
    console.error(`❌ Failed to emit multiple rooms ${event}:`, error.message);
  }
};
