export const activeRecord = (extra = {}, model = null) => {
  const record = { ...extra };

  if (model?.rawAttributes?.account_status) record.account_status = 'active';
  if (model?.rawAttributes?.is_active) record.is_active = true;
  if (model?.rawAttributes?.is_deleted) record.is_deleted = false;

  return record;
};

export const archiveRecord = (extra = {}) => ({
  is_active: false,
  is_deleted: true,
  ...extra,
});
