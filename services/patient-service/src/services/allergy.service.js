import {
  Patient,
  Person,
  Allergy,
  sequelize,
  User,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

class AllergyService {
  /**
   * Get patient from user UUID
   */
  async getPatientFromUser(userUuid, transaction = null) {
    const user = await User.findOne({
      where: {
        user_uuid: userUuid,
        account_status: 'active',
        registration_status: 'completed',
      },
      include: [
        {
          model: Person,
          as: 'person',
          include: [{ model: Patient, as: 'patient' }],
        },
      ],
      transaction,
    });

    if (!user?.person?.patient) {
      throw new AppError('Patient not found', 404);
    }

    return user.person.patient;
  }

  /**
   * Get all allergies for a patient
   */
  async getPatientAllergies(userUuid) {
    const transaction = await sequelize.transaction();
    try {
      const patient = await this.getPatientFromUser(userUuid, transaction);

      const allergies = await Allergy.getPatientAllergies(patient.patient_id, {
        transaction,
      });

      await transaction.commit();
      return allergies;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Get allergies failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get allergies', 500);
    }
  }

  /**
   * Add new allergy
   */
  async addAllergy(userUuid, allergyData) {
    const transaction = await sequelize.transaction();
    try {
      const patient = await this.getPatientFromUser(userUuid, transaction);

      // Check for duplicate
      const existing = await Allergy.findOne({
        where: {
          patient_id: patient.patient_id,
          allergen: allergyData.allergen,
        },
        transaction,
      });

      if (existing) {
        throw new AppError('This allergy already exists', 400);
      }

      const allergy = await Allergy.addAllergy(
        patient.patient_id,
        allergyData,
        allergyData.reported_by || patient.patient_id, // Default to self-reported
        { transaction }
      );

      await transaction.commit();
      return allergy;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Add allergy failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to add allergy', 500);
    }
  }

  /**
   * Update existing allergy
   */
  async updateAllergy(userUuid, allergyId, updates) {
    const transaction = await sequelize.transaction();
    try {
      const patient = await this.getPatientFromUser(userUuid, transaction);

      // Verify allergy belongs to this patient
      const allergy = await Allergy.findOne({
        where: {
          allergy_id: allergyId,
          patient_id: patient.patient_id,
        },
        transaction,
      });

      if (!allergy) {
        throw new AppError('Allergy not found', 404);
      }

      const updatedAllergy = await allergy.update(updates, { transaction });

      await transaction.commit();
      return updatedAllergy;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Update allergy failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to update allergy', 500);
    }
  }

  /**
   * Delete allergy
   */
  async deleteAllergy(userUuid, allergyId) {
    const transaction = await sequelize.transaction();
    try {
      const patient = await this.getPatientFromUser(userUuid, transaction);

      // Verify allergy belongs to this patient
      const allergy = await Allergy.findOne({
        where: {
          allergy_id: allergyId,
          patient_id: patient.patient_id,
        },
        transaction,
      });

      if (!allergy) {
        throw new AppError('Allergy not found', 404);
      }

      await allergy.destroy({ transaction });

      await transaction.commit();
      return { message: 'Allergy deleted successfully' };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Delete allergy failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to delete allergy', 500);
    }
  }

  /**
   * Get critical allergies (severe/life-threatening)
   */
  async getCriticalAllergies(userUuid) {
    const transaction = await sequelize.transaction();
    try {
      const patient = await this.getPatientFromUser(userUuid, transaction);

      const criticalAllergies = await Allergy.getCriticalAllergies(
        patient.patient_id,
        { transaction }
      );

      await transaction.commit();
      return criticalAllergies;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Get critical allergies failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get critical allergies', 500);
    }
  }
}

export default new AllergyService();
