# MIGRATE_TO_ASTRO.md

建议：迁移到 Astro（最小可行步骤）

为什么迁移
- Astro 支持组件化、布局复用、快速构建静态站和博客。
- 便于把页面拆成多页并统一管理头部/脚注/样式。

最小文件清单（示例）
- package.json（已有）
- astro.config.mjs
- src/
  - layouts/Layout.astro
  - pages/index.astro
  - pages/about.astro
  - pages/contact.astro
  - components/ThemeToggle.astro (可选)
- public/
  - favicon.svg, images, og-image.jpg
- src/styles.css（全局样式）

基础命令
- 安装（如果还没安装）：
  npm install
  npm install -D astro
- 本地开发：
  npx astro dev
- 构建：
  npx astro build
- 预览构建：
  npx astro preview

迁移步骤（简洁）
1. 在仓库中创建 `src/layouts/Layout.astro`，把现有 head/meta 与 header/footer 提取进 Layout。
2. 把当前 index.html 内容迁到 `src/pages/index.astro`，使用 Layout 组件包裹。
3. 把 styles.css 放到 `src/styles.css` 并在 Layout 中以 `<link rel="stylesheet" href={getPath('/styles.css')}>` 引入，或使用导入方式。
4. 将静态资源（favicon, og 图）放到 public/（已在仓库内）。
5. 运行 `npx astro dev` 本地验证，调整路径与环境变量。
6. 若需自动部署，添加 GitHub Actions 工作流（示例可提供）。

如需，我可以把示例 Layout 和 pages/index.astro 的最小模板也添加到仓库以快速启动 Astro 项目骨架。
