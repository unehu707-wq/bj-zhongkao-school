import { loadAMap } from './amap-loader.js';
import { DEFAULT_CENTER, DEFAULT_ZOOM, DISTRICTS, DEFAULT_TRAVEL_MODE } from './config.js';
import { isBeijingAdcode, haversineMeters } from './geo.js';
import { getSchoolsByDistrict } from './data.js';
import { renderSchoolList, renderModeTabs, setCardCommute } from './ui.js';
import { calcRoute } from './routing.js';
import { createIntersectObserver } from './observer.js';

let map;
let geocoder;
let homeMarker;
let selectedAddress = null;

// 当前查询上下文（M3 新增）
let home = null;                       // { lng, lat }
let cardsById = new Map();             // id -> card element
let schoolsById = new Map();           // id -> school object
let currentMode = DEFAULT_TRAVEL_MODE;
let requestVersion = 0;                // 防请求竞态
let cardObserver = null;

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

    console.log('[M3] 地图、地址联想、路径规划就绪');
  } catch (err) {
    console.error('[M3] 初始化失败：', err);
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
}

async function onSubmit(e) {
  e.preventDefault();
  const address = document.getElementById('address-input').value.trim();
  const district = document.getElementById('district-select').value;

  let location = selectedAddress;
  if (!location || location.name !== address || !location.adcode) {
    location = await geocodeAddress(address);
    if (!location) {
      showToast('地址识别失败，请换个更具体的地点');
      return;
    }
  }

  if (!isBeijingAdcode(location.adcode)) {
    showToast('本工具仅支持北京市内地址');
    return;
  }

  home = { lng: location.lng, lat: location.lat };
  placeHomeMarker(location);
  showToast(`✓ 已识别：${location.name}（${districtName(district)}）`);
  await loadAndRenderSchools(district);
  setupModeTabsAndObserver();
}

async function loadAndRenderSchools(districtId) {
  const container = document.getElementById('school-list');
  try {
    const schools = await getSchoolsByDistrict(districtId);
    const withDistance = schools
      .map(s => ({ ...s, distance: haversineMeters(home.lng, home.lat, s.lng, s.lat) }))
      .sort((a, b) => a.distance - b.distance);

    schoolsById = new Map(withDistance.map(s => [s.id, s]));
    const cards = renderSchoolList(withDistance, container);
    cardsById = new Map(cards.map(card => [card.dataset.id, card]));
    console.log(`[M3] 渲染 ${districtName(districtId)} ${withDistance.length} 所学校`);
  } catch (err) {
    console.error('[M3] 学校数据加载失败：', err);
    container.innerHTML = `<p class="empty">学校数据加载失败：${err.message}</p>`;
  }
}

function setupModeTabsAndObserver() {
  renderModeTabs(document.getElementById('mode-tabs'), currentMode, onModeChange);
  if (cardObserver) cardObserver.disconnect();
  cardObserver = createIntersectObserver(onCardEnter);
  cardsById.forEach(card => cardObserver.observe(card));
}

function onModeChange(mode) {
  currentMode = mode;
  requestVersion++;
  // 重置所有卡片为 pending，并重新触发可见性检测
  cardsById.forEach(card => {
    setCardCommute(card, 'pending');
    cardObserver.unobserve(card);
    cardObserver.observe(card);
  });
}

function onCardEnter(card) {
  const myVersion = requestVersion;
  const id = card.dataset.id;
  const school = schoolsById.get(id);
  if (!school || !home) return;

  calcRoute(currentMode, [home.lng, home.lat], [school.lng, school.lat])
    .then(result => {
      if (myVersion !== requestVersion) return; // 已过期，丢弃
      setCardCommute(card, result);
    })
    .catch(err => {
      if (myVersion !== requestVersion) return;
      console.warn(`[M3] ${school.shortName} ${currentMode} 失败：`, err.message);
      setCardCommute(card, 'error');
    });
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
