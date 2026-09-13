# 贡献指南

感谢你有兴趣为「面试笔记系统」出力。本文说明如何搭建环境、修改代码、以及提交 PR。

---

## 环境要求

- **Node.js ≥ 14**（`scripts/create-note.js` 用到了可选链 `?.`）
- 任意现代浏览器（Chrome / Edge / Firefox / Safari）

**不需要 `npm install`。** 本项目刻意保持零依赖：`scripts/` 只使用 Node 原生模块
（`fs` / `path` / `vm` / `child_process`），第三方库已预置在 `assets/lib/`，完全离线可用。

---

## 本地跑起来

```bash
git clone git@github.com:Roman-to-ai/interview-notes-skill.git
cd interview-notes-skill
```

然后用浏览器**直接打开 `index.html`** 即可。没有构建步骤、没有 dev server，
改完文件刷新页面就生效（`file://` 协议下所有功能均正常，包括代码主题切换与流程图灯箱）。

写笔记前请先打开 **`ui-showcase.html`** —— 它是组件写法的唯一权威来源，每个组件都有真实渲染结果和可复制的 HTML。

---

## 目录职责速查

| 路径 | 职责 |
|---|---|
| `assets/js/note-ui.js` | 组件库运行时，`registry` 在此注册 |
| `assets/css/note-ui.css` | 组件库样式（自带全部视觉规则，**不依赖 Tailwind**） |
| `ui-showcase.html` | 组件速查手册（真实渲染 + 可复制写法） |
| `SKILL.md` | 生成流程 + 组件契约表 |
| `scripts/` | 初始化 / 建笔记 / 修复 / 校验 |
| `data/dict.js` | 英文技术词全局词典 |
| `data/menu-data.js` | 菜单数据，由 `create-note.js` 自动生成，**勿手改** |

---

## 最重要的约定：新增一个组件要改五处

这是本项目**最容易漏、也最容易出错**的贡献路径。`CLAUDE.md` 里写的"四件套"漏了第 5 处，
实测确认：漏掉第 5 处会让 `scan-notes.js --verify` 把新组件当成**未知组件报错**。

### ① 在 `assets/js/note-ui.js` 的 `registry` 注册

组件就是「名字 → 处理函数」的映射，没有 schema 文件。处理函数在初始化时收到该 DOM 节点，
自己读 `node.dataset.*` 取参数：

```js
// registry 是 note-ui.js 内部的普通对象（约 L17）
registry.badge = function (node) {
  var text = node.dataset.text || '';
  var tone = node.dataset.tone || 'info';
  node.classList.add('ui-badge', 'ui-badge-' + tone);
  if (text) node.appendChild(el('span', 'ui-badge-label', text));
};
```

可以复用的内部工具函数（定义在文件顶部）：

| 函数 | 作用 |
|---|---|
| `el(tag, cls, text)` | 创建元素并设置 class / 文本 |
| `dedent(s)` | 去掉多行字符串的公共缩进 |
| `slug(s)` | 由标题生成锚点 id |

**注意事项：**

- 处理函数必须**幂等**。`initAll()` 会跳过已处理的节点（靠 `node._uiReady` 标记），
  但 `NoteUI.refresh()` 可能对同一节点再次调用。
- 组件在初始化时若摘掉了 `data-ui` 属性，`initAll()` 会正确跳过（见 `tab` 面板升级为 `tabpanel` 的写法）。
- 父组件先于子组件初始化（`drawer-group` 先于其内 `drawer`），依赖关系可放心假设。
- 必须能优雅降级：外部库缺失时（如 `mermaid` 未加载）不要抛错。`initAll()` 已用 try/catch 兜底，
  但请尽量自行处理。
- 需要外部库时用 `window.mermaid` 之类的存在性判断，不要硬依赖。

### ② 在 `assets/css/note-ui.css` 加样式

组件样式**一律自带**，不要引入 Tailwind 类名——主页面用 Tailwind，但笔记页不加载它。
沿用现有的 CSS 变量（`--ui-sans` 等）以保持主题一致。

### ③ 在 `ui-showcase.html` 加真实渲染示例

每个组件都要有可复制粘贴的写法片段 + 实际渲染结果。这是外部用户的唯一参考。

### ④ 在 `SKILL.md` 的组件契约表加一行

即 `## Step 3 — Write note content(组件契约)` 下的「组件总览」表（约 L113–L128），
格式为 `data-ui 标记 | 用途 | 自动获得的能力`。Claude 生成笔记时依赖这张表，
不加则 Claude 不会用你的新组件。

### ⑤ 在 `scripts/scan-notes.js` 登记

- `KNOWN_COMPONENTS` 数组（约 L31）**必须**加上组件名——否则 `--verify` 判定为未知组件，直接失败。
- `COMPONENT_DETECTORS` 正则表（约 L34）按需添加，用于统计该组件的使用量。
  仅作为容器、不需要单独计数的组件（如 `card`、`tab`）可以不加。

---

## 笔记内容的硬规则

写笔记或改示例时请遵守（摘自 `SKILL.md`）：

1. **裸 `<>` 必须转义** —— 笔记里出现的泛型、尖括号一律写 `&lt;` `&gt;`，否则 HTML 结构会被破坏。
2. **代码块必须显式写 `data-lang`** —— 如 `data-lang="java"`，否则不高亮。
3. **不要混用旧类名** —— 如 `summary-card`、`knowledge-card`、`code-wrapper` 等，
   `scan-notes.js` 的 `LEGACY_CLASSES` 会判定失败。旧模板方案已废弃。
4. **不留占位符** —— `（待补充）`、`{{XXX}}`、`TODO` 等会被 `--verify` 拦截。
5. `<base href="{{BASE_HREF}}">` 是**占位符，不要手改**，最后由 `fix-base-href.js` 统一替换。

---

## 提交前自查

**每个 PR 在提交前必须跑通：**

```bash
node scripts/scan-notes.js --verify
```

它会校验：笔记路径是否有效、是否出现未知组件、必填属性是否缺失、是否残留占位符或旧类名。
输出出现非零退出码就说明有问题。

改动涉及流程图时，再跑一次：

```bash
node scripts/validate-mermaid.js          # 校验
node scripts/validate-mermaid.js --fix    # 自动修箭头方向 / 全角括号
```

---

## 提交与 PR 流程

1. Fork 本仓库，从 `main` 切出分支：`git checkout -b feat/your-component`
2. 提交信息沿用现有的中文约定式风格：

   ```
   feat: 新增 badge 徽标组件
   fix: 修正 code 组件在超长行下的横向滚动
   docs: 补充 table 组件的 data-best 用法
   ```

3. 推送并开 PR，在描述里勾选自查项（PR 模板已列出）。
4. PR 描述请说明**动机**——解决什么问题，而不只是改了什么。

**合并要求**：`node scripts/scan-notes.js --verify` 通过；改动组件行为时，
`ui-showcase.html` 与 `SKILL.md` 已同步更新。

---

## 关于 `git commit` 的署名

请使用你自己的 Git 身份提交。若你希望隐藏真实邮箱，GitHub 提供了
「Keep my email addresses private」选项，可在 Settings → Emails 中开启，
并把 `user.email` 设为 `<用户名>@users.noreply.github.com`。

---

## 报告问题

- **Bug**：请用 Bug Report 模板，务必附上 Node 版本、浏览器、复现步骤，
  以及 `node scripts/scan-notes.js --verify` 的输出。
- **新组件 / 新功能**：请用 Feature Request 模板，先描述使用场景，
  再讨论 `data-ui` 的标记设计。

提出新组件前，建议先看看 `ui-showcase.html` 里的 14 个现有组件能不能组合出你要的效果——
本项目的设计哲学是**用少数正交的组件自由组合**，而不是为每个场景新增一个组件。

---

## 许可证

提交贡献即表示你同意以本项目的 [MIT 许可证](LICENSE) 授权你的贡献。
