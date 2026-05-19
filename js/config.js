// 高德地图配置
// Key 与安全密钥的申请方法详见 README.md
// 申请到之后把下面两个占位符替换成真实值即可
export const AMAP_KEY = '608e1a36c4db5112ff4d003b965d2865';
export const AMAP_SECURITY_CODE = 'c07673f25fbde3e1c72d705ef18622b8';

// 高德 JS API 版本
export const AMAP_VERSION = '2.0';

// 默认地图中心：天安门
export const DEFAULT_CENTER = [116.397428, 39.90923];
export const DEFAULT_ZOOM = 11;

// 支持的招生区（MVP 4 区，对应 PRD F-02）
export const DISTRICTS = [
  { id: 'haidian',   name: '海淀区' },
  { id: 'xicheng',   name: '西城区' },
  { id: 'chaoyang',  name: '朝阳区' },
  { id: 'dongcheng', name: '东城区' },
];

// 通勤方式（对应 PRD F-03）
export const TRAVEL_MODES = {
  TRANSIT: 'transit',  // 公共交通 = 高德 Transfer 综合换乘
  DRIVING: 'driving',
  RIDING:  'riding',
};

// PRD 决定：默认公共交通
export const DEFAULT_TRAVEL_MODE = TRAVEL_MODES.TRANSIT;

// 高德 SDK 加载时一并请求的插件
export const AMAP_PLUGINS = [
  'AMap.Geocoder',
  'AMap.PlaceSearch',
  'AMap.AutoComplete',
  'AMap.Driving',
  'AMap.Transfer',
  'AMap.Riding',
];

// 北京 adcode 前缀（用于 F-09 非北京地址拦截）
export const BEIJING_ADCODE_PREFIX = '11';
