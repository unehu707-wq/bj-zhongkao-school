# Claude Code 项目上下文

## 项目一句话
北京中考-哪个学校离我近：纯前端 H5 工具，帮家长在填报志愿时按"通勤便利度"评估高中。

## 技术栈硬约束（不要建议变更）
- **纯前端**，不引入任何后端
- **无构建工具**，不要建议 webpack/vite/rollup
- **无 npm install 依赖**，所有代码必须浏览器原生可跑
- **不引入框架**，不要建议 React/Vue/Angular
- 浏览器原生 ES modules + fetch
- 本地开发用 VSCode Live Server 插件
- 地图基于**高德 JS API v2.0**

## 当前里程碑
M0 · 骨架与 SDK 集成。M0 硬验收门槛：
1. Live Server 跑起来看到空白高德地图渲染
2. 验证 Transfer 接口是否支持 `departure_time` 参数

## 文档索引
- [docs/PRD.md](docs/PRD.md) - 产品需求 v0.2（活跃版，权威需求来源）
- [docs/PRD-v0.1.md](docs/PRD-v0.1.md) - PRD v0.1 历史归档
- [docs/IMPL-PLAN.md](docs/IMPL-PLAN.md) - 实施计划、M0→M8 里程碑、风险清单
- [README.md](README.md) - 启动方法、Key 申请

## 关键文件
- `js/config.js` - `__AMAP_KEY__` 与 `__AMAP_SECURITY_CODE__` 是**占位符**，不是 bug；由用户手动填入
- `js/amap-loader.js` - 高德 SDK 动态加载，v2.0 必须配 securityJsCode

## 协作约定
- 代码注释极简，禁止写无信息量的 "// 这里做 X"
- 不要主动添加未在 PRD 中列出的功能
- 修改前看一下 PRD 对应功能编号（F-01 ~ F-12 / F-21 ~ F-22 / F-31 ~ F-33）
- 遇到 PRD 没覆盖的设计问题，先问用户再实现
- 工时估算保守值见 IMPL-PLAN "时间估算"章节

## 数据约定
- 学校数据 JSON 按区分割，schema 见 PRD 第 5 节
- 分校与本部独立条目，通过 `parentSchool` 关联
- 每条带 `lastVerified` 字段（YYYY-MM）
