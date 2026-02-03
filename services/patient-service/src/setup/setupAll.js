import setupPatientConsents from './setup-patient-consents.js';
import setupCareTeams from './setup-care-teams.js';

/**
 * Complete Setup Script
 *
 * Runs all setup scripts in order:
 * 1. Create patient consents
 * 2. Set up care teams from appointments
 *
 * Usage:
 * node scripts/setup-all.js
 */

async function setupAll() {
  console.log('🚀 Starting complete HIPAA setup...\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Patient Consents
    console.log('\n📋 Step 1: Setting up patient consents');
    console.log('='.repeat(60));
    await setupPatientConsents();

    // Step 2: Care Teams
    console.log('\n👥 Step 2: Setting up care teams');
    console.log('='.repeat(60));
    await setupCareTeams();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Complete setup finished successfully!');
    console.log('='.repeat(60));
    console.log('\n✅ Your system is now ready to use!');
    console.log('\nNext steps:');
    console.log('1. Test patient access: GET /api/medical-records');
    console.log('2. Test doctor access: GET /api/medical-records/patient/:id');
    console.log('3. Check PHI access logs: SELECT * FROM phi_access_log');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupAll()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

setupAll();

export default setupAll;
