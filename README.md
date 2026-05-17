# LiteMart POS

基于 `Nuxt 4 + Prisma + SQLite + Tailwind CSS` 的轻量零售收银系统，适合课程实训、小型门店演示和本地开发。

当前已包含：

- 收银下单与订单历史
- 库存、供应商、采购管理
- 会员、积分、会员价
- 用户、角色权限、审计日志
- AI 经营分析与智能客服会话持久化
- `uni-app` 小程序端前台 MVP

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
app/                  前端页面、状态和组合式函数
server/               API、业务服务、鉴权中间件
prisma/               数据模型、迁移、种子数据、SQLite 数据库
shared/               前后端共享常量
scripts/              辅助脚本与检查脚本
tests/unit/           单元测试
public/               静态资源与上传文件
miniapp/              小程序端独立工程
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
