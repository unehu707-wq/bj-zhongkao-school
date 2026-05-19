// 学校数据加载
// M2-M5 阶段使用 schools-mock.json（8 所样本）
// M8 阶段会改成按区分割：schools-haidian.json / schools-xicheng.json / ...

let cache = null;

async function loadAllSchools() {
  if (cache) return cache;
  const res = await fetch('data/schools-mock.json');
  if (!res.ok) throw new Error(`学校数据加载失败 (HTTP ${res.status})`);
  cache = await res.json();
  return cache;
}

export async function getSchoolsByDistrict(districtId) {
  const all = await loadAllSchools();
  return all.filter(s => s.district === districtId);
}

export async function getSchoolById(id) {
  const all = await loadAllSchools();
  return all.find(s => s.id === id) || null;
}
