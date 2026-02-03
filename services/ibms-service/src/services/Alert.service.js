// services/dashboard/AlertService.js
import { Op, Sequelize } from 'sequelize';

import {
  AdmissionProgressNote,
  LabOrderTest,
  PersonIdentification,
  PrescriptionItem,
  PatientConsent,
} from '../../../shared/models/index.js';

class AlertService {
  /**
   * Get all critical alerts
   */
  static async getAllAlerts(options = {}) {
    const {
      alert_types = ['all'],
      severity = ['critical', 'high'],
      include_resolved = false,
      limit = 50,
    } = options;

    // Fetch different types of alerts in parallel
    const [
      criticalLabs,
      overdueMeds,
      unverifiedIds,
      systemWarnings,
      criticalNotes,
      expiringConsents,
    ] = await Promise.all([
      alert_types.includes('all') || alert_types.includes('lab')
        ? this.getCriticalLabResults()
        : [],
      alert_types.includes('all') || alert_types.includes('medication')
        ? this.getOverdueMedications()
        : [],
      alert_types.includes('all') || alert_types.includes('identity')
        ? this.getUnverifiedIdentities()
        : [],
      alert_types.includes('all') || alert_types.includes('system')
        ? this.getSystemWarnings()
        : [],
      alert_types.includes('all') || alert_types.includes('notes')
        ? this.getCriticalNotes()
        : [],
      alert_types.includes('all') || alert_types.includes('consents')
        ? this.getExpiringConsents()
        : [],
    ]);

    // Combine all alerts
    const allAlerts = [
      ...criticalLabs,
      ...overdueMeds,
      ...unverifiedIds,
      ...systemWarnings,
      ...criticalNotes,
      ...expiringConsents,
    ];

    // Filter by severity if specified
    const filteredAlerts = allAlerts.filter(alert =>
      severity.includes(alert.severity),
    );

    // Filter out resolved alerts if not requested
    const finalAlerts = include_resolved
      ? filteredAlerts
      : filteredAlerts.filter(alert => !alert.resolved);

    // Sort by severity and timestamp
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    finalAlerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    return finalAlerts.slice(0, limit);
  }

  /**
   * Get critical lab results
   */
  static async getCriticalLabResults() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const criticalLabs = await LabOrderTest.findAll({
      where: {
        is_critical: true,
        acknowledged_by: null,
        result_date: { [Op.gte]: oneDayAgo },
      },
      include: [
        {
          association: 'labOrder',
          include: ['patient'],
        },
      ],
      order: [['result_date', 'DESC']],
    });

    return criticalLabs.map(lab => ({
      id: lab.test_id,
      type: 'critical_lab',
      severity: 'critical',
      title: 'Critical Lab Result',
      description: `${lab.test_name}: ${lab.result_value} ${lab.unit}`,
      patient_name: lab.labOrder?.patient?.person?.full_name || 'Unknown',
      patient_id: lab.labOrder?.patient_id,
      mrn: lab.labOrder?.patient?.mrn,
      timestamp: lab.result_date,
      resolved: !!lab.acknowledged_by,
      resolved_at: lab.acknowledged_at,
      acknowledged_by: lab.acknowledged_by,
      metadata: {
        test_name: lab.test_name,
        result_value: lab.result_value,
        unit: lab.unit,
        reference_range: lab.reference_range,
      },
    }));
  }

  /**
   * Get overdue medications
   */
  static async getOverdueMedications() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find medications that were supposed to be administered but weren't
    const overdueMeds = await PrescriptionItem.findAll({
      where: {
        dispensed: true,
        last_administered: { [Op.lt]: oneHourAgo },
      },
      include: [
        {
          association: 'prescription',
          include: ['patient'],
        },
      ],
    });

    return overdueMeds.map(med => ({
      id: med.item_id,
      type: 'overdue_medication',
      severity: 'high',
      title: 'Overdue Medication',
      description: `${med.medication_name} - ${med.dosage} overdue for administration`,
      patient_name: med.prescription?.patient?.person?.full_name || 'Unknown',
      patient_id: med.prescription?.patient_id,
      mrn: med.prescription?.patient?.mrn,
      timestamp: med.last_administered || new Date(),
      resolved: false,
      metadata: {
        medication: med.medication_name,
        dosage: med.dosage,
        frequency: med.frequency,
        last_administered: med.last_administered,
      },
    }));
  }

  /**
   * Get unverified identities
   */
  static async getUnverifiedIdentities() {
    const unverifiedIds = await PersonIdentification.findAll({
      where: {
        verification_status: 'pending',
        verification_expiry: { [Op.gt]: new Date() },
      },
      include: ['person'],
      order: [['created_at', 'DESC']],
    });

    return unverifiedIds.map(id => ({
      id: id.identification_id,
      type: 'unverified_identity',
      severity: 'medium',
      title: 'Unverified Identity',
      description: `${id.id_type} - ${id.id_number} requires verification`,
      patient_name: id.person?.full_name || 'Unknown',
      patient_id: id.person_id,
      timestamp: id.created_at,
      resolved: false,
      metadata: {
        id_type: id.id_type,
        id_number: id.id_number,
        expiry_date: id.verification_expiry,
        days_remaining: Math.ceil(
          (id.verification_expiry - new Date()) / (1000 * 60 * 60 * 24),
        ),
      },
    }));
  }

  /**
   * Get system warnings
   */
  static async getSystemWarnings() {
    // This would check various system health metrics
    // For now, return some mock data
    return [
      {
        id: 'system-001',
        type: 'system_warning',
        severity: 'high',
        title: 'Database Connection Pool High',
        description: 'Database connection pool is at 85% capacity',
        timestamp: new Date(),
        resolved: false,
        metadata: {
          metric: 'db_connections',
          value: 85,
          threshold: 80,
        },
      },
      {
        id: 'system-002',
        type: 'system_warning',
        severity: 'medium',
        title: 'Backup Overdue',
        description: 'System backup is 2 days overdue',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        resolved: false,
        metadata: {
          metric: 'backup_status',
          last_backup: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          scheduled_interval: 'daily',
        },
      },
    ];
  }

  /**
   * Get critical progress notes
   */
  static async getCriticalNotes() {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const criticalNotes = await AdmissionProgressNote.findAll({
      where: {
        is_critical: true,
        note_date: { [Op.gte]: sixHoursAgo },
        is_deleted: false,
      },
      include: [
        {
          association: 'admission',
          include: ['patient'],
        },
      ],
      order: [['note_date', 'DESC']],
    });

    return criticalNotes.map(note => ({
      id: note.note_id,
      type: 'critical_note',
      severity: 'high',
      title: 'Critical Progress Note',
      description: `${note.note_type}: ${note.assessment?.substring(0, 100)}...`,
      patient_name: note.admission?.patient?.person?.full_name || 'Unknown',
      patient_id: note.patient_id,
      mrn: note.admission?.patient?.mrn,
      timestamp: note.note_date,
      resolved: false,
      metadata: {
        note_type: note.note_type,
        vital_signs: {
          temperature: note.temperature,
          blood_pressure: `${note.blood_pressure_systolic}/${note.blood_pressure_diastolic}`,
          heart_rate: note.heart_rate,
        },
      },
    }));
  }

  /**
   * Get expiring consents
   */
  static async getExpiringConsents() {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const expiringConsents = await PatientConsent.findAll({
      where: {
        consent_status: 'active',
        expiry_date: {
          [Op.between]: [new Date(), sevenDaysFromNow],
        },
      },
      include: ['patient'],
      order: [['expiry_date', 'ASC']],
    });

    return expiringConsents.map(consent => ({
      id: consent.consent_id,
      type: 'expiring_consent',
      severity: 'medium',
      title: 'Expiring Consent',
      description: `${consent.consent_type} consent expires in ${Math.ceil((consent.expiry_date - new Date()) / (1000 * 60 * 60 * 24))} days`,
      patient_name: consent.patient?.person?.full_name || 'Unknown',
      patient_id: consent.patient_id,
      mrn: consent.patient?.mrn,
      timestamp: consent.created_at,
      resolved: false,
      metadata: {
        consent_type: consent.consent_type,
        expiry_date: consent.expiry_date,
        days_remaining: Math.ceil(
          (consent.expiry_date - new Date()) / (1000 * 60 * 60 * 24),
        ),
      },
    }));
  }

  /**
   * Mark alert as resolved/acknowledged
   */
  static async resolveAlert(alertType, alertId, resolvedBy, notes = '') {
    switch (alertType) {
      case 'critical_lab':
        return await this.resolveCriticalLab(alertId, resolvedBy, notes);
      case 'critical_note':
        return await this.resolveCriticalNote(alertId, resolvedBy, notes);
      case 'overdue_medication':
        return await this.resolveOverdueMedication(alertId, resolvedBy, notes);
      case 'unverified_identity':
        return await this.resolveUnverifiedIdentity(alertId, resolvedBy, notes);
      case 'expiring_consent':
        return await this.resolveExpiringConsent(alertId, resolvedBy, notes);
      case 'system_warning':
        return await this.resolveSystemWarning(alertId, resolvedBy, notes);
      default:
        throw new Error(`Unknown alert type: ${alertType}`);
    }
  }

  static async resolveCriticalLab(testId, resolvedBy, notes) {
    const labTest = await LabOrderTest.findByPk(testId);
    if (!labTest) {
      throw new Error('Lab test not found');
    }

    labTest.acknowledged_by = resolvedBy;
    labTest.acknowledged_at = new Date();
    labTest.acknowledgement_notes = notes;
    await labTest.save();

    return {
      success: true,
      message: 'Critical lab result acknowledged',
      alert_id: testId,
      resolved_at: labTest.acknowledged_at,
    };
  }

  static async resolveCriticalNote(noteId, resolvedBy, notes) {
    const progressNote = await AdmissionProgressNote.findByPk(noteId);
    if (!progressNote) {
      throw new Error('Progress note not found');
    }

    // Mark as no longer critical
    progressNote.is_critical = false;
    progressNote.updated_by = resolvedBy;
    progressNote.updated_at = new Date();
    await progressNote.save();

    return {
      success: true,
      message: 'Critical note resolved',
      alert_id: noteId,
      resolved_at: progressNote.updated_at,
    };
  }

  static async resolveOverdueMedication(itemId, resolvedBy, notes) {
    const medication = await PrescriptionItem.findByPk(itemId);
    if (!medication) {
      throw new Error('Medication not found');
    }

    // Update last administered time
    medication.last_administered = new Date();
    medication.administered_by = resolvedBy;
    medication.adminstration_notes = notes;
    await medication.save();

    return {
      success: true,
      message: 'Medication administration recorded',
      alert_id: itemId,
      resolved_at: medication.last_administered,
    };
  }

  static async resolveUnverifiedIdentity(identityId, resolvedBy, notes) {
    const identification = await PersonIdentification.findByPk(identityId);
    if (!identification) {
      throw new Error('Identification not found');
    }

    identification.verification_status = 'verified';
    identification.verified_by = resolvedBy;
    identification.verified_at = new Date();
    identification.verification_notes = notes;
    await identification.save();

    return {
      success: true,
      message: 'Identity verified',
      alert_id: identityId,
      resolved_at: identification.verified_at,
    };
  }

  static async resolveExpiringConsent(consentId, resolvedBy, notes) {
    const consent = await PatientConsent.findByPk(consentId);
    if (!consent) {
      throw new Error('Consent not found');
    }

    // Extend consent or mark as renewed
    consent.consent_status = 'renewed';
    consent.renewed_by = resolvedBy;
    consent.renewed_at = new Date();
    consent.expiry_date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Extend 1 year
    await consent.save();

    return {
      success: true,
      message: 'Consent renewed and extended',
      alert_id: consentId,
      resolved_at: consent.renewed_at,
      new_expiry: consent.expiry_date,
    };
  }

  static async resolveSystemWarning(warningId, resolvedBy, notes) {
    // For system warnings, just log the resolution
    console.log(
      `System warning ${warningId} resolved by ${resolvedBy}: ${notes}`,
    );

    return {
      success: true,
      message: 'System warning resolved',
      alert_id: warningId,
      resolved_at: new Date(),
    };
  }

  /**
   * Get alert statistics
   */
  static async getAlertStatistics(period = 'day') {
    const dateRange = this.getDateRange(period);

    const stats = {
      total_alerts: 0,
      critical_alerts: 0,
      high_alerts: 0,
      medium_alerts: 0,
      low_alerts: 0,
      resolved_alerts: 0,
      unresolved_alerts: 0,
      by_type: {},
    };

    // Get all alerts for the period
    const allAlerts = await this.getAllAlerts({
      alert_types: ['all'],
      include_resolved: true,
      limit: 1000,
    });

    // Filter alerts within period
    const periodAlerts = allAlerts.filter(
      alert => new Date(alert.timestamp) >= dateRange.start,
    );

    // Calculate statistics
    periodAlerts.forEach(alert => {
      stats.total_alerts++;

      // Count by severity
      if (alert.severity === 'critical') stats.critical_alerts++;
      else if (alert.severity === 'high') stats.high_alerts++;
      else if (alert.severity === 'medium') stats.medium_alerts++;
      else if (alert.severity === 'low') stats.low_alerts++;

      // Count resolved/unresolved
      if (alert.resolved) stats.resolved_alerts++;
      else stats.unresolved_alerts++;

      // Count by type
      if (!stats.by_type[alert.type]) {
        stats.by_type[alert.type] = {
          total: 0,
          resolved: 0,
          unresolved: 0,
        };
      }

      stats.by_type[alert.type].total++;
      if (alert.resolved) {
        stats.by_type[alert.type].resolved++;
      } else {
        stats.by_type[alert.type].unresolved++;
      }
    });

    // Calculate percentages
    stats.resolution_rate =
      stats.total_alerts > 0
        ? Math.round((stats.resolved_alerts / stats.total_alerts) * 100)
        : 0;

    stats.average_resolution_time = '24h'; // This would require tracking resolution timestamps

    return {
      period: period,
      date_range: dateRange,
      statistics: stats,
      summary: {
        current_unresolved: stats.unresolved_alerts,
        resolution_rate: stats.resolution_rate,
        most_common_type:
          Object.entries(stats.by_type).sort(
            (a, b) => b[1].total - a[1].total,
          )[0]?.[0] || 'none',
      },
    };
  }

  static getDateRange(period) {
    const end = new Date();
    let start = new Date();

    switch (period) {
      case 'hour':
        start.setHours(end.getHours() - 1);
        break;
      case 'day':
        start.setDate(end.getDate() - 1);
        break;
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      default:
        start.setDate(end.getDate() - 1);
    }

    return { start, end };
  }
}

export default AlertService;
