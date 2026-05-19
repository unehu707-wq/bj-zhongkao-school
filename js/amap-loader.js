import {
  AMAP_KEY,
  AMAP_SECURITY_CODE,
  AMAP_VERSION,
  AMAP_PLUGINS,
} from './config.js';

let loadPromise = null;

// 动态加载高德 JS API
// 重复调用返回同一个 Promise（懒加载 + 缓存）
export function loadAMap() {
  if (loadPromise) return loadPromise;

  if (AMAP_KEY === '__AMAP_KEY__' || AMAP_SECURITY_CODE === '__AMAP_SECURITY_CODE__') {
    return Promise.reject(new Error(
      '高德 Key 未配置。请按 README.md 申请后填入 js/config.js'
    ));
  }

  // v2.0 强制要求安全密钥，必须在 script 加载前设置全局
  window._AMapSecurityConfig = {
    securityJsCode: AMAP_SECURITY_CODE,
  };

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const plugins = AMAP_PLUGINS.join(',');
    script.src = `https://webapi.amap.com/maps?v=${AMAP_VERSION}&key=${AMAP_KEY}&plugin=${plugins}`;
    script.async = true;
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        reject(new Error('高德 SDK 加载完成但 window.AMap 不可用，可能是 Key 或安全密钥错误'));
      }
    };
    script.onerror = () => reject(new Error('高德 SDK 网络加载失败，检查网络连接'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
