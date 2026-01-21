import {
  Staff,
  Person,
  Prescription,
  Appointment,
  PrescriptionItem,
  Patient,
  sequelize,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

class PrescriptionService {
  async createPrescription(prescriptionData, doctorStaffId) {
    const transaction = await sequelize.transaction();

    try {
      const { appointmentId, admissionId, patientId, items, notes } =
        prescriptionData;

      // Validate at least one source (appointment or admission)
      if (!appointmentId && !admissionId) {
        throw new AppError(
          'Either appointmentId or admissionId is required.',
          400,
        );
      }

      // Validate items exist
      if (!items || items.length === 0) {
        throw new AppError('At least one medication is required.', 400);
      }

      // Create prescription
      const prescription = await Prescription.create(
        {
          appointment_id: appointmentId,
          admission_id: admissionId,
          patient_id: patientId,
          prescribed_by: doctorStaffId,
          prescription_date: new Date(),
          notes,
        },
        { transaction },
      );

      // Create prescription items
      const prescriptionItems = items.map(item => ({
        prescription_id: prescription.prescription_id,
        ...item,
      }));

      await PrescriptionItem.bulkCreate(prescriptionItems, { transaction });

      await transaction.commit();

      return await this.getPrescriptionById(prescription.prescription_id);
    } catch (error) {
      await transaction.rollback();
      console.error('Create prescription failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to create prescription.', 500);
    }
  }

  async getPrescriptionById(prescriptionId) {
    try {
      const prescription = await Prescription.findByPk(prescriptionId, {
        include: [
          {
            model: PrescriptionItem,
            as: 'items',
          },
          {
            model: Patient,
            as: 'patient',
            include: [{ model: Person, as: 'person' }],
          },
          {
            model: Staff,
            as: 'prescribedBy',
            include: [{ model: Person, as: 'person' }],
          },
          {
            model: Appointment,
            as: 'appointment',
            attributes: ['appointment_date', 'appointment_time'],
          },
        ],
      });

      if (!prescription) {
        throw new AppError('Prescription not found.', 404);
      }

      return prescription;
    } catch (error) {
      console.error('Get prescription failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get prescription.', 500);
    }
  }

  async getPatientPrescriptions(patientId, activeOnly = false) {
    try {
      const where = { patient_id: patientId };
      if (activeOnly) {
        where.prescription_status = 'active';
      }

      const prescriptions = await Prescription.findAll({
        where,
        include: [
          {
            model: PrescriptionItem,
            as: 'items',
          },
          {
            model: Staff,
            as: 'prescribedBy',
            include: [{ model: Person, as: 'person' }],
          },
        ],
        order: [['prescription_date', 'DESC']],
      });

      return prescriptions;
    } catch (error) {
      console.error('Get patient prescriptions failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get prescriptions.', 500);
    }
  }

  async dispenseMedication(itemId, pharmacistStaffId) {
    try {
      const item = await PrescriptionItem.findByPk(itemId);

      if (!item) {
        throw new AppError('Prescription item not found.', 404);
      }

      if (item.dispensed) {
        throw new AppError('Medication already dispensed.', 400);
      }

      await item.update({
        dispensed: true,
        dispensed_at: new Date(),
        dispensed_by: pharmacistStaffId,
      });

      return item;
    } catch (error) {
      console.error('Dispense medication failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to dispense medication.', 500);
    }
  }
}

export default new PrescriptionService();
