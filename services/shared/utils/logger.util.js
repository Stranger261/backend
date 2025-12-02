import AuditLog from '../models/patient/AuditLog.model.js';
/**
 * Log audit trail for user actions
 * @param {number} userId - The user ID performing the action
 * @param {number} staffId - The staff ID (if applicable)
 * @param {string} actionType - create, update, delete, login, logout, export
 * @param {string} tableName - The database table affected
 * @param {number} recordId - The ID of the record being affected
 * @param {object} oldValues - Previous values (for update/delete)
 * @param {object} newValues - New values (for create/update)
 * @param {string} ipAddress - User's IP address
 * @param {object} transaction - Sequelize transaction object (optional)
 * @returns {Promise<object>} - The created audit log entry
 */
const logAudit = async ({
  userId = null,
  staffId = null,
  actionType,
  tableName,
  recordId,
  oldValues = null,
  newValues = null,
  userAgent,
  ipAddress,
  transaction = null,
}) => {
  try {
    const auditData = {
      user_id: userId,
      staff_id: staffId,
      action_type: actionType,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ipAddress,
      user_agent: userAgent,
    };

    Object.keys(auditData).forEach(key => {
      if (auditData[key] === null || auditData[key] === undefined) {
        delete auditData[key];
      }
    });

    const options = transaction ? { transaction } : {};

    const auditLog = await AuditLog.create(auditData, options);

    return auditLog;
  } catch (err) {
    console.error('Failed to log audit trail:', err.message);
    return null;
  }
};

const auditHelper = {
  // for self-create and self update
  async userRegistration({
    userId,
    staffId = null,
    userData,
    userAgent,
    ipAddress,
    transaction = null,
  }) {
    return await logAudit({
      userId,
      staffId,
      actionType: 'create',
      tableName: 'users',
      recordId: userId,
      newValues: userData,
      userAgent,
      ipAddress,
      transaction,
    });
  },

  async userLogin({ userId, userAgent, ipAddress, transaction = null }) {
    return await logAudit({
      userId,
      actionType: 'login',
      tableName: 'users',
      userAgent,
      ipAddress,
      transaction,
    });
  },

  async userLogout({ userId, userAgent, ipAddress, transaction = null }) {
    return await logAudit({
      userId,
      actionType: 'logout',
      tableName: 'users',
      userAgent,
      ipAddress,
      transaction,
    });
  },

  // crud operations
  async createLog({
    userId,
    staffId = null,
    tableName,
    recordId,
    newData,
    userAgent,
    ipAddress,
    transaction = null,
  }) {
    return await logAudit({
      userId,
      staffId,
      actionType: 'create',
      tableName,
      recordId,
      newValues: newData,
      userAgent,
      ipAddress,
      transaction,
    });
  },

  async updateLog({
    userId,
    staffId = null,
    tableName,
    recordId,
    oldData,
    newData,
    userAgent,
    ipAddress,
    transaction = null,
  }) {
    return await logAudit({
      userId,
      actionType: 'update',
      staffId,
      tableName,
      recordId,
      oldValues: oldData,
      newValues: newData,
      userAgent,
      ipAddress,
      transaction,
    });
  },

  async deleteLog({
    userId,
    staffId = null,
    tableName,
    recordId,
    oldData,
    newData,
    userAgent,
    ipAddress,
    transaction = null,
  }) {
    return await logAudit({
      userId,
      staffId,
      actionType: 'delete',
      tableName,
      recordId,
      oldValues: oldData,
      newValues: newData,
      userAgent,
      ipAddress,
      transaction,
    });
  },

  async softDeleteRecord({
    userId,
    staffId = null,
    tableName,
    recordId,
    oldData,
    newData,
    userAgent,
    ipAddress,
    transaction = null,
  }) {
    return await logAudit({
      userId,
      staffId,
      actionType: 'soft_delete',
      tableName,
      recordId,
      oldValues: oldData,
      newValues: newData,
      userAgent,
      ipAddress,
      transaction,
    });
  },

  async viewRecord({
    userId,
    staffId = null,
    tableName,
    recordId,
    userAgent,
    ipAddress,
    transaction = null,
  }) {
    return await logAudit({
      userId,
      staffId,
      actionType: 'view',
      tableName,
      recordId,
      userAgent,
      ipAddress,
      transaction,
    });
  },
};

export default auditHelper;
