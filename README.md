# LiteMart POS

LiteMart POS 是一个基于 `Nuxt 4 + Prisma + SQLite + Tailwind CSS` 的轻量级零售收银系统，面向课程实训和中小型门店场景。项目当前已经包含收银、订单、库存、供应商、采购、账号权限、操作日志、AI 助手和会员体系。

---

## 项目现状

当前主功能包括：

- 收银台下单
- 订单历史与退款
- 库存管理
- 供应商管理
- 采购单管理
- 账号与角色权限（UID + PIN 登录）
- 审计日志
- AI 助手
- 会员体系
  - 会员建档
  - 手机号识别会员
  - 会员价
  - 积分累加
  - 积分抵扣
  - 退款积分回滚

---

## 技术栈

### 前端技术栈

- `Nuxt 4` — 负责页面路由、SSR/开发框架、全栈整合
- `Vue 3` — 负责页面与组件开发
- `TypeScript` — 负责类型约束
- `Pinia` — 负责购物车等前端状态管理
- `Tailwind CSS` — 负责页面样式
- `Lucide Vue` — 负责图标
- `@formkit/auto-animate` — 负责列表与局部交互动画

### 后端技术栈

- `Nuxt Nitro` — 负责服务端 API 运行时
- `h3` — 负责请求处理与错误抛出
- `Prisma` — 负责 ORM 和数据库访问
- `SQLite` — 负责本地数据库存储

### 工程化与开发工具

- `ESLint` — 代码规范检查
- `Prettier` — 代码格式化
- `tsx` — 直接执行 TypeScript 脚本

---

## 项目结构

```
app/
├── app.vue               Nuxt 根组件
├── layouts/              全局布局
├── pages/                页面路由
│   ├── index.vue         收银台
│   ├── orders.vue        订单历史
│   ├── inventory.vue     库存管理
│   ├── members.vue       会员管理
│   ├── suppliers.vue     供应商管理
│   ├── purchase-orders.vue  采购管理
│   ├── users.vue         用户管理
│   ├── logs.vue          操作日志
│   ├── insights.vue      AI 经营分析（周报）
│   ├── dashboard.vue      实时经营大屏（30s 自动刷新）
│   ├── settings.vue       个人信息 / PIN / 邀请码管理
│   ├── ai.vue            AI 助手
│   └── login.vue         登录页
├── stores/               Pinia 状态
│   └── useCart.ts       购物车与会员结算状态
├── composables/          组合式工具
│   ├── use-api-error.ts  API 错误提取
│   ├── use-format.ts     金额/时间格式化
│   └── use-toast.ts     提示消息
├── components/ui/        UI 组件
├── middleware/           前端路由中间件
└── types/               前端类型定义

server/
├── api/                  后端接口
│   ├── auth/             登录、注册、会话、用户管理
│   ├── orders/           下单、退款、订单查询
│   ├── products/         商品查询与维护
│   ├── customers/         会员管理接口
│   ├── suppliers/         供应商接口
│   ├── purchase-orders/   采购接口
│   ├── audit-logs/        审计日志接口
│   ├── insights/          看板与 AI 分析接口
│   └── upload.post.ts     图片上传
├── services/              业务服务层
│   ├── order-service.ts          下单逻辑
│   ├── order-refund-service.ts   退款逻辑
│   ├── customer-service.ts        会员逻辑
│   ├── product-service.ts         商品映射与工具
│   ├── supplier-service.ts        供应商逻辑
│   ├── purchase-service.ts       采购逻辑
│   ├── audit-service.ts           审计日志逻辑
│   └── rbac-service.ts           权限判定逻辑
├── middleware/           服务端中间件
│   └── auth.ts          登录态与接口权限控制
├── lib/                  基础设施
│   ├── prisma.ts        Prisma 单例
│   └── schema-bootstrap.ts  SQLite 自动补表/补字段
└── utils/               工具函数

prisma/
├── schema.prisma         Prisma 数据模型
├── migrations/            迁移记录
├── dev.db                开发数据库
└── seed.ts               种子数据

shared/
└── constants/            前后端共享常量

scripts/
├── test-membership.ts    会员全链路测试
├── verify-seed.ts       种子数据完整性验证
└── check-db-health.ps1   SQLite 健康检查脚本
```

### 结构分层说明

- `app/pages` — 负责页面展示与用户交互
- `app/stores` — 负责前端本地状态，当前最核心的是购物车和会员结算信息
- `server/api` — 只做请求入口、参数读取、错误返回、调用 service
- `server/services` — 放真正的业务逻辑
- `prisma/schema.prisma` — 负责数据库结构定义
- `scripts` — 放独立测试与运维辅助脚本

---

## 环境要求

- Node.js `18+`
- npm `9+`
- Windows PowerShell

本项目默认使用 SQLite，本地无需额外安装 MySQL / PostgreSQL。

---

## 安装与启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，或直接补全 `.env`。

最少需要确认这些变量：

```bash
DATABASE_URL=file:./dev.db
NUXT_AUTH_SECRET=
NUXT_ADMIN_PIN=
NUXT_AI_PROVIDER=
NUXT_AI_API_KEY=
NUXT_AI_API_URL=
NUXT_AI_MODEL=
NUXT_MINIMAX_API_KEY=
NUXT_MINIMAX_API_URL=
NUXT_MINIMAX_MODEL=
```

说明：

- `DATABASE_URL` — Prisma 的数据库连接地址，当前项目使用 SQLite，`file:./dev.db` 表示数据库文件位于 `prisma/dev.db`
- `NUXT_AUTH_SECRET` — 登录态签名密钥，建议使用 32 位以上随机字符串
- `NUXT_ADMIN_PIN` — 初始管理员 PIN，如果未配置，首访时可走注册流程
- `NUXT_AI_*` — AI 能力相关配置，不使用 AI 时可留空

### `NUXT_AUTH_SECRET` 如何生成

这个值用于登录态签名，不能太短，也不要写成固定弱口令。建议生成 32 位以上随机字符串。

#### PowerShell 生成方式

```powershell
[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
```

示例输出：

```
3f2d4b3a5f2c4f8e8e1a2b6d9c0f7e3d7a1b5c9d3e2f4a6b8c1d2e3f4a5b6c7d
```

把它写入 `.env`：

```bash
NUXT_AUTH_SECRET=这里替换成你生成的随机字符串
```

#### Node.js 生成方式

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### OpenSSL 生成方式

```bash
openssl rand -hex 32
```

### 更换 `NUXT_AUTH_SECRET` 的影响

如果你修改了 `NUXT_AUTH_SECRET`：

- 旧登录态会全部失效
- 需要重新登录

这是正常现象，不是故障。

### 3. 生成 Prisma Client

```bash
npm run prisma:generate
```

### 4. 启动项目

```bash
npm run dev
```

默认启动后访问本地 Nuxt 开发地址即可。

---

## 常用命令

```bash
npm run dev          # 开发
npm run build        # 构建
npm run preview      # 预览

npm run lint         # 检查
npm run lint:fix     # 自动修复

npm run format       # 格式化
npm run format:check # 格式化检查

npm run prisma:generate  # 生成 Client
npm run prisma:migrate   # 迁移
npm run prisma:seed      # 种子数据
```

---

## 数据库说明

### 开发库

- 文件：`prisma/dev.db`
- 作用：本地开发运行使用

### 测试库

- 文件：`prisma/test-membership.db`
- 作用：会员全链路测试专用
- 特点：由测试脚本自动创建，测试前会删除旧文件并重建，不污染 `dev.db`

### 为什么有 `DATABASE_URL=file:./dev.db`

这是 Prisma 的数据库连接配置。当前 `prisma/schema.prisma` 里使用：

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

因此：

- 项目运行时默认读取 `.env` 中的 `DATABASE_URL`
- 开发环境连接 `dev.db`
- 测试脚本可临时切换到其他数据库文件

### 数据库健康检查

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-db-health.ps1
```

预期输出：

```
ok
```

如果不是 `ok`，说明数据库可能存在损坏、索引异常或文件访问问题。

---

## 种子数据

```bash
npm run prisma:seed
```

会写入基础商品、供应商、采购和订单示例数据。

注意：当前 seed 主要覆盖基础业务数据，如果你重置数据库后想演示会员价，建议手动在库存页给部分商品设置 `memberPrice`。

---

## 登录与权限

### 登录方式

采用 **账号名称 + PIN** 两步登录：

1. 输入账号名称（即用户管理中的"账号名称"）
2. 输入 6 位数字 PIN

首次访问时，若未创建账号，会引导注册首个管理员账号。

### 角色体系

项目内主要角色：`ADMIN`、`MANAGER`、`CASHIER`

权限概览：

| 角色      | 权限范围                             |
| --------- | ------------------------------------ |
| `CASHIER` | 收银台、订单查看                     |
| `MANAGER` | + 库存、供应商、采购、会员、Insights |
| `ADMIN`   | + 用户管理、审计日志                 |

### 用户管理

管理员可在 `/users` 页面：

- 创建账号（设置名称、角色、PIN）
- 编辑账号名称和角色
- 重置账号 PIN
- 启用/停用账号
- 删除账号

会员管理页面路径：`/members`

---

## 会员体系说明

### 数据模型

会员体系新增了这些核心模型/字段：

- `Customer` — 手机号、姓名、积分、等级
- `PointLog` — 积分变动记录
- `Product.memberPrice` — 会员价
- `Order.memberId` — 关联会员
- `Order.pointsUsed` — 使用积分
- `Order.pointsEarned` — 获得积分
- `Order.discountAmount` — 抵扣金额

### 当前业务规则

- 手机号作为会员唯一识别
- 已移除基于手机号尾号的旧识别/找单方式
- 会员价优先于普通售价
- 消费积分规则：`1 元 = 1 积分`
- 积分抵扣规则：`100 积分 = 1 元`，抵扣上限不超过订单金额的 `50%`
- 退款回滚：恢复库存 + 回滚积分变化

### 订单检索说明

- 当前订单页仅支持按订单号、状态和日期筛选
- 历史的 `customerTail` 字段与尾号找单流程已移除

### 前端入口

- 会员管理页：`/members`
- 收银台：`/`
- 商品会员价设置：`/inventory`

### 商品会员价设置

现在库存页商品编辑表单已经支持普通售价 `price` 和会员价 `memberPrice`。当收银台识别到会员时，若商品设置了 `memberPrice`，结算按会员价计算。

---

## 测试

### 单元测试

```bash
npm test          # 单次运行
npm run test:watch # 监听模式
```

测试覆盖核心服务的纯函数逻辑：

| 文件                       | 测试点                             |
| -------------------------- | ---------------------------------- |
| `customer-service.test.ts` | 手机号校验、等级判断、积分计算     |
| `order-service.test.ts`    | 金额舍入、会员价选择、积分抵扣计算 |
| `product-service.test.ts`  | 图片URL校验、DTO转换               |
| `auth-service.test.ts`     | PIN格式校验、token编解码           |
| `rbac-service.test.ts`     | 角色层级判断、API路由权限控制      |

测试文件位于 `tests/unit/`，使用 vitest 框架。

### 会员全链路测试

```bash
npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-membership.ts
```

该测试覆盖：创建会员 → 创建带会员价商品 → 会员价下单 → 积分累加 → 积分抵扣 → 订单金额校验 → 退款 → 退款后积分回滚 → 退款后库存恢复

通过时输出：

```
membership tests passed
```

### lint 检查

```bash
npm run lint
```

---

## 已处理的数据库问题

项目开发过程中，`prisma/dev.db` 曾出现过 SQLite 索引损坏问题。当前已经完成损坏索引修复、完整性检查与健康检查脚本补充。目前结论：

- `dev.db` 可正常使用
- 会员功能与测试已验证通过
- 测试使用独立测试库，不会污染开发库

---

## 常见问题

### 1. `prisma generate` 报 `EPERM rename query_engine-windows.dll.node`

原因：Windows 下 Prisma 引擎 DLL 被占用，常见于 `npm run dev`、测试脚本或其他 Node 进程未退出。

处理方式：停掉所有相关 `node` / `nuxt` 进程，再执行 `npm run prisma:generate`。

### 2. 会员测试不想污染开发数据

直接使用：

```bash
npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-membership.ts
```

这个脚本会自动切到 `test-membership.db`。

### 3. 想删除测试库

```powershell
Remove-Item .\prisma\test-membership.db -Force
```

### 4. 数据库是否健康

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-db-health.ps1
```

输出 `ok` 即正常。

---

## 关键文件

会员体系相关核心文件：

- `prisma/schema.prisma`
- `server/services/customer-service.ts`
- `server/services/order-service.ts`
- `server/services/order-refund-service.ts`
- `server/api/customers/index.post.ts`
- `server/api/customers/lookup.get.ts`
- `app/pages/members.vue`
- `app/pages/index.vue`
- `app/pages/inventory.vue`
- `scripts/test-membership.ts`

---

## 建议的日常使用流程

### 正常开发

```bash
npm install && npm run prisma:generate && npm run dev
```

### 提交前检查

```bash
npm run lint
npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-membership.ts
```

### 数据库体检

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-db-health.ps1
```
