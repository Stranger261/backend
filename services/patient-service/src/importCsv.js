import fs from 'fs';
import xlsx from 'xlsx';
import sequelize from '../../shared/config/db.config.js';
import { Region, Province, City, Barangay } from './models/index.js';

async function importExcelToDB(filePath) {
  const transaction = await sequelize.transaction();

  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = 'PSGC';
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const regions = [];
    const provinces = [];
    const cities = [];
    const barangays = [];

    // Tracking structures
    const provinceCodesSet = new Set();
    const cityCodesSet = new Set();
    let regionOrder = 1;
    let provinceOrder = 1;
    let cityOrder = 1;

    // For barangays, use per-city ordering instead of global
    const barangayOrderByCity = {};

    // Special province codes for regions without traditional provinces
    const SPECIAL_PROVINCES = {};

    // Helper: Extract region code from PSGC
    function extractRegionCode(psgc) {
      const psgcStr = String(psgc).padStart(10, '0');
      return psgcStr.substring(0, 2) + '00000000';
    }

    // Helper: Extract province code from PSGC (for regular cities)
    function extractProvinceCode(psgc) {
      const psgcStr = String(psgc).padStart(10, '0');
      return psgcStr.substring(0, 4) + '000000';
    }

    // Helper: Determine region type
    function getRegionType(regionName) {
      const name = regionName.toLowerCase();
      if (name.includes('ncr') || name.includes('national capital region'))
        return 'ncr';
      if (
        name.includes('car') ||
        name.includes('cordillera administrative region')
      )
        return 'car';
      if (name.includes('barmm') || name.includes('bangsamoro')) return 'barmm';
      return 'region';
    }

    // FIRST PASS: Collect all regions and provinces
    data.forEach((row, index) => {
      if (index === 0) return; // Skip header

      const PSGC = row[0];
      const Name = row[1];
      const Geographic_Level = row[3];

      if (!PSGC || !Name || !Geographic_Level) return;

      if (Geographic_Level === 'Reg') {
        const regionCode = String(PSGC).padStart(10, '0');
        regions.push({
          region_code: regionCode,
          region_name: String(Name),
          region_type: getRegionType(Name),
          display_order: regionOrder++,
        });

        // Create special province for regions that need it
        const specialProvCode = regionCode;
        SPECIAL_PROVINCES[regionCode] = specialProvCode;
        provinces.push({
          province_code: specialProvCode,
          province_name: String(Name),
          region_code: regionCode,
          province_type: 'district',
          display_order: provinceOrder++,
        });
        provinceCodesSet.add(specialProvCode);
      } else if (Geographic_Level === 'Prov' || Geographic_Level === 'Dist') {
        const provinceCode = String(PSGC).padStart(10, '0');
        const regionCode = extractRegionCode(PSGC);

        provinces.push({
          province_code: provinceCode,
          province_name: String(Name),
          region_code: regionCode,
          province_type: Geographic_Level === 'Dist' ? 'district' : 'province',
          display_order: provinceOrder++,
        });
        provinceCodesSet.add(provinceCode);
      }
    });

    // SECOND PASS: Collect cities and barangays
    data.forEach((row, index) => {
      if (index === 0) return; // Skip header

      const PSGC = row[0];
      const Name = row[1];
      const Correspondence_Code = row[2];
      const Geographic_Level = row[3];

      if (!PSGC || !Name || !Geographic_Level) return;

      if (Geographic_Level === 'City' || Geographic_Level === 'Mun') {
        const cityCode = String(PSGC).padStart(10, '0');
        const regionCode = extractRegionCode(PSGC);

        // Try multiple methods to find the province code
        let provinceCode = null;

        // Method 1: Extract from city PSGC (works for regular cities)
        const extractedProvCode = extractProvinceCode(PSGC);
        if (provinceCodesSet.has(extractedProvCode)) {
          provinceCode = extractedProvCode;
        }

        // Method 2: Check if it's a special city (HUC, ICC) - use region as province
        if (!provinceCode && SPECIAL_PROVINCES[regionCode]) {
          provinceCode = SPECIAL_PROVINCES[regionCode];
        }

        // Method 3: For any remaining unmatched cities, use region as province
        if (!provinceCode) {
          provinceCode = SPECIAL_PROVINCES[regionCode] || regionCode;
        }

        cities.push({
          city_code: cityCode,
          city_name: String(Name),
          province_code: provinceCode,
          city_type: Geographic_Level === 'City' ? 'city' : 'municipality',
          display_order: cityOrder++,
        });
        cityCodesSet.add(cityCode);
      } else if (Geographic_Level === 'SubMun') {
        // Sub-Municipality - treat as municipality
        const cityCode = String(PSGC).padStart(10, '0');
        const regionCode = extractRegionCode(PSGC);

        let provinceCode = null;
        const extractedProvCode = extractProvinceCode(PSGC);
        if (provinceCodesSet.has(extractedProvCode)) {
          provinceCode = extractedProvCode;
        }

        if (!provinceCode && SPECIAL_PROVINCES[regionCode]) {
          provinceCode = SPECIAL_PROVINCES[regionCode];
        }

        if (!provinceCode) {
          provinceCode = SPECIAL_PROVINCES[regionCode] || regionCode;
        }

        cities.push({
          city_code: cityCode,
          city_name: String(Name),
          province_code: provinceCode,
          city_type: 'municipality',
          display_order: cityOrder++,
        });
        cityCodesSet.add(cityCode);
      } else if (Geographic_Level === 'Bgy') {
        const barangayCode = String(PSGC).padStart(10, '0');
        let cityCode = null;

        // Extract city code from barangay PSGC (remove last 3 digits, add 000)
        const psgcStr = String(PSGC).padStart(10, '0');
        cityCode = psgcStr.substring(0, 7) + '000';

        // Initialize counter for this city if not exists
        if (!barangayOrderByCity[cityCode]) {
          barangayOrderByCity[cityCode] = 1;
        }

        barangays.push({
          barangay_code: barangayCode,
          barangay_name: String(Name),
          city_code: cityCode,
          display_order: barangayOrderByCity[cityCode]++,
        });
      }
    });

    console.log('\n=== DATA SUMMARY ===');
    console.log('Regions:', regions.length);
    console.log('Provinces:', provinces.length);
    console.log('Cities/Municipalities:', cities.length);
    console.log('Barangays:', barangays.length);

    // Check max display_order per city for barangays
    const maxBarangayPerCity = Math.max(...Object.values(barangayOrderByCity));
    console.log('Max barangays per city:', maxBarangayPerCity);

    // Validation
    const validCities = cities.filter(c =>
      provinceCodesSet.has(c.province_code)
    );
    const invalidCities = cities.filter(
      c => !provinceCodesSet.has(c.province_code)
    );

    const validBarangays = barangays.filter(b => cityCodesSet.has(b.city_code));
    const invalidBarangays = barangays.filter(
      b => !cityCodesSet.has(b.city_code)
    );

    if (invalidCities.length > 0) {
      console.log(
        `\n⚠️  Cities with missing provinces: ${invalidCities.length}`
      );
      console.log(
        'Sample:',
        invalidCities
          .slice(0, 3)
          .map(c => `${c.city_name} -> ${c.province_code}`)
          .join(', ')
      );
    }

    if (invalidBarangays.length > 0) {
      console.log(
        `\n⚠️  Barangays with missing cities: ${invalidBarangays.length}`
      );
      console.log('Sample missing city codes:');
      const uniqueMissingCities = [
        ...new Set(invalidBarangays.map(b => b.city_code)),
      ].slice(0, 10);
      uniqueMissingCities.forEach(cityCode => {
        const barangay = invalidBarangays.find(b => b.city_code === cityCode);
        console.log(`  City ${cityCode} (Barangay: ${barangay.barangay_name})`);
      });

      // Check if these are SubMun
      console.log('\nChecking Excel for these city codes...');
      data.slice(0, 100).forEach((row, idx) => {
        if (idx === 0) return;
        const psgc = String(row[0]).padStart(10, '0');
        const geoLevel = row[3];
        if (
          uniqueMissingCities.includes(psgc) ||
          uniqueMissingCities.some(c => psgc.startsWith(c.substring(0, 7)))
        ) {
          console.log(`  Row ${idx}: ${psgc} | ${row[1]} | ${geoLevel}`);
        }
      });
    }

    // Show samples
    console.log('\n=== SAMPLE DATA ===');
    console.log('\nRegions:');
    regions
      .slice(0, 3)
      .forEach(r =>
        console.log(`  ${r.region_code}: ${r.region_name} (${r.region_type})`)
      );

    console.log('\nProvinces:');
    provinces
      .slice(1, 6)
      .forEach(p =>
        console.log(
          `  ${p.province_code}: ${p.province_name} -> Region ${p.region_code}`
        )
      );

    console.log('\nCities (NCR):');
    validCities
      .filter(c => c.city_code.startsWith('13'))
      .slice(0, 3)
      .forEach(c =>
        console.log(
          `  ${c.city_code}: ${c.city_name} -> Province ${c.province_code}`
        )
      );

    console.log('\nCities (Regular):');
    validCities
      .filter(c => !c.city_code.startsWith('13'))
      .slice(0, 3)
      .forEach(c =>
        console.log(
          `  ${c.city_code}: ${c.city_name} -> Province ${c.province_code}`
        )
      );

    console.log('\nBarangays:');
    validBarangays
      .slice(0, 3)
      .forEach(b =>
        console.log(
          `  ${b.barangay_code}: ${b.barangay_name} -> City ${b.city_code}`
        )
      );

    // INSERT DATA
    console.log('\n=== INSERTING DATA ===');

    if (regions.length > 0) {
      await Region.bulkCreate(regions, { transaction, validate: true });
      console.log(`✓ ${regions.length} regions inserted`);
    }

    if (provinces.length > 0) {
      await Province.bulkCreate(provinces, { transaction, validate: true });
      console.log(`✓ ${provinces.length} provinces inserted`);
    }

    if (validCities.length > 0) {
      await City.bulkCreate(validCities, { transaction, validate: true });
      console.log(`✓ ${validCities.length} cities inserted`);
    }

    if (validBarangays.length > 0) {
      // Insert in batches to avoid memory issues
      const batchSize = 5000;
      for (let i = 0; i < validBarangays.length; i += batchSize) {
        const batch = validBarangays.slice(i, i + batchSize);
        await Barangay.bulkCreate(batch, {
          transaction,
          validate: true,
          logging: false,
        });
        console.log(
          `✓ Barangays ${i + 1}-${Math.min(
            i + batchSize,
            validBarangays.length
          )} inserted`
        );
      }
    }

    await transaction.commit();
    console.log('\n✅ SUCCESS! All data imported successfully!');
    console.log(`   Regions: ${regions.length}`);
    console.log(`   Provinces: ${provinces.length}`);
    console.log(`   Cities: ${validCities.length}`);
    console.log(`   Barangays: ${validBarangays.length}`);
  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Transaction rolled back');
    console.error('Error:', error.message);
    if (error.errors && error.errors.length > 0) {
      console.error('Details:', error.errors[0].message);
    }
    throw error;
  }
}

// Execute
(async () => {
  try {
    await importExcelToDB(
      'C:/Users/Geicel/Downloads/PSGC-July-2025-Publication-Datafile.xlsx'
    );
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  }
})();
