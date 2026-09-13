# 面试笔记系统

基于纯静态 HTML 的通用面试笔记系统，支持**任意技术栈**，包含分类浏览、精准搜索、三套代码配色切换，每个考点独立页面展示。

## 快速开始

### 1. 初始化项目

```bash
# 带预设分类初始化
node scripts/init.js --categories "basics:基础考点:☕,advanced:进阶考点:🚀,system-design:系统设计:🏗️"

# 或无参数初始化
node scripts/init.js
```

### 2. 第三方库（已预置）

```
assets/lib/
├── tailwind.min.js                     # Tailwind CSS v3.4.1 Play CDN
├── highlight/
│   ├── highlight.min.js                # highlight.js v11.9 核心
│   ├── github-dark.min.css             # 代码主题：🌙 GitHub 暗色（默认）
│   ├── monokai.min.css                 # 代码主题：🌅 Monokai 暖色
│   └── tomorrow-night-bright.min.css   # 代码主题：🌟 Tomorrow 暖色
└── mermaid/
    └── mermaid.min.js                  # Mermaid v10.9 流程图
```

### 3. 打开浏览器

直接打开 `index.html` 即可浏览。

---

## 目录说明

```
interview-notes/
├── index.html                          # 主页面（左侧菜单 + 右侧 iframe 内容区）
├── ui-showcase.html                    # ★ 组件速查手册（真实渲染 + 可复制写法）
├── README.md                           # 本说明文件
├── assets/
│   ├── css/
│   │   ├── style.css                   # 主页面布局样式（菜单、搜索、响应式）
│   │   └── note-ui.css                 # ★ 组件库样式（自带全部视觉，不依赖 Tailwind）
│   ├── js/
│   │   ├── note-ui.js                  # ★ 组件库运行时（扫描 data-ui 自动增强）
│   │   ├── menu.js                     # 菜单数据引擎（递归渲染、展开折叠）
│   │   ├── search.js                   # 搜索过滤引擎（多关键词 AND、高亮、键盘导航）
│   │   └── app.js                      # 主控逻辑（初始化、iframe 加载、路由、响应式）
│   └── lib/                            # ★ 第三方库（已预置，离线可用）
│       ├── tailwind.min.js             # 仅主页面使用
│       ├── highlight/
│       └── mermaid/
├── notes/                              # ★ 考点笔记（按分类文件夹组织）
│   └── <category>/<section>/<slug>/
│       └── index.html                  # 📝 笔记（组件自由组合，无固定模块）
├── data/
│   ├── menu-data.js                    # ★ 菜单数据（create-note.js 自动生成和维护）
│   └── dict.js                         # ★ 英文技术词全局词典（音标 + 中文）
├── scripts/
│   ├── init.js                         # 一键初始化（创建目录 + 复制资产）
│   ├── create-note.js                  # 建目录 + 写零内容空壳 + 增量更新菜单
│   ├── fix-base-href.js                # 自动修复 base href + Mermaid 验证
│   ├── validate-mermaid.js             # 流程图语法验证（data-ui="flow"）
│   └── scan-notes.js                   # 组件用量统计 + 契约校验
└── references/
    └── docx-extraction.md              # .docx 题目提取指南
```

> 旧的内容模板（`templates/`）与旧交互脚本（`note.js` / `toc.js` / `mermaid-lightbox.js` /
> `note-style.css`）已被组件库取代，存放在 `_archive/` 中，可直接删除。

---

## 创建新笔记

### 方式一：批量创建（推荐）

```bash
# 1. 准备 notes.json（定义所有笔记的分类、标题、slug）
# 2. 批量创建目录 + 写入零内容空壳 + 自动生成 menu-data.js
node scripts/create-note.js --batch notes.json
# 3. Claude 在空壳里用组件写内容（写法见 ui-showcase.html）
# 4. 修复 + 校验
node scripts/fix-base-href.js && node scripts/scan-notes.js --verify
```

### 方式二：手动创建

1. 在对应分类下创建文件夹，如 `notes/basics/new-topic/`
2. 复制任意已有笔记的 head/foot（或跑一次 `create-note.js` 生成空壳）
3. 在 `data-ui="page"` 容器里自由组合组件填写内容
4. 运行 `node scripts/create-note.js --batch notes.json` 更新菜单

### 验证笔记

```bash
node scripts/scan-notes.js              # 基本扫描
node scripts/scan-notes.js --verify     # 验证路径 + 组件契约
node scripts/scan-notes.js --detailed   # 显示文件大小与每篇组件用量
```

---

## 笔记规范（组件而非固定模块）

**没有必须照搬的八股结构**——章节数量、顺序、用到的组件都按内容需要决定。
下面是常见的组合方式，供参考：

| 组件 | 典型用途 |
|------|---------|
| `data-ui="page"` | 每篇一个：标题 + 考点路径 + 考察知识点徽标 |
| `data-ui="section"` | 一个章节，自动编号并进入右侧目录 |
| `data-ui="callout" data-tone="key"` | 开篇一句话结论 |
| `data-ui="drawer-group"` + `drawer` | 原理拆解 / 面试官追问（可折叠，支持一键展开） |
| `data-ui="flow"` | 流程 / 状态 / 时序图，点击放大 |
| `data-ui="table" data-best` | 方案横向对比，高亮推荐列 |
| `data-ui="code" data-mark data-tone` | 代码示例，可标错误 vs 正确写法 |
| `data-ui="tabs"` + `.ui-speech-block` | 初/中/高三级话术，总→分→总 |
| `data-ui="cards"` + `card` | 业务场景卡片，响应式排布 |
| `data-ui="word"` / `data-words="auto"` | 英文术语的音标 + 中文提示 |

---

## 代码主题切换

代码块顶部有 **3 个主题切换按钮**，点击即时生效，偏好自动保存：

| 按钮 | 主题 | 风格特点 |
|------|------|---------|
| 🌙 暗色 | GitHub Dark | 护眼冷色调，GitHub 官方风格（**默认**） |
| 🌅 Monokai | Monokai | 红棕暖色调，Sublime Text 经典风格 |
| 🌟 Tomorrow | Tomorrow Night Bright | 黄绿暖色调，长时阅读舒适 |

---

## 搜索功能

| 维度 | 匹配内容 | 示例 |
|------|---------|------|
| 题目名 | 叶子节点的标题文字 | 搜"面向对象" → 命中该题 |
| 标签 tags | 每道题预设的关键词 | 搜"封装" → 命中含封装标签的题目 |
| 文件路径 | 笔记文件夹路径 | 搜"oop" → 命中 oop 相关笔记 |
| 分类名 | 所属一级/二级分类 | 搜"基础" → 匹配该分类下所有题目 |
| 多关键词 | 空格分隔，全部匹配（AND） | 搜"Java 多态" → 必须同时包含两词 |

快捷键：`Ctrl+K` 聚焦搜索框，`↓` 跳转匹配，`Enter` 打开第一个结果，`ESC` 清空搜索。

---

## 支持任意技术栈

本系统**不绑定任何特定技术栈**。使用时：

1. 通过 `--categories` 参数在初始化时定义分类
2. 代码块写 `data-lang="java"` / `"go"` / `"python"` 等（组件自动加载对应高亮）
3. 分类和菜单由 `data/menu-data.js` 驱动，`create-note.js --batch` 自动维护

示例分类：
- **Java**: `basics`, `collections`, `jvm`, `mysql`
- **前端**: `html-css`, `javascript`, `react`, `vue`
- **Go**: `go-basics`, `go-concurrency`, `go-stdlib`
- **系统设计**: `system-design`, `distributed`, `architecture`

---

## 注意事项

1. **所有第三方库已预置在 `assets/lib/`**，完全离线可用，无需网络
2. 笔记中的资源引用使用 `<base href>` + `assets/...` 路径，自动适配目录深度
3. 所有脚本仅使用 Node.js 原生库（`fs`、`path`、`readline`），无需 npm install
4. 菜单数据 `data/menu-data.js` 由 `create-note.js` 自动维护，无需手动编辑
