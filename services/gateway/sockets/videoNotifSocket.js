export const videoCallSocket = io => {
  const videoSessions = new Map();

  const userPeerMapping = new Map();

  io.on('connection', socket => {
    console.log('🎥 Video call socket connected:', socket.id);

    // user connection and registration

    /**
     * Register user for video calling
     * Payload: { userId, name, role, peerId }
     */
    socket.on('video:register', data => {
      const { userId, name, role, peerId } = data;

      const finalPeerId = peerId || socket.id;

      userPeerMapping.set(socket.id, {
        socketId: socket.id,
        peerId: peerId,
        userId,
        name,
        role,
        inCall: false,
        connectedWith: null,
      });

      console.log(`✅ User registered for video: ${name} (${socket.id})`);

      socket.emit('video:registered', {
        socketId: socket.id,
        peerId: finalPeerId,
      });
    });

    // call initiate

    /**
     * Initiate a call to another user
     * Payload: { to, offer, from, callerInfo }
     */
    socket.on('video:call-user', async data => {
      const { to, offer, from, callerInfo } = data;

      console.log(`📞 Call initiated: ${from} → ${to}`);

      // check if the target user is online
      const targetUser = Array.from(userPeerMapping.values()).find(
        u => u.peerId === to || u.socketId === to
      );

      const callerUser = userPeerMapping.get(socket.id);

      if (!targetUser) {
        socket.emit('video:call-error', {
          error: 'User not found or offline',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      if (targetUser.inCall) {
        socket.emit('video:call-error', {
          error: 'User is busy',
          code: 'USER_BUSY',
        });
        return;
      }

      // Create session
      const sessionId = `${from}-${to}=${Date.now()}`;
      videoSessions.set(sessionId, {
        caller: from,
        callee: to,
        startTime: Date.now(),
        status: 'ringing',
      });

      // mark both users as 'in-call'
      const fromPeerId = from || callerUser?.peerId;
      if (callerUser) {
        callerUser.inCall = true;
        callerUser.connectedWith = to;
      }
      targetUser.inCall = true;
      targetUser.connectedWith = fromPeerId;

      io.to(targetUser.socketId).emit('video:call-incoming', {
        from: fromPeerId,
        offer,
        sessionId,
        callerInfo: callerInfo || {
          name: callerUser?.name,
          role: callerUser?.role,
        },
      });
      console.log(`🔔 Incoming call sent to ${targetUser.name}`);
    });

    // answer call

    /**
     * Answer an incoming call
     * Payload: { to, answer, sessionId }
     */
    socket.on('video:call-answered', data => {
      const { to, answer, sessionId } = data;

      console.log(`✅ Call answered: ${socket.id} → ${to}`);

      // update the session details
      const session = videoSessions.get(sessionId);
      if (session) {
        session.status = 'connected';
        session.connectedTime = Date.now();
      }

      // find the caller's socket
      const callerUser = Array.from(userPeerMapping.values()).find(
        u => u.peerId === to || u.socketId === to
      );

      if (callerUser) {
        io.to(callerUser.socketId).emit('video:call-accepted', {
          answer,
          sessionId,
        });
        console.log(`🎉 Call accepted notification sent to caller`);
      }
    });

    // call rejection

    /**
     * Reject an incoming call
     * Payload: { to, sessionId, reason }
     */
    socket.on('video:call-rejected', data => {
      const { to, sessionId, reason } = data;

      console.log(`❌ Call rejected: ${socket.id} → ${to}`);

      // update session
      const session = videoSessions.get(sessionId);
      if (session) {
        session.status = 'rejected';
        videoSessions.delete(sessionId);
      }

      // notify the caller
      const callerUser = Array.from(userPeerMapping.values()).find(
        u => u.peerId === to || u.socketId === to
      );
      if (callerUser) {
        callerUser.inCall = false;
        callerUser.connectedWith = null;

        io.to(callerUser.socketId).emit('video:call-rejected', {
          reason: reason || 'Call declined.',
          sessionId,
        });

        // update the current user status
        const currentUser = userPeerMapping.get(socket.id);
        if (currentUser) {
          currentUser.inCall = false;
          currentUser.connectedWith = null;
        }
      }
    });

    // ice candidates (webRTC connection info)

    /**
     * Exchange ICE candidates for WebRTC connection
     * Payload: { to, candidate }
     */
    socket.on('video:ice-candidate', data => {
      const { to, candidate } = data;

      const targetUser = Array.from(userPeerMapping.values()).find(
        u => u.peerId === to || u.socketId === to
      );

      if (targetUser) {
        const senderUser = userPeerMapping.get(socket.id);
        io.to(targetUser.socketId).emit('video:ice-candidate', {
          from: senderUser?.peerId || socket.id,
          candidate,
        });
        console.log(`🧊 ICE candidate forwarded: ${socket.id} → ${to}`);
      }
    });

    // end call

    /**
     * End an active call
     * Payload: { to, sessionId }
     */
    socket.on('video:end-call', data => {
      const { to, sessionId } = data;
      console.log(`📴 Call ended: ${socket.id} → ${to}`);

      handleCallEnd(socket.id, to, sessionId);
    });

    // quality report

    /**
     * Report call quality issues
     * Payload: { sessionId, quality, issues }
     */
    socket.on('video:quality-report', data => {
      const { sessionId, quality, issues } = data;

      console.log(`📊 Quality report for session ${sessionId}:`, {
        quality,
        issues,
      });
    });

    // media control events

    /**
     * Notify peer about media changes (mute/video off)
     * Payload: { to, type, enabled }
     */
    socket.on('video:media-change', data => {
      const { to, type, enabled } = data;

      const targetUser = Array.from(userPeerMapping.values()).find(
        u => u.peerId === to || u.socketId === to
      );
      if (targetUser) {
        io.to(targetUser.socketId).emit('video:peer-media-change', {
          from: socket.id,
          type, // audio or video
          enabled,
        });
        console.log(
          `🎛️ Media change: ${type} ${enabled ? 'enabled' : 'disabled'}`
        );
      }
    });

    // get online users
    socket.on('video:get-online-users', () => {
      const onlineUsers = Array.from(userPeerMapping.values())
        .filter(u => u.socketId !== socket.id)
        .map(u => ({
          peerId: u.peerId,
          socketId: u.socketId,
          name: u.name,
          role: u.role,
          inCall: u.inCall,
        }));

      socket.emit('video:online-users', onlineUsers);
    });

    // disconnect handler
    socket.on('disconnect', () => {
      console.log('🔌 Video call socket disconnected:', socket.id);

      const user = userPeerMapping.get(socket.id);
      if (user && user.connectedWith) {
        handleCallEnd(socket.id, user.connectedWith);
      }
      userPeerMapping.delete(socket.id);
    });

    // helper functions
    const handleCallEnd = (fromSocketId, toPeerId, sessionId) => {
      // find the target user
      const targetUser = Array.from(userPeerMapping.values()).find(
        u => u.peerId === toPeerId || u.socketId === toPeerId
      );

      if (sessionId) {
        const session = videoSessions.get(sessionId);

        if (session) {
          session.status = 'ended';
          session.endTime = Date.now();
          session.duration =
            session.endTime - (session.connectedTime || session.startTime);
        }
        // You can save this to database for call history
        console.log(`📊 Call session ended:`, {
          sessionId,
          duration: `${Math.floor(session.duration / 1000)}s`,
        });

        videoSessions.delete(sessionId);
      }

      if (targetUser) {
        io.to(targetUser.socketId).emit('video:call-ended', {
          from: fromSocketId,
        });

        targetUser.inCall = false;
        targetUser.connectedWith = null;
      }

      const currentUser = userPeerMapping.get(fromSocketId);
      if (currentUser) {
        currentUser.inCall = false;
        currentUser.connectedWith = null;
      }
    };

    // clean up & monitoring
    setInterval(() => {
      const now = Date.now();
      const STALE_TIMEOUT = 5 * 60 * 1000;

      for (const [sessionId, session] of videoSessions.entries()) {
        const sessionAge = now - session.startTime;
        if (sessionAge > STALE_TIMEOUT && session.status === 'ringing') {
          console.log(`🧹 Cleaning up stale session: ${sessionId}`);

          videoSessions.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000);

    console.log('🎥 Video call socket handler initialized');
  });
};
