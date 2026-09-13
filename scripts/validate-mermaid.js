/**
 * validate-mermaid.js — 验证笔记中 Mermaid 流程图语法（零依赖）
 *
 * 原理：用 Node.js vm 模块加载项目已有的 assets/lib/mermaid/mermaid.min.js，
 *       直接用 mermaid.parse() 验证语法，无需安装任何第三方依赖。
 *
 * 用法：
 *   node scripts/validate-mermaid.js               # 验证所有笔记
 *   node scripts/validate-mermaid.js --fix         # 自动修复常见问题
 *   node scripts/validate-mermaid.js --verbose     # 显示所有通过项
 *   node scripts/validate-mermaid.js notes/basics/  # 指定路径
 *
 * 工作流集成：
 *   node scripts/fix-base-href.js && node scripts/validate-mermaid.js --fix
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.cwd();
const NOTES_DIR = path.join(ROOT, 'notes');
const MERMAID_PATH = path.join(ROOT, 'assets', 'lib', 'mermaid', 'mermaid.min.js');

const FIX = process.argv.includes('--fix');
const VERBOSE = process.argv.includes('--verbose');
const TARGET = process.argv.find(a => a.startsWith('notes/') || a.startsWith('.'));

// ── 加载 mermaid.min.js（零依赖，用 vm 沙箱运行） ─────

let mermaidParse = null;
let mermaidLoadError = null;

try {
  if (!fs.existsSync(MERMAID_PATH)) {
    mermaidLoadError = `文件不存在: ${MERMAID_PATH}`;
  } else {
    const code = fs.readFileSync(MERMAID_PATH, 'utf-8');

    // 保存并替换全局变量
    const saved = {};
    const injectedGlobals = [
      'document', 'window', 'self', 'navigator', 'location', 'history',
      'Element', 'Node', 'DocumentFragment', 'SVGElement',
      'addEventListener', 'removeEventListener', 'dispatchEvent',
      'structuredClone',
    ];
    for (const g of injectedGlobals) {
      try { saved[g] = globalThis[g]; } catch (e) { saved[g] = undefined; }
    }

    // 监听器存储
    const listeners = {};
    globalThis.addEventListener = function (e, fn) {
      (listeners[e] = listeners[e] || []).push(fn);
    };
    globalThis.removeEventListener = function (e, fn) {
      const l = listeners[e];
      if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
    };
    globalThis.dispatchEvent = function (e) {
      const l = listeners[e.type];
      if (l) l.forEach(fn => fn(e));
    };

    // 最小 document 对象
    globalThis.document = {
      nodeType: 9,
      documentElement: { nodeType: 1, style: {} },
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
      createTextNode: () => ({}),
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      createRange: () => ({
        setStart: () => {},
        setEnd: () => {},
        commonAncestorContainer: { nodeType: 9 },
      }),
      defaultView: { addEventListener: () => {}, removeEventListener: () => {} },
    };

    globalThis.window = globalThis;
    globalThis.self = globalThis;
    globalThis.navigator = { userAgent: 'Node.js' };
    globalThis.location = { href: '' };
    globalThis.history = { pushState: () => {} };
    globalThis.Element = function Element() { this.nodeType = 1; };
    globalThis.Node = function Node() { this.nodeType = 1; };
    globalThis.DocumentFragment = function DocumentFragment() { this.nodeType = 11; };
    globalThis.SVGElement = function SVGElement() { this.nodeType = 1; };

    if (typeof globalThis.structuredClone !== 'function') {
      globalThis.structuredClone = (x) => JSON.parse(JSON.stringify(x));
    }

    // 注入全局 module（脚本文件中的 runInThisContext 没有 module）
    const savedModuleExports = module.exports;
    module.exports = {};
    globalThis.module = module;
    globalThis.exports = module.exports;

    // 在沙箱中执行 mermaid.min.js
    vm.runInThisContext(code, { timeout: 15000, filename: 'mermaid.min.js' });

    // 提取 parse 函数
    const mermaid = module.exports;
    if (mermaid && typeof mermaid.parse === 'function') {
      mermaidParse = mermaid.parse.bind(mermaid);
      mermaid.initialize({ startOnLoad: false });
    } else {
      mermaidLoadError = 'mermaid.parse 不可用';
    }

    // 恢复本地 module.exports
    module.exports = savedModuleExports;

    // 清理全局
    for (const g of [...injectedGlobals, 'module', 'exports']) {
      try {
        delete globalThis[g];
        if (saved[g] !== undefined) globalThis[g] = saved[g];
      } catch (e) { /* ignore */ }
    }
  }
} catch (e) {
  mermaidLoadError = e.message;
  // 尽力清理
  try {
    const cleanup = ['document', 'window', 'self', 'navigator', 'location', 'history',
      'Element', 'Node', 'DocumentFragment', 'SVGElement',
      'addEventListener', 'removeEventListener', 'dispatchEvent'];
    for (const g of cleanup) {
      try { delete globalThis[g]; } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
}

// ── 降级方案：正则检查（vm 沙箱失败时使用） ──────────

const DIAGRAM_TYPES = [
  'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
  'stateDiagram', 'stateDiagram-v2', 'gantt', 'pie', 'erDiagram',
  'journey', 'gitgraph', 'mindmap', 'timeline', 'zenuml',
  'block', 'xyChart', 'quadrantChart', 'requirementDiagram',
  'C4Context', 'C4Container', 'C4Component', 'C4Dynamic',
  'info', 'sankey-beta',
];

function regexValidate(block) {
  const errors = [];
  const lines = block.split('\n');

  // 1) 图表类型声明
  const firstLine = block.trim().split('\n')[0].trim();
  if (!DIAGRAM_TYPES.some(t => firstLine.startsWith(t + ' ') || firstLine === t)) {
    errors.push('缺少图表类型声明（如 graph TD、flowchart LR）');
  }

  // 2) 箭头空格
  lines.forEach((line, i) => {
    if (line.trim().startsWith('%%')) return;
    if (/-\s+->/.test(line)) errors.push(`第${i + 1}行: 箭头有空格（- -> → -->）`);
    if (/=\s+=>/.test(line)) errors.push(`第${i + 1}行: 粗箭头有空格（= => → ==>）`);
    if (/-\s*\.\s*->/.test(line)) errors.push(`第${i + 1}行: 点线箭头有空格`);
  });

  // 3) 中文标点
  lines.forEach((line, i) => {
    if (line.includes('（') || line.includes('）')) {
      errors.push(`第${i + 1}行: 使用了中文括号"（）"`);
    }
    if (line.includes('：') && /[a-zA-Z一-鿿]/.test(line[line.indexOf('：') - 1])) {
      errors.push(`第${i + 1}行: 使用了中文冒号"："`);
    }
  });

  // 4) subgraph/end 配对
  let depth = 0;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('subgraph')) depth++;
    if (t === 'end' || t.startsWith('end ')) depth--;
    if (depth < 0) { errors.push(`第${i + 1}行: 多余的 end`); depth = 0; }
  });
  if (depth > 0) errors.push(`缺少 ${depth} 个 end 闭合 subgraph`);

  return errors;
}

// ── 提取 Mermaid 代码块 ───────────────────────────────
// 支持两种写法，按文档顺序统一编号（供验证与 --fix 回写共用）：
//   组件库：<div data-ui="flow">mermaid 源码</div>
//   旧写法：<pre class="mermaid">mermaid 源码</pre>

const BLOCK_RE = /<(div|pre)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

function unescapeCode(s) {
  return s
    .replace(/<code[^>]*>/gi, '')
    .replace(/<\/code>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function collectMermaidBlocks(html) {
  const out = [];
  BLOCK_RE.lastIndex = 0;
  let m;
  while ((m = BLOCK_RE.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const isFlow = /\bdata-ui\s*=\s*["']?flow\b/i.test(attrs);
    const isLegacy = tag === 'pre' && /class\s*=\s*["'][^"']*\bmermaid\b/i.test(attrs);
    if (!isFlow && !isLegacy) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      tag,
      attrs,
      code: unescapeCode(m[3]),
    });
  }
  return out.filter((b) => b.code);
}

function extractMermaidBlocks(html) {
  return collectMermaidBlocks(html).map((b) => b.code);
}

// ── 扫描 HTML 文件 ────────────────────────────────────

function findHtmlFiles(targetDir) {
  const files = [];
  if (!fs.existsSync(targetDir)) return files;
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(dir, entry.name);
      const htmlPath = path.join(fullPath, 'index.html');
      if (fs.existsSync(htmlPath)) files.push(htmlPath);
      walk(fullPath);
    }
  }
  walk(targetDir);
  return files;
}

// ── 自动修复 ──────────────────────────────────────────

const FIXES = [
  { pattern: /(\S)\s+-\s*->\s*(\S)/g, replacement: '$1-->$2' },
  { pattern: /(\S)-\s+->\s*(\S)/g, replacement: '$1-->$2' },
  { pattern: /(\S)\s+-->\s*(\S)/g, replacement: '$1-->$2' },
  { pattern: /(\S)\s*-\s*\.\s*-\s*>\s*(\S)/g, replacement: '$1-.->$2' },
  { pattern: /(\S)\s*=\s*=\s*>\s*(\S)/g, replacement: '$1==>$2' },
  { pattern: /(\S)\s*-\s*-\s*>\s*(\S)/g, replacement: '$1-->$2' },
  { pattern: /（/g, replacement: '(' },
  { pattern: /）/g, replacement: ')' },
  { pattern: /(\w+)\s*：/g, replacement: '$1:' },
  { pattern: /\n{3,}/g, replacement: '\n\n' },
];

function autoFix(block) {
  let fixed = block;
  for (const fix of FIXES) {
    fixed = fixed.replace(fix.pattern, fix.replacement);
  }
  return fixed;
}

// ── 替换第 N 个 mermaid 块 ────────────────────────────

function replaceNthMermaidBlock(content, index, newCode) {
  const blocks = collectMermaidBlocks(content);
  const target = blocks[index];
  if (!target) return content;
  const open = `<${target.tag}${target.attrs}>`;
  return content.slice(0, target.start)
    + open + '\n' + newCode + '\n</' + target.tag + '>'
    + content.slice(target.end);
}

// ── 主流程 ────────────────────────────────────────────

async function main() {
  console.log('\n🔍 验证 Mermaid 流程图语法\n');

  // 提示当前验证模式
  if (mermaidParse) {
    console.log('  ⚙ 引擎: mermaid.min.js (真实解析器)\n');
  } else {
    console.log(`  ⚙ 引擎: 正则降级模式 (${mermaidLoadError || '未知错误'})\n`);
  }

  const targetDir = TARGET ? path.resolve(ROOT, TARGET) : NOTES_DIR;
  if (!fs.existsSync(targetDir)) {
    console.error(`  ❌ 路径不存在: ${targetDir}`);
    process.exit(1);
  }

  const htmlFiles = findHtmlFiles(targetDir);
  if (htmlFiles.length === 0) {
    console.log('  ⚠ 未找到 index.html 文件');
    return;
  }

  console.log(`  扫描 ${htmlFiles.length} 篇笔记...\n`);

  let total = 0;
  let passed = 0;
  let failed = 0;
  let fixed = 0;
  const errors = [];

  for (const filePath of htmlFiles) {
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');
    const blocks = extractMermaidBlocks(content);

    if (blocks.length === 0) {
      if (VERBOSE) console.log(`  ⏭ ${relPath}（无流程图）`);
      continue;
    }

    let fileContent = content;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      total++;

      // 验证
      let blockErrors = [];

      if (mermaidParse) {
        // 真实解析器模式
        try {
          await mermaidParse(block);
          // 有效
        } catch (e) {
          blockErrors.push(e.message);

          // 尝试自动修复
          if (FIX) {
            const fixedBlock = autoFix(block);
            if (fixedBlock !== block) {
              try {
                await mermaidParse(fixedBlock);
                // 修复后有效
                fileContent = replaceNthMermaidBlock(fileContent, i, fixedBlock);
                fs.writeFileSync(filePath, fileContent, 'utf-8');
                fixed++;
                console.log(`  🔧 已修复: ${relPath} 第${i + 1}个流程图`);
                passed++;
                continue;
              } catch (e2) {
                // 修复后仍无效，保留原始错误
              }
            }
          }
        }
      } else {
        // 正则降级模式
        blockErrors = regexValidate(block);

        if (blockErrors.length > 0 && FIX) {
          const fixedBlock = autoFix(block);
          if (fixedBlock !== block) {
            const fixedErrors = regexValidate(fixedBlock);
            if (fixedErrors.length === 0) {
              fileContent = replaceNthMermaidBlock(fileContent, i, fixedBlock);
              fs.writeFileSync(filePath, fileContent, 'utf-8');
              fixed++;
              console.log(`  🔧 已修复: ${relPath} 第${i + 1}个流程图`);
              passed++;
              continue;
            }
          }
        }
      }

      if (blockErrors.length === 0) {
        passed++;
        if (VERBOSE) console.log(`  ✅ ${relPath} 第${i + 1}个流程图`);
      } else {
        failed++;
        console.log(`  ❌ ${relPath} 第${i + 1}个流程图`);
        for (const err of blockErrors) {
          const short = err.length > 150 ? err.substring(0, 150) + '...' : err;
          console.log(`     ${short}`);
        }
        console.log('     代码内容:');
        block.split('\n').forEach((line, idx) => {
          console.log(`       ${idx + 1}| ${line}`);
        });
        console.log('');
        errors.push({ file: relPath, index: i + 1, error: blockErrors[0], block });
      }
    }
  }

  // ── 统计 ──
  console.log('\n📊 统计：');
  console.log(`   总计流程图: ${total}`);
  console.log(`   ✅ 通过: ${passed}`);
  if (fixed > 0) console.log(`   🔧 自动修复: ${fixed}`);
  if (failed > 0) {
    console.log(`   ❌ 失败: ${failed}`);
    console.log('');
    console.log('📋 常见错误排查：');
    console.log('   1. 箭头不能有多余空格：A-->B  ✅   A- ->B  ❌');
    console.log('   2. 节点名含特殊字符时用引号：A["节点文本"]');
    console.log('   3. 使用英文标点：() 不是 （）');
    console.log('   4. 每行末尾加分号或换行');
    console.log('   5. subgraph 必须有 end 闭合');
    console.log('');
    process.exit(1);
  } else {
    console.log(`\n  ✅ 所有流程图语法正确！\n`);
  }
}

main().catch(e => {
  console.error('  ❌ 脚本异常:', e.message);
  process.exit(1);
});