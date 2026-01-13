import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:56741';

// Create two test clients
const client1 = io(SERVER_URL, {
  transports: ['websocket'],
});

const client2 = io(SERVER_URL, {
  transports: ['websocket'],
});

let client1PeerId = null;
let client2PeerId = null;

// Client 1 setup
client1.on('connect', () => {
  console.log('✅ Client 1 connected:', client1.id);

  client1.emit('video:register', {
    userId: 'user-1',
    name: 'Dr. Smith',
    role: 'doctor',
  });
});

client1.on('video:registered', data => {
  console.log('📝 Client 1 registered:', data);
  client1PeerId = data.peerId;
});

client1.on('video:incoming-call', data => {
  console.log('📞 Client 1 received call from:', data.from);
  console.log('📋 Offer:', data.offer);

  // Simulate answering after 2 seconds
  setTimeout(() => {
    console.log('✅ Client 1 answering call...');
    client1.emit('video:call-answered', {
      to: data.from,
      answer: { sdp: 'mock-answer-sdp', type: 'answer' },
      sessionId: data.sessionId,
    });
  }, 2000);
});

client1.on('video:call-accepted', data => {
  console.log('🎉 Client 1: Call was accepted!');
  console.log('📋 Answer:', data.answer);
});

client1.on('video:ice-candidate', data => {
  console.log('🧊 Client 1 received ICE candidate from:', data.from);
});

client1.on('video:call-ended', () => {
  console.log('📴 Client 1: Call ended');
});

// Client 2 setup
client2.on('connect', () => {
  console.log('✅ Client 2 connected:', client2.id);

  client2.emit('video:register', {
    userId: 'user-2',
    name: 'Patient John',
    role: 'patient',
  });
});

client2.on('video:registered', data => {
  console.log('📝 Client 2 registered:', data);
  client2PeerId = data.peerId;

  // Wait a bit, then initiate call to client 1
  setTimeout(() => {
    if (client1PeerId) {
      console.log(`\n📞 Client 2 calling Client 1 (${client1PeerId})...`);
      client2.emit('video:call-user', {
        to: client1PeerId,
        from: client2PeerId,
        offer: { sdp: 'mock-offer-sdp', type: 'offer' },
        callerInfo: {
          name: 'Patient John',
          role: 'patient',
        },
      });
    }
  }, 3000);
});

client2.on('video:call-accepted', data => {
  console.log('🎉 Client 2: Call was accepted!');

  // Simulate sending ICE candidates
  setTimeout(() => {
    console.log('🧊 Client 2 sending ICE candidate...');
    client2.emit('video:ice-candidate', {
      to: client1PeerId,
      candidate: { candidate: 'mock-ice-candidate', sdpMLineIndex: 0 },
    });
  }, 1000);

  // End call after 5 seconds
  setTimeout(() => {
    console.log('📴 Client 2 ending call...');
    client2.emit('video:end-call', {
      to: client1PeerId,
    });
  }, 5000);
});

client2.on('video:call-error', error => {
  console.error('❌ Client 2 call error:', error);
});

// Error handlers
client1.on('connect_error', err => {
  console.error('❌ Client 1 connection error:', err.message);
});

client2.on('connect_error', err => {
  console.error('❌ Client 2 connection error:', err.message);
});

// Keep script running
console.log('🧪 Starting video call test...\n');
