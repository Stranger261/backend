import * as addressService from '../services/address.service.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';

export const getRegions = asyncHandler(async (req, res) => {
  const regions = await addressService.getRegions();

  res.status(200).json({
    success: true,
    message: 'Regions fetched successfully',
    data: regions,
  });
});

export const getProvinces = asyncHandler(async (req, res) => {
  const { region_code } = req.params;

  if (!region_code) {
    return res.status(400).json({
      success: false,
      message: 'Region code is required',
    });
  }

  const provinces = await addressService.getProvincesByRegion(region_code);

  res.status(200).json({
    success: true,
    message: 'Provinces fetched successfully',
    data: provinces,
  });
});

export const getCities = asyncHandler(async (req, res) => {
  const { province_code } = req.params;

  if (!province_code) {
    return res.status(400).json({
      success: false,
      message: 'Province code is required',
    });
  }

  const cities = await addressService.getCitiesByProvince(province_code);

  res.status(200).json({
    success: true,
    message: 'Cities fetched successfully',
    data: cities,
  });
});

export const getBarangays = asyncHandler(async (req, res) => {
  const { city_code } = req.params;

  if (!city_code) {
    return res.status(400).json({
      success: false,
      message: 'City code is required',
    });
  }

  const barangays = await addressService.getBarangaysByCity(city_code);

  res.status(200).json({
    success: true,
    message: 'Barangays fetched successfully',
    data: barangays,
  });
});

export const getFullAddress = asyncHandler(async (req, res) => {
  const { barangay_code } = req.params;

  if (!barangay_code) {
    return res.status(400).json({
      success: false,
      message: 'Barangay code is required',
    });
  }

  const address = await addressService.getFullAddress(barangay_code);

  res.status(200).json({
    success: true,
    message: 'Full address fetched successfully',
    data: address,
  });
});
