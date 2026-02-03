import { Op } from 'sequelize';
import {
  TriageAssessment,
  Person,
  Patient,
  ERTreatment,
  ERVisit,
  IdSequence,
  sequelize,
} from '../../../shared/models/index.js';

class ERService {
  // ========== ER Visit Services ==========

  /**
   * Create a new ER visit
   * Handles both known and unknown patients
   */
  async createERVisit(visitData) {
    const transaction = await sequelize.transaction();

    try {
      const {
        patient_id,
        arrival_mode,
        chief_complaint,
        accompanied_by,
        triage_level,
        triage_nurse_id,
        assigned_doctor_id,
        er_status = 'waiting',
        isUnknownPatient = false,
      } = visitData;

      // Validate patient exists if not unknown
      if (!isUnknownPatient && patient_id) {
        const patient = await Patient.findByPk(patient_id, { transaction });
        if (!patient) {
          throw {
            statusCode: 404,
            message: 'Patient not found',
            details: 'The specified patient does not exist in the system',
          };
        }
      }

      // Generate ER number
      const erNumber = await this.generateERNumber();

      // Create ER visit
      const erVisit = await ERVisit.create(
        {
          er_number: erNumber,
          patient_id: patient_id || null,
          arrival_time: new Date(),
          arrival_mode,
          chief_complaint,
          accompanied_by,
          triage_level,
          triage_nurse_id,
          assigned_doctor_id,
          er_status,
        },
        { transaction },
      );

      await transaction.commit();

      // Fetch complete visit data with associations
      return await this.getERVisitById(erVisit.er_visit_id);
    } catch (error) {
      await transaction.rollback();
      console.log('error ervisit: ', error.message);
      throw error;
    }
  }

  /**
   * Generate unique ER number
   * Format: ER-YYYYMMDD-XXXX
   */
  async generateERNumber() {
    const transaction = await sequelize.transaction();

    try {
      const currentYear = new Date().getFullYear();
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

      // Find or create sequence for ER visits
      let [sequence, created] = await IdSequence.findOrCreate({
        where: {
          sequence_type: 'er_visit',
          year: currentYear,
        },
        defaults: {
          sequence_type: 'er_visit',
          prefix: 'ER',
          current_value: 0,
          year: currentYear,
          reset_yearly: 1,
          padding_length: 4,
          last_updated: new Date(),
        },
        transaction,
      });

      // If sequence exists but it's a new year and reset_yearly is true
      if (!created && sequence.reset_yearly && sequence.year !== currentYear) {
        await sequence.update(
          {
            current_value: 0,
            year: currentYear,
            last_updated: new Date(),
          },
          { transaction },
        );
      }

      // Increment the sequence
      const nextValue = sequence.current_value + 1;

      await sequence.update(
        {
          current_value: nextValue,
          last_updated: new Date(),
        },
        { transaction },
      );

      await transaction.commit();

      // Format the sequence number with padding
      const paddedSequence = String(nextValue).padStart(
        sequence.padding_length,
        '0',
      );

      // Return formatted ER number: ER-YYYYMMDD-XXXX
      return `${sequence.prefix}-${dateStr}-${paddedSequence}`;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get all ER visits with filters and pagination
   */
  async getAllERVisits(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (filters.status) {
      where.er_status = filters.status;
    }

    if (filters.triageLevel) {
      where.triage_level = filters.triageLevel;
    }

    if (filters.startDate || filters.endDate) {
      where.arrival_time = {};
      if (filters.startDate) {
        where.arrival_time[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.arrival_time[Op.lte] = new Date(filters.endDate);
      }
    }

    const { count, rows } = await ERVisit.findAndCountAll({
      where,
      include: [
        {
          model: Patient,
          as: 'patient',
          include: [
            {
              model: Person,
              as: 'person',
            },
          ],
        },
        {
          model: TriageAssessment,
          as: 'triage',
        },
        {
          model: ERTreatment,
          as: 'treatments',
        },
      ],
      order: [['arrival_time', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return {
      visits: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Get ER visit by ID
   */
  async getERVisitById(id) {
    const visit = await ERVisit.findByPk(id, {
      include: [
        {
          model: Patient,
          as: 'patient',
          include: [
            {
              model: Person,
              as: 'person',
            },
          ],
        },
        {
          model: TriageAssessment,
          as: 'triage',
        },
        {
          model: ERTreatment,
          as: 'treatments',
          order: [['treatment_time', 'DESC']],
        },
      ],
    });

    if (!visit) {
      throw {
        statusCode: 404,
        message: 'ER visit not found',
        details: `No ER visit found with ID: ${id}`,
      };
    }

    // Calculate waiting time if still waiting
    if (visit.er_status === 'waiting' || visit.er_status === 'in_treatment') {
      const waitingMinutes = Math.floor(
        (new Date() - new Date(visit.arrival_time)) / 60000,
      );
      visit.dataValues.current_waiting_time = waitingMinutes;
    }

    return visit;
  }

  /**
   * Update ER visit
   */
  async updateERVisit(id, updateData) {
    const visit = await ERVisit.findByPk(id);

    if (!visit) {
      throw {
        statusCode: 404,
        message: 'ER visit not found',
      };
    }

    await visit.update(updateData);
    return await this.getERVisitById(id);
  }

  /**
   * Update ER status
   */
  async updateERStatus(id, status, notes = null) {
    const visit = await ERVisit.findByPk(id);

    if (!visit) {
      throw {
        statusCode: 404,
        message: 'ER visit not found',
      };
    }

    const updateData = { er_status: status };

    // Set disposition time when status changes to final states
    if (
      [
        'discharged',
        'admitted',
        'transferred',
        'left_ama',
        'deceased',
      ].includes(status)
    ) {
      updateData.disposition_time = new Date();

      // Calculate total ER time
      const totalMinutes = Math.floor(
        (new Date() - new Date(visit.arrival_time)) / 60000,
      );
      updateData.total_er_time_minutes = totalMinutes;
    }

    await visit.update(updateData);
    return await this.getERVisitById(id);
  }

  /**
   * Delete ER visit
   */
  async deleteERVisit(id) {
    const visit = await ERVisit.findByPk(id);

    if (!visit) {
      throw {
        statusCode: 404,
        message: 'ER visit not found',
      };
    }

    await visit.destroy();
    return true;
  }

  /**
   * Get ER visits by status
   */
  async getERVisitsByStatus(status) {
    const visits = await ERVisit.findAll({
      where: { er_status: status },
      include: [
        {
          model: Patient,
          as: 'patient',
          include: [
            {
              model: Person,
              as: 'person',
            },
          ],
        },
        {
          model: TriageAssessment,
          as: 'triage',
        },
      ],
      order: [
        ['triage_level', 'ASC'],
        ['arrival_time', 'ASC'],
      ],
    });

    return visits;
  }

  /**
   * Get ER visits by patient
   */
  async getERVisitsByPatient(patientId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const { count, rows } = await ERVisit.findAndCountAll({
      where: { patient_id: patientId },
      include: [
        {
          model: TriageAssessment,
          as: 'triage',
        },
        {
          model: ERTreatment,
          as: 'treatments',
        },
      ],
      order: [['arrival_time', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return {
      visits: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  // ========== Triage Services ==========

  /**
   * Create triage assessment
   */
  async createTriageAssessment(triageData) {
    const transaction = await sequelize.transaction();

    try {
      const {
        er_visit_id,
        assessed_by,
        vital_signs,
        pain_scale,
        consciousness_level,
        presenting_symptoms,
        triage_category,
        triage_color,
        immediate_interventions,
        notes,
      } = triageData;

      // Verify ER visit exists
      const erVisit = await ERVisit.findByPk(er_visit_id, { transaction });
      if (!erVisit) {
        throw {
          statusCode: 404,
          message: 'ER visit not found',
        };
      }

      // Create triage assessment
      const triage = await TriageAssessment.create(
        {
          er_visit_id,
          assessment_time: new Date(),
          assessed_by,
          vital_signs: JSON.stringify(vital_signs),
          pain_scale,
          consciousness_level,
          presenting_symptoms,
          triage_category,
          triage_color,
          immediate_interventions,
          notes,
        },
        { transaction },
      );

      // Update ER visit with triage level
      await erVisit.update(
        {
          triage_level: triage_category,
          er_status: 'waiting',
        },
        { transaction },
      );

      await transaction.commit();
      return triage;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get triage by ER visit
   */
  async getTriageByVisit(erVisitId) {
    const triage = await TriageAssessment.findOne({
      where: { er_visit_id: erVisitId },
      include: [
        {
          model: ERVisit,
          as: 'erVisit',
        },
      ],
    });

    if (!triage) {
      throw {
        statusCode: 404,
        message: 'Triage assessment not found for this visit',
      };
    }

    return triage;
  }

  /**
   * Update triage assessment
   */
  async updateTriageAssessment(id, updateData) {
    const triage = await TriageAssessment.findByPk(id);

    if (!triage) {
      throw {
        statusCode: 404,
        message: 'Triage assessment not found',
      };
    }

    // If vital signs are being updated, stringify them
    if (updateData.vital_signs && typeof updateData.vital_signs === 'object') {
      updateData.vital_signs = JSON.stringify(updateData.vital_signs);
    }

    await triage.update(updateData);
    return triage;
  }

  // ========== Treatment Services ==========

  /**
   * Create treatment record
   */
  async createTreatment(treatmentData) {
    const {
      er_visit_id,
      performed_by,
      treatment_type,
      description,
      medication_name,
      dosage,
      route,
      outcome,
    } = treatmentData;

    // Verify ER visit exists
    const erVisit = await ERVisit.findByPk(er_visit_id);
    if (!erVisit) {
      throw {
        statusCode: 404,
        message: 'ER visit not found',
      };
    }

    const treatment = await ERTreatment.create({
      er_visit_id,
      treatment_time: new Date(),
      performed_by,
      treatment_type,
      description,
      medication_name,
      dosage,
      route,
      outcome,
    });

    // Update ER visit status to in_treatment if still waiting
    if (erVisit.er_status === 'waiting') {
      await erVisit.update({ er_status: 'in_treatment' });
    }

    return treatment;
  }

  /**
   * Get treatments by ER visit
   */
  async getTreatmentsByVisit(erVisitId) {
    const treatments = await ERTreatment.findAll({
      where: { er_visit_id: erVisitId },
      order: [['treatment_time', 'DESC']],
    });

    return treatments;
  }

  /**
   * Update treatment
   */
  async updateTreatment(id, updateData) {
    const treatment = await ERTreatment.findByPk(id);

    if (!treatment) {
      throw {
        statusCode: 404,
        message: 'Treatment not found',
      };
    }

    await treatment.update(updateData);
    return treatment;
  }

  /**
   * Delete treatment
   */
  async deleteTreatment(id) {
    const treatment = await ERTreatment.findByPk(id);

    if (!treatment) {
      throw {
        statusCode: 404,
        message: 'Treatment not found',
      };
    }

    await treatment.destroy();
    return true;
  }

  // ========== Dashboard/Statistics Services ==========

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalToday,
      waiting,
      inTreatment,
      admitted,
      discharged,
      criticalCases,
    ] = await Promise.all([
      ERVisit.count({
        where: {
          arrival_time: {
            [Op.gte]: today,
          },
        },
      }),
      ERVisit.count({
        where: { er_status: 'waiting' },
      }),
      ERVisit.count({
        where: { er_status: 'in_treatment' },
      }),
      ERVisit.count({
        where: {
          er_status: 'admitted',
          disposition_time: {
            [Op.gte]: today,
          },
        },
      }),
      ERVisit.count({
        where: {
          er_status: 'discharged',
          disposition_time: {
            [Op.gte]: today,
          },
        },
      }),
      ERVisit.count({
        where: {
          triage_level: {
            [Op.lte]: 2,
          },
          er_status: {
            [Op.in]: ['waiting', 'in_treatment'],
          },
        },
      }),
    ]);

    // Get average waiting time
    const avgWaitingTime = await this.calculateAverageWaitingTime();

    return {
      totalToday,
      waiting,
      inTreatment,
      admitted,
      discharged,
      criticalCases,
      averageWaitingTime: avgWaitingTime,
    };
  }

  /**
   * Calculate average waiting time
   */
  async calculateAverageWaitingTime() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const visits = await ERVisit.findAll({
      where: {
        disposition_time: {
          [Op.gte]: today,
          [Op.ne]: null,
        },
        total_er_time_minutes: {
          [Op.ne]: null,
        },
      },
      attributes: ['total_er_time_minutes'],
    });

    if (visits.length === 0) return 0;

    const totalMinutes = visits.reduce(
      (sum, visit) => sum + visit.total_er_time_minutes,
      0,
    );

    return Math.round(totalMinutes / visits.length);
  }

  /**
   * Get waiting times for current patients
   */
  async getWaitingTimes() {
    const waitingPatients = await ERVisit.findAll({
      where: {
        er_status: {
          [Op.in]: ['waiting', 'in_treatment'],
        },
      },
      include: [
        {
          model: Patient,
          as: 'patient',
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
      ],
      order: [
        ['triage_level', 'ASC'],
        ['arrival_time', 'ASC'],
      ],
    });

    return waitingPatients.map(visit => {
      const waitingMinutes = Math.floor(
        (new Date() - new Date(visit.arrival_time)) / 60000,
      );

      return {
        er_visit_id: visit.er_visit_id,
        er_number: visit.er_number,
        patient_name: visit.patient
          ? `${visit.patient.person?.first_name || ''} ${visit.patient.person?.last_name || ''}`.trim()
          : 'Unknown Patient',
        triage_level: visit.triage_level,
        er_status: visit.er_status,
        arrival_time: visit.arrival_time,
        waiting_minutes: waitingMinutes,
        chief_complaint: visit.chief_complaint,
      };
    });
  }

  /**
   * Get triage distribution
   */
  async getTriageDistribution() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const distribution = await ERVisit.findAll({
      where: {
        arrival_time: {
          [Op.gte]: today,
        },
      },
      attributes: [
        'triage_level',
        [sequelize.fn('COUNT', sequelize.col('er_visit_id')), 'count'],
      ],
      group: ['triage_level'],
      order: [['triage_level', 'ASC']],
      raw: true,
    });

    const triageLabels = {
      1: 'Resuscitation (Red)',
      2: 'Emergency (Orange)',
      3: 'Urgent (Yellow)',
      4: 'Less Urgent (Green)',
      5: 'Non-Urgent (Blue)',
    };

    return distribution.map(item => ({
      level: item.triage_level,
      label: triageLabels[item.triage_level] || `Level ${item.triage_level}`,
      count: parseInt(item.count),
    }));
  }

  // ========== Unknown Patient Services ==========

  /**
   * Create unknown/temporary patient
   */
  async createUnknownPatient(visitData, temporaryInfo = {}) {
    const transaction = await sequelize.transaction();

    try {
      // Create temporary person record
      const person = await Person.create(
        {
          first_name: temporaryInfo.estimatedAge
            ? `Unknown (Age ~${temporaryInfo.estimatedAge})`
            : 'Unknown',
          last_name: 'Patient',
          date_of_birth: temporaryInfo.estimatedAge
            ? new Date(
                new Date().getFullYear() - temporaryInfo.estimatedAge,
                0,
                1,
              )
            : null,
          gender: temporaryInfo.gender || 'other',
          phone: temporaryInfo.phone || null,
          created_at: new Date(),
        },
        { transaction },
      );
      console.log('person: ', person.toJSON());

      // Generate temporary MRN - PASS THE TRANSACTION
      const tempMRN = await this.generateTemporaryMRN(transaction); // ← Pass transaction here

      console.log(tempMRN);

      // Create temporary patient record
      const patient = await Patient.create(
        {
          mrn: tempMRN,
          person_id: person.person_id,
          patient_status: 'active',
          first_visit_date: new Date(),
          registration_type: 'emergency',
          medical_notes:
            'TEMPORARY PATIENT - UNKNOWN IDENTITY\n' +
            (temporaryInfo.description ||
              'No additional information available'),
          created_at: new Date(),
        },
        { transaction },
      );

      console.log('patient: ', patient.toJSON());

      // Create ER visit
      const erVisit = await this.createERVisit({
        ...visitData,
        patient_id: patient.patient_id,
        isUnknownPatient: true,
      });

      console.log('erVisit: ', erVisit.toJSON());

      await transaction.commit();
      console.log('committed');

      return {
        patient,
        person,
        erVisit,
        isTemporary: true,
        message:
          'Temporary patient record created. Please update with real information when available.',
      };
    } catch (error) {
      await transaction.rollback();
      console.log('error: ', error.message);
      throw error;
    }
  }

  /**
   * Generate temporary MRN
   */
  async generateTemporaryMRN(transaction) {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateKey = parseInt(`${year}${month}${day}`);
      const dateStr = `${year}${month}${day}`;

      // Use 'temp_mrn' instead of 'mrn' as sequence_type
      let [sequence, created] = await IdSequence.findOrCreate({
        where: {
          sequence_type: 'temp_mrn', // ← Changed from 'mrn' to 'temp_mrn'
        },
        defaults: {
          sequence_type: 'temp_mrn', // ← Changed
          prefix: 'TEMP',
          current_value: 0,
          year: dateKey,
          reset_yearly: 0, // Daily reset, not yearly
          padding_length: 4,
          last_updated: new Date(),
        },
        transaction,
      });

      // Check if we need to reset for a new day
      if (sequence.year !== dateKey) {
        await sequence.update(
          {
            current_value: 0,
            year: dateKey,
            last_updated: new Date(),
          },
          { transaction },
        );
      }

      // Increment the sequence
      const nextValue = sequence.current_value + 1;

      await sequence.update(
        {
          current_value: nextValue,
          last_updated: new Date(),
        },
        { transaction },
      );

      // Format the sequence number with padding
      const paddedSequence = String(nextValue).padStart(
        sequence.padding_length,
        '0',
      );

      // Return formatted temp MRN: TEMP-YYYYMMDD-XXXX
      return `TEMP-${dateStr}-${paddedSequence}`;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Identify unknown patient and merge records
   */
  async identifyUnknownPatient(
    tempPatientId,
    realPatientId,
    personData = null,
  ) {
    const transaction = await sequelize.transaction();

    try {
      const tempPatient = await Patient.findByPk(tempPatientId, {
        include: [{ model: Person, as: 'person' }],
        transaction,
      });

      if (!tempPatient) {
        throw {
          statusCode: 404,
          message: 'Temporary patient not found',
        };
      }

      // Check if MRN is temporary
      if (!tempPatient.mrn.startsWith('TEMP-')) {
        throw {
          statusCode: 400,
          message: 'This patient is not marked as temporary',
        };
      }

      let targetPatientId = realPatientId;

      // If creating new patient from person data
      if (!realPatientId && personData) {
        // Create new person
        const newPerson = await Person.create(personData, { transaction });

        // Generate real MRN
        const realMRN = await this.generateRealMRN();

        // Create new patient
        const newPatient = await Patient.create(
          {
            mrn: realMRN,
            person_id: newPerson.person_id,
            patient_status: 'active',
            first_visit_date: new Date(),
            registration_type: 'emergency',
          },
          { transaction },
        );

        targetPatientId = newPatient.patient_id;
      }

      // Update all ER visits to point to real patient
      await ERVisit.update(
        { patient_id: targetPatientId },
        {
          where: { patient_id: tempPatientId },
          transaction,
        },
      );

      // Mark temporary patient as inactive
      await tempPatient.update(
        {
          patient_status: 'inactive',
          medical_notes:
            (tempPatient.medical_notes || '') +
            `\n\nMERGED WITH PATIENT ID: ${targetPatientId} on ${new Date().toISOString()}`,
        },
        { transaction },
      );

      // Mark temporary person as deleted
      await tempPatient.person.update(
        {
          is_deleted: 1,
          deleted_at: new Date(),
        },
        { transaction },
      );

      await transaction.commit();

      return {
        message: 'Patient identified and records merged successfully',
        tempPatientId,
        realPatientId: targetPatientId,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Generate real MRN
   */
  async generateRealMRN() {
    const transaction = await sequelize.transaction();

    try {
      const currentYear = new Date().getFullYear();

      // Find or create sequence for real MRNs
      let [sequence, created] = await IdSequence.findOrCreate({
        where: {
          sequence_type: 'mrn',
          prefix: 'MRN',
          year: currentYear,
        },
        defaults: {
          sequence_type: 'mrn',
          prefix: 'MRN',
          current_value: 0,
          year: currentYear,
          reset_yearly: 1, // Reset every year
          padding_length: 8,
          last_updated: new Date(),
        },
        transaction,
      });

      // If sequence exists but it's a new year and reset_yearly is true
      if (!created && sequence.reset_yearly && sequence.year !== currentYear) {
        await sequence.update(
          {
            current_value: 0,
            year: currentYear,
            last_updated: new Date(),
          },
          { transaction },
        );
      }

      // Increment the sequence
      const nextValue = sequence.current_value + 1;

      await sequence.update(
        {
          current_value: nextValue,
          last_updated: new Date(),
        },
        { transaction },
      );

      await transaction.commit();

      // Format the sequence number with padding
      const paddedSequence = String(nextValue).padStart(
        sequence.padding_length,
        '0',
      );

      // Return formatted MRN: MRN00000001
      return `${sequence.prefix}${paddedSequence}`;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get all unknown/temporary patients
   */
  async getUnknownPatients() {
    const patients = await Patient.findAll({
      where: {
        mrn: {
          [Op.like]: 'TEMP-%',
        },
        patient_status: 'active',
      },
      include: [
        {
          model: Person,
          as: 'person',
        },
        {
          model: ERVisit,
          as: 'erVisits',
          order: [['arrival_time', 'DESC']],
          limit: 1,
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return patients;
  }

  // ========== Discharge/Disposition Services ==========

  /**
   * Discharge patient
   */
  async dischargePatient(visitId, dischargeData) {
    const visit = await ERVisit.findByPk(visitId);

    if (!visit) {
      throw {
        statusCode: 404,
        message: 'ER visit not found',
      };
    }

    const totalMinutes = Math.floor(
      (new Date() - new Date(visit.arrival_time)) / 60000,
    );

    await visit.update({
      er_status: 'discharged',
      disposition_type: dischargeData.dispositionType || 'home',
      disposition_time: new Date(),
      total_er_time_minutes: totalMinutes,
    });

    return await this.getERVisitById(visitId);
  }

  /**
   * Admit patient
   */
  async admitPatient(visitId, admissionData) {
    const visit = await ERVisit.findByPk(visitId);

    if (!visit) {
      throw {
        statusCode: 404,
        message: 'ER visit not found',
      };
    }

    const totalMinutes = Math.floor(
      (new Date() - new Date(visit.arrival_time)) / 60000,
    );

    await visit.update({
      er_status: 'admitted',
      disposition_type: 'admitted',
      disposition_time: new Date(),
      total_er_time_minutes: totalMinutes,
    });

    return await this.getERVisitById(visitId);
  }

  /**
   * Transfer patient
   */
  async transferPatient(visitId, transferData) {
    const visit = await ERVisit.findByPk(visitId);

    if (!visit) {
      throw {
        statusCode: 404,
        message: 'ER visit not found',
      };
    }

    const totalMinutes = Math.floor(
      (new Date() - new Date(visit.arrival_time)) / 60000,
    );

    await visit.update({
      er_status: 'transferred',
      disposition_type: 'transferred',
      disposition_time: new Date(),
      total_er_time_minutes: totalMinutes,
    });

    return await this.getERVisitById(visitId);
  }
}

export default new ERService();
