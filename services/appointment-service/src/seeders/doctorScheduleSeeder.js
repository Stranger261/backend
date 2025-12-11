// seeders/doctorScheduleSeeder.js
/**
 * DOCTOR SCHEDULE SEEDER
 * Creates 3-month recurring schedules for all H Vill Hospital doctors
 * Based on actual hospital schedule as of March 2025
 */

import sequelize from '../../../shared/config/db.config.js';
import {
  Staff,
  Person,
  Department,
  DoctorSchedule,
} from '../../../shared/models/index.js';
import { Op } from 'sequelize';

// Schedule data from H Vill Hospital
const hospitalSchedule = [
  // OB GYNE
  {
    firstname: 'Ma Teresa',
    lastname: 'Hernandez',
    specialization: 'OB GYNE',
    department: 'Obstetrics and Gynecology',
    schedule: [
      { day: 'Monday', start: '09:00:00', end: '12:00:00' },
      { day: 'Monday', start: '15:00:00', end: '17:00:00' },
      { day: 'Tuesday', start: '09:00:00', end: '12:00:00' },
      { day: 'Tuesday', start: '15:00:00', end: '17:00:00' },
      { day: 'Wednesday', start: '09:00:00', end: '12:00:00' },
      { day: 'Wednesday', start: '15:00:00', end: '17:00:00' },
      { day: 'Thursday', start: '09:00:00', end: '12:00:00' },
      { day: 'Thursday', start: '15:00:00', end: '17:00:00' },
      { day: 'Friday', start: '09:00:00', end: '12:00:00' },
      { day: 'Friday', start: '15:00:00', end: '17:00:00' },
      { day: 'Saturday', start: '09:00:00', end: '12:00:00' },
      { day: 'Saturday', start: '15:00:00', end: '17:00:00' },
    ],
    department_id: 1,
    location: 'ground floor',
  },
  {
    firstname: 'Maricel',
    lastname: 'Valencia',
    specialization: 'OB GYNE',
    department: 'Obstetrics and Gynecology',
    schedule: [
      { day: 'Wednesday', start: '14:00:00', end: '16:00:00' },
      { day: 'Friday', start: '14:00:00', end: '16:00:00' },
      { day: 'Saturday', start: '14:00:00', end: '16:00:00' },
    ],
    department_id: 1,
    location: '2nd floor',
  },

  // PULMONOLOGIST
  {
    firstname: 'Joseph',
    lastname: 'Quiday',
    specialization: 'Pulmonologist',
    department: 'Pulmonology',
    schedule: [
      { day: 'Tuesday', start: '10:00:00', end: '12:00:00' },
      { day: 'Thursday', start: '10:00:00', end: '12:00:00' },
      { day: 'Saturday', start: '10:00:00', end: '12:00:00' },
    ],
    department_id: 2,
    location: 'ground floor',
  },
  {
    firstname: 'Mander',
    lastname: 'Cambonga',
    specialization: 'Pulmonologist',
    department: 'Pulmonology',
    schedule: [
      { day: 'Monday', start: '13:00:00', end: '15:00:00' },
      { day: 'Wednesday', start: '16:00:00', end: '18:00:00' },
      { day: 'Friday', start: '16:00:00', end: '18:00:00' },
    ],
    department_id: 2,
    location: '2nd floor',
  },

  // CARDIOLOGIST
  {
    firstname: 'Melquides',
    lastname: 'Pua',
    specialization: 'Cardiologist',
    department: 'Cardiology',
    schedule: [
      { day: 'Tuesday', start: '09:00:00', end: '11:00:00' },
      { day: 'Thursday', start: '09:00:00', end: '11:00:00' },
      { day: 'Saturday', start: '09:00:00', end: '11:00:00' },
    ],
    department_id: 3,
    location: '2nd floor',
  },

  // NEPHROLOGIST
  {
    firstname: 'Mary Grace',
    lastname: 'Gran',
    specialization: 'Nephrologist',
    department: 'Nephrology',
    schedule: [
      { day: 'Monday', start: '13:00:00', end: '15:00:00' },
      { day: 'Friday', start: '13:00:00', end: '15:00:00' },
    ],
    department_id: 4,
    location: 'ground floor',
  },
  {
    firstname: 'Bea Barbara',
    lastname: 'Carrascosa',
    specialization: 'Nephrologist',
    department: 'Nephrology',
    schedule: [
      { day: 'Tuesday', start: '13:00:00', end: '15:00:00' },
      { day: 'Saturday', start: '13:00:00', end: '15:00:00' },
    ],
    department_id: 4,
    location: '2nd floor',
  },

  // GASTROENTEROLOGIST
  {
    firstname: 'Christopher',
    lastname: 'Sampana',

    specialization: 'Gastroenterologist',
    department: 'Gastroenterology',
    schedule: [
      { day: 'Tuesday', start: '16:00:00', end: '18:00:00' },
      { day: 'Thursday', start: '16:00:00', end: '18:00:00' },
      { day: 'Saturday', start: '15:00:00', end: '17:00:00' },
    ],
    department_id: 5,
    location: 'ground floor',
  },

  // ENDOCRINOLOGIST
  {
    firstname: 'Neil Francis',
    lastname: 'Amba',

    specialization: 'Endocrinologist',
    department: 'Endocrinology',
    schedule: [
      { day: 'Tuesday', start: '15:00:00', end: '17:00:00' },
      { day: 'Thursday', start: '13:00:00', end: '15:00:00' },
      { day: 'Saturday', start: '13:00:00', end: '15:00:00' },
    ],
    department_id: 6,
    location: '2nd floor',
  },

  // INTERNAL MEDICINE
  {
    firstname: 'Maria Jesusa',
    lastname: 'Rana',
    specialization: 'Internal Medicine',
    department: 'Internal Medicine',
    schedule: [
      { day: 'Monday', start: '08:00:00', end: '12:00:00' },
      { day: 'Wednesday', start: '08:00:00', end: '12:00:00' },
      { day: 'Friday', start: '08:00:00', end: '12:00:00' },
    ],
    department_id: 7,
    location: 'ground floor',
  },
  {
    firstname: 'Cherry Ann',
    lastname: 'Ubay',
    specialization: 'Internal Medicine',
    department: 'Internal Medicine',
    schedule: [
      { day: 'Monday', start: '13:00:00', end: '15:00:00' },
      { day: 'Friday', start: '09:00:00', end: '11:00:00' },
    ],
    department_id: 7,
    location: '2nd floor',
  },

  // NEURO-PSYCHIATRIST
  {
    firstname: 'Donna Mae Lyn Buhay',
    lastname: 'Santiago',
    specialization: 'Neuro-Psychiatrist',
    department: 'Neurology',
    schedule: [
      { day: 'Monday', start: '10:00:00', end: '12:00:00' },
      { day: 'Friday', start: '10:00:00', end: '12:00:00' },
    ],
    department_id: 8,
    location: 'ground floor',
  },

  // ORTHOPEDIC SURGEON
  {
    name: 'Maye Faye Quinto',
    firstname: 'Maye Faye',
    lastname: 'Quinto',
    specialization: 'Orthopedic Surgeon',
    department: 'Orthopedics',
    schedule: [{ day: 'Wednesday', start: '10:00:00', end: '12:00:00' }],
    department_id: 8,
    location: '2nd floor',
  },
  {
    firstname: 'German',
    lastname: 'Valdez',
    specialization: 'Orthopedic Surgeon',
    department: 'Orthopedics',
    schedule: [{ day: 'Saturday', start: '10:00:00', end: '12:00:00' }],
    department_id: 9,
    location: '2nd floor',
  },
  {
    firstname: 'Rowena',
    lastname: 'Evangelista',
    specialization: 'Orthopedic Surgeon',
    department: 'Orthopedics',
    schedule: [
      { day: 'Thursday', start: '14:00:00', end: '16:00:00' },
      { day: 'Saturday', start: '13:00:00', end: '15:00:00' },
    ],
    department_id: 9,
    location: '2nd floor',
  },

  // ENT-HNS
  {
    firstname: 'Niño Bernardo',
    lastname: 'Tinbungco',
    specialization: 'ENT-HNS',
    department: 'Otorhinolaryngology',
    schedule: [
      { day: 'Monday', start: '15:00:00', end: '17:00:00' },
      { day: 'Wednesday', start: '15:00:00', end: '17:00:00' },
      { day: 'Friday', start: '15:00:00', end: '17:00:00' },
    ],
    department_id: 10,
    location: '2nd floor',
  },
  {
    name: 'Mia Goyenechea',
    firstname: 'Mia',
    lastname: 'Goyenechea',
    specialization: 'ENT-HNS',
    department: 'Otorhinolaryngology',
    schedule: [{ day: 'Saturday', start: '15:00:00', end: '17:00:00' }],
    department_id: 10,
    location: '2nd floor',
  },

  // SURGEON
  {
    name: 'Ariel De Luna',
    firstname: 'Ariel',
    lastname: 'De Luna',
    specialization: 'General Surgeon',
    department: 'Surgery',
    schedule: [
      { day: 'Tuesday', start: '13:00:00', end: '15:00:00' },
      { day: 'Thursday', start: '13:00:00', end: '15:00:00' },
      { day: 'Saturday', start: '13:00:00', end: '15:00:00' },
    ],
    department_id: 11,
    location: '2nd floor',
  },

  // UROLOGIST
  {
    name: 'James Claveria',
    firstname: 'James',
    lastname: 'Claveria',
    specialization: 'Urologist',
    department: 'Urology',
    schedule: [
      { day: 'Tuesday', start: '08:00:00', end: '10:00:00' },
      { day: 'Thursday', start: '08:00:00', end: '10:00:00' },
    ],
    department_id: 12,
    location: '2nd floor',
  },

  // DERMATOLOGIST
  {
    name: 'Joy Serrano',
    firstname: 'Joy',
    lastname: 'Serrano',
    specialization: 'Dermatologist',
    department: 'Dermatology',
    schedule: [{ day: 'Tuesday', start: '15:00:00', end: '17:00:00' }],
    department_id: 13,
    location: '2nd floor',
  },

  // PEDIATRICIAN
  {
    firstname: 'Arlene',
    lastname: 'Villanueva',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    schedule: [
      { day: 'Monday', start: '09:00:00', end: '16:00:00' },
      { day: 'Tuesday', start: '09:00:00', end: '11:00:00' },
      { day: 'Tuesday', start: '14:00:00', end: '16:00:00' },
      { day: 'Wednesday', start: '09:00:00', end: '11:00:00' },
      { day: 'Thursday', start: '09:00:00', end: '11:00:00' },
      { day: 'Thursday', start: '14:00:00', end: '16:00:00' },
      { day: 'Friday', start: '09:00:00', end: '16:00:00' },
      { day: 'Saturday', start: '09:00:00', end: '11:00:00' },
      { day: 'Saturday', start: '14:00:00', end: '16:00:00' },
    ],
    department_id: 14,
    location: '2nd floor',
  },
  {
    firstname: 'Mary Jane',
    lastname: 'Pang-itan',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    schedule: [
      { day: 'Tuesday', start: '10:00:00', end: '12:00:00' },
      { day: 'Thursday', start: '10:00:00', end: '12:00:00' },
      { day: 'Saturday', start: '10:00:00', end: '12:00:00' },
    ],
    department_id: 14,
    location: '2nd floor',
  },
  {
    name: 'John Cuerpo',
    firstname: 'John',
    lastname: 'Cuerpo',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    schedule: [{ day: 'Wednesday', start: '10:00:00', end: '12:00:00' }],
    department_id: 14,
    location: '2nd floor',
  },
  {
    firstname: 'Mary Ann',
    lastname: 'Del Valle',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    schedule: [
      { day: 'Tuesday', start: '13:00:00', end: '15:00:00' },
      { day: 'Thursday', start: '13:00:00', end: '15:00:00' },
    ],
    department_id: 14,
    location: '2nd floor',
  },
  {
    firstname: 'Raquel',
    lastname: 'Adalim',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    schedule: [{ day: 'Monday', start: '09:00:00', end: '11:00:00' }],
    department_id: 14,
    location: '2nd floor',
  },
  {
    firstname: 'Marisilvana Medina',
    lastname: 'Basat',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    schedule: [
      { day: 'Monday', start: '11:00:00', end: '13:00:00' },
      { day: 'Wednesday', start: '11:00:00', end: '13:00:00' },
      { day: 'Friday', start: '11:00:00', end: '13:00:00' },
    ],
    department_id: 14,
    location: '2nd floor',
  },
  {
    firstname: 'Mary Christian Grace',
    lastname: 'Mariano',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    schedule: [
      { day: 'Monday', start: '09:00:00', end: '11:00:00' },
      { day: 'Wednesday', start: '09:00:00', end: '11:00:00' },
      { day: 'Friday', start: '09:00:00', end: '11:00:00' },
    ],
    department_id: 14,
    location: '2nd floor',
  },
  {
    firstname: 'Monalisa',
    lastname: 'Lopez',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    schedule: [{ day: 'Thursday', start: '15:00:00', end: '17:00:00' }],
    department_id: 14,
    location: '2nd floor',
  },
  {
    firstname: 'Nikki',
    lastname: 'Fernandez',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    schedule: [{ day: 'Monday', start: '10:00:00', end: '12:00:00' }],
    department_id: 14,
    location: '2nd floor',
  },
];

/** Seed Function */
async function seedDoctorSchedules() {
  const transaction = await sequelize.transaction();

  try {
    console.log('\n🏥 Starting H Vill Hospital Doctor Schedule Seeder...\n');

    for (const doctor of hospitalSchedule) {
      console.log(`-----------------------------`);
      console.log(`👨‍⚕ Processing: ${doctor.firstname} ${doctor.lastname}`);

      console.log('firstname', doctor.firstname, 'lastname', doctor.lastname);

      /** Find Department */
      const department = await Department.findOne({
        where: { department_id: doctor.department_id },
        transaction,
      });

      if (!department) {
        console.log(`❌ Department not found (${doctor.department_id})`);
        continue;
      }

      /** Find Person (exact → fallback LIKE) */
      let person = await Person.findOne({
        where: { first_name: doctor.firstname, last_name: doctor.lastname },
        transaction,
      });

      if (!person) {
        console.log(`⚠ No exact name match → trying LIKE search`);
        person = await Person.findOne({
          where: { last_name: { [Op.like]: `%${lastName}%` } },
          transaction,
        });
      }

      if (!person) {
        console.log(`🚫 Person not found in DB → SKIPPED: ${doctor.name}`);
        continue;
      }

      console.log(`✔ Person matched: ${person.first_name} ${person.last_name}`);

      /** Match Staff */
      const staff = await Staff.findOne({
        where: { person_id: person.person_id, role: 'doctor' },
        transaction,
      });

      if (!staff) {
        console.log(`🚫 Staff not found for doctor → Skipped`);
        continue;
      }

      console.log(
        `🆔 Staff ID: ${staff.staff_id} | Department: ${department.department_name}`
      );

      /** Clear old schedules */
      await DoctorSchedule.destroy({
        where: { staff_id: staff.staff_id },
        transaction,
      });

      console.log(`🧹 Old schedules removed`);

      /** Generate Effective Dates */
      const effective_from = new Date(); // today
      const effective_until = new Date();
      effective_until.setMonth(effective_until.getMonth() + 3); // + 3 months validity

      /** Insert new schedules */
      for (const sched of doctor.schedule) {
        await DoctorSchedule.create(
          {
            staff_id: staff.staff_id,
            day_of_week: sched.day,
            start_time: sched.start,
            end_time: sched.end,
            location: doctor.location,
            is_active: true,
            effective_from,
            effective_until,
          },
          { transaction }
        );

        console.log(
          `   ➕ ${sched.day}: ${sched.start} - ${sched.end} (Valid 3 months)`
        );
      }

      console.log(`🎯 Completed doctor: ${doctor.name}\n`);
    }

    await transaction.commit();
    console.log('\n🎉 All doctor schedules seeded successfully!');
    console.log(`📊 Doctors processed: ${hospitalSchedule.length}\n`);
  } catch (error) {
    console.log(`\n❌ Error occurred — Rolling back...`);
    await transaction.rollback();
    console.error(error);
  }

  process.exit();
}

// Run Seeder
seedDoctorSchedules();
export default seedDoctorSchedules;
