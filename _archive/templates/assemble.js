/**
 * assemble.js — 从模块组件组装完整笔记模板
 *
 * 读取 content-types.json 配置，将 templates/modules/ 下的模块片段
 * 拼接成完整的 HTML 模板，输出到 templates/types/<type>.html
 *
 * 用法：
 *   node templates/assemble.js                    # 组装所有类型
 *   node templates/assemble.js --type interview   # 只组装指定类型
 *   node templates/assemble.js --dry-run          # 预览，不写文件
 *
 * 零依赖，仅使用 Node.js 原生库
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.resolve(__dirname);
const MODULES_DIR = path.join(TEMPLATES_DIR, 'modules');
const TYPES_DIR = path.join(TEMPLATES_DIR, 'types');
const CONFIG_PATH = path.join(TEMPLATES_DIR, 'content-types.json');

const TARGET_TYPE = process.argv.find((a, i) => process.argv[i - 1] === '--type');
const DRY_RUN = process.argv.includes('--dry-run');

// ── 模板骨架 ────────────────────────────────────────────

function buildHtml(typeName, headerHtml, modulesHtml) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}} — 面试笔记</title>
  <base href="{{BASE_HREF}}">
  <script src="assets/lib/tailwind.min.js"><\/script>
  <link rel="stylesheet" href="assets/lib/highlight/github-dark.min.css" class="code-theme" data-theme="github-dark">
  <link rel="stylesheet" href="assets/lib/highlight/monokai.min.css" class="code-theme" data-theme="monokai" disabled>
  <link rel="stylesheet" href="assets/lib/highlight/tomorrow-night-bright.min.css" class="code-theme" data-theme="tomorrow-night-bright" disabled>
  <link rel="stylesheet" href="assets/css/note-style.css">
</head>
<body class="p-6 max-w-4xl mx-auto font-sans">

  <!-- ═══════════════════════════════════════════════════ -->
  <!-- 考点标签                                           -->
  <!-- ═══════════════════════════════════════════════════ -->
  <div class="topic-path">
    <span class="topic-path-icon">🏷️</span>
    <span>（填写考点路径，如：Java基础 &gt; 面向对象 &gt; 封装）</span>
  </div>

  <!-- ═══════════════════════════════════════════════════ -->
  <!-- 考察知识点                                         -->
  <!-- ═══════════════════════════════════════════════════ -->
  <div class="topic-keypoints">
    <span class="topic-keypoints-label">🎯 考察知识点：</span>
    <span class="topic-keypoint">知识点1</span>
    <span class="topic-keypoint">知识点2</span>
    <span class="topic-keypoint">知识点3</span>
  </div>

${modulesHtml}
  <!-- ═══════════════════════════════════════════════════ -->
  <!-- 底部                                               -->
  <!-- ═══════════════════════════════════════════════════ -->
  <footer class="text-center text-gray-400 text-sm py-8 border-t border-gray-200 mt-10">
    <p>📝 面试笔记 · {{TITLE}}</p>
  </footer>

  <!-- ═══════════════════════════════════════════════════ -->
  <!-- 脚本（按依赖顺序加载）                              -->
  <!-- ═══════════════════════════════════════════════════ -->
  <script src="assets/lib/highlight/highlight.min.js"><\/script>
  <script src="assets/lib/mermaid/mermaid.min.js"><\/script>
  <script src="assets/js/note.js"><\/script>
  <script src="assets/js/mermaid-lightbox.js"><\/script>
  <script src="assets/js/toc.js"><\/script>
</body>
</html>
`;
}

// ── 读取模块片段 ────────────────────────────────────────

function readModule(moduleId) {
  const filePath = path.join(MODULES_DIR, moduleId + '.html');
  if (!fs.existsSync(filePath)) {
    console.error(`  ❌ 模块文件不存在: ${moduleId}.html`);
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// ── 组装单个类型 ────────────────────────────────────────

function assembleType(typeId, typeConfig) {
  console.log(`\n📦 组装类型: ${typeId} (${typeConfig.name})`);
  console.log(`   模块: ${typeConfig.modules.join(' → ')}`);

  const moduleBlocks = [];
  for (const modId of typeConfig.modules) {
    const content = readModule(modId);
    if (!content) return false;
    moduleBlocks.push(content);
  }

  const html = buildHtml(typeConfig.name, typeConfig.header, moduleBlocks.join('\n'));

  // 输出路径
  const outPath = path.join(TYPES_DIR, typeId + '.html');

  if (DRY_RUN) {
    console.log(`  ✅ [模拟] ${path.relative(process.cwd(), outPath)} (${(html.length / 1024).toFixed(1)}KB)`);
  } else {
    if (!fs.existsSync(TYPES_DIR)) {
      fs.mkdirSync(TYPES_DIR, { recursive: true });
    }
    fs.writeFileSync(outPath, html, 'utf-8');
    console.log(`  ✅ ${path.relative(process.cwd(), outPath)} (${(html.length / 1024).toFixed(1)}KB)`);
  }

  return true;
}

// ── 主流程 ──────────────────────────────────────────────

function main() {
  console.log('\n🔧 笔记模板组装工具\n');

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ 配置文件不存在: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  if (DRY_RUN) console.log('  ⚡ 模拟模式（--dry-run），不会实际写文件\n');

  // 检查模块文件完整性
  const allModules = new Set();
  for (const type of Object.values(config)) {
    type.modules.forEach(m => allModules.add(m));
  }
  console.log(`📋 已注册模块: ${[...allModules].join(', ')}`);

  let success = 0;
  let failed = 0;

  if (TARGET_TYPE) {
    // 只组装指定类型
    if (!config[TARGET_TYPE]) {
      console.error(`❌ 未知类型: ${TARGET_TYPE}`);
      console.error(`   可用类型: ${Object.keys(config).join(', ')}`);
      process.exit(1);
    }
    if (assembleType(TARGET_TYPE, config[TARGET_TYPE])) success++;
    else failed++;
  } else {
    // 组装所有类型
    for (const [typeId, typeConfig] of Object.entries(config)) {
      if (assembleType(typeId, typeConfig)) success++;
      else failed++;
    }
  }

  console.log(`\n📊 统计：${success} 个类型组装成功${failed > 0 ? `，${failed} 个失败` : ''}`);

  if (!DRY_RUN && success > 0) {
    console.log('\n📌 模板已生成到 templates/types/，可在 create-note.js --batch 中通过 "type" 字段指定使用');
  }

  console.log('');
}

main();
