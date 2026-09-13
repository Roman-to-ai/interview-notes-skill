# 面试笔记系统

> 用 Claude Code 写面试笔记：纯静态 HTML + 组件库。**笔记由组件自由组合而成，没有内容模板。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A5%2014-brightgreen.svg)](#环境要求)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0-orange.svg)](#环境要求)

---

## 这是什么

一个面试笔记系统。你给它一份考点清单，Claude Code 按 `SKILL.md` 的流程把它变成一套可浏览、
可搜索的静态笔记站点：左侧三级菜单、右侧内容区、三套代码配色、流程图点击放大。

它和别的笔记框架最大的不同在于——

### 没有内容模板，只有组件库

绝大多数笔记工具的用法是「挑一个模板 → 把占位符替换成你的内容」。章节顺序、模块种类都是定死的，
内容稍微特殊一点就要跟模板较劲。

这里反过来：**组件是积木，笔记是一次自由拼装**。你（或 Claude）在笔记里只写声明式标记：

```html
<div data-ui="page" data-title="InnoDB 为什么用 B+ 树做索引？"
     data-path="MySQL &gt; 索引 &gt; 数据结构" data-keypoints="B+树,聚簇索引,回表">

  <div data-ui="callout" data-tone="key">核心结论写在这里</div>

  <div data-ui="section" data-title="为什么不是红黑树">
    <div data-ui="flow">graph TD; A-->B;</div>
  </div>

  <div data-ui="code" data-lang="sql">EXPLAIN SELECT ...</div>
</div>
```

行为由 `assets/js/note-ui.js` 自动接管：章节自动编号并注册进右侧目录、代码块自动高亮并可复制、
流程图自动渲染并可点击放大。**笔记里不写一行 JS。**

一篇笔记用几个章节、按什么顺序、上哪些组件，完全由内容决定——没有"必须照搬的八股结构"。

---

## 组件一览

共 14 个组件，覆盖面试笔记的绝大多数表达需求：

| 组件 | 能做什么 |
|------|---------|
| `page` | 页面壳：面包屑 + 标题 + 考点路径 + 考察知识点徽标 |
| `section` | 章节：自动编号、注册进右侧目录、一键复制本节链接 |
| `code` | 代码：高亮、复制、语言/文件标签、行号、高亮指定行、对错描边、超长折叠、换行开关 |
| `flow` | 流程图：Mermaid 渲染、题注、点击灯箱（缩放/平移/复位）、复制源码、语法错降级 |
| `drawer` / `drawer-group` | 抽屉：原理拆解、面试官追问；组级全部展开/收起、手风琴互斥 |
| `cards` / `card` | 卡片组：响应式网格，适合业务场景并列 |
| `table` | 表格：滚动壳、斑马纹、表头吸顶、推荐列高亮、复制为 Markdown |
| `tabs` / `tab` | 选项卡：初/中/高三级话术、多语言对照，记住选择、键盘切换 |
| `callout` | 提示框：8 种语气（tip / note / key / hot / pit / warn / ok / quote） |
| `word` / `words-auto` | 生词提示：查全局词典补音标与中文，或整块自动扫描标注 |
| `zoom` | 任意图片 / SVG 复用灯箱放大 |

**完整写法与真实渲染效果见 [`ui-showcase.html`](ui-showcase.html)** —— 写笔记前先看这个，它是唯一权威来源。

内置交互（笔记里无需任何 JS）：右侧快速定位目录（滚动高亮 + 阅读进度条）、
流程图灯箱、代码主题三套切换、打印/导出 PDF 时自动展开折叠内容。

---

## 快速开始

### 方式 A：作为 Claude Code Skill 使用（推荐）

把 `SKILL.md` 交给 Claude Code，它会在 `Skill` 工具可用时自动加载，或者你直接说
"按 SKILL.md 的流程帮我建笔记"。

流程共 4 步：

```bash
# 1. 初始化目录结构（复制资产、组件库、词典）
node scripts/init.js --categories "basics:基础考点:☕,advanced:进阶考点:🚀"

# 2. 批量建笔记：建目录 + 写入零内容空壳 + 生成菜单
node scripts/create-note.js --batch notes.json

# 3. —— 在空壳里自由组合组件写内容（写法见 ui-showcase.html）——

# 4. 一键修复 + 校验
node scripts/fix-base-href.js && node scripts/scan-notes.js --verify
```

第 3 步是 Claude 来完成的部分。`SKILL.md` 里的组件契约表告诉它有哪些积木可用、
每块积木需要哪些属性，剩下的排版、章节划分、话术组织由它按内容自行判断。

### 方式 B：作为模板手工使用

不需要 Claude，也不需要 Node：

```bash
git clone git@github.com:Roman-to-ai/interview-notes-skill.git
cd interview-notes-skill
```

**直接用浏览器打开 `index.html`** 就能看到效果。要加笔记就复制
`notes/mysql/index/innodb-bplus-tree/` 这个示例，改内容，再手工往 `data/menu-data.js` 里加一条菜单项。

> 手工方式下你享受不到组件库之外的自动化（菜单生成、路径修复、契约校验），
> 但笔记本身仍由组件驱动，视觉效果完全一致。

---

## 目录结构

```
interview-notes-skill/
├── index.html                          # 主页面（左侧菜单 + 右侧 iframe 内容区）
├── ui-showcase.html                    # ★ 组件速查手册（真实渲染 + 可复制写法）
├── SKILL.md                            # ★ 生成流程 + 组件契约表（给 Claude Code 读）
├── assets/
│   ├── css/
│   │   ├── style.css                   # 主页面布局样式（菜单、搜索、响应式）
│   │   └── note-ui.css                 # ★ 组件库样式（自带全部视觉，不依赖 Tailwind）
│   ├── js/
│   │   ├── note-ui.js                  # ★ 组件库运行时（扫描 data-ui 自动增强）
│   │   ├── menu.js                     # 菜单数据引擎（递归渲染、展开折叠）
│   │   ├── search.js                   # 搜索过滤引擎（多关键词 AND、高亮、键盘导航）
│   │   └── app.js                      # 主控逻辑（初始化、iframe 加载、路由、响应式）
│   └── lib/                            # 第三方库（已预置，离线可用）
├── notes/                              # ★ 考点笔记，按分类组织
│   └── <category>/<section>/<slug>/index.html
├── data/
│   ├── menu-data.js                    # 菜单数据（create-note.js 自动维护，勿手改）
│   └── dict.js                         # ★ 英文技术词全局词典（音标 + 中文）
├── scripts/                            # 构建与校验脚本
└── references/
    └── docx-extraction.md              # .docx 题目提取参考
```

---

## 环境要求

| 项 | 要求 |
|---|---|
| 浏览器 | 任意现代浏览器。**`file://` 协议下全部功能可用**，无需起服务器 |
| Node.js | **≥ 14**（仅在用脚本时需要；`create-note.js` 用了可选链） |
| npm install | **不需要**。脚本只用 Node 原生模块（`fs` / `path` / `vm` / `child_process`） |
| 网络 | **不需要**。所有第三方库已预置在 `assets/lib/`，完全离线 |

`assets/lib/` 内置：[Tailwind CSS](https://tailwindcss.com) 3.4.1（仅主页面用）、
[highlight.js](https://highlightjs.org) 11.9.0 + 三套主题、
[Mermaid](https://mermaid.js.org) 10.9.0。许可与署名见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

---

## 功能细节

### 搜索

| 维度 | 匹配内容 | 示例 |
|------|---------|------|
| 题目名 | 叶子节点标题 | 搜"面向对象" → 命中该题 |
| 标签 tags | 每道题预设的关键词 | 搜"封装" → 命中含封装标签的题目 |
| 文件路径 | 笔记文件夹路径 | 搜"oop" → 命中 oop 相关笔记 |
| 分类名 | 所属一级/二级分类 | 搜"基础" → 匹配该分类下所有题目 |
| 多关键词 | 空格分隔，全部匹配（AND） | 搜"Java 多态" → 必须同时包含两词 |

快捷键：`Ctrl+K` 聚焦搜索框，`↓` 跳转匹配，`Enter` 打开第一个结果，`ESC` 清空。

### 代码主题切换

主页面右上角 ⚙️ 切换，或点代码块顶部的主题按钮，偏好自动保存：

| 主题 | 风格 |
|------|------|
| 🌙 GitHub Dark | 护眼冷色调（默认） |
| 🌅 Monokai | 红棕暖色，Sublime 经典 |
| 🌟 Tomorrow Night Bright | 黄绿暖色，长时阅读舒适 |

选择经 `localStorage` + `postMessage` 在父页面与 iframe 间同步，`file://` 下同样生效。

### 支持任意技术栈

系统不绑定任何技术栈。分类由 `--categories` 定义，代码块写 `data-lang="java"` / `"go"` / `"python"` 即可。
可选分类示例：`basics` `collections` `jvm` `mysql` / `html-css` `javascript` `react` / `go-concurrency` /
`system-design` `distributed`。

---

## 贡献

欢迎提 PR。**开始之前请务必读 [CONTRIBUTING.md](CONTRIBUTING.md)** ——
本项目有两条容易踩坑的硬约定：

1. **新增一个组件要改五处**（`note-ui.js` / `note-ui.css` / `ui-showcase.html` / `SKILL.md` /
   `scripts/scan-notes.js` 的 `KNOWN_COMPONENTS`）。漏掉最后一处会让校验脚本把新组件当未知组件报错。
2. 改了组件行为必须同步更新文档，`node scripts/scan-notes.js --verify` 必须通过。

提新组件前建议先看看现有 14 个能不能组合出你要的效果——本项目的设计哲学是
**用少数正交的组件自由组合**，而不是为每个场景新增组件。

---

## 许可证

[MIT](LICENSE) © 2026 Roman-to-ai

`notes/` 目录下的笔记**内容**版权归各笔记作者所有，不适用 MIT 许可证；MIT 仅覆盖系统代码。
详见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

## 致谢

感谢 [Tailwind CSS](https://tailwindcss.com)、[highlight.js](https://highlightjs.org)、
[Mermaid](https://mermaid.js.org) 三个优秀的开源项目。
