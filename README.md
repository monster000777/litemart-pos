# LiteMart POS

基于 `Nuxt 4 + Prisma + SQLite + Tailwind CSS` 的轻量零售收银系统，支持桌面端与小程序端，适合课程实训、小型门店演示和本地开发。

当前已包含：

- 收银下单与订单历史
- 库存、供应商、采购管理
- 会员、积分、会员价
- 用户、角色权限、审计日志
- AI 经营分析与智能客服会话持久化
- `Electron` 桌面端客户端
- `uni-app` 小程序端前台 MVP

---

## 核心特性

- 🛒 **高效收银**：响应式收银界面，支持条码搜索、扫码模拟，集成会员价逻辑。
- 📦 **库存管理**：完整的进销存流程，支持供应商管理、采购入库及库存预警。
- 👥 **会员体系**：多级会员制，支持积分累积、等级折扣及详细的积分流水记录。
- 🤖 **智能助手**：内置 AI 经营分析，支持通过自然语言查询销售趋势、库存状态等。
- 🔐 **权限合规**：精细的角色访问控制 (RBAC)，完整的审计日志，保障系统安全。
- 📱 **多端协同**：提供小程序端，方便店员或顾客随时查看商品与订单信息。

---

## 环境变量说明

| 变量名             | 必填 | 说明                                                           |
| :----------------- | :--- | :------------------------------------------------------------- |
| `DATABASE_URL`     | 是   | SQLite 数据库路径，容器内部固定为 `file:/app/data/litemart.db` |
| `NUXT_AUTH_SECRET` | 是   | 用于 JWT 签名的密钥，请使用长随机字符串                        |
| `NUXT_AI_PROVIDER` | 否   | AI 服务商 (如 `openai`, `minimax`)                             |
| `NUXT_AI_API_KEY`  | 否   | AI 服务的 API Key                                              |
| `NUXT_AI_API_URL`  | 否   | AI 服务的接口地址 (如使用代理或特定供应商)                     |
| `NUXT_AI_MODEL`    | 否   | 指定使用的 AI 模型名称                                         |

---

## 快速开始

### 环境要求

- Node.js `18+`
- npm `9+`

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，至少补这几项：

```bash
DATABASE_URL=file:./dev.db
TEST_DATABASE_URL=file:./test.db
NUXT_AUTH_SECRET=你的随机密钥
```

可用下面的命令生成密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

如果需要 AI 功能，再补充：

```bash
NUXT_AI_PROVIDER=
NUXT_AI_API_KEY=
NUXT_AI_API_URL=
NUXT_AI_MODEL=
NUXT_MINIMAX_API_KEY=
NUXT_MINIMAX_API_URL=
NUXT_MINIMAX_MODEL=
```

### 3. 初始化数据库

```bash
npm run prisma:migrate
npm run prisma:seed
```

### 4. 启动开发环境

```bash
npm run dev
```

首次启动后访问本地 Nuxt 地址即可。若系统中还没有账号，可先注册管理员账号。

---

## 可直接复制的命令块

### 本地开发

```bash
npm install
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

### 生产部署

```bash
npm install
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed
npm run build
npm run preview
```

### 桌面端开发与打包 (Electron)

```bash
# 复制/准备发布用的干净数据库模板 release.db
copy prisma\dev.db prisma\release.db

# 启动桌面开发调试
npm run electron:dev

# 构建打包桌面端安装包 (.exe)
npm run electron:build
```

### Docker 快速部署

推荐使用 Docker 进行生产环境部署，以确保环境一致性并简化初始化流程。

**1. 准备环境**
确保宿主机已安装 Docker 和 Docker Compose。

**2. 配置环境变量**
复制并编辑 `.env` 文件：

```bash
cp .env.example .env
```

请务必填写 `NUXT_AUTH_SECRET`，并根据需要配置 AI 接口参数。

**3. 一键启动**

```bash
docker compose up -d --build
```

此命令将：

- 构建应用镜像。
- 启动 `db-init` 容器自动执行数据库迁移 (`prisma migrate`) 和数据填充 (`prisma seed`)。
- 启动 `app` 容器运行收银系统。
- 自动挂载 `litemart-data` 卷实现 SQLite 数据库持久化。

**4. 常用维护命令**

- **查看日志**：`docker compose logs -f app`
- **停止服务**：`docker compose down`
- **进入容器检查**：`docker exec -it litemart-pos sh`
- **重置数据库**：`docker compose down -v` (注意：这将删除所有持久化数据)

---

## CI/CD 与版本发布

项目集成了 GitHub Actions 自动化流水线，实现了从代码质检、单元测试到多端构建及 Docker 镜像发布的完整流程。

### 1. 自动化流水线流程

- **日常提交**：推送到 `master` 分支即触发。自动执行 Lint、Type Check、单元测试，并更新 `ghcr.io` 中的 `:main` 标签镜像。
- **正式发布**：推送以 `v` 开头的标签（如 `v1.0.0`）触发。除基础流程外，还将自动创建 GitHub Release。

### 2. 官方发布与产物获取 (GitHub Releases)

在仓库首页右侧的 **Releases** 页面中，您可以获取：

- **预编译后端包**：`nuxt-standalone.zip`（含所有前端 UI）。
- **微信小程序正式版包**：方便直接导入微信开发者工具进行审核发布。
- **变更日志 (Changelog)**：由流水线自动汇总的版本更新明细。
- **安全证明**：基于 GitHub 标准生成的镜像来源可信证明。

### 3. 生产环境镜像引用

在生产服务器上，推荐通过引用的方式快速部署（无需 clone 源码和构建）：

```yaml
# docker-compose.prod.yml
services:
  app:
    image: ghcr.io/<GitHub用户名>/litemart-pos:main # 或指定具体版本号 :v1.0.0
    # ... 其他配置保持一致
```

### 4. 权限配置提醒

为了让流水线正常推送镜像，请务必在仓库设置中：
`Settings -> Actions -> General -> Workflow permissions` 开启 **Read and write permissions**。

---

### 提交前检查

```bash
npm run lint
npm test
npm run build
```

### 小程序端开发

```bash
cd miniapp
npm install
npm run dev:mp-weixin
```

---

## 常用命令

### 开发与构建

```bash
npm run dev
npm run build
npm run preview
npm run electron:dev
npm run electron:build
```

### 代码检查

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

### Prisma 与数据库

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 测试

```bash
npm test
npm run test:watch
```

### 小程序端

```bash
npm run lint:miniapp
npm run lint:miniapp:fix
```

### 其他脚本

```bash
npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-membership.ts
powershell -ExecutionPolicy Bypass -File .\scripts\check-db-health.ps1
```

---

## 数据库说明

项目默认区分开发库和测试库：

- 开发库：`prisma/dev.db`
- 测试库：`prisma/test.db`

约定如下：

- 正常运行流程使用 `DATABASE_URL`
- `npm test` 自动切到 `TEST_DATABASE_URL`
- 测试不会污染开发库

如果需要恢复开发演示数据：

```bash
npm run prisma:seed
```

---

## 功能概览

### 收银与订单

- 商品加入购物车
- 会员识别、会员价结算
- 积分累计与积分抵扣
- 订单查询与退款

### 商品与库存

- 商品信息维护
- 商品图片上传
- 库存与最低库存预警
- 供应商与采购单管理

### 用户与权限

- UID + PIN 登录
- `ADMIN / MANAGER / CASHIER` 角色控制
- 审计日志记录

### AI 功能

- 经营分析问答
- 智能客服会话管理
- 聊天会话与消息持久化到数据库

### 小程序端

- 基于 `uni-app + Vue 3 + Pinia`
- 已支持登录、商品浏览、购物车、会员识别、积分抵扣、下单、订单查询
- 小程序端说明见 [miniapp/README.md](miniapp/README.md)

---

## 测试说明

当前测试覆盖重点包括：

- 会员与积分规则
- 订单金额与退款逻辑
- 商品 DTO 与图片字段
- 权限与登录逻辑
- AI 聊天会话持久化

运行测试：

```bash
npm test
```

会员全链路脚本：

```bash
npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-membership.ts
```

---

## 项目结构

```text
app/                  # 前端 UI 层 (Nuxt Pages, Components, Composables)
server/               # 后端业务层 (Nitro API, Server Middleware, Services)
prisma/               # 数据库层 (Schema 定义、数据迁移脚本、Seed 数据)
electron/             # 桌面端 (Electron 主进程及预加载脚本)
shared/               # 公共定义 (前后端共用的常量、类型定义)
scripts/              # 工具脚本 (数据库健康检查、会员测试等)
tests/                # 测试套件 (集成测试与单元测试)
public/               # 静态资源 (图片、上传的商品图存储路径)
miniapp/              # 移动端 (基于 uni-app 的独立小程序工程)
```

---

## 常见问题

### 1. 首次启动后无法登录

确认以下几点：

- `.env` 中已配置 `NUXT_AUTH_SECRET`
- 数据库已初始化
- 首次已完成管理员注册

### 2. 测试会污染开发数据吗

不会。`npm test` 默认使用 `TEST_DATABASE_URL=file:./test.db`。

### 3. Prisma generate 出现 `EPERM rename`

通常是 Windows 下 Prisma 引擎文件被占用。先关闭正在运行的 `node` / `nuxt` 进程，再执行：

```bash
npm run prisma:generate
```

### 4. 如何检查 SQLite 是否健康

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-db-health.ps1
```

输出 `ok` 表示正常。
