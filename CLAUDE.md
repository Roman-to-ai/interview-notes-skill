# 面试笔记项目

基于纯静态 HTML 的面试笔记系统：组件库 + 脚本 + 生成流程。**没有内容模板**，笔记由组件自由组合而成。

## 使用方式

用户提供一份菜单目录（考点列表），Claude 按 SKILL.md 中的流程：

1. 首次使用 → `node scripts/init.js` 初始化目录结构（复制资产、组件库、词典）
2. `node scripts/create-note.js --batch notes.json` → 建目录 + 写入零内容空壳 + 生成菜单
3. 生成笔记 → 在空壳里**自由组合组件**写内容（`<base href>` 保持 `{{BASE_HREF}}` 占位符）
4. 一键修复 + 验证 → `node scripts/fix-base-href.js`（base 路径 + Mermaid 语法）、
   `node scripts/scan-notes.js --verify`（组件契约）
5. 浏览器打开 `index.html` 预览

## 关键文件

- `SKILL.md` — 生成流程 + 组件契约表
- `ui-showcase.html` — **组件速查手册**（真实渲染 + 可复制写法，写笔记前先看这个）
- `assets/css/note-ui.css` — 组件库样式（自带全部视觉规则，不依赖 Tailwind）
- `assets/js/note-ui.js` — 组件库运行时（扫描 `data-ui` 自动增强，暴露 `window.NoteUI`）
- `data/dict.js` — 英文技术词全局词典（音标 + 中文，生词提示的数据源）
- `data/menu-data.js` — 菜单数据（由 create-note.js 自动生成和维护）
- `index.html` — 主页面（左侧菜单 + 右侧 iframe）
- `assets/css/style.css` — 主页面（菜单框架）样式
- `assets/js/{app,menu,search}.js` — 主页面逻辑（菜单、搜索、代码主题齿轮）
- `assets/lib/` — 第三方库（Tailwind、highlight.js、Mermaid）
- `scripts/` — init / create-note / fix-base-href / validate-mermaid / scan-notes

## 组件库

笔记里只写声明式标记，行为由 `note-ui.js` 自动接管：

| 组件 | 能力 |
|------|------|
| `data-ui="page"` | 页面壳：面包屑 + 标题 + 考察知识点徽标 + 排版宽度 |
| `data-ui="section"` | 章节：自动编号 + 注册进右侧目录 + 复制本节链接 |
| `data-ui="code"` | 代码：高亮、复制、语言/文件标签、行号、高亮指定行、对错描边、超长折叠、换行开关 |
| `data-ui="flow"` | 流程图：Mermaid 渲染、题注、点击灯箱（缩放/平移/复位）、复制源码、语法错降级 |
| `data-ui="drawer"` / `drawer-group` | 抽屉：展开收起、语气变体、组级全部展开/收起、手风琴互斥 |
| `data-ui="cards"` / `card` | 卡片组：响应式网格、图标/标题/标签、hover |
| `data-ui="table"` | 表格：滚动壳、斑马纹、表头吸顶、推荐列高亮、复制为 Markdown |
| `data-ui="tabs"` / `tab` | 选项卡：三级话术、多语言对照、记住选择、键盘切换 |
| `data-ui="callout"` | 提示框：8 种语气（tip/note/key/hot/pit/warn/ok/quote） |
| `data-ui="word"` / `words-auto` | 生词提示：查全局词典补音标翻译，或整块自动扫描标注 |
| `data-ui="zoom"` | 任意图片/SVG 复用灯箱放大 |

内置交互（无需在笔记里写任何 JS）：右侧快速定位目录（展开收起 + 滚动高亮 + 阅读进度条）、
流程图灯箱、代码主题三套切换（与 `index.html` 齿轮通过 localStorage + postMessage 联动，兼容 `file://`）、
打印/导出 PDF 时自动展开折叠内容。

## 约定

- 目录 slug 只用纯英文，禁止 `01-xxx` 数字前缀（路径需稳定）
- 新写法一律用 `data-ui` 组件；旧模板类名（`summary-card` / `code-wrapper` 等）已被
  `scan-notes.js` 的 `LEGACY_CLASSES` 列入黑名单，出现即校验失败
- 新增可复用能力 → **五处**同步：`note-ui.js` 的 `registry` 加组件 + `note-ui.css` 加样式 +
  `ui-showcase.html` 加示例 + SKILL.md 组件表加一行 + `scan-notes.js` 的 `KNOWN_COMPONENTS`
  （漏最后一处会让 `--verify` 把新组件当未知组件报错）
- `data/dict.js` 只增不改键名（键为小写短语，音标用 IPA）
