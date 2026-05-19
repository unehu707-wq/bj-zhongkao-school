# Claude Code 项目上下文

## 项目一句话
北京中考-哪个学校离我近：纯前端 H5 工具，帮家长在填报志愿时按"通勤便利度"评估高中。

## 当前状态
**MVP 完工**。PRD v0.2 所有 P0 (F-01 ~ F-12) 已实现，9 个 git commit 对应 M0→M8。
下一步候选：部署上线（GitHub Pages / Vercel）、完善 enrichments、做 P1 功能。

## 技术栈硬约束（不要建议变更）
- **纯前端**，不引入任何后端
- **无构建工具**，不要建议 webpack/vite/rollup
- **无 npm install 依赖**，所有代码必须浏览器原生可跑
- **不引入框架**，不要建议 React/Vue/Angular
- 浏览器原生 ES modules + fetch
- 本地开发用 VSCode Live Server 插件
- 地图基于**高德 JS API v2.0**

## 文档索引
- [docs/PRD.md](docs/PRD.md) - 产品需求 v0.2（权威需求来源）
- [docs/PRD-v0.1.md](docs/PRD-v0.1.md) - PRD v0.1 历史归档
- [docs/IMPL-PLAN.md](docs/IMPL-PLAN.md) - 实施计划、M0→M8 里程碑、风险清单
- [data/README.md](data/README.md) - 学校数据 schema + enrichments 编辑指南
- [README.md](README.md) - 启动方法、Key 申请

## 关键架构决策（动之前先理解）

### 数据层（M8 决定）
- 学校的 name/address/lng/lat **从高德 PlaceSearch 实时拉**，不是静态 JSON
- 政策性字段（admissionScope/aliases/shortName/isBranch/hasInternationalDept）由 `data/enrichments.json` 手动补充，按 name 键 merge
- 30 天 localStorage 缓存，刷新页面秒开
- **QPS 防护是必需的，不要简化**：页之间 700ms 间隔 + 区之间 1500ms + CUQPS 报错指数退避重试 + in-flight Map 去重。免费 Key QPS 上限很低，去掉任何一层都会 CUQPS_HAS_EXCEEDED_THE_LIMIT 报错

### F-12 设计偏离 PRD（M6 决定）
- PRD 原文："命中后直接进入该校详情，跳过选区"
- **实际实现**：搜索框 = "选一所特别关注的学校" 入口，命中后 pin 到 chip 而非跳转；查询后该校出现在"★ 我特别关注的"区，本区列表 dedup 掉它
- 价值：跨区/分校 pin 入列表后能和本区候选并排比通勤
- 如果用户问起 F-12 行为，说明这个偏离

### M4 全屏路线视图（用 body class 切换）
- 点"看路线" → body 加 `route-view` class → CSS 隐藏其余 UI + map 变 100vh
- **复用主地图实例**，不另起 modal map（之前 attempt 1 stash 在 git stash 里，因 modal sizing 问题废弃）
- 切完 class 后 setTimeout 100ms 调 `map.resize()` 让 AMap 重新测量容器
- `[hidden] !important` CSS 规则必需，防止 `display: flex` 覆盖 `hidden` 属性

### 协作约定
- 代码注释极简，禁止写无信息量的 "// 这里做 X"
- 不要主动添加未在 PRD 中列出的功能
- 修改前看一下 PRD 对应功能编号
- 遇到 PRD 没覆盖的设计问题，先问用户再实现
- 提交前自审一遍代码（用户多次强调）

## 关键文件速查

| 文件 | 作用 |
|---|---|
| `index.html` | 入口 + 全部 DOM 结构 |
| `css/main.css` | 全部样式，移动优先响应式 |
| `js/app.js` | 主流程串联，事件绑定 |
| `js/amap-loader.js` | 高德 SDK 动态加载（v2.0 + securityJsCode） |
| `js/amap-schools.js` | 高德 PlaceSearch 拉学校 + QPS 限流 + localStorage 缓存 |
| `js/data.js` | 合并 AMap + enrichments 给 UI |
| `js/geo.js` | Haversine + adcode 校验 |
| `js/routing.js` | driving / transit / riding 三接口封装 + 在地图上画路线 |
| `js/observer.js` | IntersectionObserver 工厂 |
| `js/ui.js` | 列表/卡片/tab/chip 渲染 + 简称别名 escapeHtml |
| `js/search.js` | 学校名/别名子串匹配 + 前缀优先 |
| `js/storage.js` | localStorage 封装（地址/区/方式记忆） |
| `js/config.js` | 高德 Key、常量、4 区枚举、FEEDBACK_EMAIL 占位符 |
| `data/enrichments.json` | 16 所顶部学校的政策性补丁（用户维护） |

## v0.3 候选改进（不阻塞）
- F-11 反馈渠道升级（mailto → 腾讯问卷 / 微信，因 mailto 对中考家长 UX 极差）
- 数据 source/url 字段、API 结果缓存优化、隐私二次提示
- F-21 自定义出发时间、F-22 多校并排对比（已在 PRD P1）
- 复制/分享链接、浏览器定位按钮
- 别名词典扩充、校区/分校关系完善
- 部署后追加域名到高德 Key 白名单

## 部署相关注意
- 部署前需在 `js/config.js` 把 `FEEDBACK_EMAIL` 占位符改成真实邮箱（或先改成腾讯问卷链接，参考 v0.3 候选）
- 部署到 GitHub Pages 时，路径有子目录前缀 `/repo-name/`，相对路径资源已经做了正确处理
- 部署后回高德 LBS 控制台把部署域名追加到 Key 白名单（如 `*.github.io` / `username.github.io`）
- 高德 Key 已在前端 HTML 里暴露：当前由"安全密钥 + 域名白名单 + 每日 20000 上限"三重保护
