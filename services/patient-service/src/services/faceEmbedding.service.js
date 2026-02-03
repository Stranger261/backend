import crypto from 'crypto';

import sequelize from '../../../shared/config/db.config.js';
import { activeRecord } from '../../../shared/helpers/queryFilters.helper.js';
import AppError from '../../../shared/utils/AppError.util.js';

export default class FaceEmbeddingService {
  generateEmbeddingHash(embeddingVector) {
    const embeddingString = JSON.stringify(embeddingVector);
    return crypto.createHash('sha256').update(embeddingString).digest('hex');
  }

  async checkFaceUniqueness(faceToken, embeddingHash, transaction) {
    try {
      const options = transaction ? { transaction } : {};
      let existingEmbedding;

      // Check by face token first (most reliable)
      if (faceToken) {
        existingEmbedding = await FaceEmbedding.findOne({
          where: activeRecord({ face_token: faceToken }),
          include: [
            {
              model: Patient,
              attributes: [
                'patient_id',
                'first_name',
                'last_name',
                'date_of_birth',
              ],
            },
          ],
          ...options,
        });
      }

      // If no match by face token, check by embedding hash
      if (!existingEmbedding && embeddingHash) {
        existingEmbedding = await FaceEmbedding.findOne({
          where: activeRecord({ embedding_hash: embeddingHash }),
          include: [
            {
              model: Patient,
              attributes: [
                'patient_id',
                'first_name',
                'last_name',
                'date_of_birth',
              ],
            },
          ],
          ...options,
        });
      }

      if (existingEmbedding) {
        throw new AppError(
          'Face is already registered with other account.',
          400,
        );
      }

      return { isUnique: true, message: 'Face can be registered' };
    } catch (error) {
      console.log(error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  async saveFaceEmbedding(embeddingData, transaction) {
    const options = transaction ? { transaction } : {};
    try {
      const {
        patient_id,
        face_token,
        embedding_vector,
        image_url,
        confidence_score = 0.0,
      } = embeddingData;

      const embedding_hash = crypto
        .createHash('sha256')
        .update(face_token)
        .digest('hex');

      const faceEmbeddingData = {
        patient_id,
        face_token,
        embedding_vector,
        embedding_hash,
        image_url,
        confidence_score,
      };

      const newEmbedding = await FaceEmbedding.create(faceEmbeddingData, {
        ...options,
      });

      return newEmbedding;
    } catch (error) {
      console.error('Save face embedding error:', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  async getPatientFaceEmbedding(patientId) {
    try {
      const embedding = await FaceEmbedding.findOne({
        where: activeRecord({ patient_id: patientId }),
        attributes: [
          'embedding_id',
          'face_token',
          'embedding_vector',
          'confidence_score',
          'image_url',
          'created_at',
        ],
      });

      if (!embedding) {
        throw new AppError(
          `Face embedding with Patient ID of ${patientId} not found.`,
        );
      }

      return embedding;
    } catch (error) {
      console.error('Get patient face embedding error:', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  async deactivateFaceEmbedding(embId, staffId, userAgent, ipAddress) {
    const transaction = await sequelize.transaction();

    try {
      const result = await FaceEmbedding.update(
        { is_active: false },
        { where: activeRecord({ embedding_id: embId }), transaction },
      );

      if (!result) {
        throw new AppError('Deactivating face failed.', 400);
      }

      const success = result[0] > 0;

      // log
      // logPatient(
      //   res.patient_id,
      //   'status change',
      //   'deactivate face embedding using embedding_id',
      //   staff_id,
      //   ipAddress,
      //   userAgent
      // );

      await transaction.commit();

      return success;
    } catch (error) {
      await transaction.rollback();
      console.log('Deactivate Face Embedding error: ', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  async deactivateFaceEmbeddingByPatientId(
    patientId,
    staffId,
    userAgent,
    ipAddress,
  ) {
    const transaction = await sequelize.transaction();

    try {
      const result = await FaceEmbedding.update(
        { is_active: false },
        { where: activeRecord({ patient_id: patientId }), transaction },
      );

      if (!result) {
        throw new AppError('Failed to deactivate patient face embedding.', 400);
      }

      const success = result[0] > 0;

      // log
      // logPatient(
      //   patient_id,
      //   'status change',
      //   'deactivate face embedding using patient_id',
      //   staff_id,
      //   ipAddress,
      //   userAgent
      // );

      await transaction.commit();

      return success;
    } catch (error) {
      await transaction.rollback();
      console.log('Deactivate face embedding using PatientID failed: ', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  async getAllEmbeddings() {
    try {
      const allFaceEmbedding = await FaceEmbedding.findAll({
        where: activeRecord(),
        attributes: [
          'embedding_id',
          'patient_id',
          'face_token',
          'embedding_vector',
          'embedding_hash',
        ],
        include: [
          {
            model: Patient,
            attributes: ['mrn', 'first_name', 'last_name', 'date_of_birth'],
          },
        ],
      });

      return allFaceEmbedding;
    } catch (error) {
      console.error('Get all active embeddings error:', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }
}
