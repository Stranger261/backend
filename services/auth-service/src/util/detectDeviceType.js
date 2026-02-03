export const detectDeviceType = userAgent => {
  if (/mobile/i.test(userAgent)) {
    if (/android/i.test(userAgent)) return 'mobile_android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'mobile_ios';
    return 'mobile_ios';
  }
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  return 'web';
};
