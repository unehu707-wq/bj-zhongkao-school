// 学校名搜索（F-12）
// 匹配 name / shortName / aliases 任意一个
// 子串匹配 + 前缀优先
const MAX_RESULTS = 8;

export function searchSchools(query, schools) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches = [];
  for (const s of schools) {
    const candidates = [s.name, s.shortName, ...(s.aliases || [])].filter(Boolean);
    let bestField = null;
    let bestRank = Infinity;
    for (const field of candidates) {
      const lc = field.toLowerCase();
      let rank;
      if (lc === q) rank = 0;
      else if (lc.startsWith(q)) rank = 1;
      else if (lc.includes(q)) rank = 2;
      else continue;
      if (rank < bestRank) {
        bestRank = rank;
        bestField = field;
      }
    }
    if (bestField !== null) {
      matches.push({ school: s, matchedField: bestField, rank: bestRank });
    }
  }

  return matches
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_RESULTS);
}
