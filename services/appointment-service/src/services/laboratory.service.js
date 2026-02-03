import {
  Person,
  Patient,
  Appointment,
  Staff,
  LabOrderTest,
  LabOrder,
  sequelize,
  RisService,
  LisService,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

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

      // Generate order number
      const orderNumber = await this.generateOrderNumber();

      // Create lab order
      const labOrder = await LabOrder.create(
        {
          order_number: orderNumber,
          appointment_id: appointmentId,
          patient_id: patientId,
          ordered_by: doctorStaffId,
          order_date: new Date(),
          order_status: 'pending',
          priority: priority || 'routine',
          clinical_notes: clinicalNotes,
        },
        { transaction },
      );

      // Create lab tests
      if (labTests && labTests.length > 0) {
        const labTestsPromises = labTests.map(test =>
          LabOrderTest.create(
            {
              order_id: labOrder.order_id,
              test_name: test.test_name,
              test_code: test.test_code,
              specimen_type: test.specimen_type || 'blood',
              priority: test.priority || priority || 'routine',
            },
            { transaction },
          ),
        );

        await Promise.all(labTestsPromises);
      }

      // Request lab result (call external lab system if needed)
      if (authToken) {
        await this.requestLabResults(labOrder, patient, authToken);
      }

      await transaction.commit();

      // Reload with associations
      const completeLabOrder = await this.getLabOrderById(labOrder.order_id);

      return completeLabOrder;
    } catch (error) {
      await transaction.rollback();
      console.error('Create lab order failed:', error);
      throw error;
    }
  }

  async generateOrderNumber() {
    const prefix = 'LAB';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Get count of orders today
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const count = await LabOrder.count({
      where: {
        order_date: {
          [Op.between]: [startOfDay, endOfDay],
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');

    return `${prefix}${year}${month}${day}${sequence}`;
  }

  async getLabOrderById(orderId) {
    const labOrder = await LabOrder.findByPk(orderId, {
      include: [
        {
          model: LabOrderTest,
          as: 'tests',
        },
        {
          model: Patient,
          as: 'patient',
          include: [{ model: Person, as: 'person' }],
        },
        {
          model: Staff,
          as: 'orderedBy',
          include: [{ model: Person, as: 'person' }],
        },
        {
          model: Appointment,
          as: 'appointment',
        },
      ],
    });

    return labOrder;
  }

  async getLabOrdersByAppointment(appointmentId) {
    const labOrders = await LabOrder.findAll({
      where: { appointment_id: appointmentId },
      include: [
        {
          model: LabOrderTest,
          as: 'tests',
        },
        {
          model: Staff,
          as: 'orderedBy',
          include: [{ model: Person, as: 'person' }],
        },
      ],
      order: [['order_date', 'DESC']],
    });

    return labOrders;
  }

  async getLabOrdersByPatient(patientId, filters = {}) {
    const where = { patient_id: patientId };

    if (filters.status) {
      where.order_status = filters.status;
    }

    if (filters.startDate && filters.endDate) {
      where.order_date = {
        [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)],
      };
    }

    const labOrders = await LabOrder.findAll({
      where,
      include: [
        {
          model: LabOrderTest,
          as: 'tests',
        },
        {
          model: Staff,
          as: 'orderedBy',
          include: [{ model: Person, as: 'person' }],
        },
        {
          model: Appointment,
          as: 'appointment',
        },
      ],
      order: [['order_date', 'DESC']],
    });

    return labOrders;
  }

  async getAllLabOrders(filters = {}) {
    const where = {};

    if (filters.status) {
      where.order_status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.startDate && filters.endDate) {
      where.order_date = {
        [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)],
      };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const { rows: labOrders, count } = await LabOrder.findAndCountAll({
      where,
      include: [
        {
          model: LabOrderTest,
          as: 'tests',
        },
        {
          model: Patient,
          as: 'patient',
          include: [{ model: Person, as: 'person' }],
        },
        {
          model: Staff,
          as: 'orderedBy',
          include: [{ model: Person, as: 'person' }],
        },
      ],
      order: [['order_date', 'DESC']],
      limit,
      offset,
    });

    return {
      labOrders,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getLabOrderTests(orderId) {
    const tests = await LabOrderTest.findAll({
      where: { order_id: orderId },
      order: [['test_id', 'ASC']],
    });

    return tests;
  }

  async updateLabOrder(orderId, updateData) {
    const transaction = await sequelize.transaction();

    try {
      const labOrder = await LabOrder.findByPk(orderId, { transaction });

      if (!labOrder) {
        throw new Error('Lab order not found');
      }

      // Only allow certain fields to be updated
      const allowedFields = ['order_status', 'priority', 'clinical_notes'];

      const filteredData = {};
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      await labOrder.update(filteredData, { transaction });

      await transaction.commit();

      return await this.getLabOrderById(orderId);
    } catch (error) {
      await transaction.rollback();
      console.error('Update lab order failed:', error);
      throw error;
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

      return await this.getLabOrderById(orderId);
    } catch (error) {
      await transaction.rollback();
      console.error('Update lab results failed:', error);
      throw error;
    }
  }

  async cancelLabOrder(orderId, reason) {
    const transaction = await sequelize.transaction();

    try {
      const labOrder = await LabOrder.findByPk(orderId, { transaction });

      if (!labOrder) {
        throw new Error('Lab order not found');
      }

      if (['completed', 'cancelled'].includes(labOrder.order_status)) {
        throw new Error(
          `Cannot cancel lab order with status: ${labOrder.order_status}`,
        );
      }

      await labOrder.update(
        {
          order_status: 'cancelled',
          clinical_notes: labOrder.clinical_notes
            ? `${labOrder.clinical_notes}\n\nCancellation reason: ${reason}`
            : `Cancellation reason: ${reason}`,
        },
        { transaction },
      );

      await transaction.commit();

      return await this.getLabOrderById(orderId);
    } catch (error) {
      await transaction.rollback();
      console.error('Cancel lab order failed:', error);
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

      // Call external lab system API if configured
      if (process.env.LAB_SYSTEM_URL) {
        const response = await fetch(
          `${process.env.LAB_SYSTEM_URL}/api/orders`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authToken,
            },
            body: JSON.stringify(labRequestData),
          },
        );

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
      }

      return null;
    } catch (error) {
      console.error('Lab request failed:', error);
      // Don't throw here - we still want to save the order even if lab system is down
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

        // TODO: Implement actual notification service
        // await notificationService.send(notification);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async getAllLabServices() {
    try {
      const risServices = await RisService.findAll();
      const lisServices = await LisService.findAll();

      return { risServices, lisServices };
    } catch (error) {
      console.error('Failed to get all RIS services: ', error);
      throw (
        error instanceof AppError ? error : 'Failed to get RIS Services',
        500
      );
    }
  }

  async receiever(data) {
    console.log('data recieved: ', data);
  }
}

export default new LabOrderService();
