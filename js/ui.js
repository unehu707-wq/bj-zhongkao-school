import { formatDistance } from './geo.js';
import { TRAVEL_MODES } from './config.js';

const TYPE_LABEL = {
  'public': '公办',
  'private': '民办',
  'international-dept': '国际部',
};

const SCOPE_LABEL = {
  'district': '本区招生',
  'citywide': '全市统招',
};

const MODE_LABEL = {
  [TRAVEL_MODES.TRANSIT]: '公共交通',
  [TRAVEL_MODES.DRIVING]: '驾车',
  [TRAVEL_MODES.RIDING]: '骑行',
};

export function renderModeTabs(container, currentMode, onChange) {
  container.innerHTML = '';
  container.hidden = false;
  Object.entries(MODE_LABEL).forEach(([mode, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className = mode === currentMode ? 'active' : '';
    btn.dataset.mode = mode;
    btn.addEventListener('click', () => {
      if (mode === currentMode) return;
      currentMode = mode;
      container.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      onChange(mode);
    });
    container.appendChild(btn);
  });
}

export function renderSchoolList(schools, container) {
  container.innerHTML = '';
  if (!schools.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '该区暂无学校数据';
    container.appendChild(empty);
    return [];
  }
  const cards = schools.map(s => {
    const card = createCard(s);
    container.appendChild(card);
    return card;
  });
  return cards;
}

function createCard(school) {
  const card = document.createElement('div');
  card.className = 'school-card';
  card.dataset.id = school.id;

  const branchTag = school.isBranch ? '<span class="tag tag-branch">分校</span>' : '';
  const intlTag = school.hasInternationalDept ? '<span class="tag tag-intl">含国际部</span>' : '';

  card.innerHTML = `
    <div class="school-header">
      <span class="school-name">${escapeHtml(school.shortName || school.name)}</span>
      ${branchTag}
      ${intlTag}
    </div>
    <div class="school-meta">
      <span class="distance">${formatDistance(school.distance)}</span>
      <span class="dot">·</span>
      <span class="commute" data-state="pending">…</span>
    </div>
    <div class="school-meta-secondary">
      ${TYPE_LABEL[school.type] || school.type} · ${SCOPE_LABEL[school.admissionScope] || school.admissionScope}
    </div>
    <div class="school-address">${escapeHtml(school.address)}</div>
  `;
  return card;
}

// state: 'pending' | 'error' | { duration }
export function setCardCommute(card, state) {
  const el = card.querySelector('.commute');
  if (!el) return;
  if (state === 'pending') {
    el.textContent = '…';
    el.dataset.state = 'pending';
  } else if (state === 'error') {
    el.textContent = '-';
    el.dataset.state = 'error';
  } else {
    el.textContent = formatDuration(state.duration);
    el.dataset.state = 'ready';
  }
}

function formatDuration(seconds) {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
