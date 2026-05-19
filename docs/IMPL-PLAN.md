# 北京中考-哪个学校离我近 · Implementation Plan

**v0.1 · 2026-05-19**
**对应 PRD**：`docs/PRD.md` (v0.2)

---

## Context

PRD v0.2 已定稿，覆盖 12 个 P0 功能。本计划将 PRD 翻译为可执行的代码结构、模块分工、开发顺序与验收口径。

**关键约束**（PRD + 澄清确认）：
- 纯前端、无构建工具、无 npm install 依赖
- 浏览器原生 ES modules + fetch JSON（需通过本地 server 访问）
- 本地开发：**VSCode Live Server 插件**
- 部署：静态托管（GitHub Pages / Vercel）
- 高德 JS API v2.0；Key **本期用占位符 `__AMAP_KEY__`**，README 写申请步骤
- 数据：**先代码后数据**，M0-M5 用 8 所 mock；M8 由 AI 补全 4 区 ~200 所
- 节奏：**M0→M8 里程碑分步交付**，每步独立可跑

---

## 架构总览

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  index.html  │ ──▶ │   app.js     │ ──▶ │ amap-loader  │
│  + main.css  │     │  (主流程)    │     │  (动态加载)  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌─────────┐        ┌──────────┐         ┌────────┐
   │  geo    │        │ routing  │         │ data   │
   │ (距离)  │        │ (路径)   │         │ (JSON) │
   └─────────┘        └──────────┘         └────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
        ┌─────────┬─────────┬─────────┬──────────┐
        │  ui     │observer │ storage │  search  │
        │(渲染)   │(可见卡) │(本地存) │ (F-12)   │
        └─────────┴─────────┴─────────┴──────────┘
```

**模块边界原则**：
- 数据层（data / geo）不依赖 UI
- UI 层（ui / observer）不直接调高德 API
- routing / search 是协调层，从 data 取数据、给 ui 喂结果

---

## 文件结构

```
北京哪个学校离我近/
├── index.html               入口 + 高德 SDK loader 占位
├── README.md                启动说明、Key 申请 5 步
├── css/
│   └── main.css             移动优先；@media (min-width:768px) 适配 PC
├── js/
│   ├── config.js            __AMAP_KEY__、API endpoints、4 区枚举、默认值
│   ├── app.js               主入口；初始化、事件总线、错误顶层处理
│   ├── amap-loader.js       动态注入高德 SDK script，Promise 化
│   ├── geo.js               Haversine 直线距离 + adcode 校验（is11Prefix）
│   ├── data.js              按区 fetch JSON、缓存、索引（id→school）
│   ├── search.js            F-12 学校名/别名/简称匹配（含同音/前缀宽容）
│   ├── routing.js           driving / transit (Transfer) / riding 三接口封装
│   ├── ui.js                列表渲染、卡片模板、toast、banner、route modal
│   ├── observer.js          IntersectionObserver 工厂，触发可见卡精确查询
│   └── storage.js           localStorage 封装（地址/区/方式/清除）
├── data/
│   ├── schools-mock.json    8 所样本（M0-M5 用）
│   ├── schools-haidian.json M8 补全
│   ├── schools-xicheng.json M8 补全
│   ├── schools-chaoyang.json M8 补全
│   ├── schools-dongcheng.json M8 补全
│   └── aliases.json         简称→学校 id（M6 起用）
└── docs/
    ├── PRD.md               PRD v0.2（已就位）
    ├── PRD-v0.1.md          PRD v0.1 归档（已就位）
    └── IMPL-PLAN.md         本文件
```

---

## 关键技术决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| JS 模块系统 | 浏览器原生 `<script type="module">` | 零构建；require Live Server |
| 状态管理 | 模块级单例 + 事件总线（mitt 风格 100 行手写） | 不引入框架，规模够用 |
| CSS | 单文件，移动优先，CSS Variables | 不用预处理器 |
| 路径规划 API | 高德 JS API（非 REST） | JS API 域名白名单更易管控；与 SDK 一体 |
| 出发时间（公交） | 下周一 07:30（动态算出本周/下周一） | PRD 已定，避开周末算路 |
| 并发控制 | Promise.allSettled，单失败不阻塞 | 对应异常表"单校失败显示 -" |
| 别名词典格式 | `{ "四中": ["beijing-no4"], "十一": ["bj-11-school"] }` 一对多 | "实验"可能歧义，要支持选择 |

---

## 里程碑 M0 → M8

每个里程碑产出**独立可跑**的状态，可单独 review。

### M0 · 骨架与高德 SDK 集成（1 天）

**新增文件**：`index.html` / `README.md` / `css/main.css` / `js/config.js` / `js/amap-loader.js` / `js/app.js`（仅初始化）

**产出**：在 Live Server 跑起来，页面有一个空白的高德地图组件居中显示北京。
**验收**：浏览器控制台无报错；地图组件渲染默认视图。
**README**：写明 (1) VSCode Live Server 启动步骤 (2) 高德 Key 5 步申请流程 + 怎么填进 config.js (3) 域名白名单怎么设。

### M1 · 地址输入 + 招生区 + 北京拦截（半天）

**新增**：`js/geo.js`（Haversine + adcode 校验）；扩展 `app.js` / `index.html` / `main.css`

**对应 PRD**：F-01 / F-02 / F-09
**产出**：输入"望京西园" → placeSearch 联想 → 选朝阳 → 点查询 → 输入非北京地址被拦截。
**验收**：联想 ≤0.5s；非北京地址 toast 提示 + 按钮置灰。

### M2 · 学校列表 + 直线距离（半天）

**新增**：`js/data.js` / `js/ui.js` / `data/schools-mock.json`（8 所样本：四中、人大附本部、人大附朝阳、十一学校、北师大实验、北京二中、首师大附、八十中——覆盖城 4 区与分校情形）

**对应 PRD**：F-04（直线距离部分）
**产出**：查询后看到 8 所学校列表，按直线距离升序，分校带 tag。
**验收**：卡片字段齐全（校名、距离、类型、招生范围）；分校独立条目。

### M3 · 通勤方式 + 可见卡片精确通勤（2 天）

**新增**：`js/routing.js` / `js/observer.js`；扩展 `app.js` / `ui.js`

**对应 PRD**：F-03（公共交通默认） / F-05（IntersectionObserver） / F-06（切换重排）
**产出**：切换 tab → 可见卡片调高德路径规划 → 用时回填；列表保持直线距离排序。
**验收**：DevTools Network 验证只为可见卡发请求；切换 tab ≤3s 内回填；公交默认排序按 duration；快速连切 tab 无结果错乱。

### M4 · 看路线弹窗（半天）

**对应 PRD**：F-07
**产出**：点"看路线"弹出全屏地图，绘制路径与关键节点标注；关闭返回列表状态保留。
**验收**：三种通勤方式路径都能渲染；移动端横屏可用。

### M5 · localStorage 记忆 + 反馈入口（2 小时）

**新增**：`js/storage.js`
**对应 PRD**：F-08 / F-11
**产出**：刷新页面自动回填上次输入；底部反馈链接（先用 `mailto:`，开发后期可改 GitHub Issues）。
**验收**：清除按钮立即生效；隐私模式下静默降级不报错。

### M6 · 学校名搜索（半天）

**新增**：`js/search.js` / `data/aliases.json`
**对应 PRD**：F-12
**初始别名表**：四中、人大附、师大附（含实验/二附）、十一、首师大附、八十中、八一、清华附、北大附、二中、五中、十一、十二、三十五 ≈ 20 条
**产出**：顶部搜索框输入"四中" → 命中 → 直接进详情。
**验收**：简称命中后跳过选区流程；多歧义时弹出候选列表（如"实验"匹配多所）。

### M7 · 限额降级 + 异常处理（半天）

**对应 PRD**：F-10 + 异常表全部
**产出**：模拟高德返回限额错误码 → 顶部 banner；列表仍展示直线距离。
**验收**：手动断网测试 toast 出现；模拟单校 API 失败该卡显示"-"，其余正常。

### M8 · 4 区完整数据（2-3 天，AI 整理 + 用户校对）

**新增**：`schools-haidian.json` / `schools-xicheng.json` / `schools-chaoyang.json` / `schools-dongcheng.json`
**产出**：4 区 ~200 所学校真实数据，每条带 lastVerified 字段。
**验收**：随机抽 20 所核对地址、招生范围、分校归属正确。

---

## 验证方案

**每个 M 结束后**：
1. Live Server 跑当前里程碑核心交互
2. Chrome DevTools Network 面板核对 API 调用次数与参数
3. 控制台零报错
4. 手机连同一 WiFi 用 `http://<电脑IP>:5500` 访问做真机验证

**MVP 完工后**：
1. 用 5-10 个真实北京地址跑 4 区 × 3 种通勤方式
2. 真机测试：iOS Safari + Android Chrome 各一台
3. 部署到 GitHub Pages，链接发给 1-2 位中考家长试用并收集反馈
4. 用 Lighthouse 跑性能分（目标移动端首屏 ≥85）

---

## 已知风险与缓解

### 🔴 红色风险（必须 M0 第一天验证）

| 风险 | 影响 | 缓解 |
|---|---|---|
| **高德 JS API v2.0 强制要求 `securityJsCode`**（比 Key 白名单多一层） | 配置失败则 SDK 加载报错，可能要降级 v1.4 或改用 REST 接口（架构变更） | M0 跑通"空白地图渲染"作为硬验收门槛；挂掉立刻调整方案再继续 |
| **公交 Transfer 接口是否支持 `departure_time` 参数** | 若不支持，PRD"默认 07:30 出发"实现不了，需要回退到"当前时刻算" | M0 查官方文档；不支持则修订 PRD 此条 |

### 🟡 设计漏洞（开发中要补，不阻塞 M0）

| 漏洞 | 补丁里程碑 |
|---|---|
| 快速切换通勤方式时的请求竞态（老请求覆盖新结果） | M3 加 AbortController 或请求版本号 |
| 列表地图实例与路径弹窗地图实例是否共用 | M4 定（倾向共用 + 关闭时重置 viewport） |
| 移动端键盘弹起遮挡地址输入框 | M1 加 `scrollIntoView({ block: 'center' })` |

### ⏱ 时间估算（已根据自审修正）

| 里程碑 | 工时 |
|---|---|
| M0 | 1 天（SDK + 安全密钥排查） |
| M1 | 半天 |
| M2 | 半天 |
| M3 | 2 天（三接口 + Observer + 竞态 + 真机） |
| M4 | 半天 |
| M5 | 2 小时 |
| M6 | 半天 |
| M7 | 半天 |
| M8 | 2-3 天（地址/分校/招生类型核实） |
| **MVP 总计** | **8-11 天** |

### 其他需在 README / 部署阶段处理

- GitHub Pages 子路径 `/repo-name/` 资源相对路径
- 手机真机调试：同 WiFi + Live Server 配 `host: 0.0.0.0` + 用电脑 IP
- 高德服务条款"个人/非商用"边界确认（README 标注）

---

## 开放项（不阻塞 M0 启动）

- 别名词典最终条数 → M6 时定
- 高德路径规划失败重试策略（次数/退避）→ M3 时定
- 反馈入口最终形态（mailto vs GitHub Issues）→ M5 时定
- 移动端 360px 以下窄屏适配阈值 → M4 时实测定

---

## 下一步

批准后从 **M0** 开始。M0 的**硬验收门槛**有两条：
1. Live Server 跑起来能看到空白高德地图渲染（验证 securityJsCode 配置）
2. 查清楚 Transfer 接口的 departure_time 参数支持情况（决定 F-21 是否要改）

任一未通过，停下来调整方案，不进 M1。
