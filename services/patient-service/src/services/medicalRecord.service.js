import { Op } from 'sequelize';
import {
  PHIAccessLog,
  PatientConsent,
  PatientCareTeam,
  Patient,
  Staff,
  Person,
  User,
  Appointment,
  Admission,
  MedicalRecord,
  AppointmentDiagnosis,
  AppointmentVitals,
  AdmissionProgressNote,
  Prescription,
  PrescriptionItem,
  ConsentRestriction,
  sequelize,
} from '../../../shared/models/index.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

class MedicalRecordsService {
  /**
   * Get medical records based on user role with HIPAA compliance
   */
  async getMedicalRecords({
    requestingUserId,
    requestingUserRole,
    requestingStaffId = null,
    patientId = null,
    filters = {},
    requestInfo = {},
  }) {
    try {
      // Step 1: Validate access and determine target patient
      const accessValidation = await this.validateAccess({
        requestingUserId,
        requestingUserRole,
        requestingStaffId,
        patientId,
      });

      if (!accessValidation.hasAccess) {
        throw new AppError(
          'Access denied. You do not have permission to view these medical records.',
          403,
        );
      }

      const targetPatientId = accessValidation.targetPatientId;

      // Step 2: Log access to PHI (HIPAA requirement)
      await this.logPHIAccess({
        userId: requestingUserId,
        staffId: requestingStaffId,
        userRole: requestingUserRole,
        patientId: targetPatientId,
        accessType: 'view_medical_records',
        resourceType: 'medical_record',
        accessReason: filters.accessReason || 'Viewing medical records',
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        sessionId: requestInfo.sessionId,
      });

      // Step 3: Fetch medical records
      const records = await this.fetchMedicalRecords({
        patientId: targetPatientId,
        filters,
        requestingUserRole,
      });

      return records;
    } catch (error) {
      console.error('Get medical records failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to retrieve medical records.', 500);
    }
  }

  /**
   * Validate if user has access to patient records
   */
  async validateAccess({
    requestingUserId,
    requestingUserRole,
    requestingStaffId,
    patientId,
  }) {
    let targetPatientId = patientId;
    let hasAccess = false;

    switch (requestingUserRole) {
      case 'patient': {
        const patient = await Patient.findOne({
          include: [
            {
              model: Person,
              as: 'person',
              include: [
                {
                  model: User,
                  as: 'user',
                  where: { user_id: requestingUserId },
                },
              ],
            },
          ],
        });

        if (!patient) {
          return {
            hasAccess: false,
            reason: 'Patient record not found',
          };
        }

        targetPatientId = patient.patient_id;
        hasAccess = true;
        break;
      }

      case 'doctor':
      case 'nurse': {
        if (!patientId) {
          return {
            hasAccess: false,
            reason: 'Patient ID required for healthcare provider access',
          };
        }

        if (!requestingStaffId) {
          return {
            hasAccess: false,
            reason: 'Staff ID required for healthcare provider access',
          };
        }

        // Check treatment relationship
        const hasTreatmentRelationship = await this.checkTreatmentRelationship({
          staffId: requestingStaffId,
          patientId,
        });

        if (!hasTreatmentRelationship) {
          return {
            hasAccess: false,
            reason: 'No active treatment relationship with patient',
          };
        }

        // Check patient consent
        const hasConsent = await PatientConsent.hasActiveConsent(
          patientId,
          'treatment',
        );

        if (!hasConsent) {
          return {
            hasAccess: false,
            reason: 'Patient has not granted treatment consent',
          };
        }

        // Check access restrictions
        const restriction = await ConsentRestriction.isRestricted(
          patientId,
          requestingStaffId,
        );

        if (restriction.isRestricted) {
          return {
            hasAccess: false,
            reason: `Access restricted: ${restriction.reason}`,
          };
        }

        hasAccess = true;
        targetPatientId = patientId;
        break;
      }

      case 'admin': {
        if (!patientId) {
          return {
            hasAccess: false,
            reason: 'Patient ID required for admin access',
          };
        }

        hasAccess = true;
        targetPatientId = patientId;
        break;
      }

      default:
        return {
          hasAccess: false,
          reason: 'Invalid user role',
        };
    }

    return {
      hasAccess,
      targetPatientId,
      requestingUserRole,
    };
  }

  /**
   * Check if staff has active treatment relationship with patient
   */
  async checkTreatmentRelationship({ staffId, patientId }) {
    try {
      // Check recent appointments (within last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const recentAppointment = await Appointment.findOne({
        where: {
          patient_id: patientId,
          doctor_id: staffId,
          appointment_date: { [Op.gte]: sixMonthsAgo },
          status: { [Op.in]: ['scheduled', 'completed', 'in_progress'] },
        },
      });

      if (recentAppointment) return true;

      // Check active admissions
      const activeAdmission = await Admission.findOne({
        where: {
          patient_id: patientId,
          attending_doctor_id: staffId,
          admission_status: 'active',
        },
      });

      if (activeAdmission) return true;

      // Check care team membership
      const isOnCareTeam = await PatientCareTeam.isOnCareTeam(
        patientId,
        staffId,
      );

      return isOnCareTeam;
    } catch (error) {
      console.error('Treatment relationship check failed:', error.message);
      return false;
    }
  }

  /**
   * Fetch medical records and build timeline
   */
  async fetchMedicalRecords({ patientId, filters, requestingUserRole = null }) {
    try {
      const {
        page = 1,
        limit = 50,
        startDate = null,
        endDate = null,
        recordType = null,
        status = null,
        visitType = null,
        search = null,
      } = filters;

      // Convert to numbers
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 50;
      const offsetNum = (pageNum - 1) * limitNum;

      // Build date filter
      const dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter[Op.gte] = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter[Op.lte] = end;
      }

      // Build base where clause
      const baseWhere = { patient_id: patientId };

      // Fetch all record types concurrently
      const [medicalRecords, appointments, admissions] = await Promise.all([
        this.fetchMedicalRecordsData(patientId, filters, dateFilter, baseWhere),
        this.fetchAppointmentsData(patientId, filters, dateFilter, baseWhere),
        this.fetchAdmissionsData(patientId, filters, dateFilter, baseWhere),
      ]);

      // Apply search filter if needed
      const searchLower = search ? search.trim().toLowerCase() : '';
      let filteredAppointments = appointments;
      let filteredAdmissions = admissions;
      let filteredMedicalRecords = medicalRecords;

      if (searchLower) {
        filteredAppointments = this.filterAppointmentsBySearch(
          appointments,
          searchLower,
        );
        filteredAdmissions = this.filterAdmissionsBySearch(
          admissions,
          searchLower,
        );
        filteredMedicalRecords = this.filterMedicalRecordsBySearch(
          medicalRecords,
          searchLower,
        );
      }

      // Build unified timeline
      const timeline = this.buildMedicalTimeline({
        medicalRecords: filteredMedicalRecords,
        appointments: filteredAppointments,
        admissions: filteredAdmissions,
        requestingUserRole,
      });

      // Apply pagination
      const paginatedTimeline = timeline.slice(offsetNum, offsetNum + limitNum);

      return {
        timeline: paginatedTimeline,
        summary: {
          totalRecords: timeline.length,
          totalMedicalRecords: filteredMedicalRecords.length,
          totalAppointments: filteredAppointments.length,
          totalAdmissions: filteredAdmissions.length,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: timeline.length,
          totalPages: Math.ceil(timeline.length / limitNum),
        },
      };
    } catch (error) {
      console.error('Fetch medical records failed:', error.message);
      throw new AppError('Failed to fetch medical records', 500);
    }
  }

  /**
   * Fetch medical records data
   */
  async fetchMedicalRecordsData(patientId, filters, dateFilter, baseWhere) {
    const { visitType, search } = filters;

    const where = { ...baseWhere };

    // Apply date filter
    if (Object.keys(dateFilter).length > 0) {
      where.record_date = dateFilter;
    }

    // Apply visit type filter
    if (visitType && visitType !== '') {
      where.visit_type = visitType;
    }

    return MedicalRecord.findAll({
      where,
      include: [
        {
          model: Staff,
          as: 'doctor',
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
            },
          ],
        },
      ],
      order: [['record_date', 'DESC']],
    });
  }

  /**
   * Fetch appointments data
   */
  async fetchAppointmentsData(patientId, filters, dateFilter, baseWhere) {
    const { visitType, status } = filters;

    // If visitType is specified and not appointment, return empty
    if (visitType && visitType !== '' && visitType !== 'appointment') {
      return [];
    }

    const where = { ...baseWhere };

    // Apply date filter
    if (Object.keys(dateFilter).length > 0) {
      where.appointment_date = dateFilter;
    }

    // Apply status filter
    if (status && status !== '') {
      where.status = status;
    }

    return Appointment.findAll({
      where,
      include: [
        {
          model: AppointmentDiagnosis,
          as: 'diagnosis',
          required: false,
        },
        {
          model: AppointmentVitals,
          as: 'vitals',
          required: false,
        },
        {
          model: Staff,
          as: 'doctor',
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
            },
          ],
        },
        {
          model: Admission,
          as: 'resultingAdmission',
          required: false,
          include: this.getAdmissionIncludes(null),
        },
      ],
      order: [['appointment_date', 'DESC']],
    });
  }

  /**
   * Fetch admissions data
   */
  async fetchAdmissionsData(patientId, filters, dateFilter, baseWhere) {
    const { visitType, status } = filters;

    // If visitType is specified and not admission, return empty
    if (visitType && visitType !== '' && visitType !== 'admission') {
      return [];
    }

    const where = { ...baseWhere };

    // Apply date filter
    if (Object.keys(dateFilter).length > 0) {
      where.admission_date = dateFilter;
    }

    // Apply status filter
    if (status && status !== '') {
      where.admission_status = status;
    }

    return Admission.findAll({
      where,
      include: this.getAdmissionIncludes(null),
      order: [['admission_date', 'DESC']],
    });
  }

  /**
   * Filter medical records by search term
   */
  filterMedicalRecordsBySearch(medicalRecords, searchLower) {
    return medicalRecords.filter(record => {
      // Check record fields
      const matchesInRecord = this.searchInObject(record, searchLower, [
        'diagnosis',
        'treatment',
        'notes',
        'chief_complaint',
        'record_type',
        'visit_type',
      ]);

      // Check doctor name
      const matchesInDoctor = this.searchDoctorByName(
        record.doctor,
        searchLower,
      );

      return matchesInRecord || matchesInDoctor;
    });
  }

  /**
   * Filter appointments by search term
   */
  filterAppointmentsBySearch(appointments, searchLower) {
    return appointments.filter(appointment => {
      // Check appointment fields
      const matchesInAppointment = this.searchInObject(
        appointment,
        searchLower,
        ['appointment_type', 'status'],
      );

      // Check diagnosis array
      const diagnosisArray = Array.isArray(appointment.diagnosis)
        ? appointment.diagnosis
        : [appointment.diagnosis].filter(Boolean);

      const matchesInDiagnosis = diagnosisArray.some(diagnosis =>
        this.searchInObject(diagnosis, searchLower, [
          'chief_complaint',
          'primary_diagnosis',
          'treatment_plan',
          'disposition',
          'secondary_diagnoses',
        ]),
      );

      // Check vitals
      const matchesInVitals = this.searchInObject(
        appointment.vitals,
        searchLower,
        ['chief_complaint'],
      );

      // Check doctor name
      const matchesInDoctor = this.searchDoctorByName(
        appointment.doctor,
        searchLower,
      );

      // Check resulting admission
      const matchesInAdmission = appointment.resultingAdmission
        ? this.searchInObject(appointment.resultingAdmission, searchLower, [
            'admission_type',
            'admission_source',
            'diagnosis_at_admission',
          ]) ||
          this.searchDoctorByName(
            appointment.resultingAdmission.attendingDoctor,
            searchLower,
          )
        : false;

      return (
        matchesInAppointment ||
        matchesInDiagnosis ||
        matchesInVitals ||
        matchesInDoctor ||
        matchesInAdmission
      );
    });
  }

  /**
   * Filter admissions by search term
   */
  filterAdmissionsBySearch(admissions, searchLower) {
    return admissions.filter(admission => {
      // Check admission fields
      const matchesInAdmission = this.searchInObject(admission, searchLower, [
        'admission_type',
        'admission_source',
        'admission_status',
        'diagnosis_at_admission',
        'discharge_summary',
        'discharge_type',
        'admission_number',
      ]);

      // Check attending doctor name
      const matchesInDoctor = this.searchDoctorByName(
        admission.attendingDoctor,
        searchLower,
      );

      // Check progress notes
      const progressNotes = admission.progressNotes || [];
      const matchesInProgressNotes = progressNotes.some(
        note =>
          this.searchInObject(note, searchLower, [
            'subjective',
            'objective',
            'assessment',
            'plan',
            'note_type',
          ]) || this.searchDoctorByName(note.recorder, searchLower),
      );

      // Check prescriptions
      const prescriptions = admission.prescriptions || [];
      const matchesInPrescriptions = prescriptions.some(prescription =>
        this.searchInPrescription(prescription, searchLower),
      );

      return (
        matchesInAdmission ||
        matchesInDoctor ||
        matchesInProgressNotes ||
        matchesInPrescriptions
      );
    });
  }

  /**
   * Search for term in prescription
   */
  searchInPrescription(prescription, searchLower) {
    if (!prescription) return false;

    // Check prescription fields
    if (
      prescription.prescription_number?.toLowerCase().includes(searchLower) ||
      prescription.prescription_status?.toLowerCase().includes(searchLower)
    ) {
      return true;
    }

    // Check prescription items
    const items = prescription.items || [];
    return items.some(item =>
      this.searchInObject(item, searchLower, [
        'medication_name',
        'dosage',
        'frequency',
        'route',
        'duration',
        'instructions',
      ]),
    );
  }

  /**
   * Search for doctor by name
   */
  searchDoctorByName(doctor, searchLower) {
    if (!doctor || !doctor.person) return false;

    const { first_name, middle_name, last_name, suffix } = doctor.person;

    // Check first name
    if (first_name && first_name.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Check last name
    if (last_name && last_name.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Check full name combinations
    const fullName = `${first_name || ''} ${middle_name || ''} ${
      last_name || ''
    }`.toLowerCase();

    if (fullName.includes(searchLower)) {
      return true;
    }

    // Check if search term contains "dr" or "doctor" and matches name
    if (searchLower.includes('dr') || searchLower.includes('doctor')) {
      const nameWithoutPrefix = searchLower
        .replace('dr', '')
        .replace('doctor', '')
        .trim();
      if (nameWithoutPrefix) {
        return (
          (first_name &&
            first_name.toLowerCase().includes(nameWithoutPrefix)) ||
          (last_name && last_name.toLowerCase().includes(nameWithoutPrefix)) ||
          fullName.includes(nameWithoutPrefix)
        );
      }
    }

    return false;
  }

  /**
   * Search for term in object properties
   */
  searchInObject(obj, searchLower, properties) {
    if (!obj) return false;

    return properties.some(prop => {
      const value = obj[prop];
      return value && value.toString().toLowerCase().includes(searchLower);
    });
  }

  /**
   * Get admission includes based on user role
   */
  // Update the getAdmissionIncludes method in MedicalRecordsService
  getAdmissionIncludes(requestingUserRole) {
    const baseIncludes = [
      {
        model: AdmissionProgressNote,
        as: 'progressNotes',
        where: { is_deleted: false },
        required: false,
        separate: true,
        limit: 10, // Increased limit
        order: [['note_date', 'DESC']],
        include: [
          {
            model: Staff,
            as: 'recorder',
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'middle_name', 'last_name'],
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
          },
        ],
      },
      {
        model: Staff,
        as: 'attendingDoctor',
        include: [
          {
            model: Person,
            as: 'person',
            attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
          },
        ],
      },
    ];

    // For patients, we can filter or format progress notes differently if needed
    // For now, include them as-is but we might want to exclude sensitive notes
    return baseIncludes;
  }

  // Also update the formatProgressNotesForRole method to handle patient view:
  formatProgressNotesForRole(progressNotes, requestingUserRole) {
    return progressNotes.map(note => ({
      noteId: note.note_id,
      noteDate: note.note_date,
      noteType: note.note_type,
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      isCritical: note.is_critical,
      recordedBy: this.formatStaffName(note.recorder),
      recordedByFirstName: note.recorder?.person?.first_name || '',
      recordedByLastName: note.recorder?.person?.last_name || '',

      // For patients, we might want to show a summary instead of full details
      // or filter out certain types of notes
      canViewDetails: requestingUserRole !== 'patient' || !note.is_sensitive,
      // Add a summary for patients
      summary:
        requestingUserRole === 'patient'
          ? this.generateNoteSummary(note)
          : null,
    }));
  }

  // Add a helper method to generate patient-friendly summaries
  generateNoteSummary(note) {
    // Create a patient-friendly summary of the note
    const date = formatDate(note.note_date);
    const type = note.note_type || 'progress note';

    // Extract key information for patient
    const summary = `Medical update from ${date}: ${
      note.assessment || note.plan || 'Treatment progress noted'
    }`;

    // Limit the length
    return summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
  }

  /**
   * Build unified medical timeline from different record types
   */
  buildMedicalTimeline({
    medicalRecords,
    appointments,
    admissions,
    requestingUserRole = null,
  }) {
    const timeline = [];

    // Add medical records to timeline
    medicalRecords.forEach(record => {
      timeline.push({
        id: `mr-${record.record_id}`,
        type: 'medical_record',
        recordType: record.record_type,
        date: record.record_date,
        title: this.getRecordTitle(record.record_type),
        visitType: record.visit_type,
        visitId: record.visit_id,
        chiefComplaint: record.chief_complaint,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        notes: record.notes,
        doctor: this.formatDoctorName(record.doctor),
        doctorFirstName: record.doctor?.person?.first_name || '',
        doctorLastName: record.doctor?.person?.last_name || '',
      });
    });

    // Add appointments to timeline
    appointments.forEach(appointment => {
      const diagnosisArray = Array.isArray(appointment.diagnosis)
        ? appointment.diagnosis
        : [appointment.diagnosis].filter(Boolean);
      const diagnosisInfo = diagnosisArray[0];
      const vitalsInfo = appointment.vitals;
      const relatedAdmission = appointment.resultingAdmission;

      timeline.push({
        id: `apt-${appointment.appointment_id}`,
        type: 'appointment',
        date: appointment.appointment_date,
        title: 'Appointment',
        status: appointment.status,
        appointmentType: appointment.appointment_type,
        chiefComplaint:
          diagnosisInfo?.chief_complaint || vitalsInfo?.chief_complaint,
        diagnosis: diagnosisInfo?.primary_diagnosis,
        secondaryDiagnoses: diagnosisInfo?.secondary_diagnoses,
        treatmentPlan: diagnosisInfo?.treatment_plan,
        disposition: diagnosisInfo?.disposition,
        doctor: this.formatDoctorName(appointment.doctor),
        doctorFirstName: appointment.doctor?.person?.first_name || '',
        doctorLastName: appointment.doctor?.person?.last_name || '',
        vitals: vitalsInfo
          ? {
              temperature: vitalsInfo.temperature,
              bloodPressure: `${vitalsInfo.blood_pressure_systolic}/${vitalsInfo.blood_pressure_diastolic}`,
              heartRate: vitalsInfo.heart_rate,
              respiratoryRate: vitalsInfo.respiratory_rate,
              oxygenSaturation: vitalsInfo.oxygen_saturation,
              weight: vitalsInfo.weight,
              height: vitalsInfo.height,
              bmi: vitalsInfo.bmi,
              painLevel: vitalsInfo.pain_level,
            }
          : null,
        requiresAdmission: diagnosisInfo?.requires_admission,
        requiresFollowup: diagnosisInfo?.requires_followup,
        followupDate: diagnosisInfo?.followup_date,
        relatedAdmission: relatedAdmission
          ? this.formatAdmissionForTimeline(
              relatedAdmission,
              requestingUserRole,
            )
          : null,
      });
    });

    // Add admissions to timeline
    admissions.forEach(admission => {
      timeline.push({
        id: `adm-${admission.admission_id}`,
        type: 'admission',
        date: admission.admission_date,
        title: 'Hospital Admission',
        admissionNumber: admission.admission_number,
        admissionType: admission.admission_type,
        admissionSource: admission.admission_source,
        status: admission.admission_status,
        diagnosis: admission.diagnosis_at_admission,
        expectedDischargeDate: admission.expected_discharge_date,
        dischargeDate: admission.discharge_date,
        dischargeType: admission.discharge_type,
        dischargeSummary: admission.discharge_summary,
        lengthOfStay: admission.length_of_stay_days,
        doctor: this.formatDoctorName(admission.attendingDoctor),
        doctorFirstName: admission.attendingDoctor?.person?.first_name || '',
        doctorLastName: admission.attendingDoctor?.person?.last_name || '',
        progressNotesCount: admission.progressNotes?.length || 0,
        prescriptionsCount: admission.prescriptions?.length || 0,
        recentProgressNotes: this.formatProgressNotesForRole(
          admission.progressNotes?.slice(0, 3) || [],
          requestingUserRole,
        ),
        hasProgressNotes:
          admission.progressNotes && admission.progressNotes.length > 0,
        hasPrescriptions:
          admission.prescriptions && admission.prescriptions.length > 0,
        prescriptions:
          admission.prescriptions?.map(rx => this.formatPrescription(rx)) || [],
      });
    });

    // Sort by date (most recent first)
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return timeline;
  }

  /**
   * Format admission for timeline display
   */
  formatAdmissionForTimeline(admission, requestingUserRole) {
    return {
      id: `adm-${admission.admission_id}`,
      admissionNumber: admission.admission_number,
      admissionDate: admission.admission_date,
      admissionType: admission.admission_type,
      admissionSource: admission.admission_source,
      status: admission.admission_status,
      diagnosis: admission.diagnosis_at_admission,
      expectedDischargeDate: admission.expected_discharge_date,
      dischargeDate: admission.discharge_date,
      dischargeType: admission.discharge_type,
      dischargeSummary: admission.discharge_summary,
      lengthOfStay: admission.length_of_stay_days,
      doctor: this.formatDoctorName(admission.attendingDoctor),
      doctorFirstName: admission.attendingDoctor?.person?.first_name || '',
      doctorLastName: admission.attendingDoctor?.person?.last_name || '',
      progressNotesCount: admission.progressNotes?.length || 0,
      recentProgressNotes: this.formatProgressNotesForRole(
        admission.progressNotes?.slice(0, 3) || [],
        requestingUserRole,
      ),
      prescriptions:
        admission.prescriptions?.map(rx => this.formatPrescription(rx)) || [],
    };
  }

  /**
   * Format progress notes based on user role
   */
  formatProgressNotesForRole(progressNotes, requestingUserRole) {
    return progressNotes.map(note => ({
      noteId: note.note_id,
      noteDate: note.note_date,
      noteType: note.note_type,
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      isCritical: note.is_critical,
      recordedBy: this.formatStaffName(note.recorder),
      recordedByFirstName: note.recorder?.person?.first_name || '',
      recordedByLastName: note.recorder?.person?.last_name || '',
    }));
  }

  /**
   * Format prescription
   */
  formatPrescription(prescription) {
    return {
      prescriptionId: prescription.prescription_id,
      prescriptionNumber: prescription.prescription_number,
      prescriptionDate: prescription.prescription_date,
      status: prescription.prescription_status,
      items:
        prescription.items?.map(item => ({
          itemId: item.item_id,
          medicationName: item.medication_name,
          dosage: item.dosage,
          frequency: item.frequency,
          route: item.route,
          duration: item.duration,
          instructions: item.instructions,
          dispensed: item.dispensed,
        })) || [],
    };
  }

  /**
   * Get detailed view of a specific record
   */
  async getRecordDetails({
    requestingUserId,
    requestingUserRole,
    requestingStaffId,
    recordType,
    recordId,
    requestInfo = {},
  }) {
    try {
      let record = null;
      let patientId = null;

      // Fetch the record based on type
      switch (recordType) {
        case 'appointment':
          record = await Appointment.findByPk(recordId, {
            include: [
              { model: AppointmentDiagnosis, as: 'diagnosis' },
              { model: AppointmentVitals, as: 'vitals' },
              {
                model: Staff,
                as: 'doctor',
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
              {
                model: Admission,
                as: 'resultingAdmission',
                include: this.getAdmissionIncludes(requestingUserRole),
              },
            ],
          });
          patientId = record?.patient_id;
          break;

        case 'admission':
          record = await Admission.findByPk(recordId, {
            include: this.getAdmissionIncludes(requestingUserRole),
          });
          patientId = record?.patient_id;
          break;

        case 'medical_record':
          record = await MedicalRecord.findByPk(recordId, {
            include: [
              {
                model: Staff,
                as: 'doctor',
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
          });
          patientId = record?.patient_id;
          break;

        default:
          throw new AppError('Invalid record type', 400);
      }

      if (!record) {
        throw new AppError('Record not found', 404);
      }

      // Validate access
      const accessValidation = await this.validateAccess({
        requestingUserId,
        requestingUserRole,
        requestingStaffId,
        patientId,
      });

      if (!accessValidation.hasAccess) {
        throw new AppError('Access denied to this record', 403);
      }

      // Log access
      await this.logPHIAccess({
        userId: requestingUserId,
        staffId: requestingStaffId,
        userRole: requestingUserRole,
        patientId,
        accessType: `view_${recordType}`,
        resourceType: recordType,
        resourceId: recordId,
        accessReason: 'Viewing detailed record',
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        sessionId: requestInfo.sessionId,
      });

      return record;
    } catch (error) {
      console.error('Get record details failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to retrieve record details', 500);
    }
  }

  /**
   * Log PHI access (HIPAA requirement)
   */
  async logPHIAccess({
    userId,
    staffId,
    userRole,
    patientId,
    accessType,
    resourceType,
    resourceId = null,
    accessReason,
    ipAddress = null,
    userAgent = null,
    sessionId = null,
  }) {
    try {
      await PHIAccessLog.logAccess(
        userId,
        staffId,
        userRole,
        patientId,
        accessType,
        resourceType,
        resourceId,
        accessReason,
        ipAddress,
        userAgent,
        sessionId,
        'web',
      );
    } catch (error) {
      console.error('Failed to log PHI access:', error.message);
      // Don't throw - logging failures shouldn't block operations
    }
  }

  /**
   * Helper: Format doctor name
   */
  formatDoctorName(doctor) {
    if (!doctor || !doctor.person) return 'Unknown';

    const { first_name, middle_name, last_name, suffix } = doctor.person;
    let name = `Dr. ${first_name}`;

    if (middle_name) name += ` ${middle_name}`;
    name += ` ${last_name}`;
    if (suffix) name += `, ${suffix}`;

    return name;
  }

  /**
   * Helper: Format staff name (for nurses, etc.)
   */
  formatStaffName(staff) {
    if (!staff || !staff.person) return 'Unknown';

    const { first_name, middle_name, last_name, suffix } = staff.person;
    let name = first_name;

    if (middle_name) name += ` ${middle_name}`;
    name += ` ${last_name}`;
    if (suffix) name += `, ${suffix}`;

    return name;
  }

  /**
   * Helper: Get record title
   */
  getRecordTitle(recordType) {
    const titles = {
      consultation: 'Consultation',
      lab_result: 'Laboratory Result',
      imaging: 'Imaging Study',
      diagnosis: 'Diagnosis',
      procedure: 'Procedure',
    };
    return titles[recordType] || recordType;
  }
}

export default new MedicalRecordsService();
