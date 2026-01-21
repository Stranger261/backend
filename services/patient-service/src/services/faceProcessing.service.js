import FormData from 'form-data';
import axios from 'axios';
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import AppError from '../../../shared/utils/AppError.util.js';
import { Person } from '../../../shared/models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class FaceProcessingService {
  constructor() {
    this.faceSetToken = process.env.FACEPP_FACESET_TOKEN;
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.minDelay = 2000; // 2 seconds between requests
    this.initializeFaceSet();
  }

  async queueRequest(apiCall) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ apiCall, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { apiCall, resolve, reject } = this.requestQueue.shift();

    try {
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelay) {
        const waitTime = this.minDelay - timeSinceLastRequest;
        console.log(`⏳ Waiting ${waitTime}ms...`);
        await this.sleep(waitTime);
      }

      this.lastRequestTime = Date.now();
      const result = await this.retryWithBackoff(apiCall);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      setImmediate(() => this.processQueue());
    }
  }

  async retryWithBackoff(apiCall, maxRetries = 5) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries}...`);
        const result = await apiCall();
        console.log('✅ Request successful');
        return result;
      } catch (error) {
        lastError = error;
        const errorMsg = error.response?.data?.error_message || '';
        const statusCode = error.response?.status;
        const isConcurrency = errorMsg.includes('CONCURRENCY_LIMIT_EXCEEDED');
        const isRateLimit =
          statusCode === 403 || statusCode === 429 || isConcurrency;

        console.error(`❌ Failed (${statusCode}):`, errorMsg || error.message);

        if (isRateLimit && attempt < maxRetries) {
          const delay = Math.min(3000 * Math.pow(2, attempt - 1), 30000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        if (statusCode >= 400 && statusCode < 500 && !isRateLimit) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw new AppError(
            `Face++ failed after ${maxRetries} attempts: ${
              errorMsg || error.message
            }`,
            statusCode || 500
          );
        }
      }
    }

    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // FACESET OPERATIONS
  // ==========================================================================

  async initializeFaceSet() {
    try {
      if (!this.faceSetToken) {
        console.log('\n⚠️  Creating new FaceSet...\n');
        const newFaceSet = await this.createFaceSet();
        console.log(
          `\n✅ Add to .env: FACEPP_FACESET_TOKEN=${newFaceSet.faceset_token}\n`
        );
        this.faceSetToken = newFaceSet.faceset_token;
      } else {
        const details = await this.getFaceSetDetails();
        console.log(`\n✅ FaceSet ready (${details.face_count} faces)\n`);
      }
    } catch (error) {
      console.error('❌ FaceSet init failed:', error.message);
    }
  }

  async createFaceSet() {
    return this.queueRequest(async () => {
      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('display_name', 'Hospital_Patient_Registry');
      formData.append('outer_id', `hms_faceset_${Date.now()}`);

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/faceset/create',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 }
      );

      if (response.data.error_message) {
        throw new AppError(
          `FaceSet creation failed: ${response.data.error_message}`,
          500
        );
      }

      return response.data;
    });
  }

  async getFaceSetDetails() {
    return this.queueRequest(async () => {
      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('faceset_token', this.faceSetToken);

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/faceset/getdetail',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 }
      );

      return response.data;
    });
  }

  // ==========================================================================
  // FACE DETECTION
  // ==========================================================================

  generateEmbeddingHash(faceToken) {
    return crypto.createHash('sha256').update(faceToken).digest('hex');
  }

  async detectAndCropFace(imageBuffer) {
    return this.queueRequest(async () => {
      console.log('🔍 Detecting face...');

      let buffer;

      if (Buffer.isBuffer(imageBuffer)) {
        buffer = imageBuffer;
      } else if (typeof imageBuffer === 'string') {
        let base64Data = imageBuffer;

        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }

        buffer = Buffer.from(base64Data, 'base64');
        console.log('✅ Converted base64 string to buffer');
      } else {
        throw new AppError(
          'Invalid image format. Expected Buffer or base64 string.',
          400
        );
      }

      if (!buffer || buffer.length === 0) {
        throw new AppError('Invalid image data', 400);
      }

      console.log(`📦 Image size: ${(buffer.length / 1024).toFixed(2)} KB`);

      const formData = new FormData();
      formData.append('image_file', buffer, {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('return_attributes', 'blur,facequality');

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/detect',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 }
      );

      if (response.data.error_message) {
        throw new AppError(
          `Face detection failed: ${response.data.error_message}`,
          400
        );
      }

      if (!response.data.faces || response.data.faces.length === 0) {
        throw new AppError(
          'No face detected. Please upload a clear photo.',
          400
        );
      }

      if (response.data.faces.length > 1) {
        throw new AppError(
          'Multiple faces detected. Please use a photo with only one person.',
          400
        );
      }

      const face = response.data.faces[0];
      const faceRect = face.face_rectangle;

      if (faceRect.width < 100 || faceRect.height < 100) {
        throw new AppError(
          'Face too small. Please upload a higher quality photo.',
          400
        );
      }

      const blurValue = face.attributes?.blur?.blurriness?.value || 0;
      if (blurValue > 50) {
        throw new AppError(
          `Photo too blurry (${blurValue.toFixed(
            1
          )}). Please upload clearer photo.`,
          400
        );
      }

      const faceQuality = face.attributes?.facequality?.value || 85;
      if (faceQuality < 45) {
        throw new AppError(
          `Face quality too low (${faceQuality.toFixed(1)}/100).`,
          400
        );
      }

      console.log('✅ Quality:', {
        size: `${faceRect.width}x${faceRect.height}`,
        blur: blurValue.toFixed(1),
        quality: faceQuality.toFixed(1),
      });

      // Crop face
      const metadata = await sharp(buffer).metadata();
      const padding = 0.3;

      const croppedFaceBuffer = await sharp(buffer)
        .extract({
          left: Math.max(
            0,
            Math.floor(faceRect.left - faceRect.width * padding)
          ),
          top: Math.max(
            0,
            Math.floor(faceRect.top - faceRect.height * padding)
          ),
          width: Math.min(
            metadata.width -
              Math.max(0, Math.floor(faceRect.left - faceRect.width * padding)),
            Math.floor(faceRect.width * (1 + 2 * padding))
          ),
          height: Math.min(
            metadata.height -
              Math.max(0, Math.floor(faceRect.top - faceRect.height * padding)),
            Math.floor(faceRect.height * (1 + 2 * padding))
          ),
        })
        .resize(600, 600, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 90 })
        .toBuffer();

      console.log('✅ Face cropped');

      return {
        croppedFaceBuffer,
        faceRectangle: faceRect,
        faceToken: face.face_token,
        faceQuality,
        qualityChecks: {
          blur: blurValue,
          quality: faceQuality,
          faceSize: { width: faceRect.width, height: faceRect.height },
        },
      };
    });
  }

  // ==========================================================================
  // DUPLICATE DETECTION - FIXED VERSION
  // ==========================================================================

  async searchFaceInFaceSet(faceToken) {
    return this.queueRequest(async () => {
      console.log('🔍 Searching FaceSet for duplicates...');

      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('faceset_token', this.faceSetToken);
      formData.append('face_token', faceToken);
      formData.append('return_result_count', '5'); // Get top 10 matches

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/search',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 }
      );

      if (response.data.error_message) {
        const errorMsg = response.data.error_message;

        // Empty FaceSet is OK
        if (
          errorMsg.includes('EMPTY_FACESET') ||
          errorMsg.includes('no face') ||
          errorMsg.includes('invalid faceset')
        ) {
          console.log('⚠️ FaceSet is empty');
          return [];
        }

        throw new AppError(`Face search failed: ${errorMsg}`, 400);
      }

      const results = response.data.results || [];

      return results;
    });
  }

  /**
   * ✅ FIXED: Proper duplicate detection using database mapping
   * Checks if the face already exists in the FaceSet
   */
  async checkDuplicateFace(faceToken, transaction) {
    try {
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('🔍 ENHANCED DUPLICATE FACE CHECK');
      console.log('═══════════════════════════════════════');

      // Get FaceSet details
      const details = await this.getFaceSetDetails();
      console.log(
        `📊 FaceSet currently has ${details.face_count} registered faces`
      );

      if (details.face_count === 0) {
        console.log('✅ FaceSet is empty - this is the first registration');
        console.log('═══════════════════════════════════════');
        console.log('');
        return { isDuplicate: false };
      }

      // Search for similar faces
      const matches = await this.searchFaceInFaceSet(faceToken);

      if (matches.length === 0) {
        console.log('✅ No similar faces found');
        console.log('═══════════════════════════════════════');
        console.log('');
        return { isDuplicate: false };
      }

      // Check each match against threshold
      const THRESHOLD = parseInt(process.env.FACEPP_DUPLICATE_THRESHOLD) || 75;
      console.log(`🎯 Using duplicate threshold: ${THRESHOLD}%`);
      console.log('');

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const confidence = match.confidence;
        const matchedFaceToken = match.face_token;

        console.log(`───────────────────────────────────────`);
        console.log(`🔍 Checking match #${i + 1}:`);
        console.log(
          `   Matched face token: ${matchedFaceToken?.substring(0, 20)}...`
        );
        console.log(`   Confidence: ${confidence.toFixed(2)}%`);

        // Check if confidence is above threshold
        if (confidence < THRESHOLD) {
          console.log(
            `   ℹ️ Below threshold (${confidence.toFixed(
              2
            )}% < ${THRESHOLD}%), skipping`
          );
          continue;
        }

        console.log(`   🚨 ABOVE THRESHOLD! Checking database...`);

        // ✅ METHOD 1: Check database by face_encoding
        const personByEncoding = await Person.findOne({
          where: {
            face_encoding: matchedFaceToken,
            is_deleted: false,
          },
          attributes: ['person_id', 'first_name', 'last_name', 'user_id'],
          transaction,
        });

        if (personByEncoding) {
          console.log(`   ❌ DUPLICATE DETECTED via face_encoding!`);
          console.log(
            `   Person: ${personByEncoding.first_name} ${personByEncoding.last_name} (ID: ${personByEncoding.person_id})`
          );
          console.log(`   Match confidence: ${confidence.toFixed(2)}%`);
          console.log('═══════════════════════════════════════');
          console.log('');

          throw new AppError(
            `This face is already registered to other user. (${confidence.toFixed(
              1
            )}% match). Each person can only register once.`,
            409
          );
        }

        // ✅ METHOD 2: If no database match, check if face has user_id in Face++
        try {
          const faceDetails = await this.getFaceDetails(matchedFaceToken);
          if (faceDetails.user_id) {
            const personById = await Person.findOne({
              where: {
                person_id: faceDetails.user_id,
                is_deleted: false,
              },
              attributes: ['person_id', 'first_name', 'last_name', 'user_id'],
              transaction,
            });

            if (personById) {
              console.log(`   ❌ DUPLICATE DETECTED via user_id!`);
              console.log(
                `   Person: ${personById.first_name} ${personById.last_name} (ID: ${personById.person_id})`
              );
              console.log(`   Match confidence: ${confidence.toFixed(2)}%`);
              console.log('═══════════════════════════════════════');
              console.log('');

              throw new AppError(
                `This face is already registered to other user. (${confidence.toFixed(
                  1
                )}% match). Each person can only register once.`,
                409
              );
            }
          }
        } catch (error) {
          console.log(`   ⚠️ Could not get face details: ${error.message}`);
        }

        console.log(`   ✅ No duplicate found for match #${i + 1}`);
      }

      console.log('✅ No duplicate faces found - registration can proceed');
      console.log('═══════════════════════════════════════');
      console.log('');
      return { isDuplicate: false };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error('❌ Duplicate check failed:', error.message);
      console.log('═══════════════════════════════════════');
      console.log('');
      throw new AppError('Failed to check for duplicate faces', 500);
    }
  }

  // ✅ NEW METHOD: Get face details from Face++
  async getFaceDetails(faceToken) {
    return this.queueRequest(async () => {
      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('face_token', faceToken);

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/face/getdetail',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 }
      );

      return response.data;
    });
  }

  // ==========================================================================
  // FACESET MANAGEMENT
  // ==========================================================================

  async addFaceToFaceSet(faceToken, personId) {
    return this.queueRequest(async () => {
      console.log(`📥 Adding face to FaceSet...`);
      console.log(`   Person ID: ${personId}`);
      console.log(`   Face Token: ${faceToken.substring(0, 20)}...`);

      // ✅ Validate inputs
      if (!personId || isNaN(personId) || personId <= 0) {
        throw new AppError('Invalid person ID for FaceSet', 400);
      }

      if (!faceToken || typeof faceToken !== 'string') {
        throw new AppError('Invalid face token', 400);
      }

      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('faceset_token', this.faceSetToken);

      // ✅ CRITICAL FIX: Use only face_tokens parameter
      formData.append('face_tokens', faceToken);

      // ✅ Remove outer_id to avoid COEXISTENCE_ARGUMENTS error
      // formData.append('outer_id', `person_${personId}`); // REMOVED

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/faceset/addface',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 }
      );

      if (response.data.error_message) {
        // Handle specific error cases
        const errorMsg = response.data.error_message;

        if (errorMsg.includes('EXIST')) {
          console.log('⚠️ Face already exists in FaceSet');
          return response.data; // Still return success for existing faces
        }

        throw new AppError(`Failed to add face: ${errorMsg}`, 500);
      }

      console.log('✅ Face successfully added to FaceSet');
      return response.data;
    });
  }

  // ✅ NEW METHOD: Update face user_id after adding to FaceSet
  async updateFaceUserId(faceToken, personId) {
    return this.queueRequest(async () => {
      console.log(`🏷️ Setting user_id for face...`);
      console.log(`   Face Token: ${faceToken.substring(0, 20)}...`);
      console.log(`   User ID: ${personId}`);

      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('face_token', faceToken);
      formData.append('user_id', personId.toString());

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/face/setuserid',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 }
      );

      if (response.data.error_message) {
        console.warn('⚠️ Could not set user_id:', response.data.error_message);
        // Don't throw error - this is non-critical
        return null;
      }

      console.log('✅ User ID set for face');
      return response.data;
    });
  }

  async removeFaceFromFaceSet(faceToken) {
    return this.queueRequest(async () => {
      console.log('🗑️ Removing face from FaceSet...');

      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('faceset_token', this.faceSetToken);
      formData.append('face_tokens', faceToken);

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/faceset/removeface',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 }
      );

      console.log('✅ Face removed from FaceSet');
      return response.data;
    });
  }

  async compareFaces(storedFaceToken, liveFaceToken) {
    return this.queueRequest(async () => {
      console.log('⚖️ Comparing faces...');

      if (!storedFaceToken || typeof storedFaceToken !== 'string') {
        throw new AppError('Invalid stored face token', 400);
      }

      if (!liveFaceToken || typeof liveFaceToken !== 'string') {
        console.error(
          '❌ Invalid liveFaceToken:',
          typeof liveFaceToken,
          liveFaceToken
        );
        throw new AppError('Invalid live face token', 400);
      }

      console.log(`   Stored token: ${storedFaceToken.substring(0, 20)}...`);
      console.log(`   Live token: ${liveFaceToken.substring(0, 20)}...`);

      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('face_token1', storedFaceToken);
      formData.append('face_token2', liveFaceToken);

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/compare',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 }
      );

      if (response.data.error_message) {
        throw new AppError(
          `Comparison failed: ${response.data.error_message}`,
          400
        );
      }

      const confidence = response.data.confidence;
      console.log(`✅ Comparison: ${confidence.toFixed(2)}% confidence`);

      return {
        confidence,
        thresholds: response.data.thresholds,
        is_match: confidence >= (response.data.thresholds['1e-5'] || 80),
        raw_response: response.data,
      };
    });
  }

  // ==========================================================================
  // FILE OPERATIONS
  // ==========================================================================

  async saveFaceImage(faceBuffer, personId) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'faces');
    await fs.mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const filename = `person_${personId}_${timestamp}_${randomString}.jpg`;
    const filepath = path.join(uploadDir, filename);

    await fs.writeFile(filepath, faceBuffer);
    console.log('✅ Face image saved:', filename);

    return {
      filepath,
      filename,
      relativePath: `/uploads/faces/${filename}`,
    };
  }

  async processFaceFromID(idPhotoBuffer, personId) {
    console.log('🎭 Processing face from ID...');

    const { croppedFaceBuffer, faceToken, faceQuality, qualityChecks } =
      await this.detectAndCropFace(idPhotoBuffer);

    if (faceQuality < 40) {
      throw new AppError(
        `Face quality insufficient (${faceQuality.toFixed(1)}/100).`,
        400
      );
    }

    let relativePath = null;
    if (personId && personId > 0) {
      const saveResult = await this.saveFaceImage(croppedFaceBuffer, personId);
      relativePath = saveResult.relativePath;
    }

    const embeddingHash = this.generateEmbeddingHash(faceToken);
    console.log('✅ Face processing complete');

    return {
      face_encoding: faceToken,
      face_image_path: relativePath,
      face_quality_score: faceQuality,
      embedding_hash: embeddingHash,
      cropped_face_buffer: croppedFaceBuffer,
      quality_checks: qualityChecks,
    };
  }
}
