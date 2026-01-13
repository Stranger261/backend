import axios from 'axios';

export const videoCallSocket = io => {
  const roomParticipants = new Map();
  const userRoomMapping = new Map();

  const VIDEO_SERVICE_URL = process.env.VIDEO_SERVICE_URL;

  io.on('connection', socket => {
    console.log('🎥 Video call socket connected:', socket.id);

    socket.on('video:register', data => {
      const { userId, name, role, peerId } = data;

      userRoomMapping.set(socket.id, {
        socketId: socket.id,
        peerId: peerId || socket.id,
        userId,
        name,
        role,
        roomId: null,
      });

      socket.emit('video:registered', {
        socketId: socket.id,
        peerId: peerId || socket.id,
      });
    });

    /**
     * Join a consultation room
     * Payload: { roomId }
     */
    socket.on('video:join-room', data => {
      const { roomId } = data;
      const user = userRoomMapping.get(socket.id);
      console.log('this is the user', user);

      console.log('================');
      console.log('joining');
      console.log('================');
      if (!user) {
        socket.emit('video:room-error', {
          error: 'User not registered',
          code: 'NOT_REGISTERED',
        });
        return;
      }
      console.log('================');
      console.log('joined');
      console.log('================');

      // Join the room
      socket.join(roomId);
      user.roomId = roomId;

      console.log('this is the participants before: ', roomParticipants);
      // Track participants
      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Set());
      }

      roomParticipants.get(roomId).add(socket.id);

      const participantsCount = roomParticipants.get(roomId).size;

      console.log('this is the participants after: ', roomParticipants);
      console.log(`✅ ${user.name} joined room: ${roomId}`);

      // Get other participants in the roo
      const participants = Array.from(roomParticipants.get(roomId)).map(id => {
        const participant = userRoomMapping.get(id);
        console.log(participant);

        return {
          socketId: participant.socketId,
          peerId: participant.peerId,
          userId: participant.userId,
          role: participant.role,
          name: participant.name,
        };
      });
      console.log(participants);

      io.to(roomId).emit('video:room-users-updated', {
        roomId,
        participants,
        participantsCount,
      });
    });

    socket.on('video:offer', data => {
      const { roomId, to, offer } = data;
      const sender = userRoomMapping.get(socket.id);

      console.log(`📤 Sending offer: ${sender?.name} → ${to}`);

      if (to) {
        // Send to specific user
        io.to(to).emit('video:offer', {
          from: socket.id,
          fromPeerId: sender?.peerId,
          fromName: sender?.name,
          offer,
          roomId,
        });
      } else {
        // Broadcast to room
        socket.to(roomId).emit('video:offer', {
          from: socket.id,
          fromPeerId: sender?.peerId,
          fromName: sender?.name,
          offer,
          roomId,
        });
      }
    });

    // ✅ ADDED: Handle WebRTC answer
    socket.on('video:answer', data => {
      const { roomId, to, answer } = data;
      const sender = userRoomMapping.get(socket.id);

      console.log(`📤 Sending answer: ${sender?.name} → ${to}`);

      if (to) {
        io.to(to).emit('video:answer', {
          from: socket.id,
          fromPeerId: sender?.peerId,
          fromName: sender?.name,
          answer,
          roomId,
        });
      } else {
        socket.to(roomId).emit('video:answer', {
          from: socket.id,
          fromPeerId: sender?.peerId,
          fromName: sender?.name,
          answer,
          roomId,
        });
      }
    });

    /**
     * Exchange ICE candidates (still needed for WebRTC)
     * Payload: { roomId, to, candidate }
     */
    socket.on('video:ice-candidate', data => {
      const { roomId, to, candidate } = data;

      if (to) {
        io.to(to).emit('video:ice-candidate', {
          from: socket.id,
          candidate,
          roomId,
        });
      } else {
        socket.to(roomId).emit('video:ice-candidate', {
          from: socket.id,
          candidate,
          roomId,
        });
      }
    });

    /**
     * Leave a room
     * Payload: { roomId }
     */
    socket.on('video:leave-room', data => {
      const { roomId } = data;
      handleLeaveRoom(socket.id, roomId);
    });

    /**
     * Media control events (mute/video)
     * Payload: { roomId, type, enabled }
     */
    socket.on('video:media-change', data => {
      const { roomId, type, enabled } = data;
      const user = userRoomMapping.get(socket.id);

      socket.to(roomId).emit('video:peer-media-change', {
        from: socket.id,
        peerId: user?.peerId,
        name: user?.name,
        role: user?.role,
        type,
        enabled,
      });
      console.log(
        `🎛️ ${user?.name} ${type} ${enabled ? 'enabled' : 'disabled'}`
      );
    });

    /**
     * Disconnect handler
     */
    socket.on('video:force-disconnect', async data => {
      const { socketId, userId, userType, roomId } = data;

      const user = userRoomMapping.get(socketId);

      if (user) {
        // Clean up room
        if (roomId) {
          handleLeaveRoom(socketId, roomId, true);
        }
      }

      try {
        await axios.patch(`${VIDEO_SERVICE_URL}/disconnected-user`, {
          socketId: socket.id,
          userId: user.userId,
          userType: user.role,
        });

        console.log(`✅ User ${userId} marked as disconnected in database`);
      } catch (error) {
        console.error('❌ Failed to mark user as disconnected:', error);
      }

      userRoomMapping.delete(socketId);
    });

    socket.on('disconnect', async () => {
      const user = userRoomMapping.get(socket.id);
      if (user && user.roomId) {
        console.log('thi is the url: ', VIDEO_SERVICE_URL);
        await axios.patch(`${VIDEO_SERVICE_URL}/disconnected-user`, {
          socketId: socket.id,
          userId: user.userId,
          userType: user.role,
        });
      }

      userRoomMapping.delete(socket.id);
    });

    const handleLeaveRoom = (socketId, roomId, isDisconnected = false) => {
      const user = userRoomMapping.get(socketId);

      if (!user) return;

      socket.leave(roomId);

      const participants = roomParticipants.get(roomId);
      if (participants) {
        participants.delete(socketId);

        const remainingCount = participants.size;

        socket.to(roomId).emit('video:user-left', {
          socketId,
          peerId: user.peerId,
          name: user.name,
          role: user.role,
          isDisconnected,
        });

        const remainingParticipant = Array.from(participants).map(id => {
          const participant = userRoomMapping.get(id);
          return {
            socketId: participant.socketId,
            peerId: participant.peerId,
            userId: participant.userId,
            name: participant.name,
            role: participant.role,
          };
        });

        socket.to(roomId).emit('video:room-users-updated', {
          roomId,
          participants: remainingParticipant,
          participantsCount: remainingCount,
        });

        if (remainingCount === 0) {
          roomParticipants.delete(roomId);
          console.log(`🗑️ Room ${roomId} deleted (empty)`);
        }
      }

      user.roomId = null;
    };
  });
};
