import { BEIJING_ADCODE_PREFIX } from './config.js';

// Haversine 公式计算两点直线距离（米）
// 把地球当成球（足够精确，几米级误差对本场景无影响）
export function haversineMeters(lng1, lat1, lng2, lat2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// 北京所有 adcode 都以 11 开头（110000-110116）
export function isBeijingAdcode(adcode) {
  return typeof adcode === 'string' && adcode.startsWith(BEIJING_ADCODE_PREFIX);
}
