import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export const patientApi = axios.create({
  baseURL: process.env.DEVELOPMENT_BASE_URL,
  withCredentials: true,
  headers: {
    'x-internal-api-key': process.env.INTERNAL_API_KEY,
  },
  timeout: 60000,
});

export const appointmentApi = axios.create({
  baseURL: process.env.DEVELOPMENT_BASE_URL,
  withCredentials: true,
  headers: {
    'x-internal-api-key': process.env.DEVELOPMENT_BASE_URL,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export const ibmsApi = axios.create({
  baseURL: process.env.DEVELOPMENT_BASE_URL,
  withCredentials: true,
  headers: {
    'x-internal-api-key': process.env.DEVELOPMENT_BASE_URL,
  },
  timeout: 30000,
});

export const ertsApi = axios.create({
  baseURL: process.env.DEVELOPMENT_BASE_URL,
  withCredentials: true,
  headers: {
    'x-internal-api-key': process.env.DEVELOPMENT_BASE_URL,
  },
  timeout: 30000,
});

export const tocsApi = axios.create({
  baseURL: process.env.DEVELOPMENT_BASE_URL,
  withCredentials: true,
  headers: {
    'x-internal-api-key': process.env.DEVELOPMENT_BASE_URL,
  },
  timeout: 30000,
});
