import { DataTypes, Model, Op } from 'sequelize';
import sequelize from '../../config/db.config.js';
import Patient from '../patient/Patient.model.js';
import Appointment from '../appointment/Appointment.model.js';
import Staff from './Staff.model.js';
import Person from '../patient/Person.model.js';
import BedAssignment from './BedAssignment.model.js';
import Bed from './Bed.model.js';
import Prescription from '../prescription/Prescription.model.js';
import PrescriptionItem from '../prescription/PrescriptionItem.model.js';
import Room from './Room.model.js';
import User from '../auth/User.model.js';
import AdmissionProgressNote from './AdmissionProgressNote.model.js';
import MedicalRecord from '../patient/MedicalRecord.model.js';
import PersonContact from '../patient/PersonContact.model.js';
import PersonAddress from '../patient/PersonAddress.model.js';

class Admission extends Model {
  static async getAllAdmissions(filters = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'active', // 'active', 'pending_discharge', 'discharged', etc.
      admission_type = '',
      admission_source = '',
      from_date = '',
      to_date = '',
      floor = '',
      discharge_from = '',
      discharge_to = '',
      doctor_id = '',
    } = filters;

    const where = {};

    // Status filter - if empty, show all except deleted
    if (status) {
      where.admission_status = status;
    } else {
      // Show all admissions except those marked as deleted
      where.admission_status = {
        [Op.notIn]: ['deleted', 'cancelled'],
      };
    }

    // Admission type filter
    if (admission_type) {
      where.admission_type = admission_type;
    }

    // Admission source filter
    if (admission_source) {
      where.admission_source = admission_source;
    }

    // Admission date range filter
    if (from_date && to_date) {
      where.admission_date = {
        [Op.between]: [from_date, to_date],
      };
    } else if (from_date) {
      where.admission_date = {
        [Op.gte]: from_date,
      };
    } else if (to_date) {
      where.admission_date = {
        [Op.lte]: to_date,
      };
    }

    // Discharge date range filter
    if (discharge_from && discharge_to) {
      where.discharge_date = {
        [Op.between]: [discharge_from, discharge_to],
      };
    } else if (discharge_from) {
      where.discharge_date = {
        [Op.gte]: discharge_from,
      };
    } else if (discharge_to) {
      where.discharge_date = {
        [Op.lte]: discharge_to,
      };
    }

    // Doctor filter
    if (doctor_id) {
      where.attending_doctor_id = parseInt(doctor_id);
    }

    // Create search conditions
    let searchCondition = {};
    if (search) {
      searchCondition = {
        [Op.or]: [
          { admission_number: { [Op.like]: `%${search}%` } },
          { '$patient.mrn$': { [Op.like]: `%${search}%` } },
          { '$patient.person.first_name$': { [Op.like]: `%${search}%` } },
          { '$patient.person.last_name$': { [Op.like]: `%${search}%` } },
          { '$bedAssignments.bed.bed_number$': { [Op.like]: `%${search}%` } },
          { '$patient.person.user.phone$': { [Op.like]: `%${search}%` } },
          { '$patient.person.user.email$': { [Op.like]: `%${search}%` } },
        ],
      };
    }

    // Floor filter
    let floorCondition = {};
    if (floor) {
      floorCondition = {
        '$bedAssignments.bed.room.floor_number$': parseInt(floor),
      };
    }

    // Combine all conditions
    const finalWhere = {
      ...where,
      ...(search && searchCondition),
      ...(floor && floorCondition),
    };

    const offset = (page - 1) * limit;

    try {
      const { rows: admissions, count: total } = await this.findAndCountAll({
        where: finalWhere,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['admission_date', 'DESC']],
        distinct: true,
        include: [
          {
            model: Patient,
            as: 'patient',
            attributes: [
              'patient_id',
              'mrn',
              'height',
              'weight',
              'chronic_conditions',
              'person_id',
            ],
            include: [
              {
                model: Person,
                as: 'person',
                attributes: [
                  'first_name',
                  'middle_name',
                  'last_name',
                  'date_of_birth',
                  'gender',
                  'blood_type',
                ],
                include: [
                  { model: User, as: 'user', attributes: ['phone', 'email'] },
                ],
              },
            ],
          },
          {
            model: Appointment,
            as: 'originatingAppointment',
            include: [
              {
                model: Staff,
                as: 'doctor',
                attributes: ['staff_id', 'specialization', 'employee_number'],
                include: [
                  {
                    model: Person,
                    as: 'person',
                    attributes: ['first_name', 'last_name'],
                    include: [
                      {
                        model: User,
                        as: 'user',
                        attributes: ['phone', 'email'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            model: Staff,
            as: 'attendingDoctor',
            attributes: ['staff_id', 'specialization', 'employee_number'],
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'last_name'],
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: ['phone', 'email'],
                  },
                ],
              },
            ],
          },
          {
            model: BedAssignment,
            as: 'bedAssignments',
            where: { is_current: true },
            required: false,
            include: [
              {
                model: Bed,
                as: 'bed',
                attributes: ['bed_id', 'bed_number', 'bed_status', 'bed_type'],
                include: [
                  {
                    model: Room,
                    as: 'room',
                    attributes: ['room_number', 'floor_number', 'room_type'],
                  },
                ],
              },
            ],
          },
          {
            model: Prescription,
            as: 'prescriptions',
            required: false,
            attributes: [
              'prescription_id',
              'created_at',
              'prescription_status',
            ],
            include: [
              {
                model: PrescriptionItem,
                as: 'items',
                required: false,
                attributes: [
                  'medication_name',
                  'dosage',
                  'frequency',
                  'route',
                  'duration',
                  'instructions',
                  'dispensed',
                  'dispensed_at',
                ],
              },
            ],
          },
        ],
        subQuery: false,
      });

      return {
        admissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error in getAllAdmissions:', error);
      throw error;
    }
  }

  static async getDoctorAdmissions(filters = {}) {
    const {
      doctor_id,
      page = 1,
      limit = 20,
      search = '',
      status = '', // 'active', 'discharged', etc.
      admission_type = '',
      from_date = '',
      to_date = '',
      floor = '',
      discharge_pending = false,
    } = filters;

    if (!doctor_id) {
      throw new Error('Doctor ID is required');
    }

    const where = {
      attending_doctor_id: parseInt(doctor_id),
    };

    // Status filter
    if (status) {
      where.admission_status = status;
    } else {
      // Default: show active and pending_discharge
      where.admission_status = { [Op.in]: ['active', 'pending_discharge'] };
    }

    // Admission type filter
    if (admission_type) {
      where.admission_type = admission_type;
    }

    // Admission date range filter
    if (from_date && to_date) {
      where.admission_date = {
        [Op.between]: [from_date, to_date],
      };
    } else if (from_date) {
      where.admission_date = {
        [Op.gte]: from_date,
      };
    } else if (to_date) {
      where.admission_date = {
        [Op.lte]: to_date,
      };
    }

    // Pending discharge filter
    if (discharge_pending === 'true' || discharge_pending === true) {
      where.admission_status = 'active';
      where.expected_discharge_date = {
        [Op.lte]: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    }

    // Create search conditions
    let searchCondition = {};
    if (search) {
      searchCondition = {
        [Op.or]: [
          { admission_number: { [Op.like]: `%${search}%` } },
          { '$patient.mrn$': { [Op.like]: `%${search}%` } },
          { '$patient.person.first_name$': { [Op.like]: `%${search}%` } },
          { '$patient.person.last_name$': { [Op.like]: `%${search}%` } },
          { '$bedAssignments.bed.bed_number$': { [Op.like]: `%${search}%` } },
          { diagnosis_at_admission: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    // Floor filter
    let floorCondition = {};
    if (floor) {
      floorCondition = {
        '$bedAssignments.bed.room.floor_number$': parseInt(floor),
      };
    }

    // Combine all conditions
    const finalWhere = {
      ...where,
      ...(search && searchCondition),
      ...(floor && floorCondition),
    };

    const offset = (page - 1) * limit;

    try {
      const { rows: admissions, count: total } = await this.findAndCountAll({
        where: finalWhere,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['admission_date', 'DESC']],
        distinct: true,
        subQuery: false,
        include: [
          {
            model: Patient,
            as: 'patient',
            attributes: [
              'patient_id',
              'patient_uuid',
              'mrn',
              'height',
              'weight',
              'chronic_conditions',
              'allergies',
              'blood_type',
            ],
            include: [
              {
                model: Person,
                as: 'person',
                attributes: [
                  'first_name',
                  'middle_name',
                  'last_name',
                  'date_of_birth',
                  'gender',
                  'phone',
                ],
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: ['phone', 'email'],
                  },
                  {
                    model: PersonContact,
                    as: 'contacts',
                    where: {
                      contact_type: 'emergency',
                      is_primary: true,
                    },
                    required: false,
                    attributes: [
                      'contact_number',
                      'contact_name',
                      'relationship',
                    ],
                  },
                ],
              },
            ],
          },
          {
            model: BedAssignment,
            as: 'bedAssignments',
            where: { is_current: true },
            required: false,
            include: [
              {
                model: Bed,
                as: 'bed',
                attributes: ['bed_id', 'bed_number', 'bed_status', 'bed_type'],
                include: [
                  {
                    model: Room,
                    as: 'room',
                    attributes: ['room_number', 'room_type', 'floor_number'],
                  },
                ],
              },
            ],
          },
          {
            model: Prescription,
            as: 'prescriptions',
            required: false,
            where: { prescription_status: 'active' },
            attributes: [
              'prescription_id',
              'prescription_number',
              'prescribed_by',
              'prescription_date',
              'prescription_status',
              'notes',
            ],
            include: [
              {
                model: PrescriptionItem,
                as: 'items',
                required: false,
                attributes: [
                  'item_id',
                  'medication_name',
                  'dosage',
                  'frequency',
                  'route',
                  'duration',
                  'quantity',
                  'instructions',
                  'dispensed',
                  'dispensed_at',
                ],
              },
            ],
          },
          {
            model: AdmissionProgressNote,
            as: 'progressNotes',
            required: false,
            where: {
              note_date: {
                [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
              },
              is_deleted: false,
            },
            limit: 1,
            order: [['note_date', 'DESC']],
            attributes: ['note_id', 'note_type', 'note_date', 'recorded_by'],
          },
        ],
      });

      // Add calculated fields
      const admissionsWithCalculations = admissions.map(admission => {
        const admissionData = admission.toJSON();

        // Calculate length of stay
        admissionData.length_of_stay = admission.getLengthOfStay();

        // Calculate age
        if (admissionData.patient?.person?.date_of_birth) {
          const birthDate = new Date(
            admissionData.patient.person.date_of_birth,
          );
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();

          if (
            monthDiff < 0 ||
            (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ) {
            age--;
          }
          admissionData.patient.age = age;
        }

        // Extract emergency contact from PersonContact
        if (
          admissionData.patient?.person?.contacts &&
          admissionData.patient.person.contacts.length > 0
        ) {
          const emergencyContact = admissionData.patient.person.contacts[0];
          admissionData.patient.emergency_contact = {
            name: emergencyContact.contact_name,
            number: emergencyContact.contact_number,
            relationship: emergencyContact.relationship,
          };
        }

        // Check if doctor has visited today
        admissionData.visited_today =
          admissionData.progressNotes &&
          admissionData.progressNotes.length > 0 &&
          admissionData.progressNotes[0].note_type === 'doctor_round';

        // Flag for pending discharge
        admissionData.is_discharge_pending =
          admissionData.admission_status === 'active' &&
          admissionData.expected_discharge_date &&
          new Date(admissionData.expected_discharge_date) <=
            new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Count active prescriptions
        const activePrescriptions = admissionData.prescriptions || [];
        admissionData.active_prescriptions_count = activePrescriptions.length;

        // Count pending medications (undispensed)
        const undispensedMeds = activePrescriptions
          .flatMap(p => p.items || [])
          .filter(item => !item.dispensed);
        admissionData.pending_medications_count = undispensedMeds.length;

        // Format bed information
        if (
          admissionData.bedAssignments &&
          admissionData.bedAssignments.length > 0
        ) {
          const bedAssignment = admissionData.bedAssignments[0];
          admissionData.current_bed = {
            bed_number: bedAssignment.bed?.bed_number,
            bed_type: bedAssignment.bed?.bed_type,
            bed_status: bedAssignment.bed?.bed_status,
            room_number: bedAssignment.bed?.room?.room_number,
            room_type: bedAssignment.bed?.room?.room_type,
            floor: bedAssignment.bed?.room?.floor_number,
          };
        } else {
          admissionData.current_bed = null;
        }

        return admissionData;
      });

      return {
        admissions: admissionsWithCalculations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error in getDoctorAdmissions:', error);
      throw error;
    }
  }

  static async getDoctorAdmissionDetails(admissionId, doctorId) {
    const admission = await this.findOne({
      where: {
        admission_id: admissionId,
        attending_doctor_id: doctorId,
      },
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: [
            'patient_id',
            'mrn',
            'height',
            'weight',
            'chronic_conditions',
            'allergies',
            'insurance_provider',
            'primary_doctor_id',
            'person_id',
          ],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: [
                'first_name',
                'middle_name',
                'last_name',
                'date_of_birth',
                'gender',
                'blood_type',
                'phone',
              ],
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['phone', 'email'],
                },
                {
                  model: PersonContact,
                  as: 'contacts',
                  required: false,
                  attributes: [
                    'contact_number',
                    'contact_name',
                    'relationship',
                    'contact_type',
                    'is_primary',
                  ],
                },
                {
                  model: PersonAddress,
                  as: 'addresses',
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: BedAssignment,
          as: 'bedAssignments',
          where: { is_current: true },
          required: false,
          include: [
            {
              model: Bed,
              as: 'bed',
              attributes: ['bed_id', 'bed_number', 'bed_status', 'bed_type'],
              include: [
                {
                  model: Room,
                  as: 'room',
                  attributes: ['room_number', 'floor_number', 'room_type'],
                },
              ],
            },
          ],
        },
        {
          model: Prescription,
          as: 'prescriptions',
          required: false,
          include: [
            {
              model: PrescriptionItem,
              as: 'items',
              required: false,
              attributes: [
                'medication_name',
                'dosage',
                'frequency',
                'route',
                'duration',
                'instructions',
                'dispensed',
                'dispensed_at',
              ],
            },
            {
              model: Staff,
              as: 'prescribedBy',
              attributes: ['staff_id', 'specialization'],
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: ['first_name', 'last_name'],
                },
              ],
            },
          ],
        },
        // REMOVED progressNotes and medicalRecords from main query
      ],
    });

    if (!admission) {
      console.error('ERROR: Admission not found');
      throw new Error('Admission not found or access denied');
    }

    // Add calculated fields
    const admissionData = admission.toJSON();

    // Calculate length of stay
    admissionData.length_of_stay = admission.getLengthOfStay();

    // Calculate age
    if (admissionData.patient?.person?.date_of_birth) {
      const birthDate = new Date(admissionData.patient.person.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
      admissionData.patient.age = age;
    }

    const progressNotes = await AdmissionProgressNote.findAll({
      where: {
        admission_id: admissionId,
        is_deleted: false,
      },
      include: [
        {
          model: Staff,
          as: 'recorder',
          attributes: ['staff_id'],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
            },
          ],
        },
        {
          model: Staff,
          as: 'amender',
          required: false,
          attributes: ['staff_id'],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
            },
          ],
        },
      ],
      order: [['note_date', 'DESC']],
      limit: 10,
    });

    admissionData.progressNotes = progressNotes.map(note => note.toJSON());

    const medicalRecords = await MedicalRecord.findAll({
      where: {
        patient_id: admissionData.patient_id,
        visit_type: 'admission',
        visit_id: admissionId,
      },
      attributes: [
        'record_id',
        'record_type',
        'record_date',
        'notes',
        'diagnosis',
        'treatment',
      ],
      order: [['record_date', 'DESC']],
      limit: 5,
    });

    admissionData.medicalRecords = medicalRecords.map(record =>
      record.toJSON(),
    );

    const latestVitals = await AdmissionProgressNote.findOne({
      where: {
        admission_id: admissionId,
        is_deleted: false,
      },
      order: [['note_date', 'DESC']],
      attributes: [
        'temperature',
        'blood_pressure_systolic',
        'blood_pressure_diastolic',
        'heart_rate',
        'respiratory_rate',
        'oxygen_saturation',
        'pain_level',
        'consciousness_level',
        'note_date',
        'recorded_by',
      ],
      include: [
        {
          model: Staff,
          as: 'recorder',
          attributes: ['staff_id'],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
            },
          ],
        },
      ],
    });

    admissionData.latest_vitals = latestVitals ? latestVitals.toJSON() : null;

    return admissionData;
  }

  static async getDoctorAdmissionStats(doctorId, period = 'month') {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const stats = await this.findAll({
      where: {
        attending_doctor_id: doctorId,
        admission_date: { [Op.gte]: startDate },
      },
      attributes: [
        [
          sequelize.fn('COUNT', sequelize.col('admission_id')),
          'total_admissions',
        ],
        [
          sequelize.fn(
            'SUM',
            sequelize.literal(
              "CASE WHEN admission_status = 'active' THEN 1 ELSE 0 END",
            ),
          ),
          'active_admissions',
        ],
        [
          sequelize.fn(
            'SUM',
            sequelize.literal(
              "CASE WHEN admission_status = 'discharged' THEN 1 ELSE 0 END",
            ),
          ),
          'discharged_admissions',
        ],
        [
          sequelize.fn('AVG', sequelize.col('length_of_stay_days')),
          'avg_length_of_stay',
        ],
      ],
      raw: true,
    });

    // Get admission types breakdown
    const typeStats = await this.findAll({
      where: {
        attending_doctor_id: doctorId,
        admission_date: { [Op.gte]: startDate },
      },
      attributes: [
        'admission_type',
        [sequelize.fn('COUNT', sequelize.col('admission_id')), 'count'],
      ],
      group: ['admission_type'],
      raw: true,
    });

    // Get pending discharges
    const pendingDischarges = await this.count({
      where: {
        attending_doctor_id: doctorId,
        admission_status: 'active',
        expected_discharge_date: {
          [Op.lte]: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      period,
      start_date: startDate,
      end_date: new Date(),
      ...stats[0],
      admission_types: typeStats,
      pending_discharges: pendingDischarges,
    };
  }

  // Get patients for doctor's rounds (patients not visited today)
  static async getPatientsForDoctorRounds(doctorId, floor = null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where = {
      attending_doctor_id: doctorId,
      admission_status: 'active',
    };

    const admissions = await this.findAll({
      where,
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['patient_id', 'mrn'],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'last_name', 'date_of_birth'],
            },
          ],
        },
        {
          model: BedAssignment,
          as: 'bedAssignments',
          where: { is_current: true },
          required: true,
          include: [
            {
              model: Bed,
              as: 'bed',
              attributes: ['bed_number'],
              include: [
                {
                  model: Room,
                  as: 'room',
                  attributes: ['room_number', 'floor_number'],
                },
              ],
            },
          ],
        },
        {
          model: AdmissionProgressNote,
          as: 'progressNotes',
          required: false,
          where: {
            note_type: 'doctor_round',
            note_date: {
              [Op.gte]: today,
            },
          },
          attributes: ['note_id', 'note_date'],
        },
      ],
      order: [
        ['expected_discharge_date', 'ASC'], // Prioritize pending discharges
        ['admission_date', 'DESC'],
      ],
    });

    // Filter and format response
    const formatted = admissions
      .filter(admission => {
        const bed = admission.bedAssignments[0];
        if (!bed) return false;

        // Floor filter
        if (floor && bed.bed.room.floor_number !== parseInt(floor)) {
          return false;
        }

        return true;
      })
      .map(admission => {
        const data = admission.toJSON();
        const bed = data.bedAssignments[0];

        // Check if doctor has visited today
        const visitedToday =
          data.progressNotes && data.progressNotes.length > 0;

        // Calculate age
        let age = null;
        if (data.patient?.person?.date_of_birth) {
          const birthDate = new Date(data.patient.person.date_of_birth);
          const ageDiff = Date.now() - birthDate.getTime();
          const ageDate = new Date(ageDiff);
          age = Math.abs(ageDate.getUTCFullYear() - 1970);
        }

        // Calculate priority
        let priority = 0;
        if (
          data.expected_discharge_date &&
          new Date(data.expected_discharge_date) <=
            new Date(Date.now() + 24 * 60 * 60 * 1000)
        ) {
          priority += 3; // Higher priority for pending discharge
        }

        const los = admission.getLengthOfStay();
        if (los > 7) priority += 1;
        if (los > 14) priority += 1;
        if (visitedToday) priority = 0; // Lower priority if visited today

        return {
          admission_id: data.admission_id,
          patient: {
            patient_id: data.patient.patient_id,
            name: `${data.patient.person.first_name} ${data.patient.person.last_name}`,
            mrn: data.patient.mrn,
            age,
          },
          location: {
            bed: bed?.bed?.bed_number,
            room: bed?.bed?.room?.room_number,
            floor: bed?.bed?.room?.floor_number,
            room_type: bed?.bed?.room?.room_type,
          },
          diagnosis: data.diagnosis_at_admission,
          admission_date: data.admission_date,
          expected_discharge_date: data.expected_discharge_date,
          length_of_stay: los,
          visited_today: visitedToday,
          priority,
        };
      });

    return formatted;
  }

  getLengthOfStay() {
    if (this.discharge_date) {
      const diff = this.discharge_date - this.admission_date;
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    const diff = new Date() - this.admission_date;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}

Admission.init(
  {
    admission_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admission_number: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    admission_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    admission_type: {
      type: DataTypes.ENUM('elective', 'emergency', 'transfer', 'delivery'),
      allowNull: false,
    },
    admission_source: {
      type: DataTypes.ENUM('er', 'outpatient', 'referral', 'direct'),
      allowNull: false,
    },
    attending_doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    diagnosis_at_admission: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    expected_discharge_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    admission_status: {
      type: DataTypes.ENUM('active', 'discharged', 'transferred', 'deceased'),
      defaultValue: 'active',
    },
    discharge_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    discharge_type: {
      type: DataTypes.ENUM(
        'routine',
        'against_advice',
        'transferred',
        'deceased',
        'pending_discharge',
      ),
      allowNull: true,
    },
    discharge_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    length_of_stay_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Admission',
    tableName: 'admissions',
    timestamps: false,
    indexes: [
      { name: 'idx_admission_number', fields: ['admission_number'] },
      { name: 'idx_patient_id', fields: ['patient_id'] },
    ],
  },
);

export default Admission;
