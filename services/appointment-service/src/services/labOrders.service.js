import {
  Person,
  Patient,
  Appointment,
  LabOrderTest,
  LabOrder,
} from '../../../shared/models/index.js';

class LabOrderService {
  async createLabOrderFromConsultation(orderData, doctorStaffId, authToken) {
    const transaction = await sequelize.transaction();

    try {
      const { appointmentId, patientId, labTests, clinicalNotes, priority } =
        orderData;

      // Verify patient exists
      const patient = await Patient.findOne({
        where: { patient_id: patientId },
        include: [{ model: Person, as: 'person' }],
        transaction,
      });

      if (!patient) {
        throw new Error('Patient not found');
      }

      // Create lab order
      const labOrder = await LabOrder.create(
        {
          appointment_id: appointmentId,
          patient_id: patientId,
          ordered_by: doctorStaffId,
          order_status: 'pending',
          priority,
          clinical_notes: clinicalNotes,
        },
        { transaction },
      );

      // Create lab tests
      const labTestsPromises = labTests.map(test =>
        LabOrderTest.create(
          {
            order_id: labOrder.order_id,
            test_name: test.test_name,
            specimen_type: test.specimen_type || 'blood',
            priority: test.priority || 'routine',
          },
          { transaction },
        ),
      );

      await Promise.all(labTestsPromises);

      // Request lab result (call external lab system if needed)
      await this.requestLabResults(labOrder, patient, authToken);

      await transaction.commit();

      return {
        labOrder,
        patient: {
          id: patient.patient_id,
          name: `${patient.person.first_name} ${patient.person.last_name}`,
          mrn: patient.mrn,
          dob: patient.date_of_birth,
        },
      };
    } catch (error) {
      await transaction.rollback();
      console.error('Create lab order failed:', error);
      throw error;
    }
  }

  async requestLabResults(labOrder, patient, authToken) {
    try {
      // Prepare data for lab request
      const labRequestData = {
        orderNumber: labOrder.order_number,
        patient: {
          id: patient.patient_id,
          mrn: patient.mrn,
          name: `${patient.person.first_name} ${patient.person.last_name}`,
          dob: patient.date_of_birth,
          gender: patient.gender,
          contact: patient.person.contact_number,
        },
        tests: await LabOrderTest.findAll({
          where: { order_id: labOrder.order_id },
        }),
        priority: labOrder.priority,
        clinicalNotes: labOrder.clinical_notes,
      };

      // Call external lab system API
      const response = await fetch(`${process.env.LAB_SYSTEM_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(labRequestData),
      });

      if (!response.ok) {
        throw new Error(`Lab system API error: ${response.statusText}`);
      }

      const result = await response.json();

      // Update lab order with external ID if provided
      if (result.externalId) {
        await labOrder.update({
          external_reference: result.externalId,
        });
      }

      return result;
    } catch (error) {
      console.error('Lab request failed:', error);
      // Don't throw here - we still want to save the order even if lab system is down
    }
  }

  async updateLabResults(orderId, results) {
    const transaction = await sequelize.transaction();

    try {
      const labOrder = await LabOrder.findByPk(orderId, {
        include: [{ model: LabOrderTest, as: 'tests' }],
        transaction,
      });

      if (!labOrder) {
        throw new Error('Lab order not found');
      }

      // Update each test with results
      for (const result of results) {
        const test = labOrder.tests.find(
          t => t.test_id === result.testId || t.test_name === result.testName,
        );

        if (test) {
          await test.update(
            {
              result_value: result.value,
              result_unit: result.unit,
              reference_range: result.referenceRange,
              result_status: result.status,
              performed_by: result.performedBy,
              performed_at: result.performedAt || new Date(),
              verified_by: result.verifiedBy,
              verified_at: result.verifiedAt,
              notes: result.notes,
            },
            { transaction },
          );
        }
      }

      // Check if all tests are completed
      const pendingTests = labOrder.tests.filter(t => !t.result_value);

      if (pendingTests.length === 0) {
        await labOrder.update(
          {
            order_status: 'completed',
          },
          { transaction },
        );
      } else {
        await labOrder.update(
          {
            order_status: 'processing',
          },
          { transaction },
        );
      }

      await transaction.commit();

      // Notify doctor about completed results
      if (labOrder.order_status === 'completed') {
        await this.notifyDoctorResults(labOrder);
      }

      return labOrder;
    } catch (error) {
      await transaction.rollback();
      console.error('Update lab results failed:', error);
      throw error;
    }
  }

  async notifyDoctorResults(labOrder) {
    try {
      // Get doctor information
      const appointment = await Appointment.findByPk(labOrder.appointment_id, {
        include: [
          {
            model: Staff,
            as: 'doctor',
            include: [{ model: Person, as: 'person' }],
          },
        ],
      });

      if (appointment && appointment.doctor) {
        const doctor = appointment.doctor;

        // Send notification (could be email, SMS, or in-app notification)
        const notification = {
          to: doctor.person.email,
          subject: `Lab Results Ready - ${labOrder.order_number}`,
          message: `Lab results for order ${labOrder.order_number} are now available.`,
          doctorId: doctor.staff_id,
          orderId: labOrder.order_id,
        };

        // Implement notification logic here
        console.log('Lab results notification:', notification);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }
}

export default new LabOrderService();
