/**
 * init.js — 面试笔记项目初始化脚本
 * 功能：创建完整目录树、复制资产文件、初始化菜单配置
 * 用法：node scripts/init.js [--categories "cat1:分类1:icon1,cat2:分类2:icon2"]
 * 注意：仅使用 Node.js 原生库，无第三方依赖
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKILL_DIR = path.resolve(__dirname, '..');

// 资产文件映射：skill 目录 → 项目根目录
const ASSET_MAP = [
  // index.html（主页面）+ 组件速查手册
  { src: 'index.html', dest: 'index.html' },
  { src: 'ui-showcase.html', dest: 'ui-showcase.html' },
  // CSS
  { src: 'assets/css/style.css', dest: 'assets/css/style.css' },
  { src: 'assets/css/note-ui.css', dest: 'assets/css/note-ui.css' },
  // JS（note-ui.js 为组件库统一运行时）
  { src: 'assets/js/app.js', dest: 'assets/js/app.js' },
  { src: 'assets/js/menu.js', dest: 'assets/js/menu.js' },
  { src: 'assets/js/search.js', dest: 'assets/js/search.js' },
  { src: 'assets/js/note-ui.js', dest: 'assets/js/note-ui.js' },
  // 数据（生词全局词典）
  { src: 'data/dict.js', dest: 'data/dict.js' },
  // 第三方库
  { src: 'assets/lib/tailwind.min.js', dest: 'assets/lib/tailwind.min.js' },
  { src: 'assets/lib/highlight/highlight.min.js', dest: 'assets/lib/highlight/highlight.min.js' },
  { src: 'assets/lib/highlight/github-dark.min.css', dest: 'assets/lib/highlight/github-dark.min.css' },
  { src: 'assets/lib/highlight/monokai.min.css', dest: 'assets/lib/highlight/monokai.min.css' },
  { src: 'assets/lib/highlight/tomorrow-night-bright.min.css', dest: 'assets/lib/highlight/tomorrow-night-bright.min.css' },
  { src: 'assets/lib/mermaid/mermaid.min.js', dest: 'assets/lib/mermaid/mermaid.min.js' },
  // 脚本
  { src: 'scripts/scan-notes.js', dest: 'scripts/scan-notes.js' },
  { src: 'scripts/create-note.js', dest: 'scripts/create-note.js' },
  { src: 'scripts/fix-base-href.js', dest: 'scripts/fix-base-href.js' },
  { src: 'scripts/validate-mermaid.js', dest: 'scripts/validate-mermaid.js' },
];

// 需要创建的基础目录
const BASE_DIRS = [
  'assets/css',
  'assets/js',
  'assets/lib/highlight',
  'assets/lib/mermaid',
  'data',
  'scripts',
];

// ── 解析命令行参数 ────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const categories = [];

  const catIdx = args.indexOf('--categories');
  if (catIdx !== -1 && args[catIdx + 1]) {
    const entries = args[catIdx + 1].split(',');
    for (const entry of entries) {
      const parts = entry.trim().split(':');
      if (parts.length >= 2) {
        categories.push({
          id: parts[0].trim(),
          name: parts[1].trim(),
          icon: (parts[2] || '📄').trim(),
        });
      }
    }
  }

  return { categories };
}

// ── 工具函数 ──────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`  ✓ 创建目录: ${path.relative(ROOT, dirPath)}`);
  }
}

function copyAsset(srcRelative, destRelative) {
  const srcPath = path.join(SKILL_DIR, srcRelative);
  const destPath = path.join(ROOT, destRelative);

  if (!fs.existsSync(srcPath)) {
    console.log(`  ⚠ 源文件不存在，跳过: ${srcRelative}`);
    return false;
  }

  ensureDir(path.dirname(destPath));
  fs.copyFileSync(srcPath, destPath);
  console.log(`  ✓ 复制: ${srcRelative} → ${destRelative}`);
  return true;
}

// ── 主流程 ────────────────────────────────────────────

function main() {
  const { categories } = parseArgs();

  console.log('\n🚀 面试笔记项目初始化\n');
  console.log(`  项目根目录: ${ROOT}\n`);

  // 1. 创建基础目录
  console.log('📁 创建基础目录结构...');
  BASE_DIRS.forEach((dir) => ensureDir(path.join(ROOT, dir)));

  // 2. 创建分类目录
  if (categories.length > 0) {
    console.log('\n📁 创建分类目录...');
    for (const cat of categories) {
      ensureDir(path.join(ROOT, 'notes', cat.id));
    }
  }

  // 3. 复制资产文件
  console.log('\n📦 复制资产文件...');
  let copied = 0;
  let skipped = 0;
  for (const asset of ASSET_MAP) {
    if (copyAsset(asset.src, asset.dest)) {
      copied++;
    } else {
      skipped++;
    }
  }
  console.log(`\n  共复制 ${copied} 个文件${skipped > 0 ? `，跳过 ${skipped} 个` : ''}`);

  // 4. 生成初始 menu-data.js
  console.log('\n📋 初始化菜单配置...');
  const menuDataPath = path.join(ROOT, 'data', 'menu-data.js');
  if (!fs.existsSync(menuDataPath)) {
    const menuData = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      children: [],
    }));
    fs.writeFileSync(menuDataPath, `window.__MENU_DATA__ = ${JSON.stringify(menuData, null, 2)};\n`);
    console.log('  ✓ 创建: data/menu-data.js');
  } else {
    console.log('  ⚠ 已存在，跳过: data/menu-data.js');
  }

  // 5. 完成
  console.log('\n✅ 初始化完成！\n');
  console.log('📌 下一步操作：');
  console.log('   1. 打开 ui-showcase.html 查看组件写法（代码块/流程图/抽屉/卡片…）');
  console.log('   2. 运行 node scripts/create-note.js --batch notes.json 批量创建笔记目录 + 空壳');
  console.log('   3. Claude 用 Write 在空壳里自由组合组件写内容');
  console.log('   4. 运行 node scripts/fix-base-href.js && node scripts/scan-notes.js --verify');
  console.log('   5. 浏览器打开 index.html 预览\n');
}

main();
