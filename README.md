# 羽白 · Personal Universe V2.2

A Universe in Progress. 羽白的个人站，使用原生 HTML、CSS、JavaScript，静态托管于 GitHub Pages。

## 运行

无需安装依赖或构建。在仓库根目录运行：

```bash
python3 -m http.server --bind 127.0.0.1 8080
```

访问 http://127.0.0.1:8080/。直接打开 `index.html` 也能浏览静态星图、星球详情和终端；浏览器的本地文件模块限制需要用 HTTP 预览才能渲染实时 3D。

## 内容与交互

- 白羽星核与 Origin、Intelligence、Ventures、Observatory、Playground 五座微缩世界。可以点击模型或使用 HTML 星球链接在首屏聚焦。悬停和键盘聚焦会显示简介，点击后保留预览和 `#focus-ventures` 等定位链接。View Story 进入唯一的 Worlds 详情区，`#world-ventures` 等直达链接保留。Escape 或「返回星图」回到首屏。自动探索由访客开启，每 4.6 秒更新一次镜头与预览，主动操作、离开星图或切到后台时停止。
- 作品、当前坐标、观察笔记、个人理念与 GitHub 均可直接访问。纵向顺序为 Hero → Worlds → Selected Work → Field Notes → Now → About → Space Console → Connect。Field Notes 收录有感公开目录中的编辑手记（可在本页展开全文）、播客工作台的公开虚构样例和一篇通用推理测评框架笔记。未添加未证实的发布日期、工作经历或联系渠道。
- 终端保留 `help`、`about`、`now`、`projects`、`links`、`fortune`、`echo`、`clear`、历史与隐藏 `neko`；`universe` 返回全景，`orbit` 开启自动探索，`visit <planet>` 打开指定星球的故事。快捷按钮复用相同的命令解析与历史。项目链接与当前状态直接读取页面内容。
- 无 WebGL、节省流量、模块加载失败或直接打开本地文件时显示静态星图；HTML 入口仍然可用。减少动态效果时保留可点击的静止 3D 场景。场景离开视口或切到后台后暂停渲染。

## 文件与资源

- `index.html`、`styles.css`：语义结构、作品数据、SEO 与桌面/移动端布局。
- `universe-ui.js`：HTML 星球入口、详情、导航及终端桥接。
- `universe.js`、`universe-models.js`：实时场景、模型、相机和射线交互；按模型包围盒和画布宽高比取景。
- `terminal.js`：访客终端。
- `public/vendor/`：本地固定版本 Three.js 0.180.0 模块及 MIT 许可。
- `public/universe-*.webp`：独立生成的深空远景和实时模型的静态回退渲染。远景由 ImageGen 生成，提示为「近黑靛色深空、细小银蓝星光、右上远处星系、右下蓝色地平线；左侧留空，无文字或前景对象」。
- `public/world-*.webp`：各星球的模型渲染。作品图另包含 CareLink 仓库的老人端首页和服务进度演示截图（`apps/senior-web/screenshots/06-progress.jpg`）、Podcast Workspace 的公开演示截图与有感仓库的原始作品图。分享封面 `public/universe-share.jpg` 由站内远景和静态星图合成。

## 验证

Node.js 22 以上可运行 `node --test tests/universe.test.mjs`，检查五个模型、镜头曲线、HTML 入口和静态资源路径。

浏览器回归脚本为 `tests/browser-smoke.cjs`，可用已有 Playwright 安装运行，不是站点运行依赖：

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROME_CHANNEL=chrome SCREENSHOTS_DIR=/tmp/yubai-v22 node tests/browser-smoke.cjs
```

不指定 `CHROME_CHANNEL` 时使用 Playwright 安装的 Chromium。脚本用临时本机端口模拟 Pages 子路径，并覆盖 1440 × 980、1280 × 900、768 × 1024、390 × 844 和 375 × 812 的排版，以及射线交互、原地聚焦、View Story、历史、移动导航、终端、自动探索及 WebGL 回退。可选截图包含上述尺寸、星球聚焦、Worlds、Selected Work、Field Notes、About 和两张移动端完整页面。

## GitHub Pages

从 `main` 分支的根目录发布即可；无需 npm 安装、构建步骤或外部 CDN。保持 `public/vendor/` 与 `public/*.webp` 一起发布，页面资源路径均相对于站点目录。
