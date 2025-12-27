export const socketHandler = io => {
  console.log('🔌 Socket handler initialized');
  io.on('connection', socket => {
    console.log('User connected: ', socket.id);

    socket.on('join-bed-room', ({ roomNumber, floorNumber, placeName }) => {
      if (!roomNumber || !floorNumber || !placeName) {
        console.warn('⚠️ Invalid room data');
        return;
      }

      const roomName = `${placeName}_${floorNumber}_${roomNumber}`;

      socket.join(roomName);

      console.log(`👥 Socket ${socket.id} joined room: ${roomName}`);

      socket.emit('bed-room-joined', {
        room: roomName,
        message: `Listening for updates on ${date}`,
      });
    });

    socket.on('leave-bed-room', ({ roomNumber, floorNumber, placeName }) => {
      if (!roomNumber || !floorNumber || !placeName) {
        console.warn('⚠️ Invalid room data');
        return;
      }

      const roomName = `${placeName}_${floorNumber}_${roomNumber}`;

      socket.leave(roomName);

      console.log(`👋 Socket ${socket.id} left room: ${roomName}`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected: ', socket.id);
    });
  });
};
