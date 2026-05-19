import { loadAMap } from './amap-loader.js';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from './config.js';

async function init() {
  const mapEl = document.getElementById('map');
  try {
    const AMap = await loadAMap();
    const map = new AMap.Map('map', {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    console.log('[M0] 高德地图初始化完成', map);
  } catch (err) {
    console.error('[M0] 初始化失败：', err);
    mapEl.innerHTML = `
      <div class="error-box">
        ${err.message}
        <small>请按 README.md 操作申请并配置高德 Key</small>
      </div>
    `;
  }
}

init();
