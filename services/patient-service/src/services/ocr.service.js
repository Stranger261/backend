import axios from 'axios';
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

import sequelize from '../../../shared/config/db.config.js';
import { activeRecord } from '../../../shared/helpers/queryFilters.helper.js';
import AppError from '../../../shared/utils/AppError.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OCRService {
  /**
   * STEP 1: Extract data from ID using Azure OCR
   * Called BEFORE form submission for immediate validation
   */
  async extractIDData(fileBuffer) {
    if (!fileBuffer) {
      throw new AppError('File not found', 404);
    }

    const ocrUrl = `${process.env.AZURE_OCR_ENDPOINT}/vision/v3.2/read/analyze`;
    const key = process.env.AZURE_OCR_KEY;

    try {
      console.log('🔍 Starting Azure OCR...');

      // Send image to Azure
      const response = await axios.post(ocrUrl, fileBuffer, {
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/octet-stream',
        },
      });

      const operationLocation = response.headers['operation-location'];
      if (!operationLocation) {
        throw new AppError('No operation-location from Azure OCR', 500);
      }

      // Poll for results
      let result;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const pollResponse = await axios.get(operationLocation, {
          headers: { 'Ocp-Apim-Subscription-Key': key },
        });

        result = pollResponse.data;

        if (result.status === 'succeeded') break;
        if (result.status === 'failed') {
          throw new AppError('Azure OCR failed', 500);
        }
      }

      if (!result || result.status !== 'succeeded') {
        throw new AppError('OCR timeout', 500);
      }

      const readResults = result.analyzeResult?.readResults;
      if (!readResults) {
        throw new AppError('No OCR results', 404);
      }

      const extractedText = readResults
        .map(page => page.lines.map(line => line.text).join('\n'))
        .join('\n\n');

      const parsedData = this.parseIDFromText(extractedText);

      const totalFields = 5;
      const extractedFields = Object.values(parsedData).filter(v => v).length;
      const confidence = (extractedFields / totalFields) * 100;

      console.log(`✅ OCR Confidence: ${confidence}%`);

      return {
        extractedText,
        parsedData,
        confidence,
        raw: result,
      };
    } catch (error) {
      console.error('❌ OCR Error:', error.message);
      if (error instanceof AppError) throw error;
      throw new AppError('OCR processing failed: ' + error.message, 500);
    }
  }
  /**
   * Parse Philippine ID data from extracted text
   * Supports: National ID, Driver's License, Passport, etc.
   */
  parseIDFromText(text) {
    const lines = text.split('\n').map(line => line.trim());

    const parsed = {
      id_number: null,
      full_name: null,
      first_name: null,
      last_name: null,
      middle_name: null,
      date_of_birth: null,
      address: null,
      expiry_date: null,
      id_type: null,
    };

    // Detect ID type
    const textLower = text.toLowerCase();
    if (textLower.includes('philsys') || textLower.includes('national id')) {
      parsed.id_type = 'national_id';
    } else if (textLower.includes('driver') || textLower.includes('license')) {
      parsed.id_type = 'drivers_license';
    } else if (textLower.includes('passport')) {
      parsed.id_type = 'passport';
    }

    // Extract ID Number patterns
    for (const line of lines) {
      // National ID: 1234-5678-9012-3456
      const nationalIdMatch = line.match(/\d{4}-\d{4}-\d{4}-\d{4}/);
      if (nationalIdMatch) {
        parsed.id_number = nationalIdMatch[0];
      }

      // Driver's License: N12-34-567890
      const dlMatch = line.match(/[A-Z]\d{2}-\d{2}-\d{6}/);
      if (dlMatch) {
        parsed.id_number = dlMatch[0];
      }

      // Date of Birth: YYYY-MM-DD or MM/DD/YYYY
      const dobMatch = line.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/);
      if (dobMatch && line.toLowerCase().includes('birth')) {
        parsed.date_of_birth = this.standardizeDate(dobMatch[0]);
      }

      // Expiry Date
      const expiryMatch = line.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/);
      if (expiryMatch && line.toLowerCase().includes('expiry')) {
        parsed.expiry_date = this.standardizeDate(expiryMatch[0]);
      }

      // Name extraction (usually in LAST NAME, FIRST NAME format)
      if (line.toLowerCase().includes('name') && line.includes(',')) {
        const nameParts = line.split(':')[1]?.split(',') || [];
        if (nameParts.length >= 2) {
          parsed.last_name = nameParts[0].trim();
          parsed.first_name = nameParts[1].trim();
          parsed.middle_name = nameParts[2]?.trim() || null;
          parsed.full_name = `${parsed.first_name} ${
            parsed.middle_name || ''
          } ${parsed.last_name}`.trim();
        }
      }
    }

    // Extract address (usually multi-line after "Address:")
    const addressIndex = lines.findIndex(l =>
      l.toLowerCase().includes('address')
    );
    if (addressIndex !== -1) {
      parsed.address = lines
        .slice(addressIndex + 1, addressIndex + 4)
        .join(', ');
    }

    return parsed;
  }
  /**
   * Convert various date formats to YYYY-MM-DD
   */
  standardizeDate(dateStr) {
    if (!dateStr) return null;

    // If already YYYY-MM-DD
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }

    // Convert MM/DD/YYYY to YYYY-MM-DD
    if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [month, day, year] = dateStr.split('/');
      return `${year}-${month}-${day}`;
    }

    return null;
  }
}
