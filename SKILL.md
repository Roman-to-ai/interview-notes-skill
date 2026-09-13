---
name: interview-notes
description: >
  Generate interview knowledge-point notes from .docx source files or topic lists,
  producing HTML notes assembled from a self-contained component library
  (assets/js/note-ui.js + assets/css/note-ui.css) — no fixed template or module order.
  Use when the user says "生成面试笔记", "生成笔记", "创建笔记", "create interview notes",
  or when they provide .docx files and ask to turn them into interview-study material.
  Also use for batch-generating multiple notes from a topic outline, iterating on
  existing notes, or running "scan-notes" to synchronize the menu.
  Components cover: one-line summary callouts, principle breakdowns (collapsible drawers),
  Mermaid flowcharts with zoom lightbox, comparison tables, highlighted code with copy,
  three-level interview speech tabs, business scenario cards, follow-up Q&A, and inline
  English-term tooltips backed by a shared dictionary.
  Supports any technology stack (Java, Go, Python, React, system design, etc.)
---

# Interview Notes Skill

## When to use this skill

Invoke this skill whenever the user:
- Says **"生成面试笔记"**, **"生成笔记"**, **"创建笔记"**, **"写一篇笔记"**
- Provides **.docx files** with interview questions and asks to turn them into notes
- Gives a **list of topics** and wants HTML interview notes generated
- Asks to **"扫描笔记"** / **"sync menu"** / **"同步菜单"**
- Wants to **iterate / improve** existing notes (add more depth, fix content)

## 架构：没有模板，只有组件库

笔记**不再基于固定骨架填充**。每篇笔记是一段自由组织的 HTML，能力全部来自组件库：

| 文件 | 职责 |
|------|------|
| `assets/css/note-ui.css` | 组件样式（自带全部视觉规则，**不依赖 Tailwind**） |
| `assets/js/note-ui.js` | 组件运行时（扫描 `data-ui` 自动增强：高亮、复制、灯箱、折叠、目录…） |
| `data/dict.js` | 英文技术词汇全局词典（音标 + 中文），生词提示的数据源 |
| `ui-showcase.html` | **组件速查手册**：每个组件的真实渲染 + 可直接复制的写法 |

> 生成笔记前先看 `ui-showcase.html`。它是唯一的写法权威来源。

`create-note.js` 只写入一个**零内容空壳**（头部引入 + 空的 `data-ui="page"` 容器 + 尾部脚本），
其余内容由 Claude 用 Write 直接写组件标记。

## Core workflow (4 steps)

```bash
# 1. 首次使用：初始化目录结构 + 复制资产
node scripts/init.js --categories "basics:Java基础:☕"

# 2. 批量创建笔记目录 + 写入空壳 + 自动生成 menu-data.js
node scripts/create-note.js --batch notes.json

# 3. Claude 用 Write 为每篇笔记写内容（<base href> 保持 {{BASE_HREF}} 占位符）

# 4. 一键修复 + 验证（base 路径 + Mermaid 语法 + 组件契约）
node scripts/fix-base-href.js
node scripts/scan-notes.js --verify
```

浏览器打开 `index.html` 即可浏览；`ui-showcase.html` 可单独打开查写法。

## Step 1 — Extract topics from .docx

Read .docx files in the project root. Use Python (`python-docx`) or unzip + XML parsing:

```bash
python -c "
from docx import Document
doc = Document(r'PATH_TO_FILE.docx')
for p in doc.paragraphs:
    if p.text.strip():
        print(p.text)
"
```

If `python-docx` is not available, fall back to copying .docx as .zip and parsing XML with Node.js.

Parse the output: extract section headings and numbered questions.

## Step 2 — 三级菜单结构

每道面试题 = 一篇独立笔记。菜单结构为三级：

```
一级：Java基础 ☕（文档名）
  二级：一、面向对象 🧩（docx 的 section 标题）
    三级：什么是Java的封装特性？（每道题 = 一篇笔记）
    三级：什么是Java中的继承机制？
  二级：二、基础概念与语法 📝
    三级：JDK和JRE有什么区别？
```

笔记目录结构：`notes/<category>/<section-slug>/<question-slug>/index.html`

**目录命名规则**：所有层级的目录名只使用纯英文 slug（如 `encapsulation`、`jdk-vs-jre`），
**不允许带数字序号前缀**（如 `01-xxx`）。原因：后续新增/删除题目时，序号会导致路径不稳定。

`notes.json` 格式（`type` 字段已废弃，保留不影响）：
```json
[
  { "category":"mysql/beginner", "section":"一、初识MySQL", "icon":"📖",
    "topName":"MySQL入门", "topIcon":"🐬",
    "title":"什么是数据库？", "slug":"what-is-database" }
]
```

**增量更新**：再次运行 `create-note.js --batch new-notes.json` 时，新笔记会自动合并到已有
`menu-data.js`，不会覆盖已有条目；重复运行也不会覆盖已填好的笔记内容。

## Step 3 — Write note content（组件契约）

### 组件总览

| 组件写法 | 用途 | 自动获得的能力 |
|---------|------|--------------|
| `<div data-ui="page" data-title data-path data-keypoints data-badges>` | 页面壳（每篇一个） | 面包屑、h1、考察知识点徽标、最大宽度排版 |
| `<section data-ui="section" data-title>` | 章节 | 自动编号、注册进右侧目录、🔗 复制本节链接 |
| `<div data-ui="code" data-lang data-title data-lines data-mark data-del data-add data-tone data-max>` | 代码块 | hljs 高亮、📋 复制、语言/文件标签、行号、高亮指定行、错误(红)/正确(绿)描边、超长折叠、自动换行开关 |
| `<div data-ui="flow" data-caption data-zoom>` | 流程图 | Mermaid 渲染、题注、点击灯箱（滚轮缩放/拖拽/双击复位/Esc）、复制源码、**语法错降级为错误框不白屏** |
| `<details data-ui="drawer" data-title data-icon data-tone data-open>` | 抽屉折叠 | 展开收起、`faq/answer/pit/flat` 语气、键盘可达；`div` 也会被自动升级 |
| `<div data-ui="drawer-group" data-accordion data-expand-all>` | 抽屉组 | 组头「展开全部 / 收起全部」+ 条目计数；`data-accordion=true` 互斥 |
| `<div data-ui="cards" data-cols data-min>` + `<div data-ui="card" data-icon data-title data-tags data-tone>` | 卡片组 | `auto-fit` 响应式网格、图标/标题/标签、hover 提升、窄屏单列 |
| `<table data-ui="table" data-caption data-best data-sticky data-nowrap data-max>` | 表格 | 自动滚动壳、斑马纹、表头吸顶、推荐列高亮、**复制为 Markdown** |
| `<div data-ui="tabs" data-active data-mem>` + `<div data-ui="tab" data-key data-label>` | 选项卡（话术三级 / 多方案对照通用） | aria 语义、←→ 键盘切换、记住上次选择、`#key` 直达 |
| `<div data-ui="callout" data-tone data-title data-icon>` | 提示框 | `tip/note/key/hot/pit/warn/ok/quote` 八种语气 + 图标 |
| `<span data-ui="word">` / `<div data-ui="words-auto">` | 英文生词提示 | 查 `data/dict.js` 自动补音标+翻译；容器版自动扫描全文标注 |
| `<div data-ui="zoom">` | 任意图片/静态 SVG | 复用同一灯箱引擎放大查看 |

### 话术「总-分-总」结构

```html
<div data-ui="tabs" data-mem="speech-<slug>">
  <div data-ui="tab" data-key="junior" data-label="🟢 初级（~150字）">
    <div class="ui-speech-block" data-part="intro"><div class="ui-speech-part">【总】核心结论</div><p>…</p></div>
    <div class="ui-speech-block" data-part="body"><div class="ui-speech-part">【分】分点展开</div><ol><li>…</li></ol></div>
    <div class="ui-speech-block" data-part="end"><div class="ui-speech-part">【总】总结升华</div><p>…</p></div>
  </div>
  <div data-ui="tab" data-key="mid" data-label="🟡 中级（~300字）">…</div>
  <div data-ui="tab" data-key="senior" data-label="🔴 高级（~500字）">…</div>
</div>
```

### 写内容时的四条硬规则

1. **代码/流程图里不能出现裸 `<` `>`**：需要时用 `&lt;` `&gt;`（组件会正确还原显示）。
2. **`data-lang` 尽量显式写**：省略时走 `hljs.highlightAuto` 猜测，可能猜错语言。
   未收录的语言（`dockerfile`、`nginx`、`properties` 等）由别名表降级，不会白屏。
3. **不要混用旧模板类名**（`summary-card`、`knowledge-card`、`code-wrapper`、
   `speech-tab`、`mermaid-wrapper`…）：组件库不识别，`scan-notes.js --verify` 会报错。
4. **内容里不要留占位符**（`（待补充）`、`TODO`、`{{...}}`）：验证脚本会拦。

## 脚本职责

| 脚本 | 职责 |
|------|------|
| `scripts/init.js` | 初始化目录结构 + 复制资产（含组件库、词典、速查手册） |
| `scripts/create-note.js` | 创建笔记目录 + 写入零内容空壳 + 从 batch JSON 生成/增量合并 `data/menu-data.js` |
| `scripts/fix-base-href.js` | 修复所有笔记的 `{{BASE_HREF}}` + 自动调用 Mermaid 语法校验 |
| `scripts/validate-mermaid.js` | 校验 `<div data-ui="flow">` 与旧式 `<pre class="mermaid">`，`--fix` 自动修箭头/全角括号 |
| `scripts/scan-notes.js` | 组件用量统计 + 契约校验（未知组件名、必填属性、占位符、旧类名、空壳） |

```bash
node scripts/create-note.js -c basics/oop -t "什么是Java的封装特性？" -s encapsulation
node scripts/create-note.js --batch notes.json
node scripts/fix-base-href.js [--dry-run] [--skip-mermaid]
node scripts/validate-mermaid.js [--fix] [--verbose] [路径]
node scripts/scan-notes.js [--verify] [--detailed]
```

## 资源路径规则

笔记 HTML 用 `<base href>` 把基准路径固定到项目根目录，**资源引用直接写 `assets/...`**，
无需计算 `../` 层数。

Claude 生成内容时**不要动 `<base href="{{BASE_HREF}}">`**，全部笔记写完后一次性修复：

```bash
node scripts/fix-base-href.js
```

原理：`<base href>` 的值 = 笔记 `index.html` 到项目根目录的层数，每层一个 `../`
（脚本按实际路径自动计算，人工不需要算）。

## 英文词汇 Tip 规范

笔记面向英语基础薄弱的用户，正文英文技术词需要内联提示（音标 + 中文）。

**首选：自动标注**（生成笔记时一个词都不用标）
```html
<div data-ui="page" data-title="…" data-words="auto">   <!-- 全篇自动扫描词典命中词 -->
<!-- 或局部：<div data-ui="words-auto">…</div> -->
```

**手动标注**
```html
<span data-ui="word">Encapsulation</span>                          <!-- 查词典 -->
<span data-ui="word" data-t="幂等">idempotent</span>                <!-- 词典没有时内联兜底 -->
```

规则：
- 词典命中优先级：内联 `data-p`/`data-t` > `data/dict.js`
- 代码块、链接、已有 `.ui-word` 内部的文本**不会**被自动标注
- 词典里没有、也没写 `data-t` 的词不会画虚线，不会出现空气泡
- 新增术语只改 `data/dict.js` 一处，全站笔记同时生效

## Content quality standards

- **Technical accuracy**: All facts, source code, and implementation details must be correct
- **Depth gradient**: Junior (~150 chars) → Mid (~300 chars) → Senior (~500 chars)
- **Practical relevance**: Business scenarios must be real-world project examples
- **Code quality**: All code examples must be syntactically correct
- **Language**: All content in professional technical Chinese (unless the user specifies otherwise)
- **File size**: 一篇笔记 10–40KB；章节数量与顺序按内容需要，不套用固定八股结构
- **Diagram first**: 有流程/状态/时序的地方优先用 `data-ui="flow"`，不要写成长段落

## 已废弃

旧模板方案（`templates/` 下的 note-template.html、modules/、types/、content-types.json、
assemble.js，以及 `note-style.css`、`note.js`、`toc.js`、`mermaid-lightbox.js`）
已全部被组件库取代，并已从仓库移除（需要查阅时可从 git 历史中取回）。

**不要**在笔记里复用旧模板的类名——`summary-card`、`knowledge-card`、`code-wrapper`、
`speech-tab`、`scene-card` 等已被 `scan-notes.js` 的 `LEGACY_CLASSES` 列入黑名单，
出现即校验失败。所有写法一律用 `data-ui` 组件，权威参考是 `ui-showcase.html`。
