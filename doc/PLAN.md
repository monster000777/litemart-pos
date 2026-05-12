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

## 三、UID + PIN 登录（待确认）

### 当前登录系统分析

**现状：纯 PIN 登录**

- 6 位 PIN 是唯一凭证，无用户名层
- `findAuthUserByPin` 线性遍历所有用户逐个验签，O(n) 复杂度
- 无法防 PIN 重复（两用户设相同 PIN 时先匹配者优先）

**优点：**

- 登录快，收银员 6 位数字即进系统
- 适合小团队（2-10 人）

**问题：**

- 安全性偏弱：PIN 泄露即账户沦陷，无第二层验证
- 审计模糊：多员工共用一个 PIN 时难以区分操作人
- 扩展性差：用户多了后线性遍历变慢

### 两种方案

| 方案          | 登录方式          | 改动量 | 适合场景                |
| ------------- | ----------------- | ------ | ----------------------- |
| A. 保留纯 PIN | 6 位 PIN          | 不改   | 2-5 人小团队            |
| B. UID + PIN  | 用户名 + 6 位 PIN | 中等   | 5+ 人，需明确区分操作人 |

### 如果选 B，改动点

1. `AuthUser` 表已有 `name` 字段，可直接当 UID 用，或新增 `uid` 字段
2. 登录页改为两步输入：先输 UID，再输 PIN
3. `findAuthUserByUid` 替代线性遍历
4. 审计日志记录 UID
5. 用户管理页支持设置/修改 UID

---

## 执行顺序

```
第一步：测试框架 + 核心服务测试
第二步：暗色换肤（前端）
第三步：UID 登录（如果确认要做）
```
