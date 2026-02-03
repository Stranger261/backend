import {
  Patient,
  Person,
  LisService,
  LisPatient,
  LisTestOrder,
  LisSpecimen,
  LisTestResult,
  Staff,
} from '../../../shared/models/index.js';

class LisIntegrationService {
  /**
   * Create LIS order from your existing LabOrder
   */
  async createLisOrderFromLabOrder(labOrder, labTests) {
    try {
      // 1. Get or create LIS patient
      const lisPatient = await this.getOrCreateLisPatient(labOrder.patient_id);

      // 2. Create LIS test order for each test
      const lisOrders = [];

      for (const test of labTests) {
        // Find matching LIS service
        const lisService = await LisService.findOne({
          where: {
            test_code: test.test_code || test.test_name,
          },
        });

        if (!lisService) {
          console.warn(`LIS Service not found for: ${test.test_name}`);
          continue;
        }

        // Create LIS order
        const lisOrder = await LisTestOrder.create({
          patient_id: lisPatient.patient_id,
          service_id: lisService.service_id,
          ordering_physician: await this.getPhysicianName(labOrder.ordered_by),
          order_date: labOrder.order_date || new Date(),
          order_time: new Date().toTimeString().split(' ')[0],
          priority: this.mapPriority(labOrder.priority),
          clinical_indication: labOrder.clinical_notes,
          order_status: 'Ordered',
        });

        // Create specimen for the order
        const specimen = await LisSpecimen.create({
          order_id: lisOrder.order_id,
          patient_id: lisPatient.patient_id,
          specimen_type: test.specimen_type || 'Blood',
          collection_date: new Date(),
          collection_time: new Date().toTimeString().split(' ')[0],
          collected_by: 'Phlebotomist', // Get from context
          specimen_condition: 'Acceptable',
          status: 'Collected',
        });

        lisOrders.push({
          labTest: test,
          lisOrder,
          specimen,
        });
      }

      return lisOrders;
    } catch (error) {
      console.error('LIS integration error:', error);
      throw error;
    }
  }

  /**
   * Get or create LIS patient from your Patient table
   */
  async getOrCreateLisPatient(patientId) {
    // Check if LIS patient already exists
    let lisPatient = await LisPatient.findOne({
      where: { patient_id: patientId }, // Assuming you want to link by same ID
    });

    if (!lisPatient) {
      // Get patient from your system
      const patient = await Patient.findOne({
        where: { patient_id: patientId },
        include: [{ model: Person, as: 'person' }],
      });

      if (!patient) {
        throw new Error('Patient not found');
      }

      // Create LIS patient
      lisPatient = await LisPatient.create({
        first_name: patient.person.first_name,
        last_name: patient.person.last_name,
        date_of_birth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.person.contact_number,
        email: patient.person.email,
      });
    }

    return lisPatient;
  }

  /**
   * Sync LIS results back to your LabOrderTest
   */
  async syncResultsToLabOrder(lisOrderId, labOrderTestId) {
    try {
      // Get LIS results
      const lisResults = await LisTestResult.findAll({
        where: { order_id: lisOrderId },
        include: ['service'],
      });

      if (lisResults.length === 0) {
        return null;
      }

      for (const result of lisResults) {
        await LabOrderTest.update(
          {
            result_value: result.result_value,
            result_unit: result.result_unit,
            reference_range: result.reference_range,
            result_status: result.result_status,
            performed_by: result.performed_by,
            performed_at: result.result_date,
            verified_by: result.verified_by,
            verified_at: result.verified_at,
          },
          {
            where: { test_id: labOrderTestId },
          },
        );
      }

      return lisResults;
    } catch (error) {
      console.error('Sync results error:', error);
      throw error;
    }
  }

  /**
   * Map your priority to LIS priority
   */
  mapPriority(priority) {
    const priorityMap = {
      routine: 'Routine',
      urgent: 'Urgent',
      stat: 'STAT',
    };
    return priorityMap[priority?.toLowerCase()] || 'Routine';
  }

  /**
   * Get physician name from staff_id
   */
  async getPhysicianName(staffId) {
    const staff = await Staff.findOne({
      where: { staff_id: staffId },
      include: [{ model: Person, as: 'person' }],
    });

    if (!staff) return 'Unknown Physician';

    return `${staff.person.first_name} ${staff.person.last_name}`;
  }
}

export default new LisIntegrationService();
