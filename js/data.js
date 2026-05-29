// 学校数据 = 高德 POI（自动维护）+ data/enrichments.json（手动补充）
//
// AMap 提供：name, address, lng, lat, district, id
// enrichments 提供（按 name 键匹配）：
//   - 基础：shortName, aliases, admissionScope, isBranch, parentSchool,
//          hasInternationalDept, type
//   - v0.3 核对字段：verified, verifiedAt, source, sourceUrl,
//                   addressOverride, issueDescription
//   - v0.3 高德没搜到时的追加字段：district（必填，否则不追加）, lng, lat
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
  if (!patch) return school;
  const merged = { ...school, ...patch };
  // addressOverride 优先于高德 address，但保留 lng/lat 不动（路线规划仍用高德坐标）
  if (patch.addressOverride) merged.address = patch.addressOverride;
  return merged;
}

// enrichments 里有但高德没搜到的学校，按 district 字段追加（标 notFoundInAmap）
// 必须显式声明 district，否则跳过（避免错误地把某校放到所有区）
function buildOrphans(amapSchools, enrichments, districtId) {
  const amapNames = new Set(amapSchools.map(s => s.name));
  const orphans = [];
  for (const [name, patch] of Object.entries(enrichments)) {
    if (amapNames.has(name)) continue;
    if (patch.district !== districtId) continue;
    orphans.push({
      id: `enrich-${name}`,
      name,
      type: 'public', // 默认公办,patch 里若有 type 字段会覆盖
      address: patch.addressOverride || patch.address || '',
      lng: patch.lng ?? null,
      lat: patch.lat ?? null,
      district: districtId,
      notFoundInAmap: true,
      ...patch,
    });
  }
  return orphans;
}

const districtCache = new Map();

export async function getSchoolsByDistrict(districtId) {
  if (districtCache.has(districtId)) return districtCache.get(districtId);
  const [schools, enrich] = await Promise.all([
    getSchoolsForDistrict(districtId),
    loadEnrichments(),
  ]);
  const merged = schools.map(s => applyEnrichment(s, enrich));
  const orphans = buildOrphans(schools, enrich, districtId);
  const all = merged.concat(orphans);
  districtCache.set(districtId, all);
  return all;
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
