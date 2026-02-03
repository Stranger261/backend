import medicalRecordsService from '../services/medicalRecord.service.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';

class MedicalRecordsController {
  getMyMedicalRecords = asyncHandler(async (req, res) => {
    const { user_id, role, staff_id } = req.user;

    const filters = {
      page: req.query.page || 1,
      limit: req.query.limit || 50,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      recordType: req.query.recordType || req.query.visitType, // Support both
      visitType: req.query.visitType,
      status: req.query.status,
      search: req.query.search,
    };

    const requestInfo = req.clientInfo || {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionID || req.session?.id,
      timestamp: new Date().toISOString(),
    };

    const records = await medicalRecordsService.getMedicalRecords({
      requestingUserId: user_id,
      requestingUserRole: role,
      requestingStaffId: staff_id,
      patientId: null, // Will be determined in validateAccess for patients
      filters,
      requestInfo,
    });

    messageSender(200, 'Medical records retrieved successfully', records, res);
  });

  getPatientMedicalRecords = asyncHandler(async (req, res) => {
    const { user_id, role, staff_id } = req.user;
    const { patientId } = req.params;

    if (!['doctor', 'nurse', 'admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only healthcare providers can access patient medical records',
      });
    }

    const filters = {
      page: req.query.page || 1,
      limit: req.query.limit || 50,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      recordType: req.query.recordType,
      visitType: req.query.visitType,
      search: req.query.search,
      accessReason: req.query.accessReason || 'Medical care',
    };

    const requestInfo = req.clientInfo || {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionID || req.session?.id,
      timestamp: new Date().toISOString(),
    };

    const records = await medicalRecordsService.getMedicalRecords({
      requestingUserId: user_id,
      requestingUserRole: role,
      requestingStaffId: staff_id,
      patientId: parseInt(patientId),
      filters,
      requestInfo,
    });

    messageSender(
      200,
      'Patient medical records retrieved successfully',
      records,
      res,
    );
  });

  getRecordDetails = asyncHandler(async (req, res) => {
    const { user_id, role, staff_id } = req.user;
    const { recordType, recordId } = req.params;

    const validRecordTypes = ['appointment', 'admission', 'medical_record'];
    if (!validRecordTypes.includes(recordType)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid record type. Must be: appointment, admission, or medical_record',
      });
    }

    const requestInfo = req.clientInfo || {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionID || req.session?.id,
      timestamp: new Date().toISOString(),
    };

    const record = await medicalRecordsService.getRecordDetails({
      requestingUserId: user_id,
      requestingUserRole: role,
      requestingStaffId: staff_id,
      recordType,
      recordId: parseInt(recordId),
      requestInfo,
    });

    messageSender(200, 'Record details retrieved successfully', record, res);
  });

  getMedicalRecordsSummary = asyncHandler(async (req, res) => {
    const { user_id, role, staff_id } = req.user;
    const patientId = req.query.patientId;

    const filters = {
      accessReason: 'Viewing summary',
    };

    const requestInfo = req.clientInfo || {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionID || req.session?.id,
      timestamp: new Date().toISOString(),
    };

    const records = await medicalRecordsService.getMedicalRecords({
      requestingUserId: user_id,
      requestingUserRole: role,
      requestingStaffId: staff_id,
      patientId: patientId ? parseInt(patientId) : null,
      filters: { ...filters, limit: 5 },
      requestInfo,
    });

    messageSender(
      200,
      'Medical records summary retrieved successfully',
      {
        summary: records.summary,
        recentRecords: records.timeline,
      },
      res,
    );
  });
}

export default new MedicalRecordsController();
