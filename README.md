# 北京中考-哪个学校离我近

帮北京中考学生家长在填报志愿时评估学校通勤便利度。
输入家庭地址 + 招生区 → 一屏给出候选高中的距离、通勤时间、地图路线。

纯前端 H5，无构建工具，浏览器原生 JS。详细需求见 [docs/PRD.md](docs/PRD.md)。

---

## 启动开发环境

### 1. 装 VSCode Live Server 插件（一次性）
- VSCode 左侧 "扩展" 图标
- 搜 `Live Server`，作者 **Ritwick Dey**，点 Install

### 2. 启动
- VSCode 打开本项目根目录
- 右键 `index.html` → "Open with Live Server"
- 浏览器自动打开 `http://127.0.0.1:5500/index.html`

### 3. 手机真机调试（同 WiFi）
- 看本机 IP：cmd 里 `ipconfig` → 找 IPv4
- 手机浏览器输入 `http://<电脑IP>:5500`
- Windows 防火墙可能要放行 VSCode

---

## 申请高德地图 Key（首次必做）

本产品基于高德地图 JS API，必须有一个 Key 才能加载地图、做路径规划。
免费额度 30 万次/日，个人开发够用。

### 步骤

**1. 注册账号**
- 打开 https://lbs.amap.com/
- 用手机号注册，完成实名认证（个人开发者，免费）

**2. 创建应用**
- 控制台 → 应用管理 → 我的应用 → 创建新应用
- 应用名随意，比如 "中考通勤"

**3. 在应用下添加 Key**
- 服务平台选 **Web 端（JS API）**
- 名称随意
- 域名白名单：开发期填 `localhost`；部署到 GitHub Pages 后再追加部署域名

**4. 拿到两个值**
- **Key**：32 位字母数字
- **安全密钥（jscode）**：v2.0 必须配套使用

**5. 填进 `js/config.js`**
```js
export const AMAP_KEY = '你刚才复制的 Key';
export const AMAP_SECURITY_CODE = '你刚才复制的安全密钥';
```

### 验证 Key 工作正常
保存 config.js → Live Server 自动刷新 → 看到北京全图的地图组件 = 成功

---

## 项目结构

```
.
├── index.html               入口页面
├── README.md                本文件
├── CLAUDE.md                Claude Code 项目上下文（可选）
├── css/main.css             移动优先响应式样式
├── js/
│   ├── config.js            Key、常量、4 区、通勤方式
│   ├── app.js               主入口
│   ├── amap-loader.js       高德 SDK 动态加载
│   ├── geo.js               (M1) 距离与 adcode 校验
│   ├── data.js              (M2) 学校数据加载
│   ├── routing.js           (M3) 路径规划封装
│   ├── observer.js          (M3) 可见卡片触发器
│   ├── ui.js                (M2) 列表渲染、Toast
│   ├── storage.js           (M5) localStorage 封装
│   └── search.js            (M6) 学校名搜索
├── data/                    (M2+) 学校 JSON 数据
└── docs/
    ├── PRD.md               产品需求 v0.2
    ├── PRD-v0.1.md          PRD v0.1 历史归档
    └── IMPL-PLAN.md         实施计划与里程碑
```

## 文档导览

- [docs/PRD.md](docs/PRD.md) - 产品需求 v0.2（活跃版）
- [docs/PRD-v0.1.md](docs/PRD-v0.1.md) - PRD v0.1 历史归档
- [docs/IMPL-PLAN.md](docs/IMPL-PLAN.md) - 实施计划、里程碑 M0→M8、风险清单

## 开发节奏

按里程碑分步走，详见 IMPL-PLAN：
- **M0** 骨架与 SDK ← 当前
- M1 地址输入 + 招生区
- M2 学校列表（直线距离）
- M3 通勤方式 + 精确通勤
- M4 看路线弹窗
- M5 localStorage 记忆
- M6 学校名搜索
- M7 异常降级
- M8 4 区完整数据

---

注：本产品为个人/学习项目，非商用。数据由 AI 辅助整理，请以学校官方公告为准。
