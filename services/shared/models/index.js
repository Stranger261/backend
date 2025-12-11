import sequelize from '../config/db.config.js';

// Import all models first
import User from './auth/User.model.js';
import UserSession from './auth/UserSession.model.js';
import LoginAttempt from './auth/LoginAttempt.model.js';
import PasswordResetToken from './auth/PasswordResetToken.model.js';
import EmailVerificationToken from './auth/EmailVerificationToken.model.js';
import TwoFactorAuth from './auth/TwoFactorAuth.model.js';
import AccountLockout from './auth/AccountLockout.model.js';
import Role from './auth/Role.model.js';
import Permission from './auth/Permission.model.js';
import UserRole from './auth/UserRole.model.js';
import RolePermission from './auth/RolePermission.model.js';
import PrivacyPreference from './auth/PrivacyPreference.model.js';

import Person from './patient/Person.model.js';
import PersonContact from './patient/PersonContact.model.js';
import PersonAddress from './patient/PersonAddress.model.js';
import Patient from './patient/Patient.model.js';
import MedicalRecord from './patient/MedicalRecord.model.js';
import Allergy from './patient/Allergy.model.js';
import PatientConsent from './patient/PatientConsent.model.js';
import DoctorPatientAssignment from './patient/DoctorPatientAssignment.model.js';
import PHIAccessLog from './patient/PHIAccessLog.model.js';
import AuditLog from './patient/AuditLog.model.js';
import Region from './patient/Region.model.js';
import Province from './patient/Province.model.js';
import City from './patient/City.model.js';
import Barangay from './patient/Barangay.model.js';
import IdType from './patient/IdType.model.js';
import PersonIdentification from './patient/PersonIdentification.model.js';

import Appointment from './appointment/Appointment.model.js';
import AppointmentCheckIn from './appointment/AppointmentCheckIn.model.js';
import DoctorSchedule from './appointment/DoctorSchedule.model.js';
import DoctorLeave from './appointment/DoctorLeave.model.js';
import TelehealthSession from './appointment/TelehealthSession.model.js';
import TelehealthNote from './appointment/TelehealthNote.model.js';
import AppointmentPricing from './appointment/AppointmentPricing.model.js';
import AppointmentHistory from './appointment/AppointmentHistory.model.js';
import AppointmentPayment from './appointment/AppointmentPayment.model.js';

import ERVisit from './erts/ERVisit.model.js';
import TriageAssessment from './erts/TriageAssessment.model.js';
import ERTreatment from './erts/ERTreatment.model.js';

import Department from './ibms/Department.model.js';
import Staff from './ibms/Staff.model.js';
import Room from './ibms/Room.model.js';
import Bed from './ibms/Bed.model.js';
import Admission from './ibms/Admission.model.js';
import BedAssignment from './ibms/BedAssignment.model.js';
import IdSequence from './ibms/IdSequence.model.js';

// Export all models
export {
  // Auth Models
  User,
  UserSession,
  LoginAttempt,
  PasswordResetToken,
  EmailVerificationToken,
  TwoFactorAuth,
  AccountLockout,
  Role,
  Permission,
  UserRole,
  RolePermission,
  PrivacyPreference,

  // Patient Models
  Person,
  PersonContact,
  PersonAddress,
  Patient,
  MedicalRecord,
  Allergy,
  PatientConsent,
  DoctorPatientAssignment,
  PHIAccessLog,
  AuditLog,
  Region,
  Province,
  City,
  Barangay,
  IdType,
  PersonIdentification,

  // Appointment Models
  Appointment,
  AppointmentHistory,
  AppointmentPricing,
  AppointmentPayment,
  AppointmentCheckIn,
  DoctorSchedule,
  DoctorLeave,
  TelehealthSession,
  TelehealthNote,

  // ERTS Models
  ERVisit,
  TriageAssessment,
  ERTreatment,

  // IBMS Models
  Department,
  Staff,
  Room,
  Bed,
  Admission,
  BedAssignment,
  IdSequence,
};

// ============================================================================
// MODEL ASSOCIATIONS
// ============================================================================

export const setupAssociations = () => {
  console.log('Setting up model associations...');

  // ==========================================================================
  // AUTH SERVICE ASSOCIATIONS
  // ==========================================================================

  // User ↔ UserSession (One-to-Many)
  User.hasMany(UserSession, { foreignKey: 'user_id', as: 'sessions' });
  UserSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // User ↔ LoginAttempt (One-to-Many)
  User.hasMany(LoginAttempt, { foreignKey: 'user_id', as: 'loginAttempts' });
  LoginAttempt.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // User ↔ PasswordResetToken (One-to-Many)
  User.hasMany(PasswordResetToken, {
    foreignKey: 'user_id',
    as: 'passwordResetTokens',
  });
  PasswordResetToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // User ↔ EmailVerificationToken (One-to-Many)
  User.hasMany(EmailVerificationToken, {
    foreignKey: 'user_id',
    as: 'emailVerificationTokens',
  });
  EmailVerificationToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // User ↔ TwoFactorAuth (One-to-One)
  User.hasOne(TwoFactorAuth, { foreignKey: 'user_id', as: 'twoFactorAuth' });
  TwoFactorAuth.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // User ↔ AccountLockout (One-to-Many)
  User.hasMany(AccountLockout, {
    foreignKey: 'user_id',
    as: 'accountLockouts',
  });
  AccountLockout.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // User ↔ PrivacyPreference (One-to-One)
  User.hasOne(PrivacyPreference, {
    foreignKey: 'user_id',
    as: 'privacyPreferences',
  });
  PrivacyPreference.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // User ↔ Role (Many-to-Many through UserRole)
  User.belongsToMany(Role, {
    through: UserRole,
    foreignKey: 'user_id',
    otherKey: 'role_id',
    as: 'roles',
  });
  Role.belongsToMany(User, {
    through: UserRole,
    foreignKey: 'role_id',
    otherKey: 'user_id',
    as: 'users',
  });

  // UserRole ↔ User (Many-to-One)
  UserRole.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  User.hasMany(UserRole, { foreignKey: 'user_id', as: 'userRoles' });

  // UserRole ↔ Role (Many-to-One) - THIS IS THE KEY ASSOCIATION YOU'RE MISSING
  UserRole.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
  Role.hasMany(UserRole, { foreignKey: 'role_id', as: 'userRoles' });

  // Role ↔ Permission (Many-to-Many through RolePermission)
  Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: 'role_id',
    otherKey: 'permission_id',
    as: 'permissions',
  });
  Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: 'permission_id',
    otherKey: 'role_id',
    as: 'roles',
  });

  // UserRole ↔ Staff (Optional)
  UserRole.belongsTo(Staff, { foreignKey: 'staff_id', as: 'staff' });
  Staff.hasMany(UserRole, { foreignKey: 'staff_id', as: 'userRoles' });

  // ==========================================================================
  // PATIENT SERVICE ASSOCIATIONS
  // ==========================================================================

  // User ↔ Person (One-to-One)
  User.hasOne(Person, { foreignKey: 'user_id', as: 'person' });
  Person.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // Person ↔ PersonContact (One-to-Many)
  Person.hasMany(PersonContact, { foreignKey: 'person_id', as: 'contacts' });
  PersonContact.belongsTo(Person, { foreignKey: 'person_id', as: 'person' });

  // Person ↔ PersonAddress (One-to-Many)
  Person.hasMany(PersonAddress, { foreignKey: 'person_id', as: 'addresses' });
  PersonAddress.belongsTo(Person, { foreignKey: 'person_id', as: 'person' });

  // Person ↔ PersonIdentification (One-to-Many)
  Person.hasMany(PersonIdentification, {
    foreignKey: 'person_id',
    as: 'identifications',
  });
  PersonIdentification.belongsTo(Person, {
    foreignKey: 'person_id',
    as: 'person',
  });

  // PersonIdentification ↔ IdType (Many-to-One)
  PersonIdentification.belongsTo(IdType, {
    foreignKey: 'id_type_id',
    as: 'idType',
  });
  IdType.hasMany(PersonIdentification, {
    foreignKey: 'id_type_id',
    as: 'personIdentifications',
  });

  // Person ↔ Patient (One-to-One)
  Person.hasOne(Patient, { foreignKey: 'person_id', as: 'patient' });
  Patient.belongsTo(Person, { foreignKey: 'person_id', as: 'person' });

  // Patient ↔ MedicalRecord (One-to-Many)
  Patient.hasMany(MedicalRecord, {
    foreignKey: 'patient_id',
    as: 'medicalRecords',
  });
  MedicalRecord.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

  // Patient ↔ Allergy (One-to-Many)
  Patient.hasMany(Allergy, { foreignKey: 'patient_id', as: 'allergies' });
  Allergy.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

  // Patient ↔ PatientConsent (One-to-Many)
  Patient.hasMany(PatientConsent, { foreignKey: 'patient_id', as: 'consents' });
  PatientConsent.belongsTo(Patient, {
    foreignKey: 'patient_id',
    as: 'patient',
  });

  // Patient ↔ DoctorPatientAssignment (One-to-Many)
  Patient.hasMany(DoctorPatientAssignment, {
    foreignKey: 'patient_id',
    as: 'doctorAssignments',
  });
  DoctorPatientAssignment.belongsTo(Patient, {
    foreignKey: 'patient_id',
    as: 'patient',
  });

  // Staff ↔ DoctorPatientAssignment (One-to-Many)
  Staff.hasMany(DoctorPatientAssignment, {
    foreignKey: 'doctor_id',
    as: 'patientAssignments',
  });
  DoctorPatientAssignment.belongsTo(Staff, {
    foreignKey: 'doctor_id',
    as: 'doctor',
  });

  // Patient ↔ PHIAccessLog (One-to-Many)
  Patient.hasMany(PHIAccessLog, { foreignKey: 'patient_id', as: 'accessLogs' });
  PHIAccessLog.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

  // User ↔ PHIAccessLog (One-to-Many)
  User.hasMany(PHIAccessLog, { foreignKey: 'user_id', as: 'phiAccessLogs' });
  PHIAccessLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // Staff ↔ PHIAccessLog (One-to-Many)
  Staff.hasMany(PHIAccessLog, { foreignKey: 'staff_id', as: 'phiAccessLogs' });
  PHIAccessLog.belongsTo(Staff, { foreignKey: 'staff_id', as: 'staff' });

  // User ↔ AuditLog (One-to-Many)
  User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
  AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // Staff ↔ AuditLog (One-to-Many)
  Staff.hasMany(AuditLog, { foreignKey: 'staff_id', as: 'auditLogs' });
  AuditLog.belongsTo(Staff, { foreignKey: 'staff_id', as: 'staff' });

  // ==========================================================================
  // PHILIPPINE ADDRESS HIERARCHY ASSOCIATIONS
  // ==========================================================================

  // Region ↔ Province (One-to-Many)
  Region.hasMany(Province, { foreignKey: 'region_code', as: 'provinces' });
  Province.belongsTo(Region, { foreignKey: 'region_code', as: 'region' });

  // Province ↔ City (One-to-Many)
  Province.hasMany(City, { foreignKey: 'province_code', as: 'cities' });
  City.belongsTo(Province, { foreignKey: 'province_code', as: 'province' });

  // City ↔ Barangay (One-to-Many)
  City.hasMany(Barangay, { foreignKey: 'city_code', as: 'barangays' });
  Barangay.belongsTo(City, { foreignKey: 'city_code', as: 'city' });

  // PersonAddress ↔ Barangay (Many-to-One)
  PersonAddress.belongsTo(Barangay, {
    foreignKey: 'barangay_code',
    as: 'barangay',
  });
  Barangay.hasMany(PersonAddress, {
    foreignKey: 'barangay_code',
    as: 'addresses',
  });

  // PersonAddress ↔ City (Many-to-One)
  PersonAddress.belongsTo(City, { foreignKey: 'city_code', as: 'city' });
  City.hasMany(PersonAddress, { foreignKey: 'city_code', as: 'addresses' });

  // PersonAddress ↔ Province (Many-to-One)
  PersonAddress.belongsTo(Province, {
    foreignKey: 'province_code',
    as: 'province',
  });
  Province.hasMany(PersonAddress, {
    foreignKey: 'province_code',
    as: 'addresses',
  });

  // PersonAddress ↔ Region (Many-to-One)
  PersonAddress.belongsTo(Region, { foreignKey: 'region_code', as: 'region' });
  Region.hasMany(PersonAddress, { foreignKey: 'region_code', as: 'addresses' });

  // ==========================================================================
  // APPOINTMENT SERVICE ASSOCIATIONS
  // ==========================================================================

  // Patient ↔ Appointment (One-to-Many)
  Patient.hasMany(Appointment, {
    foreignKey: 'patient_id',
    as: 'appointments',
  });
  Appointment.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

  // Staff ↔ Appointment (One-to-Many as Doctor)
  Staff.hasMany(Appointment, {
    foreignKey: 'doctor_id', // This is the column in Appointment table
    sourceKey: 'staff_id', // This is the column in Staff table
    as: 'appointments',
  });

  // Appointment belongs to Staff (doctor)
  Appointment.belongsTo(Staff, {
    foreignKey: 'doctor_id', // This is the column in Appointment table
    targetKey: 'staff_id', // This is the column in Staff table
    as: 'doctor',
  });

  // Appointment ↔ Department
  Appointment.belongsTo(Department, {
    foreignKey: 'department_id',
    as: 'department',
  });
  Department.hasMany(Appointment, {
    foreignKey: 'department_id',
    as: 'appointments',
  });

  // Appointment ↔ AppointmentCheckIn (One-to-One)
  Appointment.hasOne(AppointmentCheckIn, {
    foreignKey: 'appointment_id',
    as: 'checkIn',
  });
  AppointmentCheckIn.belongsTo(Appointment, {
    foreignKey: 'appointment_id',
    as: 'appointment',
  });

  // Staff ↔ AppointmentCheckIn (One-to-Many)
  Staff.hasMany(AppointmentCheckIn, {
    foreignKey: 'checked_in_by',
    as: 'checkIns',
  });
  AppointmentCheckIn.belongsTo(Staff, {
    foreignKey: 'checked_in_by',
    as: 'checkedInBy',
  });

  // Staff ↔ DoctorSchedule (One-to-Many)
  Staff.hasMany(DoctorSchedule, { foreignKey: 'staff_id', as: 'schedules' });
  DoctorSchedule.belongsTo(Staff, { foreignKey: 'staff_id', as: 'staff' });

  // Staff ↔ DoctorLeave (One-to-Many)
  Staff.hasMany(DoctorLeave, { foreignKey: 'staff_id', as: 'leaves' });
  DoctorLeave.belongsTo(Staff, { foreignKey: 'staff_id', as: 'staff' });

  // DoctorLeave -> User (approved_by)
  DoctorLeave.belongsTo(User, {
    foreignKey: 'approved_by',
    as: 'approvedBy',
  });

  // Staff ↔ DoctorLeave (Approver)
  Staff.hasMany(DoctorLeave, {
    foreignKey: 'approved_by',
    as: 'approvedLeaves',
  });
  DoctorLeave.belongsTo(Staff, { foreignKey: 'approved_by', as: 'approver' });

  // Appointment ↔ TelehealthSession (One-to-One)
  Appointment.hasOne(TelehealthSession, {
    foreignKey: 'appointment_id',
    as: 'telehealthSession',
  });
  TelehealthSession.belongsTo(Appointment, {
    foreignKey: 'appointment_id',
    as: 'appointment',
  });

  // TelehealthSession ↔ TelehealthNote (One-to-One)
  TelehealthSession.hasOne(TelehealthNote, {
    foreignKey: 'session_id',
    as: 'notes',
  });
  TelehealthNote.belongsTo(TelehealthSession, {
    foreignKey: 'session_id',
    as: 'session',
  });

  // ==========================================================================
  // ERTS SERVICE ASSOCIATIONS
  // ==========================================================================

  // Patient ↔ ERVisit (One-to-Many)
  Patient.hasMany(ERVisit, { foreignKey: 'patient_id', as: 'erVisits' });
  ERVisit.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

  // Staff ↔ ERVisit (Triage Nurse)
  Staff.hasMany(ERVisit, {
    foreignKey: 'triage_nurse_id',
    as: 'triagedVisits',
  });
  ERVisit.belongsTo(Staff, {
    foreignKey: 'triage_nurse_id',
    as: 'triageNurse',
  });

  // Staff ↔ ERVisit (Assigned Doctor)
  Staff.hasMany(ERVisit, {
    foreignKey: 'assigned_doctor_id',
    as: 'assignedERVisits',
  });
  ERVisit.belongsTo(Staff, {
    foreignKey: 'assigned_doctor_id',
    as: 'assignedDoctor',
  });

  // ERVisit ↔ TriageAssessment (One-to-One)
  ERVisit.hasOne(TriageAssessment, {
    foreignKey: 'er_visit_id',
    as: 'triageAssessment',
  });
  TriageAssessment.belongsTo(ERVisit, {
    foreignKey: 'er_visit_id',
    as: 'erVisit',
  });

  // Staff ↔ TriageAssessment (One-to-Many)
  Staff.hasMany(TriageAssessment, {
    foreignKey: 'assessed_by',
    as: 'triageAssessments',
  });
  TriageAssessment.belongsTo(Staff, {
    foreignKey: 'assessed_by',
    as: 'assessedBy',
  });

  // ERVisit ↔ ERTreatment (One-to-Many)
  ERVisit.hasMany(ERTreatment, { foreignKey: 'er_visit_id', as: 'treatments' });
  ERTreatment.belongsTo(ERVisit, { foreignKey: 'er_visit_id', as: 'erVisit' });

  // Staff ↔ ERTreatment (One-to-Many)
  Staff.hasMany(ERTreatment, {
    foreignKey: 'performed_by',
    as: 'erTreatments',
  });
  ERTreatment.belongsTo(Staff, {
    foreignKey: 'performed_by',
    as: 'performedBy',
  });

  // ==========================================================================
  // IBMS SERVICE ASSOCIATIONS
  // ==========================================================================

  // Department ↔ Staff (One-to-Many)
  Department.hasMany(Staff, { foreignKey: 'department_id', as: 'staff' });
  Staff.belongsTo(Department, {
    foreignKey: 'department_id',
    as: 'department',
  });

  // Staff ↔ Person
  Staff.belongsTo(Person, {
    foreignKey: 'person_id',
    as: 'person',
  });
  Person.hasOne(Staff, {
    foreignKey: 'person_id',
    as: 'staff',
  });

  // Department ↔ Room (One-to-Many)
  Department.hasMany(Room, { foreignKey: 'department_id', as: 'rooms' });
  Room.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

  // Room ↔ Bed (One-to-Many)
  Room.hasMany(Bed, { foreignKey: 'room_id', as: 'beds' });
  Bed.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });

  // Patient ↔ Admission (One-to-Many)
  Patient.hasMany(Admission, { foreignKey: 'patient_id', as: 'admissions' });
  Admission.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

  // Staff ↔ Admission (Attending Doctor)
  Staff.hasMany(Admission, {
    foreignKey: 'attending_doctor_id',
    as: 'admissions',
  });
  Admission.belongsTo(Staff, {
    foreignKey: 'attending_doctor_id',
    as: 'attendingDoctor',
  });

  // Admission ↔ BedAssignment (One-to-Many)
  Admission.hasMany(BedAssignment, {
    foreignKey: 'admission_id',
    as: 'bedAssignments',
  });
  BedAssignment.belongsTo(Admission, {
    foreignKey: 'admission_id',
    as: 'admission',
  });

  // Bed ↔ BedAssignment (One-to-Many)
  Bed.hasMany(BedAssignment, { foreignKey: 'bed_id', as: 'assignments' });
  BedAssignment.belongsTo(Bed, { foreignKey: 'bed_id', as: 'bed' });

  // Staff ↔ BedAssignment (Assigned By)
  Staff.hasMany(BedAssignment, {
    foreignKey: 'assigned_by',
    as: 'bedAssignments',
  });
  BedAssignment.belongsTo(Staff, {
    foreignKey: 'assigned_by',
    as: 'assignedBy',
  });

  // ==========================================================================
  // MEDICAL RECORD ASSOCIATIONS WITH OTHER SERVICES
  // ==========================================================================

  // MedicalRecord ↔ Staff (Doctor)
  Staff.hasMany(MedicalRecord, {
    foreignKey: 'doctor_id',
    as: 'medicalRecords',
  });
  MedicalRecord.belongsTo(Staff, { foreignKey: 'doctor_id', as: 'doctor' });

  // MedicalRecord ↔ Appointment (Optional)
  MedicalRecord.belongsTo(Appointment, {
    foreignKey: 'visit_id',
    as: 'appointment',
  });
  Appointment.hasMany(MedicalRecord, {
    foreignKey: 'visit_id',
    as: 'medicalRecords',
  });

  // Appointment ↔ AppointmentHistory
  Appointment.hasMany(AppointmentHistory, {
    foreignKey: 'appointment_id',
    as: 'history',
  });
  AppointmentHistory.belongsTo(Appointment, {
    foreignKey: 'appointment_id',
    as: 'appointment',
  });

  // AppointmentPricing ↔ Staff (optional - for doctor-specific pricing)
  AppointmentPricing.belongsTo(Staff, {
    foreignKey: 'staff_id',
    as: 'staff',
  });
  Staff.hasMany(AppointmentPricing, {
    foreignKey: 'staff_id',
    as: 'pricing',
  });

  // AppointmentHistory ↔ User (changed_by)
  AppointmentHistory.belongsTo(User, {
    foreignKey: 'changed_by',
    as: 'changedBy',
  });

  // AppointmentPricing ↔ Department (optional - for department-specific pricing)
  AppointmentPricing.belongsTo(Department, {
    foreignKey: 'department_id',
    as: 'department',
  });
  Department.hasMany(AppointmentPricing, {
    foreignKey: 'department_id',
    as: 'pricing',
  });

  // AppointmentPayment -> User (processed_by)
  AppointmentPayment.belongsTo(User, {
    foreignKey: 'processed_by',
    as: 'processedBy',
  });

  // Appointment ↔ AppointmentPayment
  Appointment.hasMany(AppointmentPayment, {
    foreignKey: 'appointment_id',
    as: 'payments',
  });
  AppointmentPayment.belongsTo(Appointment, {
    foreignKey: 'appointment_id',
    as: 'appointment',
  });

  // MedicalRecord ↔ ERVisit (Optional)
  MedicalRecord.belongsTo(ERVisit, { foreignKey: 'visit_id', as: 'erVisit' });
  ERVisit.hasMany(MedicalRecord, {
    foreignKey: 'visit_id',
    as: 'medicalRecords',
  });

  // MedicalRecord ↔ Admission (Optional)
  MedicalRecord.belongsTo(Admission, {
    foreignKey: 'visit_id',
    as: 'admission',
  });
  Admission.hasMany(MedicalRecord, {
    foreignKey: 'visit_id',
    as: 'medicalRecords',
  });

  console.log('✅ All model associations setup completed!');
};

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

export const initializeDatabase = async (options = {}) => {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Setup associations
    setupAssociations();

    // Sync options
    const syncOptions = {
      alter: process.env.NODE_ENV === 'development',
      force: false,
      ...options,
    };

    // Sync all models with database
    await sequelize.sync(syncOptions);
    console.log('✅ All models synchronized successfully.');

    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Export sequelize instance for use in services
export { sequelize };

// Default export with all models
export default {
  // Auth Models
  User,
  UserSession,
  LoginAttempt,
  PasswordResetToken,
  EmailVerificationToken,
  TwoFactorAuth,
  AccountLockout,
  Role,
  Permission,
  UserRole,
  RolePermission,
  PrivacyPreference,

  // Patient Models
  Person,
  PersonContact,
  PersonAddress,
  Patient,
  MedicalRecord,
  Allergy,
  PatientConsent,
  DoctorPatientAssignment,
  PHIAccessLog,
  AuditLog,
  Region,
  Province,
  City,
  Barangay,
  IdType,
  PersonIdentification,

  // Appointment Models
  Appointment,
  AppointmentCheckIn,
  DoctorSchedule,
  DoctorLeave,
  TelehealthSession,
  TelehealthNote,

  // ERTS Models
  ERVisit,
  TriageAssessment,
  ERTreatment,

  // IBMS Models
  Department,
  Staff,
  Room,
  Bed,
  Admission,
  BedAssignment,
  IdSequence,

  // Database functions
  setupAssociations,
  initializeDatabase,
  sequelize,
};
