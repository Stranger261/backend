import axios from 'axios';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '../helpers/bedSocket.helper.js';

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

export const emitBedAssigned = async bedData => {
  const { bed_id, admission_id, room } = bedData;
  const tasks = [];

  tasks.push(
    emitToRoom(
      SOCKET_ROOMS.BED_MANAGEMENT,
      SOCKET_EVENTS.BED_ASSIGNED,
      bedData,
    ),
  );

  if (room?.floor_number) {
    tasks.push(
      emitToRoom(
        SOCKET_ROOMS.FLOOR(room.floor_number),
        SOCKET_EVENTS.FLOOR_STATS_UPDATED,
        { floor_number: room.floor_number, bed_id },
      ),
    );
  }

  if (room?.room_id) {
    tasks.push(
      emitToRoom(
        SOCKET_ROOMS.ROOM(room.room_id),
        SOCKET_EVENTS.ROOM_OCCUPANCY_UPDATED,
        { room_id: room.room_id, bed_id },
      ),
    );
  }

  tasks.push(
    broadcastToAll(SOCKET_EVENTS.BED_STATUS_CHANGED, {
      bed_id,
      new_status: 'occupied',
      admission_id,
    }),
  );

  await Promise.allSettled(tasks);
};

export const emitBedReleased = async bedData => {
  const { bed_id, admission_id, room } = bedData;
  const tasks = [];

  tasks.push(
    emitToRoom(
      SOCKET_ROOMS.BED_MANAGEMENT,
      SOCKET_EVENTS.BED_RELEASED,
      bedData,
    ),
  );

  if (room?.floor_number) {
    tasks.push(
      emitToRoom(
        SOCKET_ROOMS.FLOOR(room.floor_number),
        SOCKET_EVENTS.FLOOR_STATS_UPDATED,
        { floor_number: room.floor_number, bed_id },
      ),
    );
  }

  if (room?.room_id) {
    tasks.push(
      emitToRoom(
        SOCKET_ROOMS.ROOM(room.room_id),
        SOCKET_EVENTS.ROOM_OCCUPANCY_UPDATED,
        { room_id: room.room_id, bed_id },
      ),
    );
  }

  tasks.push(
    broadcastToAll(SOCKET_EVENTS.BED_STATUS_CHANGED, {
      bed_id,
      new_status: 'cleaning',
      admission_id,
    }),
  );

  await Promise.allSettled(tasks);
};

export const emitBedStatusChanged = async bedData => {
  const { bed_id, old_status, new_status, room } = bedData;
  const tasks = [];

  tasks.push(
    emitToRoom(
      SOCKET_ROOMS.BED_MANAGEMENT,
      SOCKET_EVENTS.BED_STATUS_CHANGED,
      bedData,
    ),
  );

  if (room?.floor_number) {
    tasks.push(
      emitToRoom(
        SOCKET_ROOMS.FLOOR(room.floor_number),
        SOCKET_EVENTS.FLOOR_STATS_UPDATED,
        { floor_number: room.floor_number },
      ),
    );
  }

  tasks.push(
    broadcastToAll(SOCKET_EVENTS.BED_STATUS_CHANGED, {
      bed_id,
      old_status,
      new_status,
    }),
  );

  await Promise.allSettled(tasks);
};

export const emitAdmissionCreated = async admissionData => {
  await Promise.allSettled([
    emitToRoom(
      SOCKET_ROOMS.ADMISSIONS,
      SOCKET_EVENTS.ADMISSION_CREATED,
      admissionData,
    ),
    emitToRoom(
      SOCKET_ROOMS.BED_MANAGEMENT,
      SOCKET_EVENTS.ADMISSION_CREATED,
      admissionData,
    ),
  ]);
};

export const emitAdmissionDischarged = async admissionData => {
  await Promise.allSettled([
    emitToRoom(
      SOCKET_ROOMS.ADMISSIONS,
      SOCKET_EVENTS.ADMISSION_DISCHARGED,
      admissionData,
    ),
    emitToRoom(
      SOCKET_ROOMS.BED_MANAGEMENT,
      SOCKET_EVENTS.ADMISSION_DISCHARGED,
      admissionData,
    ),
  ]);
};
