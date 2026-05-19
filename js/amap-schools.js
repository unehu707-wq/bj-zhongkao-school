// 从高德 PlaceSearch 拉取北京 4 区"中学"POI，做高中过滤 + localStorage 30 天缓存

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = 'school-finder/amap-';
const PAGE_SIZE = 25;
const MAX_PAGES = 4;                  // 每区最多 100 条，足以覆盖城区中学数量
const PAGE_DELAY_MS = 700;            // 翻页间隔，让免费 Key QPS 不超
const INTER_DISTRICT_MIN_GAP_MS = 1500; // 真正打 AMap 时，距上次实际 fetch 最少间隔
const RETRY_ON_QUOTA_DELAYS = [1500, 3000, 6000];

const sleep = ms => new Promise(r => setTimeout(r, ms));

let lastFetchStartTs = 0;
async function throttleBetweenDistricts() {
  const since = Date.now() - lastFetchStartTs;
  if (since < INTER_DISTRICT_MIN_GAP_MS) {
    await sleep(INTER_DISTRICT_MIN_GAP_MS - since);
  }
  lastFetchStartTs = Date.now();
}

const DISTRICT_TO_NAME = {
  haidian: '海淀区',
  xicheng: '西城区',
  chaoyang: '朝阳区',
  dongcheng: '东城区',
};

let placeSearch = null;

function ensurePlaceSearch() {
  if (placeSearch) return placeSearch;
  const AMap = window.AMap;
  if (!AMap) throw new Error('高德 SDK 未就绪');
  placeSearch = new AMap.PlaceSearch({
    pageSize: PAGE_SIZE,
  });
  return placeSearch;
}

function fetchPage(districtName, pageIndex) {
  const ps = ensurePlaceSearch();
  ps.setCity(districtName);
  ps.setPageIndex(pageIndex);
  return new Promise((resolve, reject) => {
    ps.search('中学', (status, result) => {
      if (status === 'complete') {
        resolve((result && result.poiList && result.poiList.pois) || []);
      } else if (status === 'no_data') {
        resolve([]);
      } else {
        const detail = typeof result === 'string' ? result : JSON.stringify(result);
        reject(new Error(`POI 查询失败 (${districtName} p${pageIndex}): ${detail}`));
      }
    });
  });
}

async function fetchPageWithRetry(districtName, pageIndex) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_ON_QUOTA_DELAYS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_ON_QUOTA_DELAYS[attempt - 1]);
    try {
      return await fetchPage(districtName, pageIndex);
    } catch (err) {
      lastErr = err;
      // 仅在 QPS 限流时重试；其它错误立即抛
      if (!/CUQPS|HAS_EXCEEDED_THE_LIMIT|QUOTA|超限/i.test(err.message)) throw err;
    }
  }
  throw lastErr;
}

async function fetchAllPages(districtName) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await sleep(PAGE_DELAY_MS);
    const items = await fetchPageWithRetry(districtName, page);
    if (!items.length) break;
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return all;
}

// 过滤：要求名称"以 中学 或 学校 结尾"（避免街道、公交站、培训机构误命中）
// 同时排除明显不是普通高中的类别
function isHighSchool(poi) {
  const name = poi.name || '';
  // 以这些词结尾的本身就是其它机构（不是 高中）
  if (/(大学|学院|幼儿园|小学|职业学校|技校|中专|培训学校|教育中心|早教中心)$/.test(name)) {
    return false;
  }
  // 含这些关键字也不是普通高中
  if (/初级中学|早教|留学|武术学校|国学|预科/.test(name)) {
    return false;
  }
  return /(中学|学校)$/.test(name);
}

function transformPoi(poi, districtId) {
  return {
    id: poi.id,
    name: poi.name,
    shortName: '', // 默认空，由 enrichments 提供
    aliases: [],
    isBranch: false,
    parentSchool: null,
    district: districtId,
    address: poi.address || '',
    lng: poi.location.lng,
    lat: poi.location.lat,
    type: 'public', // 保守默认，enrichments 可覆盖
    hasInternationalDept: false,
    admissionScope: 'district', // 保守默认
    lastVerified: 'amap-' + new Date().toISOString().slice(0, 10),
  };
}

const cacheKey = districtId => CACHE_KEY_PREFIX + districtId;

function readCache(districtId) {
  try {
    const raw = localStorage.getItem(cacheKey(districtId));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(districtId, data) {
  try {
    localStorage.setItem(cacheKey(districtId), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* 容量满 / 隐私模式 → 静默 */
  }
}

// 进行中的 fetch 用 Map 去重，避免重复并发拉同一区
const inFlight = new Map();

export async function getSchoolsForDistrict(districtId) {
  const cached = readCache(districtId);
  if (cached) return cached;
  if (inFlight.has(districtId)) return inFlight.get(districtId);

  const districtName = DISTRICT_TO_NAME[districtId];
  if (!districtName) throw new Error(`未知区: ${districtId}`);

  const promise = (async () => {
    try {
      await throttleBetweenDistricts();
      const raw = await fetchAllPages(districtName);
      const schools = raw.filter(isHighSchool).map(p => transformPoi(p, districtId));
      writeCache(districtId, schools);
      return schools;
    } finally {
      inFlight.delete(districtId);
    }
  })();
  inFlight.set(districtId, promise);
  return promise;
}

// 手动清除所有缓存（开发期间或用户主动刷新数据时用）
export function clearAmapCache() {
  Object.keys(DISTRICT_TO_NAME).forEach(d => {
    try { localStorage.removeItem(cacheKey(d)); } catch {}
  });
}
