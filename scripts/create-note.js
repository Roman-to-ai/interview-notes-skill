/**
 * create-note.js — 创建笔记目录 + 直接生成 menu-data.js
 * 用法：
 *   node scripts/create-note.js -c basics/oop -t "什么是Java的封装特性？" -s encapsulation
 *   node scripts/create-note.js --batch notes.json
 *
 * notes.json 格式：
 *   { "category":"basics/oop", "section":"一、面向对象", "icon":"🧩",
 *     "topName":"Java基础", "topIcon":"☕", "title":"标题", "slug":"slug" }
 *
 * 批量模式自动增量更新 data/menu-data.js。
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// ── 工具函数 ──────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[（）()?？！!。，、：:"""]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40) || 'untitled';
}

// 校验 slug：不允许以数字-开头（如 01-xxx），不允许为空
function validateSlug(slug) {
  if (!slug || !slug.trim()) {
    throw new Error('slug 不能为空');
  }
  if (/^\d+-/.test(slug)) {
    throw new Error(`slug 不允许以数字-开头（"${slug}"），请使用纯英文 slug`);
  }
}

function calcBaseHref(notePath) {
  const dirLevels = notePath.split('/').length - 1;
  return '../'.repeat(dirLevels);
}

// ── 笔记空壳（无内容模板，能力全部来自 assets/js/note-ui.js 组件库）──

const NOTE_SHELL = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <base href="{{BASE_HREF}}">
  <link rel="stylesheet" href="assets/lib/highlight/github-dark.min.css" class="code-theme" data-theme="github-dark">
  <link rel="stylesheet" href="assets/lib/highlight/monokai.min.css" class="code-theme" data-theme="monokai" disabled>
  <link rel="stylesheet" href="assets/lib/highlight/tomorrow-night-bright.min.css" class="code-theme" data-theme="tomorrow-night-bright" disabled>
  <link rel="stylesheet" href="assets/css/note-ui.css">
  <script src="data/dict.js"><\/script>
</head>
<body>

<div data-ui="page" data-title="{{TITLE}}" data-path="" data-keypoints="">

  <!-- 在此自由组合组件，不要求模块顺序与数量。
       可用组件与写法速查：ui-showcase.html（page / section / code / flow /
       drawer / cards / table / tabs / callout / word） -->

</div>

<script src="assets/lib/highlight/highlight.min.js"><\/script>
<script src="assets/lib/mermaid/mermaid.min.js"><\/script>
<script src="assets/js/note-ui.js"><\/script>
</body>
</html>
`;

// ── 创建目录 ──────────────────────────────────────────

function createNoteDir(category, title, slug, type) {
  validateSlug(slug);

  const categoryDir = `notes/${category}`;
  const noteDir = path.join(ROOT, categoryDir, slug);
  const notePath = `${categoryDir}/${slug}/index.html`;
  const baseHref = calcBaseHref(notePath);

  if (!fs.existsSync(noteDir)) {
    fs.mkdirSync(noteDir, { recursive: true });
  }

  // 写入空壳（已存在则不覆盖，避免清掉已填内容）
  const destPath = path.join(noteDir, 'index.html');
  let fresh = false;
  if (!fs.existsSync(destPath)) {
    fs.writeFileSync(destPath, NOTE_SHELL.replace(/\{\{TITLE\}\}/g, title), 'utf-8');
    fresh = true;
  }

  return { noteDir, notePath, baseHref, folderName: slug, fresh };
}

// ── 从 batch 数据直接生成 menu-data.js ────────────────

function generateMenuData(items) {
  // 按 category 分组（保留顺序）
  const sections = new Map();
  for (const item of items) {
    const cat = item.category;
    if (!sections.has(cat)) {
      sections.set(cat, {
        section: item.section || cat,
        icon: item.icon || '📄',
        notes: [],
      });
    }
    sections.get(cat).notes.push(item);
  }

  // 提取顶级分类名（从第一个 category 的第一段路径）
  const firstCat = items[0]?.category || '';
  const topId = firstCat.split('/')[0] || 'notes';
  const topName = items[0]?.topName || topId;
  const topIcon = items[0]?.topIcon || '📚';

  // 构建菜单结构
  const children = [];
  for (const [cat, info] of sections) {
    children.push({
      id: cat.replace(/\//g, '-'),
      name: info.section,
      icon: info.icon,
      children: info.notes.map((n, i) => ({
        id: `note-${String(i + 1).padStart(2, '0')}`,
        name: n.title,
        path: n.notePath,
        tags: n.tags || [],
      })),
    });
  }

  return [{
    id: topId,
    name: topName,
    icon: topIcon,
    children,
  }];
}

// ── 增量合并新笔记到已有菜单 ─────────────────────────

function mergeMenuData(existing, newItems) {
  // 构建 section → 笔记列表的映射
  const sectionMap = new Map();
  for (const item of newItems) {
    const cat = item.category;
    if (!sectionMap.has(cat)) {
      sectionMap.set(cat, {
        section: item.section || cat,
        icon: item.icon || '📄',
        notes: [],
      });
    }
    sectionMap.get(cat).notes.push(item);
  }

  // 深拷贝 existing 以免修改原数据
  const result = JSON.parse(JSON.stringify(existing));

  // 从新笔记推断目标顶级分类（如 collections、basics）
  const firstCat = newItems[0]?.category || '';
  const targetTopId = firstCat.split('/')[0] || 'notes';
  const targetTopName = newItems[0]?.topName || targetTopId;
  const targetTopIcon = newItems[0]?.topIcon || '📚';

  // 在已有菜单中查找该顶级分类，找不到则新建
  let top = result.find(c => c.id === targetTopId);
  if (!top) {
    top = { id: targetTopId, name: targetTopName, icon: targetTopIcon, children: [] };
    result.push(top);
  }

  // 按 section name 查找或创建二级分类
  for (const [cat, info] of sectionMap) {
    const sectionId = cat.replace(/\//g, '-');
    let section = top.children.find(c => c.id === sectionId);

    if (!section) {
      // 新建二级分类
      section = {
        id: sectionId,
        name: info.section,
        icon: info.icon,
        children: [],
      };
      top.children.push(section);
    }

    // 追加新笔记（跳过已存在的路径）
    const existingPaths = new Set(section.children.map(n => n.path).filter(Boolean));
    let seq = section.children.length;
    for (const note of info.notes) {
      if (!existingPaths.has(note.notePath)) {
        seq++;
        section.children.push({
          id: `note-${String(seq).padStart(2, '0')}`,
          name: note.title,
          path: note.notePath,
          tags: note.tags || [],
        });
      }
    }
  }

  return result;
}

// ── 命令行 ────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { mode: null, category: null, title: null, slug: null, batchFile: null, type: null };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--category': case '-c': result.category = args[++i]; break;
      case '--title':    case '-t': result.title = args[++i]; break;
      case '--slug':     case '-s': result.slug = args[++i]; break;
      case '--type':              result.type = args[++i]; break;
      case '--batch':    case '-b': result.batchFile = args[++i]; result.mode = 'batch'; break;
    }
  }

  if (!result.mode && result.category && result.title) result.mode = 'single';
  return result;
}

function main() {
  const opts = parseArgs();

  if (!opts.mode) {
    console.log('\n📝 笔记目录创建 + menu-data.js 生成\n');
    console.log('用法:');
    console.log('  单个: node scripts/create-note.js -c basics/oop -t "标题" -s slug');
    console.log('  批量: node scripts/create-note.js --batch notes.json');
    console.log('\nnotes.json 格式:');
    console.log('  [{ "category":"basics/oop", "section":"一、面向对象", "icon":"🧩",');
    console.log('     "topName":"Java基础", "topIcon":"☕", "title":"标题", "slug":"slug" }]\n');
    return;
  }

  if (opts.mode === 'batch') {
    const batchPath = path.resolve(ROOT, opts.batchFile);
    if (!fs.existsSync(batchPath)) { console.error(`❌ 文件不存在: ${batchPath}`); process.exit(1); }

    const items = JSON.parse(fs.readFileSync(batchPath, 'utf-8'));
    console.log(`\n📝 批量创建 ${items.length} 个笔记目录\n`);

    // 创建目录并记录路径（跳过已存在的）
    let created = 0;
    let skipped = 0;
    for (const item of items) {
      try {
        const r = createNoteDir(item.category, item.title, item.slug || slugify(item.title), item.type);
        item.notePath = r.notePath;
        item.baseHref = r.baseHref;
        if (r.fresh) {
          console.log(`  ✅ ${r.notePath}`);
          created++;
        } else {
          console.log(`  ⏭ 已存在: ${r.notePath}`);
          skipped++;
        }
      } catch (e) {
        console.error(`  ❌ ${item.title || '?'}: ${e.message}`);
        process.exit(1);
      }
    }

    // 增量合并到 menu-data.js（不覆盖已有条目）
    const menuDataPath = path.join(ROOT, 'data', 'menu-data.js');
    let existingMenu = [];
    if (fs.existsSync(menuDataPath)) {
      try {
        const content = fs.readFileSync(menuDataPath, 'utf-8');
        const match = content.match(/window\.__MENU_DATA__\s*=\s*([\s\S]*?);\s*$/);
        if (match) existingMenu = JSON.parse(match[1]);
      } catch { /* 解析失败则从头生成 */ }
    }

    // 收集已有路径
    const existingPaths = new Set();
    function collectPaths(nodes) {
      for (const n of nodes) {
        if (n.path) existingPaths.add(n.path);
        if (n.children) collectPaths(n.children);
      }
    }
    collectPaths(existingMenu);

    // 过滤出新条目
    const newItems = items.filter(it => !existingPaths.has(it.notePath));

    if (newItems.length > 0 || existingMenu.length === 0) {
      // 合并或全新生成
      const merged = existingMenu.length > 0
        ? mergeMenuData(existingMenu, newItems)
        : generateMenuData(items);
      fs.writeFileSync(menuDataPath, `window.__MENU_DATA__ = ${JSON.stringify(merged, null, 2)};\n`, 'utf-8');
      if (existingMenu.length > 0) {
        console.log(`\n✅ 已增量更新 data/menu-data.js（新增 ${newItems.length} 条）`);
      } else {
        console.log(`\n✅ 已生成 data/menu-data.js`);
      }
    } else {
      console.log(`\n⏭ 所有笔记已在 menu-data.js 中，无需更新`);
    }

    console.log(`   新建 ${created} 个目录，跳过 ${skipped} 个已存在目录\n`);

  } else {
    const r = createNoteDir(opts.category, opts.title, opts.slug || slugify(opts.title), opts.type);
    console.log(`✅ 目录已创建: ${r.notePath}`);
    console.log(`   <base href="${r.baseHref}">`);
    console.log(`   ${r.fresh ? '已写入组件化空壳（内容按需自由组合）' : '已存在，未覆盖'}`);
    console.log('   提示: 批量模式(--batch)可自动生成 menu-data.js\n');
  }
}

main();
