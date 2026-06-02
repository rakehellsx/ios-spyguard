# iOS SpyGuard Web 平台 TODO

## 数据库与后端基础
- [x] 扩展 drizzle schema：users(本地账号)、devices、scan_tasks、scan_results、ioc_files
- [x] 执行数据库迁移 SQL
- [x] 实现本地账号注册/登录 API（bcrypt + JWT）
- [x] 实现设备列表 CRUD API
- [x] 实现数据采集任务 API（三种采集方式）
- [x] 实现文件上传 API（sysdiagnose/IOC 文件）
- [x] 实现检测引擎 API（模拟 MVT SpywareObjects 检测逻辑）
- [x] 实现 IOC 规则库 CRUD API
- [x] 实现检测结果查询 API
- [x] 实现 Markdown 报告生成与导出 API

## 前端页面
- [x] 全局样式：白色背景、专业安全工具风格
- [x] 登录页面（本地账号密码登录）
- [x] 注册页面（本地账号注册）
- [x] DashboardLayout 侧边栏导航（含所有功能入口）
- [x] 首页/仪表盘（统计概览：设备数、任务数、威胁数）
- [x] iOS 设备管理页（设备列表、连接状态、型号/版本/UDID）
- [x] 数据采集页（三种采集方式选择与配置）
- [x] 检测任务管理页（创建、查看、删除、进度状态）
- [x] 检测结果详情页（按对象类别/严重性统计、命中详情表格）
- [x] IOC 规则库管理页（上传 STIX2 文件、规则集列表）
- [x] 报告导出功能（生成 Markdown 报告下载）

## 测试
- [x] 后端 API 单元测试（vitest）：auth.logout 通过
- [x] TypeScript 编译无错误
- [x] 前端路由与页面集成验证
