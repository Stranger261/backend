import {
  Barangay,
  Province,
  City,
  Region,
} from '../../../shared/models/index.js';

export const getRegions = async () => {
  try {
    const regions = await Region.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC']],
      attributes: ['region_code', 'region_name', 'region_type'],
    });
    return regions;
  } catch (error) {
    throw new Error(`Failed to fetch regions: ${error.message}`);
  }
};

export const getProvincesByRegion = async regionCode => {
  try {
    const provinces = await Province.findAll({
      where: {
        region_code: regionCode,
        is_active: true,
      },
      order: [['display_order', 'ASC']],
      attributes: ['province_code', 'province_name', 'province_type'],
    });
    return provinces;
  } catch (error) {
    throw new Error(`Failed to fetch provinces: ${error.message}`);
  }
};

export const getCitiesByProvince = async provinceCode => {
  try {
    const cities = await City.findAll({
      where: {
        province_code: provinceCode,
        is_active: true,
      },
      order: [['display_order', 'ASC']],
      attributes: ['city_code', 'city_name', 'city_type'],
    });
    return cities;
  } catch (error) {
    throw new Error(`Failed to fetch cities: ${error.message}`);
  }
};

export const getBarangaysByCity = async cityCode => {
  try {
    const barangays = await Barangay.findAll({
      where: {
        city_code: cityCode,
        is_active: true,
      },
      order: [['display_order', 'ASC']],
      attributes: ['barangay_code', 'barangay_name'],
    });
    return barangays;
  } catch (error) {
    throw new Error(`Failed to fetch barangays: ${error.message}`);
  }
};

export const getFullAddress = async barangayCode => {
  try {
    const barangay = await Barangay.findOne({
      where: { barangay_code: barangayCode, is_active: true },
      include: [
        {
          model: City,
          as: 'city',
          attributes: ['city_name', 'city_type'],
          include: [
            {
              model: Province,
              as: 'province',
              attributes: ['province_name', 'province_type'],
              include: [
                {
                  model: Region,
                  as: 'region',
                  attributes: ['region_name', 'region_type'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!barangay) {
      throw new Error('Barangay not found');
    }

    return {
      barangay: barangay.barangay_name,
      city: barangay.city.city_name,
      province: barangay.city.province.province_name,
      region: barangay.city.province.region.region_name,
      full_address: `${barangay.barangay_name}, ${barangay.city.city_name}, ${barangay.city.province.province_name}, ${barangay.city.province.region.region_name}`,
    };
  } catch (error) {
    throw new Error(`Failed to fetch full address: ${error.message}`);
  }
};

// NEW: Get complete address hierarchy by region code
export const getAddressHierarchyByRegion = async regionCode => {
  try {
    const region = await Region.findOne({
      where: { region_code: regionCode, is_active: true },
      include: [
        {
          model: Province,
          as: 'provinces',
          where: { is_active: true },
          required: false,
          include: [
            {
              model: City,
              as: 'cities',
              where: { is_active: true },
              required: false,
              include: [
                {
                  model: Barangay,
                  as: 'barangays',
                  where: { is_active: true },
                  required: false,
                  attributes: ['barangay_code', 'barangay_name'],
                },
              ],
              attributes: ['city_code', 'city_name', 'city_type'],
            },
          ],
          attributes: ['province_code', 'province_name', 'province_type'],
        },
      ],
      attributes: ['region_code', 'region_name', 'region_type'],
    });

    if (!region) {
      throw new Error('Region not found');
    }

    return region;
  } catch (error) {
    throw new Error(`Failed to fetch address hierarchy: ${error.message}`);
  }
};

// NEW: Get all addresses in one call
export const getCompleteAddressList = async () => {
  try {
    const regions = await Region.findAll({
      where: { is_active: true },
      include: [
        {
          model: Province,
          as: 'provinces',
          where: { is_active: true },
          required: false,
          include: [
            {
              model: City,
              as: 'cities',
              where: { is_active: true },
              required: false,
              include: [
                {
                  model: Barangay,
                  as: 'barangays',
                  where: { is_active: true },
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      order: [
        ['display_order', 'ASC'],
        [{ model: Province, as: 'provinces' }, 'display_order', 'ASC'],
        [
          { model: Province, as: 'provinces' },
          { model: City, as: 'cities' },
          'display_order',
          'ASC',
        ],
        [
          { model: Province, as: 'provinces' },
          { model: City, as: 'cities' },
          { model: Barangay, as: 'barangays' },
          'display_order',
          'ASC',
        ],
      ],
    });

    return regions;
  } catch (error) {
    throw new Error(`Failed to fetch complete address list: ${error.message}`);
  }
};
