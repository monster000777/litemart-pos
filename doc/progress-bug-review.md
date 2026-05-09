# 账号管理模块 — 合规性自检与深度修复报告

## 日期：2026-05-09

---

## 一、全链路验证结果

- **`npm run lint`** ✅ 通过
- **`npx nuxi build`** ✅ 构建成功（4.69 MB，1.11 MB gzip）
- **Prisma Schema ↔ Bootstrap DDL** ✅ Config / AuthUser 表结构完全一致
- **前端 DTO ↔ 后端响应** ✅ 全部 10 条 API 路径类型对齐
- **RBAC 前端路径 ↔ 后端路由** ✅ `/users`、`/logs` 等权限规则前后一致
- **环境变量** ✅ `authSecret`、`adminPin` 在 nuxt.config.ts 中正确声明

---

## 二、已修复问题汇总（共 9 项）

### 🔒 安全类（2 项）

| #   | 文件                | 问题                                                     | 修复                              |
| --- | ------------------- | -------------------------------------------------------- | --------------------------------- |
| 1   | `rbac-service.ts`   | `/api/auth/users` 在 RBAC 层无差别放行                   | 新增 ADMIN 角色前置检查           |
| 2   | `reset-pin.post.ts` | 速率限制在昂贵 PIN 扫描之后，攻击者可绕过限流触发 scrypt | 将 rate limiter 移至 PIN 运算之前 |

### 🐛 逻辑类（3 项）

| #   | 文件                | 问题                                               | 修复                                    |
| --- | ------------------- | -------------------------------------------------- | --------------------------------------- |
| 3   | `login.vue`         | reset-pin 成功后调用 completeAuthFlow 导致闪回主页 | 改为切回登录模式 + 成功提示             |
| 4   | `reset-pin.post.ts` | 端点要求 session 但登录页无 session（死循环）      | 加入 PUBLIC_AUTH_PATHS + 双路径用户查找 |
| 5   | `users.vue`         | stats 卡片只有店长/收银员，缺少管理员              | 新增管理员统计卡片                      |

### ⚡ 性能类（2 项）

| #   | 文件                | 问题                                                           | 修复                                   |
| --- | ------------------- | -------------------------------------------------------------- | -------------------------------------- |
| 6   | `reset-pin.post.ts` | 未认证路径下 findAuthUserByPin 已验证 PIN，后续再做一次 scrypt | 用 pinAlreadyVerified 标志跳过重复验证 |
| 7   | `register.post.ts`  | 创建用户后用 findAuthUserByPin 全表扫描取 ID                   | createAuthUser 返回 userId，直接使用   |

### 🗑️ 冗余清理（2 项）

| #   | 文件                     | 问题                                                                 | 修复                                |
| --- | ------------------------ | -------------------------------------------------------------------- | ----------------------------------- |
| 8   | `role.patch.ts`          | ALLOWED_ROLES 与 isUserRole 功能重复                                 | 删除 ALLOWED_ROLES，简化条件        |
| 9   | `auth-config-service.ts` | updateAuthConfig / updateAuthRole 死代码 + COALESCE 后冗余 null 检查 | 删除死函数 + 简化 normalizeUserRole |

---

## 三、修改文件清单（26 files, +1586 −152）

| 文件                                     | 改动类型                           |
| ---------------------------------------- | ---------------------------------- |
| `shared/constants/rbac.ts`               | 显式 `/users` 路径规则             |
| `server/services/rbac-service.ts`        | RBAC 安全加固                      |
| `server/middleware/auth.ts`              | reset-pin 公开路径                 |
| `server/services/auth-config-service.ts` | 死代码清理 + 冗余简化              |
| `server/services/auth-user-service.ts`   | createAuthUser 返回 ID             |
| `server/api/auth/reset-pin.post.ts`      | 速率限制前置 + 双路径 + 去重复验证 |
| `server/api/auth/register.post.ts`       | 避免全表 PIN 扫描                  |
| `server/api/auth/role.patch.ts`          | 去冗余 ALLOWED_ROLES               |
| `app/pages/login.vue`                    | reset-pin 流程修复                 |
| `app/pages/users.vue`                    | 管理员统计卡片                     |

---

## 四、已知观察项（不阻塞）

- `findAuthUserByPin` 登录时遍历全表做 scrypt，用户量大时可能成瓶颈（建议未来引入 PIN 索引）
- `Config` 表在引入 `AuthUser` 后主要用于 legacy 迁移，长期可考虑废弃
