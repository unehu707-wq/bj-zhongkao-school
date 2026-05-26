# 学校数据说明

## 数据来源 = 两层

```
┌────────────────────────────────────┐
│ 高德 AMap PlaceSearch（自动维护）  │
│ ├─ name, address, lng, lat         │
│ ├─ district, id                    │
│ └─ 30 天 localStorage 缓存         │
└────────────────┬───────────────────┘
                 ▼
┌────────────────────────────────────┐
│ data/enrichments.json（你手动改）  │
│ ├─ shortName / aliases             │
│ ├─ admissionScope                  │
│ ├─ isBranch / parentSchool         │
│ └─ hasInternationalDept / type     │
└────────────────────────────────────┘
                 ▼
           merge → 给 UI 用
```

## enrichments.json 字段说明

每条记录的 **key 是学校全名**（要跟高德返回的 name 完全一致），value 是要覆盖/补充的字段。

```json
{
  "中国人民大学附属中学": {
    "shortName": "人大附中",
    "aliases": ["人大附", "RDFZ"],
    "admissionScope": "citywide",
    "hasInternationalDept": true,
    "isBranch": false,
    "parentSchool": null,
    "type": "public"
  }
}
```

| 字段 | 类型 | 说明 | 默认 |
|---|---|---|---|
| `shortName` | string | 卡片上显示的简称（如"人大附中"） | 空字符串 |
| `aliases` | string[] | 搜索时能匹配的别名（如`["人大附", "RDFZ"]`） | `[]` |
| `admissionScope` | `"district"` / `"citywide"` | 区内招生还是全市统招 | `"district"` |
| `isBranch` | boolean | 是不是分校 | `false` |
| `parentSchool` | string / null | 分校时关联的本部名称（要和某个 key 一致） | `null` |
| `hasInternationalDept` | boolean | 是不是含国际部 | `false` |
| `type` | `"public"` / `"private"` / `"international-dept"` | 学校类型 | `"public"` |

### v0.3 核对字段(2026.05 加入)

| 字段 | 类型 | 说明 | 默认 |
|---|---|---|---|
| `verified` | boolean | 是否已对照权威源核对 | `false`(未加字段也视为 false) |
| `verifiedAt` | string | 人工核对当日(ISO 格式 `YYYY-MM-DD`) | 空 |
| `source` | string | 数据来源标识(如 `"2025 海淀中招简章"`、`"claude-公开信息"`) | 空 |
| `sourceUrl` | string | 来源 URL(可选) | 空 |
| `addressOverride` | string | 覆盖高德返回的 address 字段(用于地址不准时) | 空 |
| `issueDescription` | string | 核对发现的问题备注,会显示为卡片 badge 的 hover tooltip | 空 |
| `district` | `"haidian"`/`"xicheng"`/`"chaoyang"`/`"dongcheng"` | **仅当高德搜不到该校时必填**,告诉系统追加到哪个区 | 不追加 |
| `lng` / `lat` | number | **仅当高德搜不到时必填**,用于距离计算 | 不参与 |

**`verified: true` 的学校卡片上会出现绿色 `✓ 已核对` badge**,鼠标 hover 显示 `issueDescription` 或 `source` 内容。

## 怎么改

1. **加新条目**：复制现有条目格式，把 key 换成新学校的全名（**要先确认高德里这个全名长什么样**，可以打开浏览器 F12 → Console 输入 `await (await fetch('data/...')).json()` 或者翻 localStorage 的 `school-finder/amap-海淀` 看）
2. **改已有条目**：直接改值就好
3. **删除**：删整个 key

**注意**：
- 改完 `Ctrl+Shift+R` 硬刷新页面即可生效
- 高德的 POI 数据不需要你维护，30 天自动更新一次
- 如果发现某所学校高德里地址错了 → 通过反馈链接报告高德，无法在本工具里修正坐标

## 强制刷新高德缓存

如果想立刻拉一次最新数据：
1. F12 → Application → Local Storage → `http://127.0.0.1:5500` → 删除以 `school-finder/amap-` 开头的所有项
2. 刷新页面

或者 Console 里：
```js
import('/js/amap-schools.js').then(m => m.clearAmapCache())
```
（用绝对路径；ES modules import 在 Console 里走 dynamic import，比较麻烦，第一种方法更快）

---

## v0.3 数据核对流程(给明年的自己看)

中考学校名单年年小变(新设/停招/合并)。每年填报季前需要重跑一次核对流程,保证数据准确:

### 1. 拿权威源
- 北京教育考试院 [bjeea.cn](https://www.bjeea.cn/) → 中考中招 → 计划查询
- 找 `XXXX年普通高中学校统一招生计划`(注意:**不是**"初中入学"或"中等职业")
- 招生计划页面主体是图片,需要**截图**或下载图片
- 时间:北京中招简章通常 6-7 月发布,提前一个月就要开始关注

### 2. 三路 diff
打开浏览器本地 [diff-tool.html](../diff-tool.html)(v0.3 后新增),三路对照:
- 权威源(教委 PDF/图片 OCR 后的学校名)
- enrichments.json(我们手工维护的)
- 高德 PlaceSearch 缓存(localStorage 里读)

三路输出:
- 仅权威源有 → **需添加**到 enrichments,设 `district + lng + lat + verified:true`
- 仅 Claude/高德有 → **可能是非高中或停招**,需移除或加 `verified:false` 标记
- 三路一致 → 一键标 `verified:true + verifiedAt:今天 + source:'XXXX 中招简章'`

### 3. 地址核对
打开浏览器本地 [address-check.html](../address-check.html)(v0.3 后新增):
- 用高德 Geocoder 反查每所学校的经纬度对应地址
- 跟 PlaceSearch 返回的 address 对比
- 输出可疑列表(地址 vs 经纬度对不上)
- 对可疑学校手工核对(去学校官网查正确地址) → 在 enrichments 加 `addressOverride` + `issueDescription`

### 4. 上线前自查
- 所有 `verified: true` 的学校必须有 `source` 字段
- 所有 `addressOverride` 的学校必须有 `issueDescription` 解释原因
- 跑一遍主流程,卡片 ✓ badge 显示正确,hover 能看到 tooltip

---

## v0.3 已核对状态(按区追踪)

| 区 | verified 状态 | 最后核对日期 | 来源 |
|---|---|---|---|
| 海淀区 | 待核对(v0.3 试点) | - | - |
| 西城区 | 未核对(v0.3.1) | - | - |
| 朝阳区 | 未核对(v0.3.2) | - | - |
| 东城区 | 未核对(v0.3.3) | - | - |
