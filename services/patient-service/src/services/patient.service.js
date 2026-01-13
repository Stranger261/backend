import { Op } from 'sequelize';

import {
  Staff,
  Person,
  Patient,
  Appointment,
  User,
  MedicalRecord,
  PersonContact,
  PersonAddress,
  Barangay,
  City,
  Province,
  Region,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

class patientServce {
  async getDoctorsPatients(doctorUuid, filters = {}) {
    try {
      const {
        status,
        searchQuery = '',
        gender,
        page = 1,
        limit = 10,
      } = filters;

      // 1. Find the doctor
      const doctor = await Staff.findOne({
        where: { staff_uuid: doctorUuid },
      });

      if (!doctor) {
        throw new AppError('Doctor not found.', 404);
      }

      // 2. Build where clause for patients
      const patientWhere = {};

      if (status && status !== 'all') {
        patientWhere.patient_status = status;
      }

      if (gender && gender !== 'all') {
        patientWhere['$person.gender$'] = gender;
      }

      if (searchQuery) {
        patientWhere[Op.or] = [
          { mrn: { [Op.like]: `%${searchQuery}%` } },
          { patient_uuid: { [Op.like]: `%${searchQuery}%` } },
          { '$person.first_name$': { [Op.like]: `%${searchQuery}%` } },
          { '$person.last_name$': { [Op.like]: `%${searchQuery}%` } },
        ];
      }

      const offset = (page - 1) * limit;

      // 3. Get filtered patients
      const { rows: patients, count: filteredTotal } =
        await Patient.findAndCountAll({
          where: patientWhere,
          offset,
          limit: parseInt(limit),
          distinct: true,
          include: [
            // Person details
            {
              model: Person,
              as: 'person',
              required: true,
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['phone', 'email'],
                },
                {
                  model: PersonContact,
                  as: 'contacts',
                  required: false, // ✅ Must be false with separate
                  separate: true,
                },
                {
                  model: PersonAddress,
                  as: 'addresses',
                  required: false, // ✅ Must be false with separate
                  separate: true,
                  include: [
                    { model: Barangay, as: 'barangay' },
                    { model: City, as: 'city' },
                    { model: Province, as: 'province' },
                    { model: Region, as: 'region' },
                  ],
                },
              ],
            },
            // Medical records
            {
              model: MedicalRecord,
              as: 'medicalRecords',
              where: { doctor_id: doctor.staff_id },
              required: false,
              separate: true,
            },
            // Appointments
            {
              model: Appointment,
              as: 'appointments',
              where: {
                doctor_id: doctor.staff_id,
                appointment_date: { [Op.gte]: new Date() },
              },
              attributes: [
                'appointment_id',
                'appointment_date',
                'status',
                'appointment_type',
              ],
              required: true,
              separate: true,
              limit: 10,
            },
          ],
          order: [['created_at', 'DESC']],
        });

      // 4. Get unfiltered stats
      const stats = await this.getPatientStats('doctor', doctorUuid);

      // 5. Normalize patient data
      const normalizedPatients = patients.map(patient => {
        const patientData = patient.toJSON();

        return {
          // Patient details
          patient_id: patientData.patient_id,
          patient_uuid: patientData.patient_uuid,
          mrn: patientData.mrn,
          patient_status: patientData.patient_status,
          registration_type: patientData.registration_type,
          first_visit_date: patientData.first_visit_date,
          insurance_provider: patientData.insurance_provider,
          insurance_number: patientData.insurance_number,
          insurance_expiry: patientData.insurance_expiry,
          created_at: patientData.created_at,

          // Person details
          person_id: patientData.person?.person_id,
          first_name: patientData.person?.first_name,
          middle_name: patientData.person?.middle_name,
          last_name: patientData.person?.last_name,
          suffix: patientData.person?.suffix,
          date_of_birth: patientData.person?.date_of_birth,
          gender: patientData.person?.gender,
          gender_specification: patientData.person?.gender_specification,
          blood_type: patientData.person?.blood_type,
          nationality: patientData.person?.nationality,
          civil_status: patientData.person?.civil_status,
          occupation: patientData.person?.occupation,
          religion: patientData.person?.religion,

          // User/Contact details
          phone: patientData.person?.user?.phone,
          email: patientData.person?.user?.email,

          // Emergency contacts - with readable labels
          contacts: (patientData.person?.contacts || []).map(contact => ({
            contact_id: contact.contact_id,
            contact_type: contact.is_primary
              ? 'Primary Contact'
              : 'Emergency Contact',
            contact_number: contact.contact_number,
            contact_name: contact.contact_name,
            relationship: contact.relationship,
            is_primary: contact.is_primary,
          })),

          // Addresses - with readable location names only
          addresses: (patientData.person?.addresses || []).map(address => ({
            address_id: address.address_id,
            address_type: address.address_type,
            house_number: address.house_number,
            street_name: address.street_name,
            building_name: address.building_name,
            unit_floor: address.unit_floor,
            subdivision: address.subdivision,
            landmark: address.landmark,
            zip_code: address.zip_code,
            is_primary: address.is_primary,
            is_verified: address.is_verified,
            delivery_instructions: address.delivery_instructions,
            latitude: address.latitude,
            longitude: address.longitude,
            // Readable location names only
            barangay: address.barangay?.barangay_name || null,
            city: address.city?.city_name || null,
            province: address.province?.province_name || null,
            region: address.region?.region_name || null,
          })),

          // Related data
          medicalRecords: patientData.medicalRecords || [],
          appointments: patientData.appointments || [],
        };
      });

      return {
        patients: normalizedPatients,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total: filteredTotal,
          totalPages: Math.ceil(filteredTotal / limit),
        },
        stats,
      };
    } catch (error) {
      console.log('Get doctor patients error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError(`Get doctor's patient error`, 500);
    }
  }

  async getPatientStats(userRole, doctorUuid = null) {
    try {
      let includeCondition = [];
      let appointmentsWhere = {};

      if (userRole === 'doctor' && doctorUuid) {
        const doctor = await Staff.findOne({
          where: { staff_uuid: doctorUuid },
        });

        if (!doctor) {
          throw new AppError('Doctor not found.', 404);
        }

        includeCondition = [
          {
            model: Appointment,
            as: 'appointments',
            where: { doctor_id: doctor.staff_id },
            required: true,
          },
        ];

        appointmentsWhere.doctor_id = doctor.staff_id;
      }

      const totalPatients = await Patient.count({
        include: includeCondition,
        distinct: true,
      });

      const activePatients = await Patient.count({
        where: { patient_status: 'active' },
        include: includeCondition,
        distinct: true,
      });

      const inactivePatients = await Patient.count({
        where: { patient_status: 'inactive' },
        include: includeCondition,
        distinct: true,
      });

      const patientsWithInsurance = await Patient.count({
        where: { insurance_provider: { [Op.ne]: null } },
        include: includeCondition,
        distinct: true,
      });

      const totalAppointments = await Appointment.count({
        where: appointmentsWhere,
      });

      return {
        totalPatients,
        activePatients,
        inactivePatients,
        patientsWithInsurance,
        totalAppointments,
      };
    } catch (error) {
      console.log('Get total patients failed: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Total patients error', 500);
    }
  }

  async getPatientMedicalHistory(patientUuid, filters = {}) {
    try {
      const { page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
      });

      if (!patient) {
        throw new AppError('Patient not found.', 404);
      }

      const { rows: medHistory, count: totalHistory } =
        await MedicalRecord.findAndCountAll({
          where: { patient_id: patient.patient_id },
          offset,
        });

      return {
        medHistory,
        pagination: {
          page: parseInt(page),
          total: totalHistory,
          limit: parseInt(limit),
          totalPages: Math.ceil(totalHistory / limit),
        },
      };
    } catch (error) {
      console.log('Failed to get patient medical history: ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Get patient medical history failed.', 500);
    }
  }
}

export default new patientServce();
