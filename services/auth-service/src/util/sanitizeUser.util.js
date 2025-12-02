// utils/sanitizeUser.js or in your service file

export const sanitizeUser = (user, roles = []) => {
  // Handle Sequelize instance
  const userData = user.dataValues || user;

  const sanitized = {
    user_id: userData.user_id,
    user_uuid: userData.user_uuid,
    email: userData.email,
    phone: userData.phone,
    registration_status: userData.registration_status,
    account_status: userData.account_status,
    email_verified: userData.email_verified,
    created_at: userData.created_at,
    updated_at: userData.updated_at,
    verified_at: userData.verified_at,
    last_activity_at: userData.last_activity_at,
  };

  // Add roles if provided
  if (roles && roles.length > 0) {
    return {
      ...sanitized,
      roles: roles.map(r => ({
        role_id: r.role_id,
        role_name: r.role_name?.toLowerCase(),
        role_code: r.role_code?.toLowerCase(),
      })),
      role: roles[0]?.role_name?.toLowerCase(),
    };
  }

  return sanitized;
};
