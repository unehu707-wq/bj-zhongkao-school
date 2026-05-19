import { TRAVEL_MODES } from './config.js';

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
  ensureServices();
  if (mode === TRAVEL_MODES.DRIVING) {
    return search(driving, origin, destination, '驾车', r => r.routes && r.routes[0]);
  }
  if (mode === TRAVEL_MODES.TRANSIT) {
    const { date, time } = nextWeekdayMorning();
    transfer.leaveAt(time, date);
    return search(transfer, origin, destination, '公交', r => r.plans && r.plans[0]);
  }
  if (mode === TRAVEL_MODES.RIDING) {
    return search(riding, origin, destination, '骑行', r => r.routes && r.routes[0]);
  }
  return Promise.reject(new Error('未知通勤方式：' + mode));
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
