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
cd E:\邹奣\Desktop\实训项目\litemart-pos
npm run dev
```

如果需要让微信开发者工具访问你电脑上的服务，确保后端可被局域网访问。

### 2. 配置请求地址

编辑 [src/config/index.ts](/E:/邹奣/Desktop/实训项目/litemart-pos/miniapp/src/config/index.ts:1)：

```ts
export const appConfig = {
  baseUrl: 'http://192.168.1.100:3000',
  requestTimeout: 12000
}
```

使用建议：

- `H5` 本机调试：可用 `http://127.0.0.1:3000`
- 微信开发者工具：通常要改成你电脑的局域网 IP

查看本机 IP：

```powershell
ipconfig
```

### 3. 安装依赖

```powershell
cd E:\邹奣\Desktop\实训项目\litemart-pos\miniapp
npm install
```

### 4. 启动小程序

微信小程序开发模式：

```powershell
npm run dev:mp-weixin
```

H5 预览：

```powershell
npm run dev:h5
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

直接打开：

```text
E:\邹奣\Desktop\实训项目\litemart-pos\miniapp
```

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

## 已知限制

- `baseUrl` 现在仍是手动切换，不是多环境配置
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

1. 把 `baseUrl` 改成分环境配置
2. 增加全局 loading / 错误提示策略
3. 补商品详情与分类
4. 接支付与更完整的会员中心
