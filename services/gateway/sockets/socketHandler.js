export const socketHandler = io => {
  console.log('🔌 Socket handler initialized');
  io.on('connection', socket => {
    socket.emit('me', socket.id);

    // appointment room start
    socket.on('join-appointment-room', ({ doctor_uuid, date }) => {
      if (!doctor_uuid || !date) {
        console.warn('⚠️ Invalid room data');
        return;
      }

      const roomName = `${doctor_uuid}_${date}`;

      socket.join(roomName);

      socket.emit('room-joined', {
        room: roomName,
        message: `Listening for updates on ${date}`,
      });
    });

    socket.on('leave', ({ doctor_uuid, date }) => {
      if (!doctor_uuid || !date) {
        console.warn('⚠️ Invalid room data');
        return;
      }

      const roomName = `${doctor_uuid}_${date}`;

      socket.leave(roomName);
    });
    // appointment room end

    // start for doctor
    socket.on('doctor-room', ({ doctor_uuid, lastname }) => {
      if (!doctor_uuid) return;
      const roomName = `doctor-${doctor_uuid}-${lastname}`;

      console.log('doctor join the room: ', lastname, doctor_uuid);

      socket.join(roomName);
    });
    // end for doctor

    // start receptionist notification upon client booking
    socket.on('receptionist-join', ({ role, staff_uuid }) => {
      if (role !== 'receptionist' || !staff_uuid) return;

      const roomName = `${staff_uuid}_${role}`;

      socket.join(roomName);
    });
    socket.on('receptionist-notification', ({ role }) => {});
    // receptionist end

    socket.on('disconnect', () => {
      console.log('User disconnected: ', socket.id);
    });
  });
};
