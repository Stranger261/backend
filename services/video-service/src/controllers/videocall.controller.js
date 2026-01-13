import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';

import videocallService from '../services/videocall.service.js';

export const getTodaysOnlineConsultation = asyncHandler(async (req, res) => {
  const userId = req.user?.staff_uuid || req.user.user_uuid;
  const role = req.user?.role;
  const filters = req.params;

  const todaysOnlineConsultation =
    await videocallService.getTodaysOnlineConsultation(userId, role, filters);

  messageSender(200, 'Success.', todaysOnlineConsultation, res);
});

export const createRoom = asyncHandler(async (req, res) => {
  const { appointmentId } = req.body;
  const { role } = req.user;
  const doctorId = role === 'doctor' ? req.user?.staff_id : null;

  const videoCallRoom = await videocallService.createRoom(
    appointmentId,
    doctorId
  );

  messageSender(
    201,
    'Video call room created successfully.',
    videoCallRoom,
    res
  );
});

export const getRoomDetails = asyncHandler(async (req, res) => {
  const { role } = req.user;
  const userId = role === 'doctor' ? req.user.staff_uuid : req.user.user_uuid;
  const { roomId } = req.params;

  const roomDetails = await videocallService.getRoomDetails(
    roomId,
    userId,
    role
  );

  messageSender(200, 'Fetch successfully.', roomDetails, res);
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const doctorId = req.user.staff_uuid;

  const deletedRoom = await videocallService.DeleteRoom(roomId, doctorId);

  messageSender(200, deletedRoom.message, {}, res);
});

export const joinRoom = asyncHandler(async (req, res) => {
  const userType = req.user.role;
  const userId = req.user.user_id;
  const { peerId, socketId } = req.body;
  const { roomId } = req.params;

  console.log(req.body);

  const joinedRoom = await videocallService.joinRoom(
    roomId,
    userId,
    userType,
    peerId,
    socketId
  );

  messageSender(200, 'Room joined successfully.', joinedRoom, res);
});

export const leaveRoom = asyncHandler(async (req, res) => {
  const userType = req.user.role;
  const userId = req.user.user_id;
  const { duration } = req.body;
  const { roomId } = req.params;

  const leftRoom = await videocallService.leaveRoom(
    roomId,
    userId,
    userType,
    duration
  );

  messageSender(200, 'Room left successfully.', leftRoom, res);
});

export const rejoinRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const userType = req.user.role;
  const userId = req.user.user_id;
  const { peerId, socketId } = req.body;

  const rejoinedRoom = await videocallService.rejoinRoom(
    roomId,
    userId,
    userType,
    peerId,
    socketId
  );

  messageSender(200, 'Rejoined room successfully.', rejoinedRoom, res);
});

export const userDisconnect = asyncHandler(async (req, res) => {
  const { socketId, userType, userId } = req.body;

  const finalUserId = userId || req.user?.user_id;
  const finalUserType = userType || req.user?.role;

  const disconnectedUser = await videocallService.userDisconnect(
    socketId,
    finalUserId,
    finalUserType
  );

  messageSender(200, 'User disconnected.', disconnectedUser, res);
});

export const getRoomStatus = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.user_id;
  const userType = req.user.role;

  const roomStatus = await videocallService.getRoomStatus(
    roomId,
    userId,
    userType
  );

  messageSender(200, 'Get room status successfully.', roomStatus, res);
});
