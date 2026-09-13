# 第三方组件许可声明

本项目在 `assets/lib/` 下**原样分发**了以下第三方库，以便完全离线可用。
各库版权归其各自作者所有，并按其原始许可证授权。本文件依据各许可证的署名保留要求提供。

| 库 | 版本 | 许可证 | 文件 |
|---|---|---|---|
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | 3.4.1 | MIT | `assets/lib/tailwind.min.js` |
| [highlight.js](https://github.com/highlightjs/highlight.js) | 11.9.0 | **BSD-3-Clause** | `assets/lib/highlight/highlight.min.js` |
| highlight.js 主题（GitHub Dark / Monokai / Tomorrow Night Bright） | 11.9.0 | BSD-3-Clause | `assets/lib/highlight/*.min.css` |
| [Mermaid](https://github.com/mermaid-js/mermaid) | 10.9.0 | MIT | `assets/lib/mermaid/mermaid.min.js` |

版本号由实际文件内容核实（非取自 README 描述）。

> **注意**：Tailwind CSS 与 Mermaid 的 min 构建产物**已剥离许可证头部**，highlight.js 的头部则完整保留。
> 因此本文件不是可选项——它是这些库许可条款在本项目中的唯一署名载体。

---

## Tailwind CSS v3.4.1 — MIT

Copyright (c) Tailwind Labs, Inc.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

本项目使用的是 **Tailwind CSS Play CDN 独立构建**（`tailwind.min.js`）。
本仓库仅将其用于主页面布局样式；笔记组件样式（`assets/css/note-ui.css`）不依赖 Tailwind。

---

## highlight.js v11.9.0 — BSD-3-Clause

`assets/lib/highlight/highlight.min.js` 文件头的原始声明如下，**逐字转载**：

```
/*!
  Highlight.js v11.9.0 (git: f47103d4f1)
  (c) 2006-2023 undefined and other contributors
  License: BSD-3-Clause
 */
```

其中版权人一栏显示为字面量 `undefined`，这是 **highlight.js 上游在打包 v11.9.0 时变量未被替换**所导致的构建瑕疵，并非本项目修改所致。上游项目的许可与著作权信息请以
<https://github.com/highlightjs/highlight.js/blob/main/LICENSE> 为准。

BSD 3-Clause License

```
Copyright (c) 2006, Ivan Sagalaev and other contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

三套代码主题（`github-dark.min.css` / `monokai.min.css` / `tomorrow-night-bright.min.css`）
同属 highlight.js 项目，适用同一许可证。

---

## Mermaid v10.9.0 — MIT

Copyright (c) 2014-present, Knut Sveidqvist

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Mermaid 自身还依赖若干 MIT 许可的子包（d3、dagre-d3、khroma 等），其许可声明同样被上游构建合并进
`mermaid.min.js`，完整清单见 <https://github.com/mermaid-js/mermaid/blob/develop/LICENSE>。

---

## 关于 `notes/` 目录

`notes/` 下的**笔记内容**（题目文字、解析、话术等）版权归各笔记作者所有，
**不适用**本项目的 MIT 许可证。若你要转载他人撰写的笔记，请先取得该作者许可。

本项目的 MIT 许可证（见 `LICENSE`）仅覆盖**系统代码**：`index.html`、`ui-showcase.html`、
`assets/css/`、`assets/js/`、`scripts/`、`data/`、`SKILL.md`、`CLAUDE.md` 及文档。
