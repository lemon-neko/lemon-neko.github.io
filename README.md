# 羽白 — 个人网站

羽白的个人主页，静态托管于 GitHub Pages。

## 特性

- **亮色 / 暗色主题** — 支持手动切换，自动跟随系统偏好
- **响应式设计** — 桌面端与移动端自适应，含侧滑抽屉菜单
- **无障碍** — Skip-to-content 链接、ARIA 属性、焦点管理、Escape 键关闭菜单
- **阅读进度条** — 页面滚动进度可视化
- **回到顶部按钮** — 滚动超过 300px 后出现
- **SEO 优化** — Open Graph / Twitter Card 卡片、JSON-LD 结构化数据、robots.txt、sitemap.xml

## 文件结构

```
.
├── index.html          # 主页面（HTML + 嵌入式脚本）
├── styles.css          # 全局样式（CSS 变量、亮暗主题、响应式）
├── public/
│   ├── favicon.svg     # 网站图标
│   └── pic.jpg         # 头像图片
├── robots.txt          # 搜索引擎爬虫规则
├── sitemap.xml         # 站点地图
└── README.md           # 本文档
```

## 本地运行

无需构建工具，直接用浏览器打开即可预览：

```bash
# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

或使用任意静态服务器：

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```

然后在浏览器访问 `http://localhost:8080`。

## 部署

本项目通过 **GitHub Pages** 自动部署。将代码推送到 `main` 分支即可：

```bash
git add .
git commit -m "Your changes"
git push origin main
```

约 1–2 分钟后访问 `https://lemon-neko.github.io` 即可查看更新。

## 自定义

修改以下内容来自定义网站：

| 文件 | 内容 |
|------|------|
| `index.html` | 标题、描述、社交链接、页面内容 |
| `styles.css` | 颜色变量、字体、布局、动画 |
| `public/pic.jpg` | 个人头像（替换此文件即可） |
| `public/favicon.svg` | 网站图标 |
| `robots.txt` | 搜索引擎爬取规则 |
| `sitemap.xml` | 站点地图（更新 `lastmod` 日期） |

## License

© 羽白 — 版权所有
