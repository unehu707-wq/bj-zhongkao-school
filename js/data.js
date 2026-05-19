// 学校数据 = 高德 POI（自动维护）+ data/enrichments.json（手动补充）
//
// AMap 提供：name, address, lng, lat, district, id
// enrichments 提供（按 name 键匹配）：shortName, aliases, admissionScope, isBranch,
//   parentSchool, hasInternationalDept, type 等
//
// 缓存：amap-schools.js 内部 30 天 localStorage；enrichments 单次会话内 memo

import { getSchoolsForDistrict } from './amap-schools.js';

const DISTRICT_IDS = ['haidian', 'xicheng', 'chaoyang', 'dongcheng'];

let enrichmentsCache = null;
async function loadEnrichments() {
  if (enrichmentsCache) return enrichmentsCache;
  try {
    const r = await fetch('data/enrichments.json');
    enrichmentsCache = r.ok ? await r.json() : {};
  } catch {
    enrichmentsCache = {};
  }
  return enrichmentsCache;
}

function applyEnrichment(school, enrichments) {
  const patch = enrichments[school.name];
  return patch ? { ...school, ...patch } : school;
}

const districtCache = new Map();

export async function getSchoolsByDistrict(districtId) {
  if (districtCache.has(districtId)) return districtCache.get(districtId);
  const [schools, enrich] = await Promise.all([
    getSchoolsForDistrict(districtId),
    loadEnrichments(),
  ]);
  const merged = schools.map(s => applyEnrichment(s, enrich));
  districtCache.set(districtId, merged);
  return merged;
}

export async function getAllSchools() {
  // 串行而非 Promise.all，避免 4 区同时拉 = QPS 超限
  // 缓存命中即时返回；真正调高德的间隔由 amap-schools.js 内部 throttle 控制
  const all = [];
  for (const id of DISTRICT_IDS) {
    const list = await getSchoolsByDistrict(id);
    all.push(...list);
  }
  return all;
}
