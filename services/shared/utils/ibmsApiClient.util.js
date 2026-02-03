import axios from 'axios';
import AppError from '../utils/AppError.util.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:56741/api/v1';

class IBMSApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      headers: {
        'x-internal-api-key': process.env.INTERNAL_API_KEY,
      },
    });
  }

  // Set authorization token
  setAuthToken(token) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Assign bed to admission
  async assignBed({ admissionId, bedId, assignedBy, authToken }) {
    try {
      this.setAuthToken(authToken);
      console.log(process.env.BASE_URL);

      const response = await this.client.post('/bedAssignment/assign', {
        admissionId,
        bedId,
        assignedBy,
      });

      console.log(response);

      return response.data;
    } catch (error) {
      console.error(
        'IBMS API - Assign bed failed:',
        error.response?.data || error.message,
      );

      if (error.response?.status === 400) {
        throw new AppError(
          error.response.data.message || 'Bed is not available for assignment.',
          400,
        );
      }

      throw new AppError(
        'Failed to assign bed. IBMS service unavailable.',
        503,
      );
    }
  }

  // Check bed availability
  async checkBedAvailability(bedId, authToken) {
    try {
      this.setAuthToken(authToken);

      const response = await this.client.get(`/bed/${bedId}`);

      return response.data.data.bed_status === 'available';
    } catch (error) {
      console.error('IBMS API - Check bed availability failed:', error.message);
      return false;
    }
  }

  // Release bed
  async releaseBed({ admissionId, reason, transaction, authToken }) {
    try {
      this.setAuthToken(authToken);

      const response = await this.client.post('/bedAssignments/release', {
        admissionId,
        reason,
      });

      return response.data;
    } catch (error) {
      console.error('IBMS API - Release bed failed:', error.message);
      throw new AppError('Failed to release bed.', 500);
    }
  }
}

export default new IBMSApiClient();
