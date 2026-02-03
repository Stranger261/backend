/**
 * Normalize patient data structure
 */
export const normalizePatientData = patient => {
  const patientData = patient.toJSON();

  // Extract person data
  const person = patientData.person || {};
  const user = person.user || {};
  const contacts = person.contacts || [];
  const addresses = person.addresses || [];

  // Filter appointments: only keep those with admissions
  if (patientData.appointments) {
    patientData.appointments = patientData.appointments.filter(
      apt => apt.resultingAdmission !== null,
    );
  }

  if (patientData.admissions) {
    // Separate walk-in/ER admissions (those without appointment_id)
    patientData.walkInAdmissions = patientData.admissions.filter(
      adm => !adm.appointment_id,
    );
  }

  // Remove the original admissions array since we've split it
  delete patientData.admissions;

  return {
    // Patient identifiers
    patient_id: patientData.patient_id,
    patient_uuid: patientData.patient_uuid,
    mrn: patientData.mrn,
    patient_status: patientData.patient_status,

    // Patient medical info
    blood_type: patientData.blood_type,
    height: patientData.height,
    weight: patientData.weight,
    allergies: patientData.allergies,
    chronic_conditions: patientData.chronic_conditions,
    current_medications: patientData.current_medications,

    // Registration info
    registration_type: patientData.registration_type,
    first_visit_date: patientData.first_visit_date,
    insurance_provider: patientData.insurance_provider,
    insurance_number: patientData.insurance_number,
    insurance_expiry: patientData.insurance_expiry,

    // Person info
    person_id: person.person_id,
    first_name: person.first_name,
    middle_name: person.middle_name,
    last_name: person.last_name,
    suffix: person.suffix,
    date_of_birth: person.date_of_birth,
    gender: person.gender,
    gender_specification: person.gender_specification,
    nationality: person.nationality,
    civil_status: person.civil_status,
    occupation: person.occupation,
    religion: person.religion,

    // Contact info
    phone: user.phone || person.phone,
    email: user.email || person.email,
    // Emergency contacts
    contacts: contacts.map(contact => ({
      contact_id: contact.contact_id,
      contact_type: contact.is_primary
        ? 'Primary Contact'
        : 'Emergency Contact',
      contact_number: contact.contact_number,
      contact_name: contact.contact_name,
      relationship: contact.relationship,
      is_primary: contact.is_primary,
    })),

    // Addresses
    addresses: addresses.map(address => ({
      address_id: address.address_id,
      address_type: address.address_type,
      house_number: address.house_number,
      street_name: address.street_name,
      building_name: address.building_name,
      unit_floor: address.unit_floor,
      subdivision: address.subdivision,
      landmark: address.landmark,
      zip_code: address.zip_code,
      is_primary: address.is_primary,
      is_verified: address.is_verified,
      delivery_instructions: address.delivery_instructions,
      latitude: address.latitude,
      longitude: address.longitude,
      barangay: address.barangay_code || null,
      city: address.city_code || null,
      province: address.province_code || null,
      region: address.region_code || null,
    })),

    // Medical history will be added separately
    medicalHistory: null,
    summary: null,
    walkInAdmissions: patientData.walkInAdmissions,
    appointments: patientData.appointments,
  };
};
