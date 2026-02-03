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
  Allergy,
  Immunization,
  LabResult,
  RadiologyResult,
  Medication,
  FamilyHistory,
  SocialHistory,
  VitalSigns,
  sequelize,
} from '../../../shared/models/index.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

class PatientMedicalRecordsService {
  /**
   * Get comprehensive patient medical records via face recognition
   * This retrieves ALL medical data for a patient authenticated via biometric
   */
  async getPatientMedicalRecordsByFaceRecognition({
    patientId,
    requestInfo = {},
  }) {
    try {
      // Step 1: Verify patient exists
      const patient = await this.verifyPatient(patientId);

      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Step 2: Get user information from patient
      const userId = patient.person?.user?.user_id;

      if (!userId) {
        throw new AppError('Patient account not properly configured', 400);
      }

      // Step 3: Log biometric access to PHI (HIPAA requirement)
      await this.logBiometricAccess({
        userId,
        patientId,
        requestInfo,
      });

      // Step 4: Fetch comprehensive medical records
      const medicalRecords =
        await this.fetchComprehensiveMedicalRecords(patientId);

      return {
        success: true,
        patient: this.formatPatientInfo(patient),
        medicalRecords,
        accessTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        'Get patient medical records by face recognition failed:',
        error.message,
      );
      throw error instanceof AppError
        ? error
        : new AppError('Failed to retrieve patient medical records', 500);
    }
  }

  /**
   * Verify patient exists and fetch basic info
   */
  async verifyPatient(patientId) {
    return Patient.findOne({
      where: { patient_id: patientId },
      include: [
        {
          model: Person,
          as: 'person',
          include: [
            {
              model: User,
              as: 'user',
            },
          ],
        },
      ],
    });
  }

  /**
   * Fetch all comprehensive medical records for patient
   */
  async fetchComprehensiveMedicalRecords(patientId) {
    // Fetch all data types concurrently for efficiency
    const [
      demographics,
      allergies,
      medications,
      immunizations,
      appointments,
      admissions,
      medicalRecords,
      labResults,
      radiologyResults,
      vitalSigns,
      familyHistory,
      socialHistory,
      careTeam,
      activeConsents,
    ] = await Promise.all([
      this.fetchPatientDemographics(patientId),
      this.fetchAllergies(patientId),
      this.fetchCurrentMedications(patientId),
      this.fetchImmunizations(patientId),
      this.fetchAppointments(patientId),
      this.fetchAdmissions(patientId),
      this.fetchMedicalRecords(patientId),
      this.fetchLabResults(patientId),
      this.fetchRadiologyResults(patientId),
      this.fetchVitalSigns(patientId),
      this.fetchFamilyHistory(patientId),
      this.fetchSocialHistory(patientId),
      this.fetchCareTeam(patientId),
      this.fetchActiveConsents(patientId),
    ]);

    return {
      demographics,
      allergies,
      medications,
      immunizations,
      appointments,
      admissions,
      medicalRecords,
      labResults,
      radiologyResults,
      vitalSigns,
      familyHistory,
      socialHistory,
      careTeam,
      consents: activeConsents,
      summary: this.generateMedicalSummary({
        allergies,
        medications,
        appointments,
        admissions,
        labResults,
        radiologyResults,
      }),
    };
  }

  /**
   * Fetch patient demographics
   */
  async fetchPatientDemographics(patientId) {
    const patient = await Patient.findOne({
      where: { patient_id: patientId },
      include: [
        {
          model: Person,
          as: 'person',
          attributes: [
            'person_id',
            'first_name',
            'middle_name',
            'last_name',
            'suffix',
            'date_of_birth',
            'gender',
            'blood_type',
            'contact_number',
            'email',
            'address_line1',
            'address_line2',
            'city',
            'state',
            'postal_code',
            'country',
          ],
        },
      ],
    });

    if (!patient) return null;

    return {
      patientId: patient.patient_id,
      patientNumber: patient.patient_number,
      registrationDate: patient.registration_date,
      emergencyContactName: patient.emergency_contact_name,
      emergencyContactPhone: patient.emergency_contact_phone,
      emergencyContactRelationship: patient.emergency_contact_relationship,
      insuranceProvider: patient.insurance_provider,
      insurancePolicyNumber: patient.insurance_policy_number,
      person: {
        firstName: patient.person.first_name,
        middleName: patient.person.middle_name,
        lastName: patient.person.last_name,
        suffix: patient.person.suffix,
        dateOfBirth: patient.person.date_of_birth,
        age: this.calculateAge(patient.person.date_of_birth),
        gender: patient.person.gender,
        bloodType: patient.person.blood_type,
        contactNumber: patient.person.contact_number,
        email: patient.person.email,
        address: {
          line1: patient.person.address_line1,
          line2: patient.person.address_line2,
          city: patient.person.city,
          state: patient.person.state,
          postalCode: patient.person.postal_code,
          country: patient.person.country,
        },
      },
    };
  }

  /**
   * Fetch all allergies
   */
  async fetchAllergies(patientId) {
    const allergies = await Allergy.findAll({
      where: {
        patient_id: patientId,
        is_active: true,
      },
      order: [
        ['severity', 'DESC'],
        ['diagnosed_date', 'DESC'],
      ],
    });

    return allergies.map(allergy => ({
      allergyId: allergy.allergy_id,
      allergen: allergy.allergen,
      allergyType: allergy.allergy_type,
      severity: allergy.severity,
      reaction: allergy.reaction,
      diagnosedDate: allergy.diagnosed_date,
      notes: allergy.notes,
      isActive: allergy.is_active,
    }));
  }

  /**
   * Fetch current medications
   */
  async fetchCurrentMedications(patientId) {
    const medications = await Medication.findAll({
      where: {
        patient_id: patientId,
        status: { [Op.in]: ['active', 'current'] },
      },
      order: [['start_date', 'DESC']],
    });

    return medications.map(med => ({
      medicationId: med.medication_id,
      medicationName: med.medication_name,
      dosage: med.dosage,
      frequency: med.frequency,
      route: med.route,
      startDate: med.start_date,
      endDate: med.end_date,
      prescribedBy: med.prescribed_by,
      instructions: med.instructions,
      status: med.status,
      refillsRemaining: med.refills_remaining,
    }));
  }

  /**
   * Fetch immunization records
   */
  async fetchImmunizations(patientId) {
    const immunizations = await Immunization.findAll({
      where: { patient_id: patientId },
      order: [['administration_date', 'DESC']],
    });

    return immunizations.map(immun => ({
      immunizationId: immun.immunization_id,
      vaccineName: immun.vaccine_name,
      vaccineType: immun.vaccine_type,
      administrationDate: immun.administration_date,
      doseNumber: immun.dose_number,
      lotNumber: immun.lot_number,
      expirationDate: immun.expiration_date,
      administeredBy: immun.administered_by,
      site: immun.site,
      route: immun.route,
      nextDueDate: immun.next_due_date,
    }));
  }

  /**
   * Fetch all appointments with full details
   */
  async fetchAppointments(patientId) {
    const appointments = await Appointment.findAll({
      where: { patient_id: patientId },
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
        },
      ],
      order: [['appointment_date', 'DESC']],
      limit: 100, // Last 100 appointments
    });

    return appointments.map(apt => this.formatAppointment(apt));
  }

  /**
   * Format appointment data
   */
  formatAppointment(appointment) {
    const diagnosisArray = Array.isArray(appointment.diagnosis)
      ? appointment.diagnosis
      : [appointment.diagnosis].filter(Boolean);
    const diagnosisInfo = diagnosisArray[0];

    return {
      appointmentId: appointment.appointment_id,
      appointmentDate: appointment.appointment_date,
      appointmentTime: appointment.appointment_time,
      appointmentType: appointment.appointment_type,
      status: appointment.status,
      chiefComplaint:
        diagnosisInfo?.chief_complaint || appointment.vitals?.chief_complaint,
      diagnosis: {
        primary: diagnosisInfo?.primary_diagnosis,
        secondary: diagnosisInfo?.secondary_diagnoses,
        treatmentPlan: diagnosisInfo?.treatment_plan,
        disposition: diagnosisInfo?.disposition,
        requiresAdmission: diagnosisInfo?.requires_admission,
        requiresFollowup: diagnosisInfo?.requires_followup,
        followupDate: diagnosisInfo?.followup_date,
      },
      vitals: appointment.vitals
        ? {
            temperature: appointment.vitals.temperature,
            bloodPressure: `${appointment.vitals.blood_pressure_systolic}/${appointment.vitals.blood_pressure_diastolic}`,
            heartRate: appointment.vitals.heart_rate,
            respiratoryRate: appointment.vitals.respiratory_rate,
            oxygenSaturation: appointment.vitals.oxygen_saturation,
            weight: appointment.vitals.weight,
            height: appointment.vitals.height,
            bmi: appointment.vitals.bmi,
            painLevel: appointment.vitals.pain_level,
          }
        : null,
      doctor: this.formatDoctorName(appointment.doctor),
      hasResultingAdmission: !!appointment.resultingAdmission,
      resultingAdmissionId: appointment.resultingAdmission?.admission_id,
    };
  }

  /**
   * Fetch all hospital admissions with full details
   */
  async fetchAdmissions(patientId) {
    const admissions = await Admission.findAll({
      where: { patient_id: patientId },
      include: [
        {
          model: AdmissionProgressNote,
          as: 'progressNotes',
          where: { is_deleted: false },
          required: false,
          separate: true,
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
      ],
      order: [['admission_date', 'DESC']],
      limit: 50, // Last 50 admissions
    });

    return admissions.map(adm => this.formatAdmission(adm));
  }

  /**
   * Format admission data
   */
  formatAdmission(admission) {
    return {
      admissionId: admission.admission_id,
      admissionNumber: admission.admission_number,
      admissionDate: admission.admission_date,
      admissionType: admission.admission_type,
      admissionSource: admission.admission_source,
      status: admission.admission_status,
      diagnosisAtAdmission: admission.diagnosis_at_admission,
      room: admission.room_number,
      bed: admission.bed_number,
      expectedDischargeDate: admission.expected_discharge_date,
      dischargeDate: admission.discharge_date,
      dischargeType: admission.discharge_type,
      dischargeSummary: admission.discharge_summary,
      lengthOfStay: admission.length_of_stay_days,
      attendingDoctor: this.formatDoctorName(admission.attendingDoctor),
      progressNotes: (admission.progressNotes || []).map(note => ({
        noteId: note.note_id,
        noteDate: note.note_date,
        noteType: note.note_type,
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan,
        isCritical: note.is_critical,
        recordedBy: this.formatStaffName(note.recorder),
      })),
      prescriptions: (admission.prescriptions || []).map(rx => ({
        prescriptionId: rx.prescription_id,
        prescriptionNumber: rx.prescription_number,
        prescriptionDate: rx.prescription_date,
        status: rx.prescription_status,
        items: (rx.items || []).map(item => ({
          itemId: item.item_id,
          medicationName: item.medication_name,
          dosage: item.dosage,
          frequency: item.frequency,
          route: item.route,
          duration: item.duration,
          instructions: item.instructions,
          dispensed: item.dispensed,
        })),
      })),
    };
  }

  /**
   * Fetch medical records
   */
  async fetchMedicalRecords(patientId) {
    const records = await MedicalRecord.findAll({
      where: { patient_id: patientId },
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
      limit: 100,
    });

    return records.map(record => ({
      recordId: record.record_id,
      recordDate: record.record_date,
      recordType: record.record_type,
      visitType: record.visit_type,
      visitId: record.visit_id,
      chiefComplaint: record.chief_complaint,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      notes: record.notes,
      doctor: this.formatDoctorName(record.doctor),
    }));
  }

  /**
   * Fetch lab results
   */
  async fetchLabResults(patientId) {
    const labResults = await LabResult.findAll({
      where: { patient_id: patientId },
      include: [
        {
          model: Staff,
          as: 'orderedBy',
          required: false,
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name'],
            },
          ],
        },
      ],
      order: [['test_date', 'DESC']],
      limit: 100,
    });

    return labResults.map(lab => ({
      labResultId: lab.lab_result_id,
      testName: lab.test_name,
      testType: lab.test_type,
      testDate: lab.test_date,
      resultDate: lab.result_date,
      resultValue: lab.result_value,
      resultUnit: lab.result_unit,
      referenceRange: lab.reference_range,
      abnormalFlag: lab.abnormal_flag,
      status: lab.status,
      notes: lab.notes,
      orderedBy: this.formatStaffName(lab.orderedBy),
    }));
  }

  /**
   * Fetch radiology results
   */
  async fetchRadiologyResults(patientId) {
    const radiologyResults = await RadiologyResult.findAll({
      where: { patient_id: patientId },
      include: [
        {
          model: Staff,
          as: 'orderedBy',
          required: false,
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name'],
            },
          ],
        },
        {
          model: Staff,
          as: 'radiologist',
          required: false,
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name'],
            },
          ],
        },
      ],
      order: [['exam_date', 'DESC']],
      limit: 50,
    });

    return radiologyResults.map(rad => ({
      radiologyResultId: rad.radiology_result_id,
      examType: rad.exam_type,
      examDate: rad.exam_date,
      bodyPart: rad.body_part,
      findings: rad.findings,
      impression: rad.impression,
      status: rad.status,
      orderedBy: this.formatStaffName(rad.orderedBy),
      radiologist: this.formatStaffName(rad.radiologist),
      reportDate: rad.report_date,
    }));
  }

  /**
   * Fetch vital signs history
   */
  async fetchVitalSigns(patientId) {
    const vitalSigns = await VitalSigns.findAll({
      where: { patient_id: patientId },
      order: [['recorded_date', 'DESC']],
      limit: 100,
    });

    return vitalSigns.map(vital => ({
      vitalSignId: vital.vital_sign_id,
      recordedDate: vital.recorded_date,
      temperature: vital.temperature,
      bloodPressureSystolic: vital.blood_pressure_systolic,
      bloodPressureDiastolic: vital.blood_pressure_diastolic,
      heartRate: vital.heart_rate,
      respiratoryRate: vital.respiratory_rate,
      oxygenSaturation: vital.oxygen_saturation,
      weight: vital.weight,
      height: vital.height,
      bmi: vital.bmi,
      painLevel: vital.pain_level,
    }));
  }

  /**
   * Fetch family history
   */
  async fetchFamilyHistory(patientId) {
    const familyHistory = await FamilyHistory.findAll({
      where: { patient_id: patientId },
      order: [['created_at', 'DESC']],
    });

    return familyHistory.map(fh => ({
      familyHistoryId: fh.family_history_id,
      relationship: fh.relationship,
      condition: fh.condition,
      ageAtDiagnosis: fh.age_at_diagnosis,
      notes: fh.notes,
      isDeceased: fh.is_deceased,
      causeOfDeath: fh.cause_of_death,
    }));
  }

  /**
   * Fetch social history
   */
  async fetchSocialHistory(patientId) {
    const socialHistory = await SocialHistory.findOne({
      where: { patient_id: patientId },
    });

    if (!socialHistory) return null;

    return {
      socialHistoryId: socialHistory.social_history_id,
      smokingStatus: socialHistory.smoking_status,
      alcoholUse: socialHistory.alcohol_use,
      drugUse: socialHistory.drug_use,
      occupation: socialHistory.occupation,
      maritalStatus: socialHistory.marital_status,
      livingArrangement: socialHistory.living_arrangement,
      exerciseFrequency: socialHistory.exercise_frequency,
      dietType: socialHistory.diet_type,
      notes: socialHistory.notes,
      lastUpdated: socialHistory.updated_at,
    };
  }

  /**
   * Fetch care team members
   */
  async fetchCareTeam(patientId) {
    const careTeamMembers = await PatientCareTeam.findAll({
      where: {
        patient_id: patientId,
        is_active: true,
      },
      include: [
        {
          model: Staff,
          as: 'staff',
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name'],
            },
          ],
        },
      ],
      order: [['assigned_date', 'DESC']],
    });

    return careTeamMembers.map(member => ({
      careTeamId: member.care_team_id,
      staffName: this.formatStaffName(member.staff),
      role: member.role,
      specialty: member.specialty,
      assignedDate: member.assigned_date,
      isPrimary: member.is_primary,
    }));
  }

  /**
   * Fetch active consents
   */
  async fetchActiveConsents(patientId) {
    const consents = await PatientConsent.findAll({
      where: {
        patient_id: patientId,
        is_active: true,
      },
      order: [['consent_date', 'DESC']],
    });

    return consents.map(consent => ({
      consentId: consent.consent_id,
      consentType: consent.consent_type,
      consentDate: consent.consent_date,
      expiryDate: consent.expiry_date,
      consentedBy: consent.consented_by,
      witnessedBy: consent.witnessed_by,
      notes: consent.notes,
    }));
  }

  /**
   * Generate medical summary
   */
  generateMedicalSummary({
    allergies,
    medications,
    appointments,
    admissions,
    labResults,
    radiologyResults,
  }) {
    const criticalAllergies = allergies.filter(
      a => a.severity === 'severe' || a.severity === 'life-threatening',
    );

    const recentAppointments = appointments.slice(0, 5);
    const recentAdmissions = admissions.slice(0, 3);
    const abnormalLabs = labResults.filter(lab => lab.abnormalFlag === true);

    return {
      totalAllergies: allergies.length,
      criticalAllergies: criticalAllergies.length,
      criticalAllergyList: criticalAllergies.map(a => a.allergen),
      activeMedications: medications.length,
      totalAppointments: appointments.length,
      recentAppointmentsCount: recentAppointments.length,
      totalAdmissions: admissions.length,
      recentAdmissionsCount: recentAdmissions.length,
      totalLabResults: labResults.length,
      abnormalLabResults: abnormalLabs.length,
      totalRadiologyResults: radiologyResults.length,
      lastAppointmentDate:
        appointments.length > 0 ? appointments[0].appointmentDate : null,
      lastAdmissionDate:
        admissions.length > 0 ? admissions[0].admissionDate : null,
    };
  }

  /**
   * Format patient basic info
   */
  formatPatientInfo(patient) {
    return {
      patientId: patient.patient_id,
      patientNumber: patient.patient_number,
      mrn: patient.mrn,
      fullName: this.formatFullName(patient.person),
      dateOfBirth: patient.person.date_of_birth,
      age: this.calculateAge(patient.person.date_of_birth),
      gender: patient.person.gender,
      bloodType: patient.person.blood_type,
      contactNumber: patient.person.contact_number,
      email: patient.person.email,
    };
  }

  /**
   * Format full name
   */
  formatFullName(person) {
    if (!person) return 'Unknown';

    let name = person.first_name;
    if (person.middle_name) name += ` ${person.middle_name}`;
    name += ` ${person.last_name}`;
    if (person.suffix) name += `, ${person.suffix}`;

    return name;
  }

  /**
   * Format doctor name
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
   * Format staff name
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
   * Calculate age from date of birth
   */
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;

    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  /**
   * Log biometric PHI access (HIPAA requirement)
   */
  async logBiometricAccess({ userId, patientId, requestInfo }) {
    try {
      await PHIAccessLog.logAccess(
        userId,
        null, // No staff ID for patient self-access
        'patient',
        patientId,
        'biometric_authentication',
        'comprehensive_medical_records',
        null,
        'Patient accessed own medical records via face recognition',
        requestInfo.ipAddress || null,
        requestInfo.userAgent || null,
        requestInfo.sessionId || null,
        'mobile_biometric', // Access method
      );
    } catch (error) {
      console.error('Failed to log biometric PHI access:', error.message);
      // Don't throw - logging failures shouldn't block operations
    }
  }
}

export default new PatientMedicalRecordsService();
