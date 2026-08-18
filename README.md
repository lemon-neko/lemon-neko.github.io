# 羽白 — 个人入口主页

羽白的个人主页与统一入口，静态托管于 GitHub Pages。

## 页面内容

- 个人身份、头像与简介
- 可输入命令的互动个人终端 Playground
- 当前关注和正在进行的方向
- About 与兴趣领域
- GitHub 和微信公众号入口
- 自动跟随系统的亮色 / 暗色主题
- Cinematic Lite 电影氛围：橙紫光雾、运行时胶片颗粒、暗角与克制的镜头式入场
- 全页本地电影背景：静音循环视频、静态封面和自动播放降级
- 头像微视差、卡片聚光和终端扫描线；触摸设备与减少动态效果偏好会自动降级
- 响应式布局与键盘无障碍支持
- Open Graph、Twitter Card、JSON-LD、robots.txt 和 sitemap.xml

## 文件结构

```text
.
├── index.html
├── styles.css
├── terminal.js
├── cinematic.js
├── public/
│   ├── favicon.svg
│   ├── hero-cinematic.m4v
│   ├── hero-cinematic-poster.jpg
│   └── pic.jpg
├── robots.txt
├── sitemap.xml
└── README.md
```

## Playground 命令

终端支持 `help`、`about`、`now`、`links`、`fortune`、`echo <text>` 和 `clear`。使用上下方向键可浏览命令历史，按 `Ctrl/⌘ + L` 可快速清屏。隐藏命令 `neko` 会唤醒一只 ASCII 小猫，并触发一次短暂的色差彩蛋。

## Cinematic Lite

电影氛围全部由原生 CSS、Canvas 与 JavaScript 实现，不使用电影素材，也不依赖 Three.js、GSAP 或外部运行时。`cinematic.js` 负责一次性生成低分辨率颗粒纹理、视口揭示、头像视差、卡片聚光、页面可见性和动作偏好；终端只负责派发彩蛋事件。

当系统启用“减少动态效果”时，视差、漂移、揭示和故障动画会关闭，仅保留静态低透明度纹理；触摸或粗指针设备也不会启用鼠标跟随效果。

背景视频经过本地压缩并随站点发布，不依赖远程视频地址。它固定覆盖整个页面，让 Hero、终端、About 与 Connect 共享同一电影场景；内容层使用深色半透明材质保持可读性。桌面和手机端默认静音循环播放；页面进入后台时自动暂停，返回后恢复。系统开启“减少动态效果”、省流量模式、自动播放被阻止或资源加载失败时，会回退到本地静态封面。

## 本地预览

项目不需要构建工具，可直接打开 `index.html`，或启动静态服务器：

```bash
python3 -m http.server --bind 127.0.0.1 8080
```

然后访问 `http://localhost:8080`。

## 部署

项目通过 GitHub Pages 部署。推送到 `main` 分支后，访问：

https://lemon-neko.github.io/
