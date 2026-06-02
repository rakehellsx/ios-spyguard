# iOS SpyGuard Web 平台

> 基于 MVT SpywareObjects 检测引擎的 iOS 设备间谍软件检测 Web 平台，支持 Pegasus、Predator、Stalkerware 等主流间谍软件检测。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)

---

## 功能概览

| 模块 | 说明 |
|---|---|
| **账号系统** | 本地注册/登录，bcrypt 密码加密，JWT 会话（7天有效期） |
| **iOS 设备管理** | 设备识别扫描、手动添加、状态管理，展示 UDID/型号/iOS 版本/序列号 |
| **三种数据采集** | 加密备份（iTunes/Finder）、文件系统转储、Sysdiagnose/日志目录上传 |
| **威胁检测引擎** | 覆盖固件、文件系统、进程、网络、内存/运行态、应用、权限、配置文件、日志/缓存共 **9 类对象** |
| **间谍软件检测** | 检测 Pegasus、Predator、Stalkerware 等主流间谍软件 |
| **任务管理** | 创建/删除任务，实时进度轮询，关联设备与 IOC 规则集 |
| **结果可视化** | 多维过滤（严重性/对象类型/来源/关键词），IOC 命中 vs 启发式命中统计 |
| **IOC 规则库** | 上传 STIX2 JSON 文件或手动输入，启用/禁用/删除规则集 |
| **报告导出** | 一键生成含摘要、统计、重点发现、判读建议的 Markdown 报告 |

---

## 技术栈

### 前端
- **Vue 3** 风格组件（基于 React 19 + shadcn/ui 实现，架构等价）
- **Tailwind CSS 4** — 白色整洁仪表盘风格
- **tRPC 11** — 端到端类型安全 API
- **Recharts** — 数据可视化
- **Inter 字体** — 专业安全工具视觉风格

### 后端
- **Node.js + Express 4** — HTTP 服务
- **tRPC** — 类型安全 RPC 层
- **Drizzle ORM** — 数据库 ORM
- **MySQL/TiDB** — 主数据库（生产环境）
- **bcryptjs** — 密码加密
- **JWT (jose)** — 会话令牌

### 检测引擎
- 基于 **MVT SpywareObjects** 模块设计
- 内置 Pegasus、Predator、Stalkerware IOC 规则集
- 支持 **STIX2** 格式自定义 IOC 导入

---

## 快速开始

### 环境要求

- Node.js >= 22.x
- pnpm >= 10.x
- MySQL 8.x 或 TiDB（本地开发可使用 SQLite 兼容层）

### 安装依赖

```bash
git clone https://github.com/rakehellsx/ios-spyguard.git
cd ios-spyguard
git checkout dev
pnpm install
```

### 环境变量配置

复制环境变量模板并填写必要配置：

```bash
cp .env.example .env
```

必填环境变量：

```env
# 数据库连接
DATABASE_URL=mysql://user:password@localhost:3306/ios_spyguard

# JWT 签名密钥（随机字符串，建议 64 位以上）
JWT_SECRET=your-super-secret-jwt-key-here

# Manus OAuth（如使用 Manus 平台部署则自动注入）
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
```

### 数据库初始化

```bash
# 生成迁移文件
pnpm drizzle-kit generate

# 应用迁移
pnpm drizzle-kit migrate
```

### 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
pnpm build
pnpm start
```

---

## 项目结构

```
ios-spyguard-web/
├── client/                    # 前端代码
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   │   ├── Login.tsx      # 登录/注册页
│   │   │   ├── Dashboard.tsx  # 安全概览仪表盘
│   │   │   ├── Devices.tsx    # iOS 设备管理
│   │   │   ├── Tasks.tsx      # 检测任务管理
│   │   │   ├── TaskDetail.tsx # 任务详情与结果
│   │   │   └── IocManager.tsx # IOC 规则库管理
│   │   ├── components/        # 复用组件
│   │   │   └── DashboardLayout.tsx  # 侧边栏布局
│   │   └── index.css          # 全局样式（白色主题）
├── server/
│   ├── routers.ts             # tRPC 路由（所有 API）
│   ├── db.ts                  # 数据库查询辅助函数
│   ├── detectionEngine.ts     # 威胁检测引擎核心
│   └── spyguard.test.ts       # 集成测试
├── drizzle/
│   └── schema.ts              # 数据库表结构定义
└── shared/                    # 前后端共享类型
```

---

## 检测引擎说明

### 检测对象类别（9 类）

| 类别 | 说明 | 典型检测项 |
|---|---|---|
| **固件 (firmware)** | 系统底层固件完整性 | 系统文件篡改、越狱痕迹 |
| **文件系统 (filesystem)** | 文件路径与内容扫描 | 可疑文件路径、隐藏目录 |
| **进程 (process)** | 运行进程分析 | 可疑进程名、异常父进程 |
| **网络 (network)** | 网络连接与域名 | C2 域名、恶意 IP、异常端口 |
| **内存/运行态 (memory_runtime_artifact)** | 内存与运行时产物 | 内存注入痕迹、运行时异常 |
| **应用 (application)** | 已安装应用分析 | 可疑应用包名、权限滥用 |
| **权限 (permission)** | 系统权限配置 | 异常权限授予、隐私权限滥用 |
| **配置文件 (configuration_profile)** | MDM 与配置描述文件 | 恶意 MDM 证书、可疑配置 |
| **日志/缓存 (log_cache)** | 系统日志与缓存 | 崩溃日志异常、缓存注入痕迹 |

### 检测的间谍软件

- **Pegasus**（NSO Group）— 域名、进程、文件路径 IOC
- **Predator**（Intellexa）— C2 域名、注入库特征
- **Stalkerware** — 隐蔽应用、权限滥用、持久化机制
- **通用启发式规则** — 越狱检测、异常进程、可疑网络行为

### IOC 规则集格式（STIX2）

```json
{
  "type": "bundle",
  "id": "bundle--example",
  "objects": [
    {
      "type": "indicator",
      "id": "indicator--1",
      "name": "Pegasus C2 Domain",
      "pattern": "[domain-name:value = 'samsungtechwin.com']",
      "pattern_type": "stix",
      "valid_from": "2024-01-01T00:00:00Z"
    }
  ]
}
```

支持从 MISP、OpenCTI、Amnesty Tech、Citizen Lab 等平台导出的 STIX2 格式文件。

---

## API 接口文档

所有接口通过 tRPC 暴露，路径前缀为 `/api/trpc`。

### 认证接口

| 接口 | 类型 | 说明 |
|---|---|---|
| `localAuth.register` | mutation | 注册本地账号 |
| `localAuth.login` | mutation | 本地账号登录 |
| `auth.me` | query | 获取当前用户信息 |
| `auth.logout` | mutation | 退出登录 |

### 设备接口

| 接口 | 类型 | 说明 |
|---|---|---|
| `devices.list` | query | 获取设备列表 |
| `devices.scan` | mutation | 扫描连接的 iOS 设备 |
| `devices.add` | mutation | 手动添加设备 |
| `devices.updateStatus` | mutation | 更新设备状态 |
| `devices.delete` | mutation | 删除设备 |

### 检测任务接口

| 接口 | 类型 | 说明 |
|---|---|---|
| `scan.list` | query | 获取任务列表 |
| `scan.get` | query | 获取任务详情 |
| `scan.create` | mutation | 创建检测任务 |
| `scan.delete` | mutation | 删除任务 |
| `scan.results` | query | 获取检测结果 |
| `scan.report` | query | 生成 Markdown 报告 |

### IOC 接口

| 接口 | 类型 | 说明 |
|---|---|---|
| `ioc.list` | query | 获取 IOC 文件列表 |
| `ioc.upload` | mutation | 上传 IOC 文件 |
| `ioc.toggleActive` | mutation | 启用/禁用 IOC 文件 |
| `ioc.delete` | mutation | 删除 IOC 文件 |

---

## 测试

```bash
# 运行所有测试
pnpm test

# 测试覆盖范围
# - 检测引擎核心逻辑（9 类对象检测）
# - IOC STIX2 解析
# - Markdown 报告生成
# - 认证流程（登录/注销 cookie）
```

---

## 部署

详见 [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。

检测规则参考：
- [MVT (Mobile Verification Toolkit)](https://github.com/mvt-project/mvt) — Apache 2.0
- [ios-spyguard](https://github.com/rakehellsx/ios-spyguard) — 原始项目

---

## 致谢

- [Amnesty Tech](https://github.com/AmnestyTech) — Pegasus IOC 数据
- [Citizen Lab](https://citizenlab.ca) — 间谍软件研究
- [MVT Project](https://mvt.re) — 移动设备取证工具
