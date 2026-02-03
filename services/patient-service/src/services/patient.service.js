import { Op } from 'sequelize';

import {
  Staff,
  Person,
  Patient,
  Appointment,
  User,
  PersonContact,
  PersonAddress,
  Barangay,
  City,
  Province,
  Region,
  sequelize,
  //
  MedicalRecord,
  //
  AppointmentDiagnosis,
  AppointmentVitals,
  Prescription,
  PrescriptionItem,
  Admission,
  PatientCareTeam,
} from '../../../shared/models/index.js';
import { normalizePatientData } from '../utils/patientNormalizer.js';
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

      const { rows: patients, count: filteredTotal } =
        await Patient.findAndCountAll({
          where: patientWhere,
          include: [
            {
              model: Person,
              as: 'person',
              include: [
                { model: User, as: 'user' },
                { model: PersonContact, as: 'contacts' },
                { model: PersonAddress, as: 'addresses' },
              ],
            },
          ],
          distinct: true,
          offset,
          limit: parseInt(limit),
          order: [['created_at', 'DESC']],
        });

      const stats = await this.getDoctorPatientStats(doctor.staff_id);

      const normalizedPatient = patients.map(patient =>
        normalizePatientData(patient),
      );

      return {
        patients: normalizedPatient,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total: filteredTotal,
          totalPages: Math.ceil(filteredTotal / limit),
        },
        stats,
      };
    } catch (error) {
      console.error('Get doctor patients error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError(`Get doctor's patient error`, 500);
    }
  }

  async getDoctorPatientStats(doctorId) {
    try {
      const [
        total,
        active,
        inactive,
        totalMedicalRecords,
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
      ] = await Promise.all([
        // Total patients with appointments to this doctor
        Patient.count({
          include: [
            {
              model: Appointment,
              as: 'appointments',
              where: { doctor_id: doctorId },
              required: true,
            },
          ],
          distinct: true,
        }),
        // Active patients
        Patient.count({
          where: { patient_status: 'active' },
          include: [
            {
              model: Appointment,
              as: 'appointments',
              where: { doctor_id: doctorId },
              required: true,
            },
          ],
          distinct: true,
        }),
        // Inactive patients
        Patient.count({
          where: { patient_status: 'inactive' },
          include: [
            {
              model: Appointment,
              as: 'appointments',
              where: { doctor_id: doctorId },
              required: true,
            },
          ],
          distinct: true,
        }),
        // Total medical records created by this doctor
        MedicalRecord.count({
          where: { doctor_id: doctorId },
        }),
        // Total appointments
        Appointment.count({
          where: { doctor_id: doctorId },
        }),
        // Upcoming appointments
        Appointment.count({
          where: {
            doctor_id: doctorId,
            appointment_date: { [Op.gte]: new Date() },
            status: { [Op.in]: ['scheduled', 'confirmed'] },
          },
        }),
        // Completed appointments
        Appointment.count({
          where: {
            doctor_id: doctorId,
            status: 'completed',
          },
        }),
      ]);

      return {
        total,
        active,
        inactive,
        totalMedicalRecords,
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
      };
    } catch (error) {
      console.error('Get doctor patient stats error:', error.message);
      throw error;
    }
  }

  async getPatientDetails(patientUuid) {
    try {
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
        include: [
          {
            model: Appointment,
            as: 'appointments',
            required: false,
            attributes: ['appointment_id'],
            include: [
              {
                model: AppointmentDiagnosis,
                as: 'diagnosis',
                required: false,
              },
              { model: AppointmentVitals, as: 'vitals', required: false },
              {
                model: Admission,
                as: 'resultingAdmission',
                required: false,
                include: [
                  {
                    model: Prescription,
                    as: 'prescriptions',
                    required: false,
                    include: [
                      {
                        model: PrescriptionItem,
                        as: 'items',
                        required: false,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            model: Person,
            as: 'person',
            include: [
              { model: User, as: 'user' },
              { model: PersonContact, as: 'contacts', required: false },
              { model: PersonAddress, as: 'addresses', required: false },
            ],
          },
          {
            model: Admission,
            as: 'admissions',
            required: false,
            include: [
              {
                model: Prescription,
                as: 'prescriptions',
                required: false,
                include: [
                  {
                    model: PrescriptionItem,
                    as: 'items',
                    required: false,
                  },
                ],
              },
            ],
          },
        ],
      });
      const normalizedPatient = normalizePatientData(patient);

      return normalizedPatient;
    } catch (error) {
      console.error('Get patients details:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError(`Get patient details error`, 500);
    }
  }

  async getPatientMedicalRecord(patientUuid, filters, role) {
    try {
      const { record_type, searchTerm } = filters;
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
      });

      if (!patient) {
        throw new AppError('Patient not found.', 404);
      }

      const where = { patient_id: patient.patient_id };

      if (record_type && record_type !== 'all') {
        where.record_type = record_type;
      }

      if (searchTerm) {
        where[Op.or] = [
          { diagnosis: { [Op.like]: `%${searchTerm}%` } },
          { chief_complaint: { [Op.like]: `%${searchTerm}%` } },
        ];
      }

      const medicalRecords = await MedicalRecord.findAll({
        where,
        include: [
          {
            model: Staff,
            as: 'doctor',
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'last_name'],
              },
            ],
          },
        ],
      });

      return medicalRecords;
    } catch (error) {
      console.error('Get patient medical record failed: ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Fetch patient medical error.', 500);
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
      console.error('Get total patients failed: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Total patients error', 500);
    }
  }

  // try for patients later
  async getPatientMedicalHistory(patientUuid, filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        recordType = null,
        visitType = null,
        startDate = null,
        endDate = null,
        doctorId = null,
        sortBy = 'record_date',
        sortOrder = 'DESC',
        includePrescriptions = false, // Toggle to include prescriptions
      } = filters;

      const offset = (page - 1) * limit;

      // Find patient
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
      });

      if (!patient) {
        throw new AppError('Patient not found.', 404);
      }

      // Build where clause
      const where = { patient_id: patient.patient_id };

      if (recordType) {
        where.record_type = recordType;
      }

      if (visitType) {
        where.visit_type = visitType;
      }

      if (doctorId) {
        where.doctor_id = doctorId;
      }

      if (startDate || endDate) {
        where.record_date = {};
        if (startDate) {
          where.record_date[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          where.record_date[Op.lte] = new Date(endDate);
        }
      }

      // Query medical records
      const { rows: medHistory, count: totalHistory } =
        await MedicalRecord.findAndCountAll({
          where,
          include: [
            {
              model: Staff,
              as: 'doctor',
              attributes: ['staff_id', 'staff_uuid'],
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: [
                    'first_name',
                    'middle_name',
                    'last_name',
                    'suffix',
                  ],
                },
              ],
            },
          ],
          order: [[sortBy, sortOrder]],
          limit: parseInt(limit),
          offset,
          distinct: true,
        });

      if (!medHistory || Array.isArray(medHistory).length === 0) {
        return { message: 'No medical record found.' };
      }

      let enrichedHistory = medHistory.map(record => record.toJSON());

      // Optionally include prescriptions
      if (includePrescriptions) {
        // Get all visit IDs for efficient querying
        const appointmentIds = medHistory
          .filter(r => r.visit_type === 'appointment' && r.visit_id)
          .map(r => r.visit_id);

        const admissionIds = medHistory
          .filter(r => r.visit_type === 'admission' && r.visit_id)
          .map(r => r.visit_id);

        // Batch fetch prescriptions
        const [appointmentPrescriptions, admissionPrescriptions] =
          await Promise.all([
            appointmentIds.length > 0
              ? Prescription.findAll({
                  where: { appointment_id: appointmentIds },
                  include: [{ model: PrescriptionItem, as: 'items' }],
                })
              : [],
            admissionIds.length > 0
              ? Prescription.findAll({
                  where: { admission_id: admissionIds },
                  include: [{ model: PrescriptionItem, as: 'items' }],
                })
              : [],
          ]);

        // Create lookup maps
        const appointmentPrescriptionMap = new Map(
          appointmentPrescriptions.map(p => [p.appointment_id, p]),
        );
        const admissionPrescriptionMap = new Map(
          admissionPrescriptions.map(p => [p.admission_id, p]),
        );

        // Attach prescriptions to records
        enrichedHistory = enrichedHistory.map(record => {
          if (record.visit_type === 'appointment' && record.visit_id) {
            record.prescription =
              appointmentPrescriptionMap.get(record.visit_id) || null;
          } else if (record.visit_type === 'admission' && record.visit_id) {
            record.prescription =
              admissionPrescriptionMap.get(record.visit_id) || null;
          }
          return record;
        });
      }

      return {
        medHistory: enrichedHistory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalHistory,
          totalPages: Math.ceil(totalHistory / limit),
          hasNext: page * limit < totalHistory,
          hasPrev: page > 1,
        },
        filters: {
          recordType,
          visitType,
          startDate,
          endDate,
          doctorId,
          sortBy,
          sortOrder,
          includePrescriptions,
        },
      };
    } catch (error) {
      console.error('Failed to get patient medical history: ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Get patient medical history failed.', 500);
    }
  }

  async getPatient(searchQuery) {
    try {
      const where = { patient_status: 'active' };

      if (searchQuery) {
        where[Op.or] = [
          { mrn: { [Op.like]: `%${searchQuery}%` } },
          { patient_uuid: { [Op.like]: `%${searchQuery}%` } },
          { '$person.first_name$': { [Op.like]: `%${searchQuery}%` } },
          { '$person.last_name$': { [Op.like]: `%${searchQuery}%` } },
          { '$person.user.email$': { [Op.like]: `%${searchQuery}%` } },
          { '$person.user.phone$': { [Op.like]: `%${searchQuery}%` } },
        ];
      }
      const patient = await Patient.findAll({
        where,
        include: [
          {
            model: Person,
            as: 'person',
            include: [{ model: User, as: 'user' }],
          },
        ],
      });
      if (!patient) {
        throw new AppError('No patient found.', 404);
      }

      return patient;
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get patient.', 500);
    }
  }

  async getAllPatients(filters = {}, userRole = 'receptionist') {
    try {
      const {
        searchQuery = '',
        status = 'all',
        gender = 'all',
        hasFace = 'all',
        page = 1,
        limit = 10,
      } = filters;

      const where = {};
      const personWhere = {};

      // Status filter
      if (status && status !== 'all') {
        where.patient_status = status;
      }

      // Gender filter
      if (gender && gender !== 'all') {
        personWhere.gender = gender;
      }

      // Face filter
      if (hasFace === 'yes') {
        personWhere.face_encoding = { [Op.ne]: null };
      } else if (hasFace === 'no') {
        personWhere.face_encoding = null;
      }

      // searchQuery filter (Person + User)
      if (searchQuery) {
        where[Op.or] = [
          { mrn: { [Op.like]: `%${searchQuery}%` } },
          { patient_uuid: { [Op.like]: `%${searchQuery}%` } },
          { '$person.first_name$': { [Op.like]: `%${searchQuery}%` } },
          { '$person.last_name$': { [Op.like]: `%${searchQuery}%` } },
          { '$person.phone$': { [Op.like]: `%${searchQuery}%` } }, // walk-in
          { '$person.email$': { [Op.like]: `%${searchQuery}%` } }, // walk-in
          { '$person.user.phone$': { [Op.like]: `%${searchQuery}%` } }, // registered
          { '$person.user.email$': { [Op.like]: `%${searchQuery}%` } }, // registered
        ];
      }

      const offset = (page - 1) * limit;

      const includes = [
        {
          model: Person,
          as: 'person',
          required: true,
          where: personWhere,
          attributes: [
            'person_id',
            'first_name',
            'middle_name',
            'last_name',
            'suffix',
            'date_of_birth',
            'gender',
            'gender_specification',
            'blood_type',
            'nationality',
            'civil_status',
            'occupation',
            'religion',
            'phone', // ✅ walk-in phone
            'email', // ✅ walk-in email
            'face_encoding',
          ],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['phone', 'email'],
              required: false, // ✅ DO NOT filter out walk-ins
            },
            {
              model: PersonContact,
              as: 'contacts',
              required: false,
              separate: true,
            },
            {
              model: PersonAddress,
              as: 'addresses',
              required: false,
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
      ];

      // Medical data only for doctors & nurses
      if (userRole === 'doctor' || userRole === 'nurse') {
        includes.push(
          {
            model: MedicalRecord,
            as: 'medicalRecords',
            required: false,
            separate: true,
            limit: 5,
            order: [['created_at', 'DESC']],
          },
          {
            model: Appointment,
            as: 'appointments',
            required: false,
            separate: true,
            limit: 5,
            order: [['appointment_date', 'DESC']],
          },
        );
      }

      const { rows: patients, count: total } = await Patient.findAndCountAll({
        where,
        offset,
        limit: parseInt(limit),
        distinct: true,
        include: includes,
        order: [['created_at', 'DESC']],
      });

      const stats = await this.calculatePatientStats(userRole);
      // Normalize response
      const normalizedPatients = patients.map(patient => {
        const p = patient.toJSON();

        const phone = p.person?.user?.phone ?? p.person?.phone ?? null;

        const email = p.person?.user?.email ?? p.person?.email ?? null;

        const baseData = {
          // Patient details
          patient_id: p.patient_id,
          patient_uuid: p.patient_uuid,
          mrn: p.mrn,
          patient_status: p.patient_status,
          registration_type: p.registration_type,
          first_visit_date: p.first_visit_date,
          insurance_provider: p.insurance_provider,
          insurance_number: p.insurance_number,
          insurance_expiry: p.insurance_expiry,
          created_at: p.created_at,

          // Person details
          person_id: p.person?.person_id,
          first_name: p.person?.first_name,
          middle_name: p.person?.middle_name,
          last_name: p.person?.last_name,
          suffix: p.person?.suffix,
          date_of_birth: p.person?.date_of_birth,
          gender: p.person?.gender,
          gender_specification: p.person?.gender_specification,
          blood_type: p.blood_type || p.person?.blood_type,
          nationality: p.person?.nationality,
          civil_status: p.person?.civil_status,
          occupation: p.person?.occupation,
          religion: p.person?.religion,

          // Contact (single source for frontend)
          phone,
          email,

          // Emergency contacts
          contacts: (p.person?.contacts || []).map(contact => ({
            contact_id: contact.contact_id,
            contact_type: contact.is_primary
              ? 'Primary Contact'
              : 'Emergency Contact',
            contact_number: contact.contact_number,
            contact_name: contact.contact_name,
            relationship: contact.relationship,
            is_primary: contact.is_primary,
          })),

          // Addresses
          addresses: (p.person?.addresses || []).map(address => ({
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
            barangay: address.barangay?.barangay_name || null,
            city: address.city?.city_name || null,
            province: address.province?.province_name || null,
            region: address.region?.region_name || null,
          })),

          has_face: !!p.person?.face_encoding,
        };

        if (userRole === 'doctor' || userRole === 'nurse') {
          baseData.medicalRecords = p.medicalRecords || [];
          baseData.appointments = p.appointments || [];
        }

        return baseData;
      });

      return {
        patients: normalizedPatients,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats,
      };
    } catch (error) {
      console.error('Get all patients error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get patients', 500);
    }
  }

  async calculatePatientStats(userRole = 'receptionist') {
    try {
      // Base stats for all roles
      const baseStats = {
        total: await Patient.count(),
        active: await Patient.count({ where: { patient_status: 'active' } }),
        inactive: await Patient.count({
          where: { patient_status: 'inactive' },
        }),
        withoutFace: await Patient.count({
          include: [
            {
              model: Person,
              as: 'person',
              where: { face_encoding: null },
              required: true,
            },
          ],
        }),
      };

      // Receptionist/Admin specific stats
      if (userRole === 'receptionist' || userRole === 'admin') {
        const [
          totalPatients,
          activePatients,
          patientsWithInsurance,
          patientsWithoutInsurance,
          totalAppointments,
          upcomingAppointments,
          newPatientsThisMonth,
          newPatientsThisWeek,
        ] = await Promise.all([
          Patient.count(),
          Patient.count({ where: { patient_status: 'active' } }),
          Patient.count({
            where: {
              insurance_provider: { [Op.ne]: null },
              insurance_number: { [Op.ne]: null },
            },
          }),
          Patient.count({
            where: {
              [Op.or]: [
                { insurance_provider: null },
                { insurance_number: null },
              ],
            },
          }),
          Appointment.count(),
          Appointment.count({
            where: {
              appointment_date: { [Op.gte]: new Date() },
              status: { [Op.in]: ['scheduled', 'confirmed'] },
            },
          }),
          Patient.count({
            where: {
              created_at: {
                [Op.gte]: new Date(new Date().setDate(1)), // First day of month
              },
            },
          }),
          Patient.count({
            where: {
              created_at: {
                [Op.gte]: new Date(
                  new Date().setDate(new Date().getDate() - 7),
                ),
              },
            },
          }),
        ]);

        return {
          ...baseStats,
          totalPatients,
          activePatients,
          patientsWithInsurance,
          patientsWithoutInsurance,
          totalAppointments,
          upcomingAppointments,
          newPatientsThisMonth,
          newPatientsThisWeek,
        };
      }

      // Return base stats for other roles
      return baseStats;
    } catch (error) {
      console.error('Calculate patient stats error:', error.message);
      throw error;
    }
  }

  async addFaceToExistingPerson(data) {
    const { personId, faceImageBase64, ipAddress, userAgent, staffId } = data;

    const transaction = await sequelize.transaction();
    let faceTokenToCleanup = null;
    let savedFiles = [];

    try {
      // PHASE 1: Validate person exists and has no face
      const person = await Person.findOne({
        where: {
          person_id: personId,
          is_deleted: false,
        },
        transaction,
      });

      if (!person) {
        throw new AppError('Person not found', 404);
      }

      if (person.face_encoding) {
        throw new AppError(
          'This person already has face registration. Cannot register again.',
          409,
        );
      }

      if (!faceImageBase64) {
        throw new AppError('Face image is required', 400);
      }

      const faceImageBuffer = Buffer.from(faceImageBase64, 'base64');

      // PHASE 2: Process face & check duplicates
      const faceData =
        await this.faceProcessingService.processFaceFromCamera(faceImageBuffer);
      faceTokenToCleanup = faceData.face_encoding;

      // Check for duplicate faces
      await this.faceProcessingService.checkDuplicateFace(
        faceData.face_encoding,
        transaction,
      );

      // PHASE 3: Save face image
      const faceImageResult = await this.faceProcessingService.saveFaceImage(
        faceData.cropped_face_buffer,
        personId,
      );
      savedFiles.push(faceImageResult.filepath);

      // PHASE 4: Add to FaceSet
      await this.faceProcessingService.addFaceToFaceSet(
        faceData.face_encoding,
        personId,
      );

      // PHASE 5: Update person record
      await person.update(
        {
          face_encoding: faceData.face_encoding,
          face_image_path: faceImageResult.relativePath,
          face_quality_score: faceData.face_quality_score,
          face_captured_at: new Date(),
          face_capture_device: 'walk_in_camera_update',
        },
        { transaction },
      );

      // Audit log
      await auditHelper.createLog({
        userId: staffId || null,
        tableName: 'person',
        recordId: person.person_id,
        action: 'face_registration_added',
        oldData: {
          face_encoding: null,
          face_image_path: null,
        },
        newData: {
          face_encoding: faceData.face_encoding,
          face_image_path: faceImageResult.relativePath,
          face_quality_score: faceData.face_quality_score,
        },
        userAgent,
        ipAddress,
        transaction,
      });

      await transaction.commit();

      return {
        success: true,
        message: 'Face registered successfully',
        data: {
          person: {
            person_id: person.person_id,
            first_name: person.first_name,
            last_name: person.last_name,
            face_quality_score: faceData.face_quality_score,
            face_captured_at: new Date(),
          },
          face: {
            quality_score: faceData.face_quality_score,
            added_to_faceset: true,
          },
        },
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      // Remove from FaceSet if added
      if (faceTokenToCleanup) {
        await this.faceProcessingService.removeFaceFromFaceSet(
          faceTokenToCleanup,
        );
      }

      // Delete saved files
      for (const filepath of savedFiles) {
        try {
          await fs.unlink(filepath);
        } catch (e) {
          console.error('Failed to delete file:', filepath);
        }
      }

      console.error('❌ Face registration failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Face registration failed', 500);
    }
  }

  async getNursesPatients(nurseUuid, filters = {}) {
    try {
      // Verify user is a nurse (role check)
      if (!nurseUuid) {
        throw new AppError('Nurse staff record not found.', 404);
      }

      const {
        status,
        searchQuery = '',
        gender,
        page = 1,
        limit = 10,
      } = filters;

      // 1. Find the nurse
      const nurse = await Staff.findOne({
        where: { staff_uuid: nurseUuid },
      });

      if (!nurse) {
        throw new AppError('Nurse not found.', 404);
      }

      // 2. Get all patients in nurse's active care team
      const careTeamAssignments = await PatientCareTeam.findAll({
        where: {
          staff_id: nurse.staff_id,
          is_active: true,
          role_in_care: 'primary_nurse', // Only primary nurse assignments
        },
        attributes: ['patient_id'],
      });

      const assignedPatientIds = careTeamAssignments.map(ct => ct.patient_id);

      if (assignedPatientIds.length === 0) {
        // Nurse has no assigned patients
        return {
          patients: [],
          pagination: {
            currentPage: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0,
          },
          stats: {
            total: 0,
            active: 0,
            inactive: 0,
            totalMedicalRecords: 0,
            totalAppointments: 0,
            upcomingAppointments: 0,
            completedAppointments: 0,
          },
        };
      }

      // 3. Build where clause for patients
      const patientWhere = {
        patient_id: { [Op.in]: assignedPatientIds }, // CRITICAL: Only assigned patients
      };

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

      const { rows: patients, count: filteredTotal } =
        await Patient.findAndCountAll({
          where: patientWhere,
          include: [
            {
              model: Person,
              as: 'person',
              include: [
                { model: User, as: 'user' },
                { model: PersonContact, as: 'contacts' },
                { model: PersonAddress, as: 'addresses' },
              ],
            },
          ],
          distinct: true,
          offset,
          limit: parseInt(limit),
          order: [['created_at', 'DESC']],
        });

      const stats = await this.getNursePatientStats(nurse.staff_id);

      const normalizedPatient = patients.map(patient =>
        normalizePatientData(patient),
      );

      return {
        patients: normalizedPatient,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total: filteredTotal,
          totalPages: Math.ceil(filteredTotal / limit),
        },
        stats,
      };
    } catch (error) {
      console.error('Get nurse patients error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError(`Get nurse's patients error`, 500);
    }
  }

  /**
   * Get statistics for nurse's assigned patients
   */
  async getNursePatientStats(nurseStaffId) {
    try {
      // Get active care team patient IDs
      const careTeamAssignments = await PatientCareTeam.findAll({
        where: {
          staff_id: nurseStaffId,
          is_active: true,
          role_in_care: 'primary_nurse',
        },
        attributes: ['patient_id'],
      });

      const assignedPatientIds = careTeamAssignments.map(ct => ct.patient_id);

      if (assignedPatientIds.length === 0) {
        return {
          total: 0,
          active: 0,
          inactive: 0,
          totalMedicalRecords: 0,
          totalAppointments: 0,
          upcomingAppointments: 0,
          completedAppointments: 0,
        };
      }

      const [
        total,
        active,
        inactive,
        totalMedicalRecords,
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
      ] = await Promise.all([
        // Total assigned patients
        Patient.count({
          where: {
            patient_id: { [Op.in]: assignedPatientIds },
          },
        }),
        // Active patients
        Patient.count({
          where: {
            patient_id: { [Op.in]: assignedPatientIds },
            patient_status: 'active',
          },
        }),
        // Inactive patients
        Patient.count({
          where: {
            patient_id: { [Op.in]: assignedPatientIds },
            patient_status: 'inactive',
          },
        }),
        // Total medical records for assigned patients
        MedicalRecord.count({
          where: {
            patient_id: { [Op.in]: assignedPatientIds },
          },
        }),
        // Total appointments for assigned patients
        Appointment.count({
          where: {
            patient_id: { [Op.in]: assignedPatientIds },
          },
        }),
        // Upcoming appointments
        Appointment.count({
          where: {
            patient_id: { [Op.in]: assignedPatientIds },
            appointment_date: { [Op.gte]: new Date() },
            status: { [Op.in]: ['scheduled', 'confirmed'] },
          },
        }),
        // Completed appointments
        Appointment.count({
          where: {
            patient_id: { [Op.in]: assignedPatientIds },
            status: 'completed',
          },
        }),
      ]);

      return {
        total,
        active,
        inactive,
        totalMedicalRecords,
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
      };
    } catch (error) {
      console.error('Get nurse patient stats error:', error.message);
      throw error;
    }
  }

  /**
   * Get patient details with care team validation
   */
  async getNursePatientDetails(patientUuid, nurseStaffId) {
    try {
      // 1. Get patient
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
      });

      if (!patient) {
        throw new AppError('Patient not found.', 404);
      }

      // 2. Verify nurse is on care team
      const isOnCareTeam = await PatientCareTeam.isOnCareTeam(
        patient.patient_id,
        nurseStaffId,
      );

      if (!isOnCareTeam) {
        throw new AppError(
          'Access denied. You are not assigned to this patient.',
          403,
        );
      }

      // 3. Get full patient details
      const patientDetails = await this.getPatientDetails(patientUuid);

      return patientDetails;
    } catch (error) {
      console.error('Get nurse patient details error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get patient details', 500);
    }
  }

  /**
   * Get patient medical records with care team validation
   */
  async getNursePatientMedicalRecords(
    patientUuid,
    nurseStaffId,
    nurseUserId,
    filters = {},
    requestInfo = {},
  ) {
    try {
      // 1. Get patient
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
      });

      if (!patient) {
        throw new AppError('Patient not found.', 404);
      }

      // 2. Verify nurse is on care team
      const isOnCareTeam = await PatientCareTeam.isOnCareTeam(
        patient.patient_id,
        nurseStaffId,
      );

      if (!isOnCareTeam) {
        throw new AppError(
          'Access denied. You are not assigned to this patient.',
          403,
        );
      }

      // 3. Prepare filters for MedicalRecordsService
      const medicalRecordFilters = {
        page: parseInt(filters.page) || 1,
        limit: parseInt(filters.limit) || 50,
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
        recordType: filters.recordType || null,
        status: filters.status || null,
        visitType: filters.visitType || null,
        search: filters.search || null,
        accessReason: 'Nurse viewing patient medical records',
      };

      // 4. Get medical records using MedicalRecordsService
      const records = await MedicalRecordsService.getMedicalRecords({
        requestingUserId: nurseUserId,
        requestingUserRole: 'nurse',
        requestingStaffId: nurseStaffId,
        patientId: patient.patient_id,
        filters: medicalRecordFilters,
        requestInfo,
      });

      return records;
    } catch (error) {
      console.error('Get nurse patient medical records error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get medical records', 500);
    }
  }

  /**
   * Get nurse's care team assignments
   */
  async getNurseCareTeamAssignments(nurseStaffId) {
    try {
      const assignments = await PatientCareTeam.findAll({
        where: {
          staff_id: nurseStaffId,
          is_active: true,
        },
        include: [
          {
            model: Patient,
            as: 'patient',
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'middle_name', 'last_name'],
              },
            ],
          },
          {
            model: User,
            as: 'assigner',
            attributes: ['email'],
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'last_name'],
              },
            ],
          },
        ],
        order: [['start_date', 'DESC']],
      });

      return {
        assignments: assignments.map(a => ({
          care_team_id: a.care_team_id,
          patient: {
            patient_id: a.patient.patient_id,
            patient_uuid: a.patient.patient_uuid,
            mrn: a.patient.mrn,
            full_name: `${a.patient.person.first_name} ${a.patient.person.last_name}`,
          },
          role_in_care: a.role_in_care,
          start_date: a.start_date,
          assigned_by: a.assigner
            ? `${a.assigner.person.first_name} ${a.assigner.person.last_name}`
            : 'System',
          assignment_reason: a.assignment_reason,
        })),
        total: assignments.length,
      };
    } catch (error) {
      console.error('Get nurse care team assignments error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get care team assignments', 500);
    }
  }
}

export default new patientServce();
