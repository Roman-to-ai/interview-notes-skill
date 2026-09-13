# Changelog

本项目的所有重要变更都会记录在此文件。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.0.0] - 2026-09-13

首个公开发布版本。

### 新增

- **组件库**（`assets/js/note-ui.js` + `assets/css/note-ui.css`）—— 声明式标记，行为自动接管，共 14 个组件：
  - `page` 页面壳（面包屑 + 标题 + 考点路径 + 考察知识点徽标）
  - `section` 章节（自动编号 + 注册右侧目录 + 复制本节链接）
  - `code` 代码块（高亮、复制、语言/文件标签、行号、指定行高亮、对错描边、超长折叠、换行开关）
  - `flow` 流程图（Mermaid 渲染、题注、点击灯箱、复制源码、语法错降级）
  - `drawer` / `drawer-group` 抽屉（展开收起、语气变体、组级全展开、手风琴互斥）
  - `cards` / `card` 卡片组（响应式网格、图标/标题/标签、hover）
  - `table` 表格（滚动壳、斑马纹、表头吸顶、推荐列高亮、复制为 Markdown）
  - `tabs` / `tab` 选项卡（三级话术、多语言对照、记住选择、键盘切换）
  - `callout` 提示框（tip / note / key / hot / pit / warn / ok / quote 八种语气）
  - `word` / `words-auto` 生词提示（查全局词典补音标翻译，或整块自动扫描标注）
  - `zoom` 任意图片 / SVG 复用灯箱放大
- **构建脚本**（`scripts/`）—— 仅依赖 Node 原生模块，无需 `npm install`：
  - `init.js` 初始化目录结构、复制资产、初始化菜单数据
  - `create-note.js` 建目录 + 写零内容空壳 + 增量维护 `menu-data.js`，支持 `--batch`
  - `fix-base-href.js` 按目录深度替换 `{{BASE_HREF}}`，并联动 Mermaid 校验
  - `validate-mermaid.js` 流程图语法校验，`--fix` 可自动修箭头与全角括号
  - `scan-notes.js` 组件用量统计 + 契约校验（未知组件、必填属性、占位符残留、旧类名）
- **主页面**：左侧三级菜单 + 右侧 iframe、多关键词 AND 搜索（题目/标签/路径/分类）、
  三套代码配色切换（GitHub Dark / Monokai / Tomorrow Night Bright），偏好经 localStorage 跨 iframe 同步
- **组件速查手册** `ui-showcase.html` —— 真实渲染 + 可复制写法，写笔记前的唯一权威参考
- **全局英文技术词典** `data/dict.js`（音标 + 中文），作为生词提示的数据源
- **生成流程文档** `SKILL.md`，供 Claude Code 按 4 步流程自动生成笔记

### 设计取舍

- **没有内容模板**：笔记由组件自由组合而成，不存在"必须照搬的八股结构"。
  这是与"复制模板填占位符"方案的核心差异，也是旧的 `templates/` 方案被整体废弃的原因。
- **零构建、零依赖**：第三方库预置在 `assets/lib/`，双击 `index.html` 即可用，完全离线。

[Unreleased]: https://github.com/Roman-to-ai/interview-notes-skill/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Roman-to-ai/interview-notes-skill/releases/tag/v1.0.0
