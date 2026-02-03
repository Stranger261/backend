import axios from 'axios';
import {
  Staff,
  Person,
  Admission,
  Appointment,
  AppointmentDiagnosis,
  sequelize,
  Patient,
  IdSequence,
  MedicalRecord,
  Prescription,
  RisService,
  LisService,
  LisPatient,
  LisTestOrder,
  LisSpecimen,
  RisPatient,
  RisAppointment,
  RisImagingStudy,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';
import {
  broadcastToAll,
  emitToRoom,
} from '../../../shared/utils/socketEmitter.js';

class AppointmentDiagnosisService {
  constructor() {
    this.bedApi = axios.create({
      baseURL:
        `${process.env.BASE_URL}/bed` || 'http://localhost:56741/api/v1/bed',
      withCredentials: true,
      headers: {
        'x-internal-api-key': process.env.INTERNAL_API_KEY,
      },
    });
  }

  async createDiagnosis(diagnosisData, doctorStaffId, authToken) {
    const transaction = await sequelize.transaction();

    try {
      const { appointmentId, ...diagnosis } = diagnosisData;
      diagnosis.followup_date = diagnosis?.followup_date
        ? diagnosis?.followup_date
        : null;
      diagnosis.estimated_stay_days = diagnosis?.estimated_stay_days
        ? diagnosis?.estimated_stay_days
        : null;

      // Verify appointment exists and is in progress
      const appointment = await Appointment.findOne({
        where: { appointment_id: appointmentId },
        include: [
          {
            model: Patient,
            as: 'patient',
            include: [{ model: Person, as: 'person' }],
          },
          {
            model: Staff,
            as: 'doctor',
            include: [{ model: Person, as: 'person' }],
          },
          {
            model: Prescription,
            as: 'prescriptions',
          },
        ],
        transaction,
      });

      if (!appointment) {
        throw new AppError('Appointment not found.', 404);
      }

      if (!['checked_in', 'in_progress'].includes(appointment.status)) {
        throw new AppError(
          'Cannot create diagnosis. Appointment must be checked in first.',
          400,
        );
      }

      // Check if diagnosis already exists
      const existingDiagnosis = await AppointmentDiagnosis.findOne({
        where: { appointment_id: appointmentId },
        transaction,
      });

      // if (existingDiagnosis) {
      //   throw new AppError(
      //     'Diagnosis already exists for this appointment. Use update instead.',
      //     409,
      //   );
      // }

      // Create diagnosis
      const newDiagnosis = await AppointmentDiagnosis.create(
        {
          appointment_id: appointmentId,
          created_by: doctorStaffId,
          ...diagnosis,
        },
        { transaction },
      );

      let admissionResult = null;

      // Handle admission if required
      if (diagnosis.requires_admission || diagnosis.disposition === 'admit') {
        if (!diagnosis.selected_bed_id) {
          throw new AppError('Bed selection is required for admission.', 400);
        }
        admissionResult = await this.createAdmissionFromAppointment(
          appointment,
          newDiagnosis,
          doctorStaffId,
          diagnosis.selected_bed_id,
          authToken,
          transaction,
        );
      }

      // Handle follow-up if required
      if (diagnosis.requires_followup && diagnosis.followup_date) {
        await this.scheduleFollowupAppointment(
          appointment,
          diagnosis.followup_date,
          transaction,
        );
      }

      console.log(diagnosis);

      // Update appointment status to completed
      await appointment.update({ status: 'completed' }, { transaction });

      await transaction.commit();

      await MedicalRecord.create({
        patient_id: appointment.patient_id,
        visit_type: 'appointment',
        visit_id: appointment.appointment_id,
        record_type: 'diagnosis',
        record_date: new Date(),
        doctor_id: doctorStaffId,
        chief_complaint: diagnosis.chief_complaint,
        treatment: diagnosis.treatment_plan,
        notes: appointment.notes,
      });

      const patient = appointment.patient;

      await broadcastToAll('patient-status_changed', {
        appointmentId: appointment.appointment_id,
        patientName: `${patient.person.first_name} ${patient.person.last_name}`,
        doctorId: appointment.doctor_id,
        arrivalTime: new Date(),
        status: 'completed',
      });

      return {
        diagnosis: await this.getDiagnosisByAppointment(appointmentId),
        admission: admissionResult,
      };
    } catch (error) {
      await transaction.rollback();
      console.error('Create diagnosis failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to create diagnosis.', 500);
    }
  }

  async createDiagnosis(diagnosisData, doctorStaffId, authToken) {
    const transaction = await sequelize.transaction();

    try {
      const { appointmentId, ...diagnosis } = diagnosisData;
      diagnosis.followup_date = diagnosis?.followup_date
        ? diagnosis?.followup_date
        : null;
      diagnosis.estimated_stay_days = diagnosis?.estimated_stay_days
        ? diagnosis?.estimated_stay_days
        : null;

      // Verify appointment exists and is in progress
      const appointment = await Appointment.findOne({
        where: { appointment_id: appointmentId },
        include: [
          {
            model: Patient,
            as: 'patient',
            include: [{ model: Person, as: 'person' }],
          },
          {
            model: Staff,
            as: 'doctor',
            include: [{ model: Person, as: 'person' }],
          },
          {
            model: Prescription,
            as: 'prescriptions',
          },
        ],
        transaction,
      });

      if (!appointment) {
        throw new AppError('Appointment not found.', 404);
      }

      if (!['checked_in', 'in_progress'].includes(appointment.status)) {
        throw new AppError(
          'Cannot create diagnosis. Appointment must be checked in first.',
          400,
        );
      }

      // Check if diagnosis already exists
      const existingDiagnosis = await AppointmentDiagnosis.findOne({
        where: { appointment_id: appointmentId },
        transaction,
      });

      // Create diagnosis
      const newDiagnosis = await AppointmentDiagnosis.create(
        {
          appointment_id: appointmentId,
          created_by: doctorStaffId,
          ...diagnosis,
        },
        { transaction },
      );

      let admissionResult = null;

      // Handle admission if required
      if (diagnosis.requires_admission || diagnosis.disposition === 'admit') {
        if (!diagnosis.selected_bed_id) {
          throw new AppError('Bed selection is required for admission.', 400);
        }
        admissionResult = await this.createAdmissionFromAppointment(
          appointment,
          newDiagnosis,
          doctorStaffId,
          diagnosis.selected_bed_id,
          authToken,
          transaction,
        );
      }

      // Handle follow-up if required
      if (diagnosis.requires_followup && diagnosis.followup_date) {
        await this.scheduleFollowupAppointment(
          appointment,
          diagnosis.followup_date,
          transaction,
        );
      }

      // Parse lab and imaging orders
      const labOrders = diagnosis.lab_tests_ordered
        ? diagnosis.lab_tests_ordered
            .split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id))
        : [];

      const imagingOrders = diagnosis.imaging_ordered
        ? diagnosis.imaging_ordered
            .split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id))
        : [];

      // Create LIS orders if lab tests are selected
      if (labOrders.length > 0) {
        await this.createLisOrders(
          appointment,
          labOrders,
          diagnosis.order_priority || 'routine',
          diagnosis.clinical_notes || '',
          doctorStaffId,
          transaction,
        );
      }

      // Create RIS orders if imaging studies are selected
      if (imagingOrders.length > 0) {
        await this.createRisOrders(
          appointment,
          imagingOrders,
          diagnosis.order_priority || 'routine',
          diagnosis.clinical_notes || '',
          doctorStaffId,
          transaction,
        );
      }

      // Update appointment status to completed
      await appointment.update({ status: 'completed' }, { transaction });

      // Create medical record
      await MedicalRecord.create(
        {
          patient_id: appointment.patient_id,
          visit_type: 'appointment',
          visit_id: appointment.appointment_id,
          record_type: 'diagnosis',
          record_date: new Date(),
          doctor_id: doctorStaffId,
          chief_complaint: diagnosis.chief_complaint,
          treatment: diagnosis.treatment_plan,
          notes: appointment.notes,
        },
        { transaction },
      );

      const patient = appointment.patient;

      await broadcastToAll('patient-status_changed', {
        appointmentId: appointment.appointment_id,
        patientName: `${patient.person.first_name} ${patient.person.last_name}`,
        doctorId: appointment.doctor_id,
        arrivalTime: new Date(),
        status: 'completed',
      });

      await transaction.commit();

      return {
        diagnosis: await this.getDiagnosisByAppointment(appointmentId),
        admission: admissionResult,
        labOrders,
        imagingOrders,
      };
    } catch (error) {
      await transaction.rollback();
      console.error('Create diagnosis failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to create diagnosis.', 500);
    }
  }

  async updateDiagnosis(appointmentId, diagnosisData) {
    try {
      const diagnosis = await AppointmentDiagnosis.findOne({
        where: { appointment_id: appointmentId },
      });

      if (!diagnosis) {
        throw new AppError('Diagnosis not found.', 404);
      }

      await diagnosis.update(diagnosisData);

      return await this.getDiagnosisByAppointment(appointmentId);
    } catch (error) {
      console.error('Update diagnosis failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to update diagnosis.', 500);
    }
  }

  async getDiagnosisByAppointment(appointmentId) {
    try {
      const diagnosis = await AppointmentDiagnosis.findOne({
        where: { appointment_id: appointmentId },
        include: [
          {
            model: Appointment,
            as: 'appointment',
            attributes: [
              'appointment_id',
              'appointment_date',
              'appointment_time',
              'status',
            ],
          },
          {
            model: Staff,
            as: 'createdBy',
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

      if (!diagnosis) {
        throw new AppError('Diagnosis not found.', 404);
      }

      return diagnosis;
    } catch (error) {
      console.error('Get diagnosis failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get diagnosis.', 500);
    }
  }

  async scheduleFollowupAppointment(appointment, followupDate, transaction) {
    try {
      const doctor = appointment.doctor;
      const roomName = `doctor-${doctor.staff_uuid}-${doctor.person.last_name}`;

      const haveAppointmentSameTime = await Appointment.findOne({
        where: {
          patient_id: appointment.patient_id,
          start_time: appointment.start_time,
          appointment_date: appointment.followupDate,
        },
      });

      if (haveAppointmentSameTime) {
        throw new AppError(
          `${created_by_type === 'patient' ? 'You currently' : 'Patient currently'} have an appointment for this date and time.`,
          400,
        );
      }

      const hasConflict = await Appointment.hasConflict(
        doctor.staff_uuid,
        followupDate,
        appointment.start_time,
      );

      if (hasConflict) {
        throw new AppError('This time slot is already booked', 409);
      }

      const followupAppointment = await Appointment.create(
        {
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          department_id: appointment.department_id,
          appointment_type: 'followup',
          appointment_date: followupDate,
          appointment_time: appointment.appointment_time, // Same time slot
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          status: 'scheduled',
          reason: `Follow-up from appointment on ${appointment.appointment_date}`,
        },
        { transaction },
      );

      // for doctor
      await emitToRoom(roomName, 'new-appointment-booked', followupAppointment);
      return followupAppointment;
    } catch (error) {
      console.error('Schedule follow-up failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Schedule follow-up failed.', 500);
    }
  }
  // Create LIS orders
  async createLisOrders(
    appointment,
    serviceIds,
    priority,
    clinicalNotes,
    doctorStaffId,
    transaction,
  ) {
    try {
      // Get LIS services
      const lisServices = await LisService.findAll({
        where: {
          service_id: serviceIds,
          is_active: true,
        },
        transaction,
      });

      if (lisServices.length === 0) {
        console.warn('No valid LIS services found for the selected IDs');
        return [];
      }

      // Find or create LIS patient
      const mainPatient = appointment.patient.person;
      let lisPatient = await LisPatient.findOne({
        where: {
          first_name: mainPatient.first_name,
          last_name: mainPatient.last_name,
          date_of_birth: mainPatient.date_of_birth,
        },
        transaction,
      });

      if (!lisPatient) {
        // Generate MRN manually
        const mrn = await IdSequence.getNextValue('mrn');

        // Map gender to allowed values
        const gender = this.mapGender(mainPatient.gender);

        lisPatient = await LisPatient.create(
          {
            mrn: mrn,
            first_name: mainPatient.first_name,
            last_name: mainPatient.last_name,
            date_of_birth: mainPatient.date_of_birth,
            gender: gender,
            phone: mainPatient.phone || '',
            email: mainPatient.email || '',
            address: mainPatient.address || '',
          },
          { transaction },
        );
      }

      const orders = [];
      const today = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toTimeString().split(' ')[0];

      // Get doctor info
      const doctor = appointment.doctor.person;

      for (const service of lisServices) {
        // Generate order number manually
        const orderNumber = await IdSequence.getNextValue('lis_order');

        // Create order for each service
        const order = await LisTestOrder.create(
          {
            order_number: orderNumber, // Manually set order number
            patient_id: lisPatient.patient_id,
            service_id: service.service_id,
            ordering_physician: `${doctor.first_name} ${doctor.last_name}`,
            order_date: today,
            order_time: currentTime,
            priority: this.mapPriority(priority),
            clinical_indication: clinicalNotes,
            order_status: 'Ordered',
            created_by: doctorStaffId,
          },
          { transaction },
        );

        orders.push(order);

        // Generate specimen number manually
        const specimenNumber = await IdSequence.getNextValue('lis_specimen');

        // Create specimen for the order
        await LisSpecimen.create(
          {
            specimen_number: specimenNumber, // Manually set specimen number
            order_id: order.order_id,
            patient_id: lisPatient.patient_id,
            specimen_type: service.specimen_type || 'Blood',
            collection_date: today,
            collection_time: currentTime,
            specimen_condition: 'Acceptable',
            status: 'Collected',
          },
          { transaction },
        );

        console.log(
          `Created LIS order ${order.order_number} for ${service.test_name}`,
        );
      }

      return orders;
    } catch (error) {
      console.error('Failed to create LIS orders:', error);
      throw error;
    }
  }

  // Create RIS orders
  async createRisOrders(
    appointment,
    serviceIds,
    priority,
    clinicalNotes,
    doctorStaffId,
    transaction,
  ) {
    try {
      // Get RIS services
      const risServices = await RisService.findAll({
        where: {
          service_id: serviceIds,
          is_active: true,
        },
        transaction,
      });

      if (risServices.length === 0) {
        console.warn('No valid RIS services found for the selected IDs');
        return [];
      }

      // Find or create RIS patient
      const mainPatient = appointment.patient.person;
      let risPatient = await RisPatient.findOne({
        where: {
          first_name: mainPatient.first_name,
          last_name: mainPatient.last_name,
          date_of_birth: mainPatient.date_of_birth,
        },
        transaction,
      });

      if (!risPatient) {
        // Generate MRN manually
        const mrn = await IdSequence.getNextValue('mrn');

        // Map gender to allowed values
        const gender = this.mapGender(mainPatient.gender);

        risPatient = await RisPatient.create(
          {
            mrn: mrn,
            first_name: mainPatient.first_name,
            last_name: mainPatient.last_name,
            date_of_birth: mainPatient.date_of_birth,
            gender: gender,
            phone: mainPatient.phone || '',
            email: mainPatient.email || '',
            address: mainPatient.address || '',
            emergency_contact: mainPatient.emergency_contact || '',
            emergency_phone: mainPatient.emergency_phone || '',
          },
          { transaction },
        );
      }

      const appointments = [];
      const today = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toTimeString().split(' ')[0];

      // Get doctor info
      const doctor = appointment.doctor.person;

      for (const service of risServices) {
        // Generate appointment number manually
        const appointmentNumber = await IdSequence.getNextValue('appointment');

        // Create appointment for each service
        const risAppointment = await RisAppointment.create(
          {
            appointment_number: appointmentNumber, // Manually set appointment number
            patient_id: risPatient.patient_id,
            service_id: service.service_id,
            appointment_date: today,
            appointment_time: currentTime,
            referring_physician: `${doctor.first_name} ${doctor.last_name}`,
            status: 'Scheduled',
            priority: this.mapPriority(priority),
            clinical_indication: clinicalNotes,
            created_by: doctorStaffId,
          },
          { transaction },
        );

        appointments.push(risAppointment);

        // Generate accession number for imaging study
        const accessionNumber = await this.generateAccessionNumber();

        // Determine modality from service (you might need to adjust this based on your data)
        const modality = this.determineModality(
          service.service_category || service.service_name,
        );

        // Create imaging study
        await RisImagingStudy.create(
          {
            accession_number: accessionNumber,
            appointment_id: risAppointment.appointment_id,
            patient_id: risPatient.patient_id,
            service_id: service.service_id,
            study_date: today,
            study_time: currentTime,
            modality: modality,
            body_part: service.service_name, // or extract body part from service
            study_description: service.description || service.service_name,
            status: 'Scheduled',
            priority: this.mapPriority(priority),
            clinical_indication: clinicalNotes,
            requested_by: `${doctor.first_name} ${doctor.last_name}`,
            // Add other required fields if they exist in your model
          },
          { transaction },
        );

        console.log(
          `Created RIS appointment ${risAppointment.appointment_number} for ${service.service_name}`,
        );
      }

      return appointments;
    } catch (error) {
      console.error('Failed to create RIS orders:', error);
      throw error;
    }
  }

  // Generate accession number
  async generateAccessionNumber() {
    try {
      // Check if your IdSequence model has a sequence for accession numbers
      // If not, create one or use a different naming convention
      return await IdSequence.getNextValue('accession');
    } catch (error) {
      // Fallback to timestamp-based accession number
      const timestamp = new Date().getTime();
      return `ACC-${timestamp}`;
    }
  }

  // Determine modality from service
  determineModality(serviceInfo) {
    if (!serviceInfo) return 'XR'; // Default to X-Ray

    const serviceString = serviceInfo.toLowerCase();

    if (serviceString.includes('x-ray') || serviceString.includes('xray')) {
      return 'XR';
    } else if (
      serviceString.includes('ct') ||
      serviceString.includes('computed tomography')
    ) {
      return 'CT';
    } else if (
      serviceString.includes('mri') ||
      serviceString.includes('magnetic resonance')
    ) {
      return 'MRI';
    } else if (
      serviceString.includes('ultrasound') ||
      serviceString.includes('us')
    ) {
      return 'US';
    } else if (serviceString.includes('mammo')) {
      return 'MG';
    } else if (serviceString.includes('fluoro')) {
      return 'RF';
    } else {
      return 'XR'; // Default to X-Ray
    }
  }

  mapGender(gender) {
    if (!gender) return 'O';

    const genderMap = {
      male: 'M',
      m: 'M',
      female: 'F',
      f: 'F',
      other: 'O',
      o: 'O',
      M: 'M',
      F: 'F',
      O: 'O',
    };

    return genderMap[gender.toLowerCase()] || 'O';
  }

  // Helper method to map priority values
  mapPriority(priority) {
    const priorityMap = {
      routine: 'Routine',
      urgent: 'Urgent',
      stat: 'STAT',
    };

    return priorityMap[priority.toLowerCase()] || 'Routine';
  }

  // Helper method to map gender values
  mapGender(gender) {
    if (!gender) return 'O'; // Default to 'Other' if not specified

    const genderMap = {
      male: 'M',
      m: 'M',
      female: 'F',
      f: 'F',
      other: 'O',
      o: 'O',
      M: 'M',
      F: 'F', // Already uppercase
      O: 'O', // Already uppercase
    };

    return genderMap[gender.toLowerCase()] || 'O';
  }

  // Helper method to map priority values
  mapPriority(priority) {
    const priorityMap = {
      routine: 'Routine',
      urgent: 'Urgent',
      stat: 'STAT',
    };

    return priorityMap[priority.toLowerCase()] || 'Routine';
  }
}

export default new AppointmentDiagnosisService();
