# LiteMart POS

轻量级社区零售/核销工作台（Nuxt 3 + Prisma + SQLite + Tailwind）。

## 技术栈

- Nuxt 3（Vue 3 + Nitro）
- TypeScript
- Prisma + SQLite
- Tailwind CSS
- Lucide Vue / Auto Animate

## 本地启动

```bash
npm install
npm run prisma:migrate
npm run prisma:generate
npm run dev
```

## 常用命令

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run format:check
npm run format
npm run prisma:migrate
npm run prisma:generate
npx prisma db seed
```

## 环境变量

创建 `.env`（可参考 `.env.example`）：

```bash
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

- `NUXT_AI_PROVIDER`：可选；建议填 `openai-compatible` 或 `minimax`，未设置时自动判断
- `NUXT_AI_API_KEY`：可选；通用 AI 接口密钥，不配置时使用本地兜底简报
- `NUXT_AI_API_URL`：可选；通用聊天补全接口地址（支持 OpenAI 兼容接口）
- `NUXT_AI_MODEL`：可选；通用模型名，MiniMax 默认 `abab6.5-chat`，其它默认 `gpt-4o-mini`
- `NUXT_MINIMAX_*`：保留向后兼容，若未配置 `NUXT_AI_*` 会自动回退读取
- `NUXT_AUTH_SECRET`：PIN 登录签名密钥（建议 32 位以上随机字符串）
- `NUXT_ADMIN_PIN`：可选；配置后可作为初始化 PIN（6 位数字），未配置时首次访问登录页可直接注册 PIN

## 目录结构

```text
app/
  layouts/          # SaaS 全局布局
  pages/            # Checkout / Inventory / Insights 页面
  components/ui/    # UI 组件（含 Table）
  composables/      # 跨页面的组合式函数（API 错误处理、格式化等）
  stores/           # Pinia 状态管理（含购物清单持久化）
  types/            # 前端 DTO 类型定义
server/
  api/              # 业务 API（auth/products/orders/insights/audit-logs）
  lib/              # 基础设施（Prisma 单例）
  middleware/       # 服务端鉴权中间件
  services/         # 后端领域服务（核心业务逻辑）
prisma/
  schema.prisma     # 数据模型
  migrations/       # 迁移记录
shared/
  constants/        # 跨端常量
```
