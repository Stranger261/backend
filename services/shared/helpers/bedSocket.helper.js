export const SOCKET_EVENTS = {
  // Bed Management Events
  BED_ASSIGNED: 'bed:assigned',
  BED_RELEASED: 'bed:released',
  BED_STATUS_CHANGED: 'bed:status_changed',
  BED_TRANSFERRED: 'bed:transferred',
  BED_CLEANED: 'bed:cleaned',
  BED_MAINTENANCE: 'bed:maintenance',

  // Room Updates
  ROOM_OCCUPANCY_UPDATED: 'room:occupancy_updated',
  FLOOR_STATS_UPDATED: 'floor:stats_updated',

  // Admission Events
  ADMISSION_CREATED: 'admission:created',
  ADMISSION_DISCHARGED: 'admission:discharged',

  // Join Rooms
  JOIN_BED_MANAGEMENT: 'join:bed_management',
  JOIN_FLOOR: 'join:floor',
  JOIN_ROOM: 'join:room',
  LEAVE_BED_MANAGEMENT: 'leave:bed_management',
};

export const SOCKET_ROOMS = {
  BED_MANAGEMENT: 'bed-management',
  FLOOR: floorNumber => `floor-${floorNumber}`,
  ROOM: roomId => `room-${roomId}`,
  ADMISSIONS: 'admissions',
};
