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
