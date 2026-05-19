import { loadAMap } from './amap-loader.js';
import {
  DEFAULT_CENTER, DEFAULT_ZOOM, DISTRICTS, DEFAULT_TRAVEL_MODE, FEEDBACK_EMAIL,
} from './config.js';
import { isBeijingAdcode, haversineMeters } from './geo.js';
import { getSchoolsByDistrict, getAllSchools } from './data.js';
import { searchSchools } from './search.js';
import {
  renderSchoolList, renderModeTabs, setCardCommute, MODE_LABEL,
  renderPinnedSchool, clearPinnedSchoolUI,
} from './ui.js';
import { calcRoute, drawRouteOnMap, clearRoutes } from './routing.js';
import { createIntersectObserver } from './observer.js';
import * as storage from './storage.js';

let map;
let geocoder;
let homeMarker;
let selectedAddress = null;

// 当前查询上下文（M3 新增）
let home = null;
let cardsById = new Map();
let schoolsById = new Map();
let currentMode = DEFAULT_TRAVEL_MODE;
let requestVersion = 0;
let cardObserver = null;

// M6: 用户特别关注的学校（chip）
let pinnedSchool = null;

async function init() {
  populateDistricts();
  bindFormEvents();
  restoreFromStorage();
  setupFeedbackLink();
  setupSchoolSearch();
  setupNetworkMonitor();

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

  // M4: 看路线（事件委托至 #app，覆盖 school-list 和 pinned-list 两个容器）
  document.getElementById('app').addEventListener('click', e => {
    const btn = e.target.closest('.view-route-btn');
    if (!btn) return;
    const card = btn.closest('.school-card');
    if (!card) return;
    const school = schoolsById.get(card.dataset.id);
    if (school) openRouteView(school);
  });

  document.getElementById('route-back-btn').addEventListener('click', closeRouteView);

  document.getElementById('clear-storage-btn').addEventListener('click', onClearStorage);

  // M6: chip × 移除 pin
  document.querySelector('#selected-school-chip .chip-remove').addEventListener('click', clearPinnedSchool);
}

function restoreFromStorage() {
  const saved = storage.load();
  if (!saved) return;
  if (saved.address) {
    document.getElementById('address-input').value = saved.address.name || '';
    selectedAddress = saved.address;
    // M6 修复：恢复 home，让 F-12 学校搜索能直接跳路线，不必再走一次"查询"
    if (saved.address.lng && saved.address.lat) {
      home = { lng: saved.address.lng, lat: saved.address.lat };
    }
  }
  if (saved.district) {
    document.getElementById('district-select').value = saved.district;
  }
  if (saved.mode) {
    currentMode = saved.mode;
  }
  // 启用查询按钮
  const input = document.getElementById('address-input');
  const select = document.getElementById('district-select');
  document.getElementById('search-btn').disabled = !(input.value.trim() && select.value);
  // 显示"清除记忆"按钮
  document.getElementById('form-footer').hidden = false;
}

function persistToStorage() {
  if (!selectedAddress || !document.getElementById('district-select').value) return;
  storage.save({
    address: selectedAddress,
    district: document.getElementById('district-select').value,
    mode: currentMode,
  });
  document.getElementById('form-footer').hidden = false;
}

function onClearStorage() {
  storage.clear();
  selectedAddress = null;
  home = null;
  document.getElementById('address-input').value = '';
  document.getElementById('district-select').value = '';
  document.getElementById('search-btn').disabled = true;
  document.getElementById('form-footer').hidden = true;
  showToast('已清除记忆');
}

function setupFeedbackLink() {
  const link = document.getElementById('footer-feedback-link');
  const subject = encodeURIComponent('整体数据反馈');
  const body = encodeURIComponent('问题描述：\n');
  link.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}

// M6: 学校名搜索（F-12）
function setupSchoolSearch() {
  const input = document.getElementById('school-search-input');
  const results = document.getElementById('school-search-results');

  let allSchools = null;
  const ensureSchools = async () => {
    if (!allSchools) allSchools = await getAllSchools();
    return allSchools;
  };

  let debounceTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const q = input.value.trim();
      if (!q) {
        results.hidden = true;
        return;
      }
      const schools = await ensureSchools();
      const matches = searchSchools(q, schools);
      renderSearchResults(matches);
    }, 150);
  });

  // 点击外面关闭下拉
  document.addEventListener('click', e => {
    if (!e.target.closest('.school-search')) {
      results.hidden = true;
    }
  });
}

function renderSearchResults(matches) {
  const results = document.getElementById('school-search-results');
  results.innerHTML = '';
  results.hidden = false;

  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '没有匹配的学校';
    results.appendChild(empty);
    return;
  }

  matches.forEach(({ school, matchedField }) => {
    const item = document.createElement('div');
    item.className = 'result-item';
    const branchTag = school.isBranch ? '<span class="tag tag-branch">分校</span>' : '';
    const matchedHint = matchedField !== school.shortName && matchedField !== school.name
      ? `（${matchedField}）` : '';
    item.innerHTML = `
      <div class="result-name">${escapeHtml(school.shortName || school.name)} ${branchTag}<small>${escapeHtml(matchedHint)}</small></div>
      <div class="result-meta">${escapeHtml(school.address)}</div>
    `;
    item.addEventListener('click', () => onSearchResultClick(school));
    results.appendChild(item);
  });
}

function onSearchResultClick(school) {
  document.getElementById('school-search-results').hidden = true;
  document.getElementById('school-search-input').value = '';
  setPinnedSchool(school);
}

function setPinnedSchool(school) {
  pinnedSchool = school;
  const chip = document.getElementById('selected-school-chip');
  chip.querySelector('.chip-text').textContent = school.shortName || school.name;
  chip.hidden = false;
  showToast(`★ 已选：${school.shortName || school.name}。填地址+招生区后点查询`);
  rerenderIfQueried();
}

function clearPinnedSchool() {
  pinnedSchool = null;
  document.getElementById('selected-school-chip').hidden = true;
  clearPinnedSchoolUI(document.getElementById('pinned-list'));
  rerenderIfQueried();
}

// 已有查询结果（home + district 都有）时立即重渲染列表，让 pin/dedup 变更立即反映
function rerenderIfQueried() {
  const district = document.getElementById('district-select').value;
  if (home && district) loadAndRenderSchools(district);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function openRouteView(school) {
  if (!home || !map) return;
  document.body.classList.add('route-view');
  document.getElementById('route-view-title').textContent =
    `${school.shortName || school.name} · ${MODE_LABEL[currentMode]}`;
  document.getElementById('route-view-header').hidden = false;

  // CSS 改变后等浏览器完成 layout，再让 AMap 重新测量容器并画路线
  setTimeout(() => {
    map.resize();
    if (homeMarker) homeMarker.hide();
    drawRouteOnMap(map, currentMode, [home.lng, home.lat], [school.lng, school.lat])
      .catch(err => {
        console.warn('[M4] 路径绘制失败：', err.message);
        showToast(`路径绘制失败：${err.message}`);
      });
  }, 100);
}

function closeRouteView() {
  clearRoutes();
  document.body.classList.remove('route-view');
  document.getElementById('route-view-header').hidden = true;
  setTimeout(() => {
    if (homeMarker) homeMarker.show();
    map.resize();
    if (home) {
      map.setCenter([home.lng, home.lat]);
      map.setZoom(14);
    }
  }, 100);
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
  selectedAddress = location;
  placeHomeMarker(location);
  showToast(`✓ 已识别：${location.name}（${districtName(district)}）`);
  await loadAndRenderSchools(district);
  persistToStorage();
}

async function loadAndRenderSchools(districtId) {
  const container = document.getElementById('school-list');
  const pinnedContainer = document.getElementById('pinned-list');
  try {
    const schools = await getSchoolsByDistrict(districtId);
    let districtList = schools
      .map(s => ({ ...s, distance: haversineMeters(home.lng, home.lat, s.lng, s.lat) }))
      .sort((a, b) => a.distance - b.distance);

    // M6: 处理 pinnedSchool
    schoolsById = new Map();
    let pinnedCard = null;
    if (pinnedSchool) {
      const pinned = {
        ...pinnedSchool,
        distance: haversineMeters(home.lng, home.lat, pinnedSchool.lng, pinnedSchool.lat),
      };
      pinnedCard = renderPinnedSchool(pinned, pinnedContainer);
      schoolsById.set(pinned.id, pinned);
      // 去重：本区列表里如果有同 id 学校，去掉
      districtList = districtList.filter(s => s.id !== pinnedSchool.id);
    } else {
      clearPinnedSchoolUI(pinnedContainer);
    }

    const districtCards = renderSchoolList(districtList, container);
    districtList.forEach(s => schoolsById.set(s.id, s));

    cardsById = new Map();
    if (pinnedCard) cardsById.set(pinnedCard.dataset.id, pinnedCard);
    districtCards.forEach(card => cardsById.set(card.dataset.id, card));

    setupModeTabsAndObserver();
    console.log(
      `[M6] 渲染 ${districtName(districtId)} ${districtList.length} 所学校` +
      (pinnedSchool ? ` + 我选的：${pinnedSchool.shortName || pinnedSchool.name}` : '')
    );
  } catch (err) {
    console.error('[M6] 学校数据加载失败：', err);
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
  cardsById.forEach(card => {
    setCardCommute(card, 'pending');
    cardObserver.unobserve(card);
    cardObserver.observe(card);
  });
  persistToStorage();
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
      if (err.code === 'QUOTA') showQuotaBanner();
      console.warn(`[route] ${school.shortName} ${currentMode} 失败：`, err.message);
      setCardCommute(card, 'error');
    });
}

// F-10：限额降级 banner（一旦显示就不再隐藏，直到刷新页面）
let quotaBannerShown = false;
function showQuotaBanner() {
  if (quotaBannerShown) return;
  quotaBannerShown = true;
  const banner = document.getElementById('api-banner');
  banner.textContent = '今日访问量已达上限，明日 0 点后恢复。列表仍按直线距离排序';
  banner.hidden = false;
}

// 网络断开 toast；恢复时静默（避免吵闹）
function setupNetworkMonitor() {
  window.addEventListener('offline', () => showToast('网络异常，请检查网络后重试'));
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
