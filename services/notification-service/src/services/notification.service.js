import { Notification, User, sequelize } from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

class NotificationService {
  async getUserNotification(userUuid, filters = {}) {
    try {
      const { status, page = 1, limit = 5 } = filters;

      const where = { user_uuid: userUuid };

      if (status) {
        where.status = status;
      }

      const offset = (page - 1) * limit;

      const { rows: notification, count: total } =
        await Notification.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: [['created_at', 'DESC']],
        });

      return {
        notification,
        pagination: {
          limit: parseInt(limit),
          currentPage: parseInt(page),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.log('Failed to get User notifications: ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Notification server error', 500);
    }
  }

  async readNotification(notifId) {
    const transaction = await sequelize.transaction();
    try {
      const notif = await Notification.findByPk(notifId, { transaction });

      if (!notif) {
        throw new AppError('Notification not found.', 404);
      }

      await notif.update({
        is_read: true,
        read_at: new Date(),
      });

      await transaction.commit();

      return notif;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      console.log('Failed to read notification: ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Internal server error', 500);
    }
  }

  async readAllUserNotification(userUuid) {
    const transaction = await sequelize.transaction();
    try {
      const notifications = await Notification.findAll(
        {
          where: { user_uuid: userUuid, is_read: false },
        },
        { transaction }
      );

      let promises = [];
      notifications.map(n => promises.push(n.update({ is_read: true })));

      promises.map(async p => await p);

      return this.getUserNotification(userUuid);
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.log('Marked all notification failed: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Marked all read notification error', 500);
    }
  }
}

export default new NotificationService();
