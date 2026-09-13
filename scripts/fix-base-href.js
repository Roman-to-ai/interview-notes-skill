/**
 * fix-base-href.js — 自动修复所有笔记 HTML 中的 {{BASE_HREF}} 占位符
 *
 * 原理：根据 notes/ 下每篇 index.html 的路径深度，自动计算正确的 <base href>
 * 公式：path.split('/').length - 1 个 "../"
 *       例：notes/basics/oop/encapsulation/index.html → "../../../"
 *
 * 用法：
 *   node scripts/fix-base-href.js              # 修复所有笔记 + 自动验证流程图
 *   node scripts/fix-base-href.js --dry-run    # 仅预览，不实际修改
 *   node scripts/fix-base-href.js --menu-only  # 仅修复 menu-data.js 中列出的笔记
 *   node scripts/fix-base-href.js --skip-mermaid  # 跳过流程图验证
 *
 * 工作流集成：
 *   Claude 生成笔记时，<base href> 统一写 {{BASE_HREF}} 占位符
 *   所有笔记生成完毕后，运行本脚本一次性修复全部 base 路径
 *   并自动执行 Mermaid 流程图语法验证（--fix）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const NOTES_DIR = path.join(ROOT, 'notes');
const MENU_DATA_PATH = path.join(ROOT, 'data', 'menu-data.js');

const DRY_RUN = process.argv.includes('--dry-run');
const MENU_ONLY = process.argv.includes('--menu-only');
const SKIP_MERMAID = process.argv.includes('--skip-mermaid');

// ── 计算 base href ──────────────────────────────────────

function calcBaseHref(notePath) {
  // notePath 格式: notes/basics/oop/encapsulation/index.html
  // 去掉文件名后的目录层数 = dirLevels - 1
  const normalized = notePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const dirLevels = segments.length - 1; // 去掉 index.html 后的段数
  return '../'.repeat(dirLevels);
}

// ── 获取所有笔记路径 ──────────────────────────────────

function getAllHtmlFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const childDir = path.join(currentDir, entry.name);
      const htmlPath = path.join(childDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        // 转成相对路径
        const relPath = path.relative(ROOT, htmlPath).replace(/\\/g, '/');
        results.push(relPath);
      }
      walk(childDir);
    }
  }

  walk(dir);
  return results;
}

// ── 从 menu-data.js 获取路径 ─────────────────────────

function getMenuPaths() {
  const paths = [];
  if (!fs.existsSync(MENU_DATA_PATH)) return paths;

  try {
    const raw = fs.readFileSync(MENU_DATA_PATH, 'utf-8');
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      const menu = JSON.parse(raw.substring(start, end + 1));
      function walk(items) {
        for (const item of items) {
          if (item.path) paths.push(item.path);
          if (item.children) walk(item.children);
        }
      }
      walk(menu);
    }
  } catch (e) {
    console.error(`  ⚠ menu-data.js 解析失败: ${e.message}`);
  }
  return paths;
}

// ── 修复单个文件 ────────────────────────────────────────

function fixBaseHref(htmlRelPath) {
  const absPath = path.join(ROOT, htmlRelPath);
  if (!fs.existsSync(absPath)) {
    console.log(`  ❌ 文件不存在: ${htmlRelPath}`);
    return false;
  }

  let content;
  try {
    content = fs.readFileSync(absPath, 'utf-8');
  } catch (e) {
    console.log(`  ❌ 读取失败: ${htmlRelPath} (${e.message})`);
    return false;
  }

  // 检查是否包含占位符
  if (!content.includes('{{BASE_HREF}}')) {
    // 可能已经修复过了，检查 base href 是否正确
    const baseMatch = content.match(/<base\s+href=["']([^"']+)["']\s*>/i);
    if (baseMatch) {
      const expected = calcBaseHref(htmlRelPath);
      if (baseMatch[1] !== expected) {
        console.log(`  ⚠ base href 可能不正确: "${baseMatch[1]}" (期望 "${expected}"): ${htmlRelPath}`);
        // 修复不正确的 base href
        content = content.replace(
          /<base\s+href=["'][^"']*["']\s*>/i,
          `<base href="${expected}">`
        );
        if (!DRY_RUN) {
          fs.writeFileSync(absPath, content, 'utf-8');
          console.log(`  🔧 已修正: ${htmlRelPath}  (${baseMatch[1]} → ${expected})`);
        } else {
          console.log(`  🔧 [模拟] 修正: ${htmlRelPath}  (${baseMatch[1]} → ${expected})`);
        }
        return true;
      }
      // 已有正确的 base href
      return null; // 无需修改
    }
    // 没有 base 标签也没有占位符
    console.log(`  ⚠ 未找到 base 标签或 {{BASE_HREF}} 占位符: ${htmlRelPath}`);
    return false;
  }

  // 替换占位符
  const expected = calcBaseHref(htmlRelPath);
  content = content.replace('{{BASE_HREF}}', expected);

  if (!DRY_RUN) {
    fs.writeFileSync(absPath, content, 'utf-8');
    console.log(`  ✅ ${htmlRelPath}  →  <base href="${expected}">`);
  } else {
    console.log(`  ✅ [模拟] ${htmlRelPath}  →  <base href="${expected}">`);
  }
  return true;
}

// ── 主流程 ──────────────────────────────────────────────

function main() {
  console.log('\n🔧 自动修复 <base href> 路径\n');

  if (DRY_RUN) console.log('  ⚡ 模拟模式（--dry-run），不会实际修改文件\n');

  // 获取待处理的路径
  let targetPaths;

  if (MENU_ONLY) {
    // 仅修复菜单中列出的笔记
    targetPaths = getMenuPaths();
    if (targetPaths.length === 0) {
      console.log('  ⚠ menu-data.js 中未找到笔记路径');
      console.log('     尝试扫描 notes/ 目录...');
      targetPaths = getAllHtmlFiles(NOTES_DIR);
    } else {
      console.log(`  从 menu-data.js 读取到 ${targetPaths.length} 篇笔记\n`);
    }
  } else {
    // 扫描 notes/ 目录下所有 HTML
    targetPaths = getAllHtmlFiles(NOTES_DIR);
    if (targetPaths.length === 0) {
      console.log('  ⚠ notes/ 目录下未找到 index.html 文件');
      console.log('     请先运行 node scripts/create-note.js --batch notes.json\n');
      return;
    }
    console.log(`  扫描到 ${targetPaths.length} 篇笔记\n`);
  }

  // 修复
  let fixed = 0;
  let alreadyCorrect = 0;
  let errors = 0;

  for (const htmlPath of targetPaths) {
    const result = fixBaseHref(htmlPath);
    if (result === true) fixed++;
    else if (result === null) alreadyCorrect++;
    else errors++;
  }

  // 统计
  console.log('\n📊 统计：');
  console.log(`   已修复: ${fixed} 篇`);
  if (alreadyCorrect > 0) console.log(`   无需修改: ${alreadyCorrect} 篇`);
  if (errors > 0) console.log(`   失败/警告: ${errors} 篇`);

  if (DRY_RUN) {
    console.log('\n  ⚡ 模拟模式，未实际修改文件');
    console.log('  移除 --dry-run 后运行即可执行修复\n');
  } else if (fixed > 0 || errors > 0) {
    console.log('\n  💡 提示：建议运行 node scripts/scan-notes.js 验证笔记完整性\n');
  } else {
    console.log('\n  ✅ 所有 base href 已正确设置\n');
  }

  // ── 自动验证 Mermaid 流程图 ──────────────────────────────
  if (!DRY_RUN && !SKIP_MERMAID) {
    const validateScript = path.join(ROOT, 'scripts', 'validate-mermaid.js');
    if (fs.existsSync(validateScript)) {
      console.log('────────────────────────────────────────────');
      console.log('🔍 自动验证 Mermaid 流程图语法...\n');
      try {
        execSync(`node "${validateScript}" --fix`, { stdio: 'inherit', cwd: ROOT });
      } catch (e) {
        // validate-mermaid 以 exit code 1 表示有错误，这是预期行为
        // 不阻止后续流程
      }
    } else {
      console.log('  ⚠ 未找到 scripts/validate-mermaid.js，跳过流程图验证');
    }
  }
}

main();