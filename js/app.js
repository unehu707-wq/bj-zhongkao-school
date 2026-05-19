import { loadAMap } from './amap-loader.js';
import { DEFAULT_CENTER, DEFAULT_ZOOM, DISTRICTS } from './config.js';
import { isBeijingAdcode } from './geo.js';

let map;
let geocoder;
let homeMarker;
let selectedAddress = null;

async function init() {
  populateDistricts();
  bindFormEvents();

  try {
    const AMap = await loadAMap();

    map = new AMap.Map('map', {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    const autoComplete = new AMap.AutoComplete({
      input: 'address-input',
      city: '北京',
      citylimit: true,
    });
    autoComplete.on('select', onAddressSelect);

    geocoder = new AMap.Geocoder();

    console.log('[M1] 地图与地址联想就绪');
  } catch (err) {
    console.error('[M1] 初始化失败：', err);
    showError(err.message);
  }
}

function populateDistricts() {
  const select = document.getElementById('district-select');
  DISTRICTS.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    select.appendChild(opt);
  });
}

function bindFormEvents() {
  const form = document.getElementById('search-form');
  const input = document.getElementById('address-input');
  const select = document.getElementById('district-select');
  const submitBtn = document.getElementById('search-btn');
  const pickBtn = document.getElementById('pick-on-map-btn');

  const validate = () => {
    submitBtn.disabled = !(input.value.trim() && select.value);
  };
  input.addEventListener('input', () => {
    selectedAddress = null;
    validate();
  });
  select.addEventListener('change', validate);

  // 移动端键盘弹起时滚动到中心，防止遮挡
  input.addEventListener('focus', () => {
    setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });

  form.addEventListener('submit', onSubmit);
  pickBtn.addEventListener('click', onPickOnMap);
}

function onAddressSelect(e) {
  const poi = e.poi;
  if (!poi || !poi.location) return;
  selectedAddress = {
    name: poi.name,
    lng: poi.location.lng,
    lat: poi.location.lat,
    adcode: poi.adcode,
  };
  console.log('[M1] 选中联想结果：', selectedAddress);
}

async function onSubmit(e) {
  e.preventDefault();
  const address = document.getElementById('address-input').value.trim();
  const district = document.getElementById('district-select').value;

  let location = selectedAddress;
  // 用户没从联想里选 / 改了文本 / 缺 adcode → 走 geocoder 兜底
  if (!location || location.name !== address || !location.adcode) {
    location = await geocodeAddress(address);
    if (!location) {
      showToast('地址识别失败，请换个更具体的地点');
      return;
    }
  }

  // F-09 非北京地址拦截
  if (!isBeijingAdcode(location.adcode)) {
    showToast('本工具仅支持北京市内地址');
    return;
  }

  // M1 完成态：识别成功后把家标在地图上
  placeHomeMarker(location);
  showToast(`✓ 已识别：${location.name}（${districtName(district)}）`);
  console.log('[M1] 查询通过：', { location, district });
  // M2 将从这里继续：加载该区学校 JSON、计算 Haversine、渲染列表
}

function onPickOnMap() {
  if (!map) return;
  showToast('请在地图上点击家的位置');
  map.once('click', e => {
    const lnglat = [e.lnglat.lng, e.lnglat.lat];
    geocoder.getAddress(lnglat, (status, result) => {
      if (status === 'complete' && result.regeocode) {
        const r = result.regeocode;
        const name = r.formattedAddress;
        const adcode = r.addressComponent && r.addressComponent.adcode;
        document.getElementById('address-input').value = name;
        selectedAddress = { name, lng: e.lnglat.lng, lat: e.lnglat.lat, adcode };
        document.getElementById('search-btn').disabled =
          !(name && document.getElementById('district-select').value);
        showToast(`✓ 已选：${name}`);
      } else {
        showToast('反向解析地址失败，请直接输入地址');
      }
    });
  });
}

function geocodeAddress(address) {
  return new Promise(resolve => {
    geocoder.getLocation(address, (status, result) => {
      if (status === 'complete' && result.geocodes && result.geocodes.length) {
        const g = result.geocodes[0];
        resolve({
          name: address,
          lng: g.location.lng,
          lat: g.location.lat,
          adcode: g.adcode,
        });
      } else {
        resolve(null);
      }
    });
  });
}

function placeHomeMarker(location) {
  const AMap = window.AMap;
  if (homeMarker) map.remove(homeMarker);
  homeMarker = new AMap.Marker({
    position: [location.lng, location.lat],
    title: location.name,
    map,
  });
  map.setCenter([location.lng, location.lat]);
  map.setZoom(14);
}

function districtName(id) {
  const d = DISTRICTS.find(x => x.id === id);
  return d ? d.name : id;
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  // 重置动画
  toast.style.animation = 'none';
  void toast.offsetWidth;
  toast.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}

function showError(message) {
  document.getElementById('map').innerHTML = `
    <div class="error-box">
      ${message}
      <small>请按 README.md 操作申请并配置高德 Key</small>
    </div>
  `;
}

init();
