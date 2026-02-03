import { Bed, Room, sequelize } from '../../../shared/models/index.js';

const seedBedManagement = async () => {
  const transaction = await sequelize.transaction();

  try {
    console.log('🏥 Starting Bed Management Seeding...');

    // Clear existing data (optional - for development)
    await Bed.destroy({ where: {}, transaction });
    await Room.destroy({ where: {}, transaction });

    // ==========================================================================
    // FLOOR 1 - GENERAL WARDS
    // ==========================================================================
    console.log('📍 Seeding Floor 1 - General Wards...');

    // General Ward Rooms (4-6 beds each)
    const ward101 = await Room.create(
      {
        room_number: '101',
        room_type: 'ward',
        floor_number: 1,
        department_id: 1, // Adjust based on your departments
        max_capacity: 6,
        is_operational: true,
      },
      { transaction },
    );

    // Create 6 beds for Ward 101
    const ward101Beds = [];
    for (let i = 1; i <= 6; i++) {
      ward101Beds.push({
        room_id: ward101.room_id,
        bed_number: `101-${i}`,
        bed_type: 'ward',
        bed_status: 'available',
        features: JSON.stringify(['adjustable', 'side_rails']),
        last_cleaned_at: new Date(),
      });
    }
    await Bed.bulkCreate(ward101Beds, { transaction });

    const ward102 = await Room.create(
      {
        room_number: '102',
        room_type: 'ward',
        floor_number: 1,
        department_id: 1,
        max_capacity: 6,
        is_operational: true,
      },
      { transaction },
    );

    const ward102Beds = [];
    for (let i = 1; i <= 6; i++) {
      ward102Beds.push({
        room_id: ward102.room_id,
        bed_number: `102-${i}`,
        bed_type: 'ward',
        bed_status: i <= 2 ? 'occupied' : 'available', // First 2 occupied
        features: JSON.stringify(['adjustable', 'side_rails']),
        last_cleaned_at: new Date(),
      });
    }
    await Bed.bulkCreate(ward102Beds, { transaction });

    const ward103 = await Room.create(
      {
        room_number: '103',
        room_type: 'ward',
        floor_number: 1,
        department_id: 1,
        max_capacity: 4,
        is_operational: true,
      },
      { transaction },
    );

    const ward103Beds = [];
    for (let i = 1; i <= 4; i++) {
      ward103Beds.push({
        room_id: ward103.room_id,
        bed_number: `103-${i}`,
        bed_type: 'ward',
        bed_status: 'available',
        features: JSON.stringify(['adjustable', 'side_rails']),
        last_cleaned_at: new Date(),
      });
    }
    await Bed.bulkCreate(ward103Beds, { transaction });

    // ==========================================================================
    // FLOOR 2 - SEMI-PRIVATE ROOMS
    // ==========================================================================
    console.log('📍 Seeding Floor 2 - Semi-Private Rooms...');

    const semiPrivateRooms = [
      { number: '201', beds: 2, occupied: 1 },
      { number: '202', beds: 2, occupied: 0 },
      { number: '203', beds: 2, occupied: 2 },
      { number: '204', beds: 2, occupied: 1 },
      { number: '205', beds: 2, occupied: 0 },
    ];

    for (const roomData of semiPrivateRooms) {
      const room = await Room.create(
        {
          room_number: roomData.number,
          room_type: 'semi_private',
          floor_number: 2,
          department_id: 2,
          max_capacity: roomData.beds,
          is_operational: true,
        },
        { transaction },
      );

      const beds = [];
      for (let i = 1; i <= roomData.beds; i++) {
        beds.push({
          room_id: room.room_id,
          bed_number: `${roomData.number}-${i}`,
          bed_type: 'semi_private',
          bed_status: i <= roomData.occupied ? 'occupied' : 'available',
          features: JSON.stringify([
            'adjustable',
            'side_rails',
            'privacy_curtain',
            'bedside_table',
          ]),
          last_cleaned_at: new Date(),
        });
      }
      await Bed.bulkCreate(beds, { transaction });
    }

    // ==========================================================================
    // FLOOR 3 - PRIVATE ROOMS
    // ==========================================================================
    console.log('📍 Seeding Floor 3 - Private Rooms...');

    const privateRooms = [
      { number: '301', status: 'available' },
      { number: '302', status: 'occupied' },
      { number: '303', status: 'available' },
      { number: '304', status: 'occupied' },
      { number: '305', status: 'available' },
      { number: '306', status: 'cleaning' },
      { number: '307', status: 'available' },
      { number: '308', status: 'occupied' },
    ];

    for (const roomData of privateRooms) {
      const room = await Room.create(
        {
          room_number: roomData.number,
          room_type: 'private',
          floor_number: 3,
          department_id: 3,
          max_capacity: 1,
          is_operational: true,
        },
        { transaction },
      );

      await Bed.create(
        {
          room_id: room.room_id,
          bed_number: `${roomData.number}-A`,
          bed_type: 'private',
          bed_status: roomData.status,
          features: JSON.stringify([
            'adjustable',
            'side_rails',
            'private_bathroom',
            'tv',
            'wifi',
            'visitor_chair',
            'bedside_table',
          ]),
          last_cleaned_at: new Date(),
        },
        { transaction },
      );
    }

    // ==========================================================================
    // FLOOR 4 - ICU (Intensive Care Unit)
    // ==========================================================================
    console.log('📍 Seeding Floor 4 - ICU...');

    const icuRooms = [
      { number: '401', status: 'occupied' },
      { number: '402', status: 'occupied' },
      { number: '403', status: 'available' },
      { number: '404', status: 'available' },
      { number: '405', status: 'occupied' },
      { number: '406', status: 'maintenance' },
    ];

    for (const roomData of icuRooms) {
      const room = await Room.create(
        {
          room_number: roomData.number,
          room_type: 'icu',
          floor_number: 4,
          department_id: 4, // ICU Department
          max_capacity: 1,
          is_operational: roomData.status !== 'maintenance',
        },
        { transaction },
      );

      await Bed.create(
        {
          room_id: room.room_id,
          bed_number: `ICU-${roomData.number}`,
          bed_type: 'icu',
          bed_status: roomData.status,
          features: JSON.stringify([
            'adjustable',
            'side_rails',
            'ventilator_support',
            'cardiac_monitor',
            'iv_poles',
            'isolation_capable',
            'central_monitoring',
          ]),
          last_cleaned_at: new Date(),
        },
        { transaction },
      );
    }

    // ==========================================================================
    // FLOOR 5 - ISOLATION ROOMS
    // ==========================================================================
    console.log('📍 Seeding Floor 5 - Isolation Rooms...');

    const isolationRooms = [
      { number: '501', status: 'available' },
      { number: '502', status: 'occupied' },
      { number: '503', status: 'available' },
      { number: '504', status: 'available' },
    ];

    for (const roomData of isolationRooms) {
      const room = await Room.create(
        {
          room_number: roomData.number,
          room_type: 'isolation',
          floor_number: 5,
          department_id: 5, // Infectious Disease Department
          max_capacity: 1,
          is_operational: true,
        },
        { transaction },
      );

      await Bed.create(
        {
          room_id: room.room_id,
          bed_number: `ISO-${roomData.number}`,
          bed_type: 'isolation',
          bed_status: roomData.status,
          features: JSON.stringify([
            'adjustable',
            'side_rails',
            'negative_pressure',
            'anteroom',
            'private_bathroom',
            'air_filtration',
            'sealed_environment',
          ]),
          last_cleaned_at: new Date(),
        },
        { transaction },
      );
    }

    await transaction.commit();

    // Summary
    const totalRooms = await Room.count();
    const totalBeds = await Bed.count();
    const availableBeds = await Bed.count({
      where: { bed_status: 'available' },
    });
    const occupiedBeds = await Bed.count({ where: { bed_status: 'occupied' } });

    console.log('\n✅ Bed Management Seeding Completed!');
    console.log('==========================================');
    console.log(`📊 Total Rooms: ${totalRooms}`);
    console.log(`🛏️  Total Beds: ${totalBeds}`);
    console.log(`✅ Available Beds: ${availableBeds}`);
    console.log(`🔴 Occupied Beds: ${occupiedBeds}`);
    console.log('==========================================\n');

    return {
      totalRooms,
      totalBeds,
      availableBeds,
      occupiedBeds,
    };
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error seeding bed management:', error);
    throw error;
  }
};

export default seedBedManagement;
