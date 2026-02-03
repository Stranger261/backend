import { Patient, PatientConsent } from '../../../shared/models/index.js';

/**
 * Setup Initial Patient Consents
 *
 * This script creates default treatment consents for all existing patients.
 * Run this ONCE after implementing the HIPAA tables.
 *
 * Usage:
 * node scripts/setup-patient-consents.js
 */

async function setupPatientConsents() {
  console.log('🏥 Setting up patient consents...\n');

  try {
    // Get all patients
    const patients = await Patient.findAll({
      attributes: ['patient_id'],
    });

    console.log(`Found ${patients.length} patients\n`);

    let created = 0;
    let skipped = 0;

    for (const patient of patients) {
      // Check if patient already has treatment consent
      const hasConsent = await PatientConsent.hasActiveConsent(
        patient.patient_id,
        'treatment',
      );

      if (hasConsent) {
        console.log(
          `⏭️  Patient ${patient.patient_id}: Already has consent (skipped)`,
        );
        skipped++;
        continue;
      }

      // Create default treatment consent
      await PatientConsent.grantConsent(patient.patient_id, 'treatment', {
        createdBy: 1, // System user (adjust if needed)
        expiresDate: null, // No expiry
      });

      console.log(
        `✅ Patient ${patient.patient_id}: Treatment consent created`,
      );
      created++;
    }

    console.log('\n📊 Summary:');
    console.log(`   Total patients: ${patients.length}`);
    console.log(`   Consents created: ${created}`);
    console.log(`   Skipped (already had): ${skipped}`);
    console.log('\n✨ Done!');
  } catch (error) {
    console.error('❌ Error setting up consents:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupPatientConsents()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default setupPatientConsents;
