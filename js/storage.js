const KEY = 'school-finder/last-search';

// 隐私模式 / 配额满 / 用户禁用 localStorage 时，所有方法静默失败不抛错
export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    /* noop */
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clear() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* noop */
  }
}
