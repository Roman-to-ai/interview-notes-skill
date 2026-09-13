# docx 内容提取与题目分组指南

## 三种提取方式

### 方式 1：officecli MCP（推荐）

通过 `/officecli` 技能调用 MCP 工具，直接读取 .docx 文件内容：

```
/officecli read "path/to/file.docx"
```

officecli 会自动解析 .docx 并输出纯文本内容，无需关心环境依赖。

**优势**：零配置，一键读取，Claude 直接拿到结构化文本。

---

### 方式 2：Node.js（纯原生，零依赖）

利用 Node.js 内置的 `fs`、`zlib` 模块，手动解析 ZIP 结构 + 解压 deflate + 提取 XML 文本：

```bash
node -e "
const fs = require('fs');
const zlib = require('zlib');

function extractDocx(filePath) {
  const buffer = fs.readFileSync(filePath);

  // ── 查找 ZIP 中央目录结尾标记 (EOCD) ──
  const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  let eocdPos = buffer.lastIndexOf(eocdSig);
  if (eocdPos === -1) throw new Error('不是有效的 .docx 文件');

  const totalEntries = buffer.readUInt16LE(eocdPos + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdPos + 16);

  // ── 遍历中央目录，找到 word/document.xml ──
  let pos = centralDirOffset;
  const entries = [];

  for (let i = 0; i < totalEntries; i++) {
    const fileNameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    const compSize = buffer.readUInt32LE(pos + 20);
    const method = buffer.readUInt16LE(pos + 10); // 0=stored, 8=deflate
    const fileName = buffer.toString('utf-8', pos + 46, pos + 46 + fileNameLen);

    entries.push({ fileName, localOffset, compSize, method });
    pos += 46 + fileNameLen + extraLen + commentLen;
  }

  const docEntry = entries.find(e => e.fileName === 'word/document.xml');
  if (!docEntry) throw new Error('未找到 word/document.xml');

  // ── 读取本地文件头后的压缩数据 ──
  const localHeader = docEntry.localOffset;
  const fileNameLen2 = buffer.readUInt16LE(localHeader + 26);
  const extraLen2 = buffer.readUInt16LE(localHeader + 28);
  const dataStart = localHeader + 30 + fileNameLen2 + extraLen2;
  const compressed = buffer.subarray(dataStart, dataStart + docEntry.compSize);

  // ── 解压 ──
  const xml = docEntry.method === 0
    ? compressed.toString('utf-8')
    : zlib.inflateRawSync(compressed).toString('utf-8');

  // ── 提取所有 <w:t> 标签文本 ──
  const textMatches = xml.match(/<w:t[^>]*>([^<]+)<\\/w:t>/g) || [];
  return textMatches.map(m => m.replace(/<[^>]+>/g, '')).join('');
}

const text = extractDocx(process.argv[1] || 'PATH_TO_FILE.docx');
const lines = text.split(/\\n+/).filter(l => l.trim());
console.log(lines.join('\\n'));
"
```

---

### 方式 3：Python（纯标准库，零依赖）

利用 Python 内置的 `zipfile` 和 `xml.etree.ElementTree` 解析 .docx：

```bash
python -c "
import zipfile, xml.etree.ElementTree as ET

with zipfile.ZipFile(r'PATH_TO_FILE.docx') as z:
    xml = z.read('word/document.xml')

root = ET.fromstring(xml)
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

for p in root.iter('{%s}p' % ns):
    texts = [t.text for t in p.iter('{%s}t' % ns) if t.text]
    line = ''.join(texts)
    if line.strip():
        print(line)
"
```

---

## 提取后的文本解析

典型的 .docx 面试题文件结构一致：

```
DOCUMENT TITLE                           ← 文档标题
一、SECTION NAME                          ← 章节标题（一、二、三…）
1. QUESTION TEXT?                         ← 编号题目
2. QUESTION TEXT?
二、NEXT SECTION
...
```

### 解析规则

1. **文档标题**：第一行
2. **章节标题**：匹配 `^[一二三四五六七八九十]+、` → 章节分组
3. **题目**：匹配 `^\d+\.\s` → 单道面试题
4. **忽略**：空行、分隔符行

## 题目分组策略

.docx 文件中包含原始题目，需要**合并为连贯的笔记**。规则：

### 合并为同一篇笔记

- 题目覆盖同一类/概念的多个方面
  - 例："HashMap原理" + "HashMap为什么用红黑树" + "HashMap除了红黑树还有什么改动" → 1 篇笔记："HashMap核心原理"
- 题目形成"概念 → 细节 → 优化"的自然链条
  - 例："什么是序列化" + "深拷贝和浅拷贝区别" → 1 篇笔记："序列化与深浅拷贝"

### 拆分为多篇笔记

- 题目覆盖完全不同的概念
  - 例："JDK和JRE区别" vs "基本数据类型" → 分篇笔记
- 合并后的笔记过大（>40KB）或主题发散

## 分类映射

分类由用户定义。根据文档结构将 .docx 章节映射到分类：

| .docx 章节 | 建议分类 ID | 文件夹 |
|------------|------------|--------|
| `<章节名>` | `<分类-id>` | `notes/<分类-id>/` |

用户在提供 .docx 文件时需指定分类映射关系。