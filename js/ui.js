import { formatDistance } from './geo.js';

const TYPE_LABEL = {
  'public': '公办',
  'private': '民办',
  'international-dept': '国际部',
};

const SCOPE_LABEL = {
  'district': '本区招生',
  'citywide': '全市统招',
};

export function renderSchoolList(schools, container) {
  container.innerHTML = '';
  if (!schools.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '该区暂无学校数据';
    container.appendChild(empty);
    return;
  }
  schools.forEach(s => container.appendChild(createCard(s)));
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
      <span>${TYPE_LABEL[school.type] || school.type}</span>
      <span class="dot">·</span>
      <span>${SCOPE_LABEL[school.admissionScope] || school.admissionScope}</span>
    </div>
    <div class="school-address">${escapeHtml(school.address)}</div>
  `;
  return card;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
