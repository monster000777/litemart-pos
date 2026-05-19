# LiteMart POS MiniApp

这是 `litemart-pos` 的 `uni-app` 小程序端工程，当前定位是门店前台 MVP。

已覆盖主流程：

- 登录
- 商品浏览与搜索
- 购物车
- 会员识别
- 积分抵扣
- 下单
- 订单查询
- 退出登录

## 当前结构

```text
miniapp/
  src/
    api/               按领域拆分的接口定义
    components/        复用组件
    config/            运行配置
    pages/             页面
    services/          业务服务层，页面统一从这里拿能力
    static/            tab 图标等小程序资源
    stores/            Pinia 状态
    types/             类型定义
    utils/             请求层与通用工具
  .gitignore
  package.json
  README.md
  tsconfig.json
  vite.config.ts
```

## 接口对齐结果

当前小程序端已对齐并实际使用这些接口：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/products`
- `GET /api/customers/lookup?phone=`
- `POST /api/orders/checkout`
- `GET /api/orders`

当前前端约定的数据结构：

- 登录返回：`token`、`role`、`user`
- 会话返回：`authenticated`、`role | actualRole`、`user`
- 商品列表返回：`Product[]`
- 订单列表返回：`{ orders, total, page, pageSize }`

## 鉴权与请求约定

当前小程序端优先使用 `Bearer Token`：

1. 登录成功后保存 `token`
2. 请求层自动带 `Authorization: Bearer <token>`
3. 如果接口返回 `401`，请求层会自动清理本地 token 并回到登录页

说明：

- 小程序端仍保留 `withCredentials: true`
- 但当前主流程已按 token 方式组织，不再依赖 Cookie 才能跑通

## 启动方式

### 1. 启动后端

在项目根目录执行：

```powershell
npm run dev -- --host 0.0.0.0
```

⚠️ **必须加** `--host 0.0.0.0` 才能被局域网内其他设备访问（微信开发者工具等）

### 2. 配置请求地址（多环境）

项目采用两环境 `baseUrl` 自动识别：

- 开发联调（lan）：`miniapp/.env.dev-lan` → `http://192.168.1.100:3000` (需改成实际IP)
- 生产发布（prod）：`miniapp/.env.production` → `https://api.litemart.local` (需改成实际域名)

#### 环境变量配置

参考 `miniapp/.env.example` 了解完整的环境变量说明和示例。

#### 自定义环境地址

编辑对应的 `.env.*` 文件修改 `VITE_API_BASE_URL`：

```bash
# 开发联调 (微信开发者工具 → 局域网后端)
# ⚠️ 必须是你开发机的真实 IP，不能用 127.0.0.1（小程序沙箱限制）
VITE_API_BASE_URL=http://192.168.1.100:3000

# 生产部署 (真实 API 域名)
VITE_API_BASE_URL=https://api.your-domain.com
```

#### 查看本机 IP

```powershell
ipconfig
```

找 `IPv4 地址` 一行，格式 `192.168.x.x` 或 `10.x.x.x`

#### 发布部署说明

**⚠️ 重要：务必修改生产API地址**

1. 修改 `.env.production` 中的 `VITE_API_BASE_URL`，将 `https://YOUR_API_DOMAIN.com` 替换为实际后端域名
2. 执行 `npm run build:mp-weixin` 构建发布版本
3. 构建输出在 `unpackage/dist/build/mp-weixin/`
4. 用微信开发者工具打开该目录，验证网络请求是否正确指向生产 API
5. 验证步骤：打开首页 → 控制台应显示 `[LiteMart POS] API BaseURL: https://YOUR_ACTUAL_DOMAIN.com`

### 3. 安装依赖

```powershell
cd .\miniapp
npm install
```

### 4. 启动小程序

**开发联调（推荐）：**

```powershell
npm run dev:mp-weixin
```

或显式指定 LAN 模式：

```powershell
npm run dev:mp-weixin:lan
```

H5 预览（浏览器预览）：

```powershell
npm run dev:h5
```

构建发布版本：

```powershell
npm run build:mp-weixin
```

清理旧缓存与构建产物：

```powershell
npm run clean
```

### 5. 单独检查小程序源码

如果只想检查 `miniapp` 源码，可在项目根目录执行：

```powershell
npm run lint:miniapp
```

自动修复：

```powershell
npm run lint:miniapp:fix
```

### 6. HBuilderX

在项目根目录，相对路径打开：

```text
./miniapp
```

或在 HBuilderX 中使用"文件 > 打开文件夹"，选择 `miniapp` 目录。

然后运行到：

- 浏览器
- 微信开发者工具

## 资源路径约定

当前小程序 tab 图标放在：

```text
miniapp/src/static/tab/
```

`pages.json` 里保持这样引用：

```json
"iconPath": "static/tab/order.png"
```

不要改成：

- `src/static/tab/...`
- `/static/tab/...`

否则微信开发者工具会报找不到图标。

## 本轮已完成的整理

- 按领域拆分 `api/`
- 增加 `services/` 层，页面不再直接拼接口
- 请求层补了统一 `401` 失效处理
- 退出登录收回到 `authService`
- 首页、登录页、购物车页、订单页、我的页视觉风格已基本统一
- 修掉了多处乱码、旧缓存误导和 tab 图标路径问题
- `baseUrl` 已改为 lan / prod 双环境配置
- 增加 `npm run clean` 用于清理遗留缓存和旧构建产物

## 已知限制

- 页面级 loading 仍然是各页自己管理，尚未做全局 loading
- 还没有商品详情页、分类页和支付流程

## 建议验证顺序

1. 登录
2. 首页商品加载
3. 加入购物车
4. 会员查询
5. 积分抵扣
6. 下单
7. 订单页查看
8. 退出登录

## 下一步推荐

1. 增加全局 loading / 错误提示策略
2. 补商品详情与分类
3. 接支付与更完整的会员中心
