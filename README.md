# 羽白 · Personal Universe

A Universe in Progress. 羽白的个人站，使用原生 HTML、CSS、JavaScript，静态托管于 GitHub Pages。

## 运行

无需安装依赖或构建。在仓库根目录运行：

```bash
python3 -m http.server --bind 127.0.0.1 8080
```

访问 http://127.0.0.1:8080/。直接打开 `index.html` 也能浏览静态星图、星球详情和终端；浏览器的本地文件模块限制需要用 HTTP 预览才能渲染实时 3D。

## 内容与交互

- 白羽星核与 Origin、Intelligence、Ventures、Observatory、Playground 五座微缩世界。可以直接点击模型，也可以通过 HTML 星球链接操作；Escape 或「返回宇宙」关闭详情。
- 作品、当前坐标、观察笔记、个人理念与 GitHub 均可直接访问。观察笔记只收录已有公开创作入口。
- 终端保留 `help`、`about`、`now`、`projects`、`links`、`fortune`、`echo`、`clear`、历史与隐藏 `neko`；新增 `universe`、`orbit`、`visit <planet>`。项目链接统一读取页面卡片。
- 无 WebGL、节省流量、模块加载失败或直接打开本地文件时显示静态星图；HTML 入口仍然可用。减少动态效果时保留可点击的静止 3D 场景。场景离开视口或切到后台后暂停渲染。

## 文件与资源

- `index.html`、`styles.css`：语义结构、作品数据、SEO 与桌面/移动端布局。
- `universe-ui.js`：HTML 星球入口、详情、导航及终端桥接。
- `universe.js`、`universe-models.js`：实时场景、模型、相机和射线交互；不加载原有背景视频。
- `terminal.js`：访客终端。
- `public/vendor/`：本地固定版本 Three.js 0.180.0 模块及 MIT 许可。
- `public/universe-*.webp`：独立生成的深空远景和实时模型的静态回退渲染。远景由 ImageGen 生成，提示为「近黑靛色深空、细小银蓝星光、右上远处星系、右下蓝色地平线；左侧留空，无文字或前景对象」。
- `public/world-*.webp`：各星球的模型渲染。作品图另包含 CareLink 仓库的老人端演示截图、Podcast Workspace 的公开演示截图与有感仓库的原始作品图。

## 验证

Node.js 22 以上可运行 `node --test tests/universe.test.mjs`，检查五个模型、HTML 入口和静态资源路径。

## GitHub Pages

从 `main` 分支的根目录发布即可；无需 npm 安装、构建步骤或外部 CDN。保持 `public/vendor/` 与 `public/*.webp` 一起发布，页面资源路径均相对于站点目录。
