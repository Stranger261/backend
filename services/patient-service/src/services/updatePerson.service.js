import {
  Patient,
  Person,
  PersonAddress,
  PersonContact,
  sequelize,
  User,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

class updatePersonService {
  // helpers
  async getUserWithIncludes(userUuid, includes = [], transaction = null) {
    const user = await User.findOne({
      where: {
        user_uuid: userUuid,
        account_status: 'active',
        registration_status: 'completed',
      },
      include: includes,
      transaction,
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    return user;
  }

  async updateModel(userUuid, modelPath, updates, includesConfig) {
    const transaction = await sequelize.transaction();

    try {
      const user = await this.getUserWithIncludes(
        userUuid,
        includesConfig,
        transaction
      );

      let model = user;

      // ✅ Only traverse path if modelPath exists
      if (modelPath && modelPath.trim() !== '') {
        const pathParts = modelPath.split('.');

        for (const part of pathParts) {
          model = model?.[part];
          if (!model) {
            throw new AppError(`${modelPath} not found.`, 404);
          }
        }
      }

      const updatedData = await model.update(updates, { transaction });

      await transaction.commit();
      return updatedData;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      console.error(`Update ${modelPath || 'user'} failed:`, error.message);

      throw error instanceof AppError
        ? error
        : new AppError('Update failed', 500);
    }
  }

  // user updates
  async updateEmail(userUuid, updatedEmail) {
    return await this.updateModel(userUuid, null, { email: updatedEmail }, []);
  }

  // person contact update
  async updateContacts(userUuid, updatedData) {
    const transaction = await sequelize.transaction();
    try {
      const keys = Object.keys(updatedData);
      const isPrimary = !keys.some(key => key.includes('emergency'));

      const updateMap = {
        emergency_contact_number: 'contact_number',
        emergency_contact_relation: 'relationship',
        emergency_contact_name: 'contact_name',
      };

      const user = await this.getUserWithIncludes(
        userUuid,
        [
          {
            model: Person,
            as: 'person',
            required: true,
            include: [
              {
                model: PersonContact,
                as: 'contacts',
                where: { is_primary: isPrimary },
              },
            ],
          },
        ],
        transaction
      );

      const contact = user.person.contacts[0];

      if (!contact) {
        throw new AppError('Contact not found.', 404);
      }

      const updatePayload = {};
      for (const key of keys) {
        if (updateMap[key]) {
          updatePayload[updateMap[key]] = updatedData[key].toLowerCase();
        } else {
          updatePayload[key] = updatedData[key];
        }
      }

      const updatedContact = await contact.update(updatePayload, {
        transaction,
      });

      await transaction.commit();
      return updatedContact;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Update contacts failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Update contacts failed', 500);
    }
  }

  // person address update
  async updateAdress(userUuid, updatedData) {
    const transaction = await sequelize.transaction();
    try {
      const user = await this.getUserWithIncludes(
        userUuid,
        [
          {
            model: Person,
            as: 'person',
            required: true,
            include: [
              {
                model: PersonAddress,
                as: 'addresses',
                where: { is_primary: true },
              },
            ],
          },
        ],
        transaction
      );

      const address = user.person.addresses[0];

      if (!address) {
        throw new AppError('Address not found.', 404);
      }

      const updatedAddress = await address.update(
        {
          unit_floor: updatedData.floor_unit,
          building_name: updatedData.building_name,
          house_number: updatedData.house_number,
          street_name: updatedData.street,
          subdivision: updatedData.subdivision_village,
          region_code: updatedData.region_code,
          province_code: updatedData.province_code,
          city_code: updatedData.city_code,
          barangay_code: updatedData.barangay_code,
          zip_code: updatedData.postal_code,
        },
        { transaction }
      );

      await transaction.commit();
      return updatedAddress;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Update address failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Update address failed', 500);
    }
  }

  // person
  async updateCivilStatus(userUuid, updatedStatus) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findOne({
        where: { user_uuid: userUuid },
        include: [{ model: Person, as: 'person' }],
        transaction,
      });

      const person = user.person;

      const updatedPerson = await person.update(
        { civil_status: updatedStatus },
        { transaction }
      );

      await transaction.commit();
      return updatedPerson;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Update civil status failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Update civil status failed', 500);
    }
  }

  // update medical records
  /**
   * Generic patient field update
   */
  async updatePatientField(userUuid, field, value) {
    const transaction = await sequelize.transaction();
    try {
      const user = await this.getUserWithIncludes(
        userUuid,
        [
          {
            model: Person,
            as: 'person',
            include: [{ model: Patient, as: 'patient' }],
          },
        ],
        transaction
      );

      const patient = user?.person?.patient;

      if (!patient) {
        throw new AppError('Patient record not found.', 404);
      }

      const updatedData = await patient.update(
        { [field]: value },
        { transaction }
      );

      await transaction.commit();

      return updatedData;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error(`Update ${field} failed:`, error.message);
      throw error instanceof AppError
        ? error
        : new AppError(`Update ${field} failed`, 500);
    }
  }
  // Medical Information
  async updateHeight(userUuid, updatedHeight) {
    return await this.updatePatientField(userUuid, 'height', updatedHeight);
  }

  async updateWeight(userUuid, updatedWeight) {
    return await this.updatePatientField(userUuid, 'weight', updatedWeight);
  }

  async updateAllergies(userUuid, updatedAllergies) {
    return await this.updatePatientField(
      userUuid,
      'allergies',
      updatedAllergies
    );
  }

  async updateChronicConditions(userUuid, updatedChronicConditions) {
    return await this.updatePatientField(
      userUuid,
      'chronic_conditions',
      updatedChronicConditions
    );
  }

  async updateCurrentMedications(userUuid, updatedCurrentMedications) {
    return await this.updatePatientField(
      userUuid,
      'current_medications',
      updatedCurrentMedications
    );
  }

  // Insurance Information
  async updateInsuranceProvider(userUuid, updatedInsuranceProvider) {
    return await this.updatePatientField(
      userUuid,
      'insurance_provider',
      updatedInsuranceProvider
    );
  }

  async updateInsuranceNumber(userUuid, updatedInsuranceNumber) {
    return await this.updatePatientField(
      userUuid,
      'insurance_number',
      updatedInsuranceNumber
    );
  }

  async updateInsuranceExpiry(userUuid, updatedInsuranceExpiry) {
    return await this.updatePatientField(
      userUuid,
      'insurance_expiry',
      updatedInsuranceExpiry
    );
  }
}

export default new updatePersonService();
