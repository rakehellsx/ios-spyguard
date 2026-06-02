# 部署文档

本文档说明 iOS SpyGuard Web 平台的各种部署方式。

---

## 目录

- [环境要求](#环境要求)
- [本地开发部署](#本地开发部署)
- [Docker 部署](#docker-部署)
- [生产环境部署（Manus 平台）](#生产环境部署manus-平台)
- [生产环境部署（自托管）](#生产环境部署自托管)
- [环境变量参考](#环境变量参考)
- [数据库管理](#数据库管理)
- [常见问题](#常见问题)

---

## 环境要求

| 组件 | 最低版本 | 推荐版本 |
|---|---|---|
| Node.js | 18.x | 22.x |
| pnpm | 9.x | 10.x |
| MySQL | 8.0 | 8.0+ |
| 内存 | 512 MB | 1 GB+ |
| 磁盘 | 1 GB | 5 GB+（含采集数据） |

---

## 本地开发部署

### 1. 克隆仓库

```bash
git clone https://github.com/rakehellsx/ios-spyguard.git
cd ios-spyguard
git checkout dev
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写必要配置（参见[环境变量参考](#环境变量参考)）。

### 4. 初始化数据库

```bash
# 生成迁移文件
pnpm drizzle-kit generate

# 应用迁移到数据库
pnpm drizzle-kit migrate
```

### 5. 启动开发服务器

```bash
pnpm dev
```

服务启动后访问：[http://localhost:3000](http://localhost:3000)

### 6. 创建管理员账号

首次访问时，在注册页面创建账号。**第一个注册的账号将自动获得管理员权限**。

---

## Docker 部署

### 使用 Docker Compose（推荐）

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://spyguard:password@db:3306/ios_spyguard
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: ios_spyguard
      MYSQL_USER: spyguard
      MYSQL_PASSWORD: password
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10
    restart: unless-stopped

volumes:
  mysql_data:
```

创建 `Dockerfile`：

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

启动服务：

```bash
# 生成强随机 JWT_SECRET
export JWT_SECRET=$(openssl rand -hex 32)

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 执行数据库迁移
docker-compose exec app node -e "
  const { drizzle } = require('drizzle-orm/mysql2');
  // 迁移逻辑
"
```

---

## 生产环境部署（Manus 平台）

本项目已针对 Manus 平台进行优化，支持一键部署。

### 部署步骤

1. 在 Manus 平台打开项目管理界面
2. 点击右上角 **Publish** 按钮
3. 平台将自动完成构建与部署
4. 部署完成后获得专属域名（格式：`xxx.manus.space`）

### 自定义域名

1. 在 Manus 管理界面进入 **Settings → Domains**
2. 修改自动生成的子域名前缀，或绑定自有域名
3. 按提示完成 DNS 配置（CNAME 记录）

### 环境变量管理

Manus 平台自动注入以下系统环境变量，无需手动配置：

- `DATABASE_URL` — 数据库连接字符串
- `JWT_SECRET` — JWT 签名密钥
- `VITE_APP_ID` — 应用 ID
- `OAUTH_SERVER_URL` — OAuth 服务地址
- `BUILT_IN_FORGE_API_KEY` — 内置 API 密钥

---

## 生产环境部署（自托管）

### 使用 PM2 进程管理

```bash
# 全局安装 PM2
npm install -g pm2

# 构建项目
pnpm build

# 使用 PM2 启动
pm2 start dist/index.js --name ios-spyguard \
  --env production \
  -i max  # 使用所有 CPU 核心

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs ios-spyguard
```

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # 上传文件大小限制（用于 IOC 文件上传）
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 180s;
    }
}
```

### 使用 Let's Encrypt 申请 SSL 证书

```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d your-domain.com

# 自动续期（已由 Certbot 配置 cron）
certbot renew --dry-run
```

---

## 环境变量参考

| 变量名 | 必填 | 说明 | 示例值 |
|---|---|---|---|
| `DATABASE_URL` | ✅ | MySQL 连接字符串 | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | ✅ | JWT 签名密钥（建议 64 位随机字符串） | `openssl rand -hex 32` 的输出 |
| `NODE_ENV` | ✅ | 运行环境 | `production` |
| `PORT` | ❌ | 服务监听端口（默认 3000） | `3000` |
| `VITE_APP_ID` | ❌ | Manus OAuth 应用 ID | `app-xxx` |
| `OAUTH_SERVER_URL` | ❌ | Manus OAuth 服务地址 | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | ❌ | Manus 登录门户地址 | `https://manus.im` |
| `BUILT_IN_FORGE_API_KEY` | ❌ | Manus 内置 API 密钥 | 由平台注入 |
| `BUILT_IN_FORGE_API_URL` | ❌ | Manus 内置 API 地址 | 由平台注入 |

---

## 数据库管理

### 数据库迁移

```bash
# 生成新的迁移文件（修改 drizzle/schema.ts 后执行）
pnpm drizzle-kit generate

# 应用迁移
pnpm drizzle-kit migrate

# 查看迁移状态
pnpm drizzle-kit status
```

### 数据库备份

```bash
# MySQL 备份
mysqldump -u user -p ios_spyguard > backup_$(date +%Y%m%d).sql

# 恢复
mysql -u user -p ios_spyguard < backup_20240101.sql
```

### 手动提升用户为管理员

```sql
UPDATE local_accounts SET role = 'admin' WHERE username = 'your-username';
```

---

## 常见问题

### Q: 启动时报 `DATABASE_URL is not defined`

确保 `.env` 文件存在且包含 `DATABASE_URL`，或在启动命令中直接传入：

```bash
DATABASE_URL="mysql://..." JWT_SECRET="..." pnpm dev
```

### Q: 数据库迁移失败

检查数据库用户是否有 `CREATE TABLE`、`ALTER TABLE` 权限：

```sql
GRANT ALL PRIVILEGES ON ios_spyguard.* TO 'user'@'%';
FLUSH PRIVILEGES;
```

### Q: 上传 IOC 文件失败

检查 Nginx 的 `client_max_body_size` 配置，默认限制 1MB，建议设置为 50MB 以上。

### Q: 检测任务一直处于 `pending` 状态

检查服务器日志，确认检测引擎没有抛出异常：

```bash
pm2 logs ios-spyguard --lines 100
```

### Q: 如何接入真实 iOS 设备

当前版本的设备扫描为模拟实现。接入真实设备需要：

1. 在服务器上安装 [libimobiledevice](https://libimobiledevice.org/)：
   ```bash
   apt install libimobiledevice-utils
   ```
2. 通过 USB 连接 iOS 设备并信任电脑
3. 修改 `server/routers.ts` 中的 `devices.scan` 过程，调用 `ideviceinfo` 命令行工具获取真实设备信息

### Q: 如何更新 IOC 规则库

1. 从 Amnesty Tech、Citizen Lab 等机构下载最新 STIX2 格式 IOC 文件
2. 在平台 **IOC 规则库** 页面点击「上传 IOC 文件」
3. 上传后系统自动解析指标数量并在下次检测时生效

---

## 安全建议

1. **生产环境务必使用 HTTPS**，避免 JWT Token 在传输中被截获
2. **定期轮换 JWT_SECRET**，轮换后所有用户需重新登录
3. **限制管理员账号数量**，避免权限过度分散
4. **定期更新 IOC 规则库**，保持对最新间谍软件的检测能力
5. **数据库定期备份**，检测结果数据具有取证价值，需妥善保存
6. **网络隔离**，建议将平台部署在内网或 VPN 保护的环境中，避免公网暴露
