import { Op } from 'sequelize';
import { Appointment, PatientCareTeam } from '../../../shared/models/index.js';

/**
 * Setup Care Teams from Existing Appointments
 *
 * This script adds doctors to patient care teams based on their appointments.
 * Run this ONCE after implementing the HIPAA tables.
 *
 * Usage:
 * node scripts/setup-care-teams.js
 */

async function setupCareTeams() {
  console.log('👥 Setting up patient care teams...\n');

  try {
    // Get appointments from the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const appointments = await Appointment.findAll({
      where: {
        appointment_date: { [Op.gte]: sixMonthsAgo },
        status: { [Op.in]: ['scheduled', 'completed', 'in_progress'] },
      },
      attributes: ['patient_id', 'doctor_id'],
      group: ['patient_id', 'doctor_id'],
    });

    console.log(
      `Found ${appointments.length} patient-doctor pairs from recent appointments\n`,
    );

    let added = 0;
    let skipped = 0;

    for (const appointment of appointments) {
      const { patient_id, doctor_id } = appointment;

      // Check if already on care team
      const isOnTeam = await PatientCareTeam.isOnCareTeam(
        patient_id,
        doctor_id,
      );

      if (isOnTeam) {
        console.log(
          `⏭️  Patient ${patient_id} - Doctor ${doctor_id}: Already on care team (skipped)`,
        );
        skipped++;
        continue;
      }

      // Add to care team
      await PatientCareTeam.addToTeam(
        patient_id,
        doctor_id,
        'primary_physician',
        1, // System user (adjust if needed)
        'Added from existing appointments',
      );

      console.log(
        `✅ Patient ${patient_id} - Doctor ${doctor_id}: Added to care team`,
      );
      added++;
    }

    console.log('\n📊 Summary:');
    console.log(`   Total patient-doctor pairs: ${appointments.length}`);
    console.log(`   Added to care team: ${added}`);
    console.log(`   Skipped (already on team): ${skipped}`);
    console.log('\n✨ Done!');
  } catch (error) {
    console.error('❌ Error setting up care teams:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupCareTeams()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default setupCareTeams;
