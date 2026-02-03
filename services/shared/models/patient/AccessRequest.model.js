import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class AccessRequest extends Model {
  /**
   * Create new access request
   */
  static async createRequest(requesterId, patientId, reason, requestType) {
    return await this.create({
      requester_id: requesterId,
      patient_id: patientId,
      request_reason: reason,
      request_type: requestType,
      status: 'pending',
    });
  }

  /**
   * Approve access request
   */
  static async approveRequest(requestId, approvedBy, expiryHours = 24) {
    const request = await this.findByPk(requestId);
    if (!request || request.status !== 'pending') {
      return null;
    }

    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + expiryHours);

    return await request.update({
      status: 'approved',
      approved_by: approvedBy,
      approval_date: new Date(),
      access_expiry: expiryDate,
    });
  }

  /**
   * Deny access request
   */
  static async denyRequest(requestId, approvedBy, denialReason) {
    const request = await this.findByPk(requestId);
    if (!request || request.status !== 'pending') {
      return null;
    }

    return await request.update({
      status: 'denied',
      approved_by: approvedBy,
      approval_date: new Date(),
      denial_reason: denialReason,
    });
  }

  /**
   * Get pending requests
   */
  static async getPendingRequests() {
    return await this.findAll({
      where: { status: 'pending' },
      order: [['created_at', 'ASC']],
    });
  }

  /**
   * Get requests for a specific patient
   */
  static async getPatientRequests(patientId) {
    return await this.findAll({
      where: { patient_id: patientId },
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Get requests by a specific user
   */
  static async getUserRequests(userId) {
    return await this.findAll({
      where: { requester_id: userId },
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Check if user has active access
   */
  static async hasActiveAccess(userId, patientId) {
    const request = await this.findOne({
      where: {
        requester_id: userId,
        patient_id: patientId,
        status: 'approved',
      },
    });

    if (!request) return false;

    // Check if expired
    if (request.access_expiry && new Date(request.access_expiry) < new Date()) {
      await request.update({ status: 'expired' });
      return false;
    }

    return true;
  }

  /**
   * Expire old requests
   */
  static async expireOldRequests() {
    const [affectedRows] = await this.update(
      { status: 'expired' },
      {
        where: {
          status: 'approved',
          access_expiry: {
            [sequelize.Op.lt]: new Date(),
          },
        },
      },
    );

    return affectedRows;
  }

  /**
   * Get access request statistics
   */
  static async getStatistics(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const stats = await this.findAll({
      where: {
        created_at: { [sequelize.Op.gte]: since },
      },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('request_id')), 'count'],
      ],
      group: ['status'],
    });

    return stats.reduce((acc, stat) => {
      acc[stat.status] = parseInt(stat.get('count'));
      return acc;
    }, {});
  }

  /**
   * Emergency access (auto-approved)
   */
  static async createEmergencyAccess(requesterId, patientId, reason) {
    const request = await this.create({
      requester_id: requesterId,
      patient_id: patientId,
      request_reason: reason,
      request_type: 'emergency',
      status: 'approved',
      approved_by: requesterId, // Self-approved in emergency
      approval_date: new Date(),
      access_expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // TODO: Send notification to compliance team
    return request;
  }
}

AccessRequest.init(
  {
    request_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    requester_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    request_reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    request_type: {
      type: DataTypes.ENUM('full_access', 'specific_records', 'emergency'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'denied', 'expired'),
      allowNull: false,
      defaultValue: 'pending',
    },
    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    approval_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    denial_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    access_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AccessRequest',
    tableName: 'access_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_access_req_requester', fields: ['requester_id'] },
      { name: 'idx_access_req_patient', fields: ['patient_id'] },
      { name: 'idx_access_req_status', fields: ['status'] },
      { name: 'idx_access_req_created', fields: ['created_at'] },
    ],
  },
);

export default AccessRequest;
