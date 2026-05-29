import { TRAVEL_MODES } from './config.js';

// routing 结果缓存（localStorage，缓解高德配额）
// key = 通勤方式 + 起点经纬度 + 终点经纬度；经纬度截 5 位小数（约 1 米）吸收浮点噪声
// TTL 7 天：公交线路/路况会变，过期重查
const ROUTE_CACHE_PREFIX = 'school-finder/route-';
const ROUTE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function coord(n) { return Number(n).toFixed(5); }

function routeCacheKey(mode, origin, destination) {
  return `${ROUTE_CACHE_PREFIX}${mode}|${coord(origin[0])},${coord(origin[1])}|${coord(destination[0])},${coord(destination[1])}`;
}

function readRouteCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > ROUTE_CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeRouteCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // localStorage 满 / 隐私模式：静默降级，不缓存
  }
}

// 清空所有 routing 缓存（数据更新后想强制重查时用）
export function clearRouteCache() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(ROUTE_CACHE_PREFIX))
    .forEach(k => { try { localStorage.removeItem(k); } catch {} });
}

// 用于"计算用时"的服务实例（不绑 map，不渲染）
let driving = null;
let transfer = null;
let riding = null;

// 用于"在主地图上画路线"的服务实例（绑定主地图）
let drawDriving = null;
let drawTransfer = null;
let drawRiding = null;

function ensureServices() {
  const AMap = window.AMap;
  if (!AMap) throw new Error('高德 SDK 未就绪');
  if (!driving) {
    driving = new AMap.Driving({
      city: '北京',
      policy: AMap.DrivingPolicy.LEAST_TIME,
    });
  }
  if (!transfer) {
    transfer = new AMap.Transfer({
      city: '北京',
      policy: AMap.TransferPolicy.LEAST_TIME,
    });
  }
  if (!riding) {
    riding = new AMap.Riding();
  }
}

function ensureDrawServices(map) {
  const AMap = window.AMap;
  if (!drawDriving) {
    drawDriving = new AMap.Driving({ map, city: '北京', policy: AMap.DrivingPolicy.LEAST_TIME, autoFitView: true });
  }
  if (!drawTransfer) {
    drawTransfer = new AMap.Transfer({ map, city: '北京', policy: AMap.TransferPolicy.LEAST_TIME, autoFitView: true });
  }
  if (!drawRiding) {
    drawRiding = new AMap.Riding({ map, autoFitView: true });
  }
}

// 计算下一个工作日的 07:30
// 周一-周五早上 07:30 前 → 今天 07:30
// 其它情况 → 下一个工作日 07:30
function nextWeekdayMorning() {
  const now = new Date();
  const day = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const beforeMorning = now.getHours() < 7 || (now.getHours() === 7 && now.getMinutes() < 30);

  let daysAhead;
  if (day >= 1 && day <= 5 && beforeMorning) {
    daysAhead = 0;
  } else if (day === 5) {
    daysAhead = 3; // 周五已过 → 下周一
  } else if (day === 6) {
    daysAhead = 2; // 周六 → 下周一
  } else if (day === 0) {
    daysAhead = 1; // 周日 → 周一
  } else {
    daysAhead = 1; // 工作日已过早高峰 → 明天
  }

  const target = new Date(now);
  target.setDate(now.getDate() + daysAhead);
  target.setHours(7, 30, 0, 0);

  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: '07:30' };
}

export function calcRoute(mode, origin, destination) {
  // 先查缓存，命中直接返回，不调高德
  const cacheKey = routeCacheKey(mode, origin, destination);
  const cached = readRouteCache(cacheKey);
  if (cached) return Promise.resolve(cached);

  ensureServices();
  let promise;
  if (mode === TRAVEL_MODES.DRIVING) {
    promise = search(driving, origin, destination, '驾车', r => r.routes && r.routes[0]);
  } else if (mode === TRAVEL_MODES.TRANSIT) {
    const { date, time } = nextWeekdayMorning();
    transfer.leaveAt(time, date);
    promise = search(transfer, origin, destination, '公交', r => r.plans && r.plans[0]);
  } else if (mode === TRAVEL_MODES.RIDING) {
    promise = search(riding, origin, destination, '骑行', r => r.routes && r.routes[0]);
  } else {
    return Promise.reject(new Error('未知通勤方式：' + mode));
  }
  // 成功才写缓存；失败(含 QUOTA)不缓存，下次还能重试
  return promise.then(result => {
    writeRouteCache(cacheKey, result);
    return result;
  });
}

// 把 AMap 的 search 回调包成 Promise；pickRoute 从 result 里取出"第一条路线"对象（含 distance、time）
// 失败时如果识别出是配额相关错误，会在 err 上挂 code = 'QUOTA'
function search(service, origin, destination, label, pickRoute) {
  return new Promise((resolve, reject) => {
    service.search(origin, destination, (status, result) => {
      const route = status === 'complete' && pickRoute(result);
      if (route) {
        resolve({ distance: route.distance, duration: route.time });
        return;
      }
      const err = new Error(`${label}路径规划失败`);
      if (isQuotaError(result)) err.code = 'QUOTA';
      reject(err);
    });
  });
}

// 高德返回的限额相关错误信息识别
// JS API 失败时 result 通常是错误描述字符串，含 OVER_LIMIT / CUQPS_HAS_EXCEEDED 等
function isQuotaError(result) {
  const text = typeof result === 'string'
    ? result
    : (result && (result.info || JSON.stringify(result))) || '';
  return /OVER_LIMIT|CUQPS|QUOTA|超限|上限|已达/i.test(text);
}

// 在指定 map 上绘制路径（会先清掉之前所有模式的路径）
export function drawRouteOnMap(map, mode, origin, destination) {
  ensureDrawServices(map);
  drawDriving.clear();
  drawTransfer.clear();
  drawRiding.clear();

  let drawer;
  if (mode === TRAVEL_MODES.DRIVING) {
    drawer = drawDriving;
  } else if (mode === TRAVEL_MODES.TRANSIT) {
    const { date, time } = nextWeekdayMorning();
    drawTransfer.leaveAt(time, date);
    drawer = drawTransfer;
  } else if (mode === TRAVEL_MODES.RIDING) {
    drawer = drawRiding;
  } else {
    return Promise.reject(new Error('未知通勤方式：' + mode));
  }

  return new Promise((resolve, reject) => {
    drawer.search(origin, destination, (status, result) => {
      if (status === 'complete') resolve(result);
      else reject(new Error('路径绘制失败'));
    });
  });
}

export function clearRoutes() {
  if (drawDriving) drawDriving.clear();
  if (drawTransfer) drawTransfer.clear();
  if (drawRiding) drawRiding.clear();
}
