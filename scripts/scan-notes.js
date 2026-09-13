/**
 * scan-notes.js — 扫描笔记目录，验证组件契约
 *
 * 职责：
 *   1. 扫描 notes/ 目录，统计每篇用了哪些 data-ui 组件
 *   2. 从 menu-data.js 读取菜单数据，验证路径完整性（--verify）
 *   3. 检查组件契约：未知组件名、必填属性缺失、占位符残留、旧模板类名、空壳（--verify）
 *
 * 用法：
 *   node scripts/scan-notes.js              # 扫描并统计
 *   node scripts/scan-notes.js --verify     # 同时验证路径与组件契约
 *   node scripts/scan-notes.js --detailed   # 显示每篇的组件用量
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NOTES_DIR = path.join(ROOT, 'notes');
const MENU_DATA_PATH = path.join(ROOT, 'data', 'menu-data.js');

const VERIFY = process.argv.includes('--verify');
const DETAILED = process.argv.includes('--detailed');

// ── 组件识别（对应 assets/js/note-ui.js 的 registry）────────
// 模板已废除：笔记内容自由组合，这里只统计用了哪些组件、并检查契约

const KNOWN_COMPONENTS = [
  'page', 'section', 'code', 'flow', 'drawer', 'drawer-group',
  'cards', 'card', 'table', 'tabs', 'tab', 'callout', 'word', 'zoom', 'words-auto',
];

const COMPONENT_DETECTORS = {
  page:    { re: /data-ui\s*=\s*["']?page\b/g,        label: '页面壳' },
  section: { re: /data-ui\s*=\s*["']?section\b/g,     label: '章节' },
  code:    { re: /data-ui\s*=\s*["']?code\b/g,        label: '代码块' },
  flow:    { re: /data-ui\s*=\s*["']?flow\b/g,        label: '流程图' },
  drawer:  { re: /data-ui\s*=\s*["']?drawer\b(?!-)/g, label: '抽屉' },
  cards:   { re: /data-ui\s*=\s*["']?cards\b/g,       label: '卡片组' },
  table:   { re: /data-ui\s*=\s*["']?table\b/g,       label: '表格' },
  tabs:    { re: /data-ui\s*=\s*["']?tabs\b/g,        label: '选项卡' },
  callout: { re: /data-ui\s*=\s*["']?callout\b/g,     label: '提示框' },
  word:    { re: /data-ui\s*=\s*["']?word\b(?!s)/g,   label: '生词' },
};

// 旧模板遗留类名 → 组件库不识别，出现说明内容没迁移
const LEGACY_CLASSES = [
  'summary-card', 'knowledge-card', 'mermaid-wrapper', 'compare-table',
  'code-wrapper', 'speech-tab', 'scene-card', 'faq-item', 'objectives-card',
  'practice-item', 'quiz-item', 'glossary-table', 'section-title', 'topic-path',
];

// 占位符残留 → 说明内容没填完
const PLACEHOLDER_RE = /(（待补充）|\(待补充\)|待替换|\{\{\s*[A-Z_]+\s*\}\}|TODO|FIXME|lorem ipsum|XXXX)/i;

function analyzeComponents(content) {
  const counts = {};
  for (const [id, det] of Object.entries(COMPONENT_DETECTORS)) {
    counts[id] = (content.match(det.re) || []).length;
  }

  const problems = [];

  // 1) 未知组件名（拼错会导致组件不生效）
  const used = new Set();
  const anyRe = /data-ui\s*=\s*["']([^"'\s>]+)["']/g;
  let m;
  while ((m = anyRe.exec(content)) !== null) used.add(m[1]);
  for (const name of used) {
    if (!KNOWN_COMPONENTS.includes(name)) {
      problems.push(`未知组件 data-ui="${name}"（可用：${KNOWN_COMPONENTS.join(', ')}）`);
    }
  }

  // 2) 组件契约必填项
  if (counts.page > 0 && !/data-ui\s*=\s*["']?page[^"']*["'][^>]*data-title/s.test(content)
      && !/data-title[^>]*data-ui\s*=\s*["']?page/s.test(content)) {
    problems.push('page 组件缺少 data-title');
  }
  if (counts.section > 0) {
    const sectionTags = content.match(/<(section|div)[^>]*data-ui\s*=\s*["']?section[^>]*>/g) || [];
    const noTitle = sectionTags.filter((t) => !/data-title\s*=/.test(t));
    if (noTitle.length) problems.push(`${noTitle.length} 个 section 缺少 data-title（目录会显示占位）`);
  }
  const emptyTabs = (content.match(/<div[^>]*data-ui\s*=\s*["']?tab\b(?!s)[^>]*>/g) || [])
    .filter((t) => !/data-label\s*=/.test(t));
  if (emptyTabs.length) problems.push(`${emptyTabs.length} 个 tab 缺少 data-label（按钮无文字）`);

  const emptyFlow = [...content.matchAll(/<div[^>]*data-ui\s*=\s*["']?flow["']?[^>]*>([\s\S]*?)<\/div>/g)]
    .filter((mm) => !mm[1].trim()).length;
  if (emptyFlow) problems.push(`${emptyFlow} 个 flow 组件内容为空`);

  // 3) 占位符残留
  const ph = content.match(new RegExp(PLACEHOLDER_RE, 'gi'));
  if (ph) problems.push(`残留占位符：${[...new Set(ph.map((p) => p.trim()))].slice(0, 5).join(' / ')}`);

  // 4) 旧模板类名
  const legacy = LEGACY_CLASSES.filter((c) => new RegExp(`class="[^"]*\\b${c}\\b`).test(content));
  if (legacy.length) problems.push(`旧模板类名（组件库不生效）：${legacy.join(', ')}`);

  // 5) 组件库是否被引入
  if (!/note-ui\.js/.test(content)) problems.push('未引入 assets/js/note-ui.js');
  if (!/note-ui\.css/.test(content)) problems.push('未引入 assets/css/note-ui.css');

  counts._problems = problems;
  return counts;
}

// ── 扫描笔记 ──────────────────────────────────────────

function extractTitle(htmlPath) {
  try {
    const content = fs.readFileSync(htmlPath, 'utf-8');
    const match = content.match(/<title>([^<]*)<\/title>/i);
    return match ? match[1].trim().replace(/\s*[—\-]\s*面试笔记\s*$/i, '') : null;
  } catch { return null; }
}

function analyzeFile(htmlPath) {
  try {
    return analyzeComponents(fs.readFileSync(htmlPath, 'utf-8'));
  } catch { return null; }
}

function scanNotes() {
  const map = new Map();
  if (!fs.existsSync(NOTES_DIR)) return map;

  function walk(dir, relativePrefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const childDir = path.join(dir, entry.name);
      const childRel = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      const htmlPath = path.join(childDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        map.set(`notes/${childRel}/index.html`, {
          title: extractTitle(htmlPath) || entry.name,
          components: DETAILED || VERIFY ? analyzeFile(htmlPath) : null,
          size: DETAILED ? fs.statSync(htmlPath).size : null,
        });
      }
      walk(childDir, childRel);
    }
  }

  walk(NOTES_DIR, '');
  return map;
}

// ── 验证菜单中的路径 ────────────────────────────────

function verifyMenuPaths(menu, scanned) {
  let issues = 0;

  function walkMenu(items) {
    for (const item of items) {
      if (item.path) {
        // 叶子节点：检查文件是否存在
        if (!scanned.has(item.path)) {
          console.log(`  ❌ 路径不存在: ${item.path} (${item.name})`);
          issues++;
        }
      }
      if (item.children) walkMenu(item.children);
    }
  }

  walkMenu(menu);
  return issues;
}

// ── 验证组件契约 ──────────────────────────────────────

function isEmptyShell(counts) {
  const c = counts || {};
  return (c.section || 0) === 0 && (c.code || 0) + (c.flow || 0)
       + (c.drawer || 0) + (c.cards || 0) + (c.table || 0)
       + (c.tabs || 0) + (c.callout || 0) === 0;
}

function verifyComponents(scanned) {
  let issues = 0;
  let shells = 0;

  scanned.forEach((info, p) => {
    if (!info.components) return;
    const problems = info.components._problems || [];

    if (isEmptyShell(info.components)) {
      shells++;
      console.log(`  ⏭ ${p}：空壳，内容尚未生成`);
      return;
    }
    if (problems.length > 0) {
      issues++;
      console.log(`  ⚠ ${p}:`);
      problems.forEach((prob) => console.log(`     - ${prob}`));
    }
  });

  if (issues === 0) {
    console.log(shells > 0
      ? `  ✅ ${scanned.size - shells} 篇笔记组件契约检查通过（另有 ${shells} 篇空壳）`
      : `  ✅ ${scanned.size} 篇笔记组件契约检查通过`);
  }
  return issues;
}

// ── 主流程 ────────────────────────────────────────────

function main() {
  console.log('\n🔍 扫描笔记目录...\n');

  const scanned = scanNotes();
  console.log(`  发现 ${scanned.size} 篇笔记`);
  if (DETAILED) {
    scanned.forEach((info, p) => {
      console.log(`    📄 ${p} → "${info.title}" (${(info.size / 1024).toFixed(1)}KB)`);
      if (info.components) {
        const c = info.components;
        const parts = Object.keys(COMPONENT_DETECTORS)
          .filter((id) => c[id])
          .map((id) => `${id}=${c[id]}`);
        console.log(`       组件: ${parts.length ? parts.join(' ') : '（空壳）'}`);
        if (c._problems && c._problems.length) {
          console.log(`       问题: ${c._problems.join(' | ')}`);
        }
      }
    });
  }

  // 从 menu-data.js 加载菜单数据
  let menu = [];

  if (fs.existsSync(MENU_DATA_PATH)) {
    try {
      const raw = fs.readFileSync(MENU_DATA_PATH, 'utf-8');
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        menu = JSON.parse(raw.substring(start, end + 1));
      }
    } catch (e) {
      console.log(`  ⚠ menu-data.js 解析失败: ${e.message}`);
    }
  }

  // 判断菜单是否有实际笔记内容
  function hasNotes(items) {
    for (const item of items) {
      if (item.path) return true;
      if (item.children && item.children.length > 0 && hasNotes(item.children)) return true;
    }
    return false;
  }

  const menuReady = menu.length > 0 && hasNotes(menu);
  if (!menuReady) {
    console.log('\n  ⚠ 菜单为空，请先运行 node scripts/create-note.js --batch notes.json');
  }

  let pathIssues = 0;
  if (VERIFY && menuReady) {
    console.log('\n📋 路径验证：');
    pathIssues = verifyMenuPaths(menu, scanned);
    if (pathIssues === 0) console.log('  ✅ 所有路径有效');
  }

  if (VERIFY) {
    console.log('\n📋 组件契约检查：');
    verifyComponents(scanned);
  }

  console.log('');
  if (VERIFY && pathIssues > 0) process.exit(1);
}

main();
