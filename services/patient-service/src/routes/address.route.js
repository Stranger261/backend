import express from 'express';
import {
  getRegions,
  getProvinces,
  getCities,
  getBarangays,
  getFullAddress,
} from '../controllers/address.controller.js';

const router = express.Router();

// Get all active regions
router.get('/regions', getRegions);

// Get provinces by region code
router.get('/provinces/:region_code', getProvinces);

// Get cities by province code
router.get('/cities/:province_code', getCities);

// Get barangays by city code
router.get('/barangays/:city_code', getBarangays);

// Get full address by barangay code
router.get('/full-address/:barangay_code', getFullAddress);

export default router;
