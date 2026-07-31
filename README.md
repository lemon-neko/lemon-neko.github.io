# 羽白 — 个人入口主页

羽白的个人主页与统一入口，静态托管于 GitHub Pages。

## 页面内容

- 个人身份、头像与简介
- 当前关注和正在进行的方向
- About 与兴趣领域
- GitHub 和微信公众号入口
- 自动跟随系统的亮色 / 暗色主题
- 响应式布局与键盘无障碍支持
- Open Graph、Twitter Card、JSON-LD、robots.txt 和 sitemap.xml

## 文件结构

```text
.
├── index.html
├── styles.css
├── public/
│   ├── favicon.svg
│   └── pic.jpg
├── robots.txt
├── sitemap.xml
└── README.md
```

## 本地预览

项目不需要构建工具，可直接打开 `index.html`，或启动静态服务器：

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 部署

项目通过 GitHub Pages 部署。推送到 `main` 分支后，访问：

https://lemon-neko.github.io/
