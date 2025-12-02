import fetch from 'node-fetch';
import FormData from 'form-data';

import { Person, User, sequelize } from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';
import auditHelper from '../../../shared/utils/logger.util.js';

class FacePlusPlusService {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = 'https://api-us.faceplusplus.com/facepp/v3';

    console.log(
      '🔑 Face++ Service initialized with API Key:',
      this.apiKey ? '✅ Present' : '❌ Missing'
    );
  }

  async #makeRequest(endpoint, formData) {
    try {
      console.log(`🔍 Making Face++ ${endpoint} request...`);

      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        body: formData,
        // Add timeout for large requests
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error_message) {
        throw new Error(`Face++ API error: ${data.error_message}`);
      }

      console.log(`✅ Face++ ${endpoint} request successful`);
      return data;
    } catch (error) {
      console.error(`❌ Face++ ${endpoint} request failed:`, error.message);

      if (error.name === 'AbortError') {
        throw new Error('Face++ request timeout - image might be too large');
      }

      throw error;
    }
  }

  async detectFace(imageBase64) {
    try {
      // Validate base64 size
      if (imageBase64.length > 10 * 1024 * 1024) {
        // 10MB limit
        throw new Error('Image too large. Please use a smaller image.');
      }

      const formData = new FormData();
      formData.append('api_key', this.apiKey);
      formData.append('api_secret', this.apiSecret);
      formData.append('image_base64', imageBase64);
      formData.append('return_attributes', 'facequality');

      const data = await this.#makeRequest('detect', formData);

      if (!data.faces || data.faces.length === 0) {
        throw new Error('No face detected in image');
      }

      return data.faces[0];
    } catch (error) {
      console.error('❌ Face detection service error:', error.message);
      throw new Error(`Failed to detect face: ${error.message}`);
    }
  }

  async compareFaces(faceToken1, faceToken2) {
    try {
      const formData = new FormData();
      formData.append('api_key', this.apiKey);
      formData.append('api_secret', this.apiSecret);
      formData.append('face_token1', faceToken1);
      formData.append('face_token2', faceToken2);

      const data = await this.#makeRequest('compare', formData);

      return data;
    } catch (error) {
      console.error('❌ Face comparison service error:', error.message);
      throw new Error(`Failed to compare faces: ${error.message}`);
    }
  }

  async verifyFaces(liveImageBase64, userUUID, ipAddress, userAgent) {
    const transaction = await sequelize.transaction();
    try {
      console.log('🎯 Starting face verification process...');

      // METHOD 1: Try with association first
      let person;
      let user;

      try {
        user = await User.findOne({
          where: {
            user_uuid: userUUID,
            is_deleted: false,
          },
          include: [
            {
              model: Person,
              as: 'person', // Try different association names
              required: false, // Change to false to see if user exists
            },
          ],
          transaction,
        });

        if (!user) {
          throw new AppError('User not found.', 404);
        }

        console.log(user);
        console.log('✅ User found:', user.user_id);
        console.log('User associations:', User.associations);

        // If association works, use it
        if (user.person) {
          person = user.person;
          console.log('✅ Person found via association');
        } else {
          // METHOD 2: Fallback - query Person directly
          console.log(
            '⚠️ Association not working, querying Person directly...'
          );
          person = await Person.findOne({
            where: { user_id: user.user_id },
            transaction,
          });
        }
      } catch (associationError) {
        console.log('⚠️ Association query failed, using direct query...');

        // METHOD 3: Direct query without associations
        user = await User.findOne({
          where: {
            user_uuid: userUUID,
            is_deleted: false,
          },
          transaction,
        });

        console.log('user', user);
        console.log('person', person);
        if (!user) {
          throw new AppError('User not found.', 404);
        }

        person = await Person.findOne({
          where: { user_id: user.user_id },
          transaction,
        });
      }

      if (!person) {
        throw new AppError('Person not found for this user.', 404);
      }

      console.log('✅ Person found:', {
        person_id: person.person_id,
        first_name: person.first_name,
        has_face_encoding: !!person.face_encoding,
      });

      const storedFaceToken = person.face_encoding;
      if (!storedFaceToken) {
        throw new AppError(
          'No face registered. Please complete registration first.',
          404
        );
      }

      console.log('✅ Found stored face token for:', person.first_name);
      console.log('📸 Detecting face in selfie...');

      let liveFace;
      try {
        liveFace = await this.detectFace(liveImageBase64);
      } catch (error) {
        throw new AppError(
          'Failed to detect face in selfie: ' + error.message,
          400
        );
      }

      const liveFaceToken = liveFace.face_token;
      console.log('✅ Face detected in selfie');

      console.log('🔍 Comparing faces...');
      const comparison = await this.compareFaces(
        storedFaceToken,
        liveFaceToken
      );

      const isMatch =
        comparison.confidence >=
        (process.env.FACEPP_CONFIDENCE_THRESHOLD || 70);

      console.log(
        `📊 Face comparison result: ${comparison.confidence}% confidence`
      );

      if (!isMatch) {
        throw new AppError(
          'Face does not match your registered ID photo. Please try again.',
          400
        );
      }

      // Update user registration status
      await User.update(
        {
          registration_step: 'completed',
          registration_status: 'completed',
          account_status: 'active',
        },
        { where: { user_uuid: userUUID }, transaction }
      );

      // Fix: Use user.user_id instead of person.user_id
      await auditHelper.updateLog({
        userId: user.user_id, // FIXED: Use user.user_id
        tableName: 'users',
        recordId: user.user_id, // FIXED: Use user.user_id
        oldData: {
          registration_step: 'verify_face',
          registration_status: 'verify_face',
          account_status: 'pending',
        },
        newData: {
          registration_step: 'completed',
          registration_status: 'completed',
          account_status: 'active',
        },
        userAgent,
        ipAddress,
        transaction,
      });

      await transaction.commit();
      console.log('✅ Face verification completed successfully');

      return {
        confidence: comparison.confidence,
        person_id: person.person_id,
        registration_completed: true,
      };
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
        console.log('⚠️ Transaction rolled back');
      }

      console.error('❌ Face verification service error:', error.message);

      // FIXED: Proper error re-throwing
      if (error instanceof AppError) {
        throw error;
      } else {
        throw new AppError('Internal server error.', 500);
      }
    }
  }

  async healthCheck() {
    try {
      const formData = new FormData();
      formData.append('api_key', this.apiKey);
      formData.append('api_secret', this.apiSecret);
      formData.append('image_base64', 'test'); // Invalid base64 to test connection

      await fetch(`${this.baseUrl}/detect`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      return {
        status: 'connected',
        message: 'Face++ API is reachable',
      };
    } catch (error) {
      // Even if it fails with invalid data, we know the API is reachable
      if (
        error.message.includes('Face++ API error') ||
        error.name === 'AbortError'
      ) {
        return {
          status: 'connected',
          message:
            'Face++ API is reachable but test data was invalid or timeout',
        };
      }
      throw new Error(`Face++ API is not reachable: ${error.message}`);
    }
  }
}

export const createFacePlusPlusService = () => {
  const apiKey = process.env.FACEPP_API_KEY;
  const apiSecret = process.env.FACEPP_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      'FACEPP_API_KEY and FACEPP_API_SECRET environment variables are required'
    );
  }

  return new FacePlusPlusService(apiKey, apiSecret);
};
