# 开发计划

## 一、基础测试（优先执行）

### 框架配置

- 安装 `vitest`
- 创建 `vitest.config.ts`
- 添加 `npm run test` 脚本

### 测试文件结构

```
tests/unit/
├── customer-service.test.ts
├── order-service.test.ts
├── product-service.test.ts
└── auth-service.test.ts
```

### 测试覆盖范围

| 服务               | 测试点                             |
| ------------------ | ---------------------------------- |
| `customer-service` | 手机号校验、等级判断、积分计算     |
| `order-service`    | 金额舍入、会员价选择、积分抵扣计算 |
| `product-service`  | 图片 URL 校验、DTO 转换            |
| `auth-service`     | PIN 格式校验、token 创建/验证      |

纯函数直接测，依赖 Prisma 的用 mock。

---

## 二、暗色换肤

### 方案

Tailwind `dark:` + CSS 变量 + localStorage 持久化

### 改动范围

- `nuxt.config.ts` 添加 `colorMode` 模块或手动实现
- `default.vue` 侧边栏 + 顶栏适配暗色
- 各页面 `bg-white` / `text-slate-*` 等类名补充 `dark:` 变体
- 登录页独立适配

### 切换入口

- 侧边栏底部加月亮/太阳图标按钮
- 默认跟随系统，用户可手动覆盖

### 持久化

- `localStorage` 存储偏好
- SSR 兼容（避免闪烁）

---

## 三、UID + PIN 登录（已完成）

### 当前登录系统分析

**现状：账号名称 + PIN 登录**

- 两步输入：先输账号名称，再输 6 位 PIN
- `findAuthUserByName` 按名称精确查询，O(1) 复杂度
- 每个账号名称唯一，PIN 可重复但不推荐

**优点：**

- 明确区分操作人，审计日志记录账号名称
- 登录流程清晰：先输账号，再输 PIN
- 支持 5+ 人团队，适合多员工场景

**已实现功能：**

1. ✅ `AuthUser` 表 `name` 字段作为 UID
2. ✅ 登录页两步输入：先输 UID，再输 PIN
3. ✅ `findAuthUserByName` 替代线性遍历
4. ✅ 审计日志记录 UID
5. ✅ 用户管理页支持设置/修改 UID

---

## 执行顺序

```
第一步：测试框架 + 核心服务测试 ✅
第二步：暗色换肤（前端）
第三步：UID 登录 ✅
```
