/**
 * note-ui.js — 笔记组件库运行时（与 note-ui.css 配套）
 *
 * 用法：内容里只写声明式标记，行为由本文件自动增强
 *   <div data-ui="code" data-lang="java">...</div>
 *   <div data-ui="flow">graph TD; A-->B;</div>
 *   <details data-ui="drawer" data-title="追问1">...</details>
 *   <div data-ui="cards"><div data-ui="card" data-title="场景1">...</div></div>
 *
 * 依赖：highlight.min.js / mermaid.min.js（缺失时组件自动降级，不报错）
 * 公共 API：window.NoteUI = { refresh, openLightbox, setCodeTheme, expandAll }
 */
;(function () {
  'use strict';

  var LINE_H = 24, PAD_TOP = 16;
  var registry = {};

  // ── 工具函数 ────────────────────────────────────────────────────
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function dedent(s) {
    var lines = String(s).replace(/^\n+|\s+$/g, '').split('\n');
    var min = Infinity;
    lines.forEach(function (l) {
      if (!l.trim()) return;
      var ind = (l.match(/^[ \t]*/) || [''])[0].length;
      if (ind < min) min = ind;
    });
    if (!isFinite(min) || min === 0) return lines.join('\n');
    return lines.map(function (l) { return l.slice(min); }).join('\n');
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^\w一-龥]+/g, '-').replace(/^-|-$/g, '') || 'sec';
  }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) { /* file:// 下可能禁用 */ }
    return null;
  }
  function copyText(text, btn, okLabel) {
    function done() {
      var old = btn.textContent;
      btn.textContent = okLabel || '✓ 已复制';
      btn.classList.add('done');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('done'); }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacy(); });
    } else { legacy(); }
    function legacy() {
      var ta = el('textarea'); ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { }
      document.body.removeChild(ta);
    }
  }
  function parseRanges(spec) {
    var out = [];
    String(spec || '').split(/[,，]/).forEach(function (part) {
      part = part.trim(); if (!part) return;
      var m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) return;
      var a = +m[1], b = m[2] ? +m[2] : a;
      for (var i = a; i <= b; i++) out.push(i);
    });
    return out;
  }

  // ══════════════════════════════════════════════════════════════
  // page — 页面壳（面包屑 + 标题 + 考察知识点 + 徽标）
  // ══════════════════════════════════════════════════════════════
  registry.page = function (node) {
    var title = node.dataset.title || '';
    var frag = document.createDocumentFragment();

    if (node.dataset.path) {
      var path = el('div', 'ui-page-path');
      path.appendChild(el('span', null, '🏷️'));
      node.dataset.path.split(/>/).forEach(function (seg, i, all) {
        var s = el('span', 'ui-page-path-item', seg.trim());
        path.appendChild(s);
        if (i < all.length - 1) path.appendChild(el('span', 'ui-page-path-sep', '›'));
      });
      frag.appendChild(path);
    }
    if (title) {
      var h1 = el('h1', 'ui-page-title', title);
      frag.appendChild(h1);
      if (!document.title) document.title = title;
    }
    if (node.dataset.subtitle) frag.appendChild(el('p', 'ui-page-subtitle', node.dataset.subtitle));

    var extra = [];
    if (node.dataset.keypoints) {
      var kps = el('div', 'ui-page-kps');
      kps.appendChild(el('span', 'ui-page-kps-label', '🎯 考察知识点：'));
      node.dataset.keypoints.split(/[,，]/).forEach(function (k) {
        if (!k.trim()) return;
        kps.appendChild(el('span', 'ui-badge', k.trim()));
      });
      extra.push(kps);
    }
    if (node.dataset.badges) {
      node.dataset.badges.split(/[,，]/).forEach(function (b) {
        b = b.trim(); if (!b) return;
        var tone = /高频|必问|必考/.test(b) ? 'hot'
          : /重点|核心/.test(b) ? 'key'
          : /了解|低频|选看/.test(b) ? 'mute' : '';
        var s = el('span', 'ui-badge', b);
        if (tone) s.dataset.tone = tone;
        extra.push(s);
      });
    }
    if (extra.length) {
      var wrap = el('div', 'ui-page-head-extra');
      extra.forEach(function (n) { wrap.appendChild(n); });
      frag.appendChild(wrap);
    }
    if (frag.childNodes.length) node.insertBefore(frag, node.firstChild);
  };

  // ══════════════════════════════════════════════════════════════
  // section — 章节（自动编号 + 标题 + 锚点 + 复制链接）
  // ══════════════════════════════════════════════════════════════
  var sectionSeq = 0;
  registry.section = function (node) {
    var title = node.dataset.title || '';
    var numAttr = node.dataset.number;
    var numbered = numAttr === 'true' || (numAttr !== 'false' && autoNumber);

    var h2 = node.querySelector('h2.ui-section-title');
    if (!h2) {
      h2 = el('h2', 'ui-section-title');
      if (numbered) {
        sectionSeq++;
        h2.appendChild(el('span', 'ui-section-no', String(sectionSeq)));
      }
      h2.appendChild(el('span', 'ui-section-text', title || '（未命名章节）'));
      node.insertBefore(h2, node.firstChild);
    }
    if (!node.id) node.id = 'sec-' + slug(title || 'section-' + (sectionSeq || node.offsetTop));

    // 供 TOC 取纯文本
    node._uiTocLabel = (h2.textContent || '').trim();

    var link = el('button', 'ui-section-link', '🔗');
    link.title = '复制本节链接';
    link.addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#' + node.id;
      copyText(url, link, '✓');
      location.hash = node.id;
    });
    h2.appendChild(link);
  };

  // ══════════════════════════════════════════════════════════════
  // callout — 提示框
  // ══════════════════════════════════════════════════════════════
  var CALLOUT = {
    tip:   ['💡', '提示'],
    warn:  ['⚠️', '注意'],
    pit:   ['🕳️', '常见坑'],
    hot:   ['🔥', '高频考点'],
    key:   ['🎯', '面试重点'],
    ok:    ['✅', '最佳实践'],
    note:  ['📌', '说明'],
    quote: ['📖', '出处']
  };
  registry.callout = function (node) {
    var tone = node.dataset.tone || 'tip';
    var def = CALLOUT[tone] || CALLOUT.tip;
    node.dataset.tone = tone;
    node.classList.add('ui-callout');
    var body = el('div', 'ui-callout-body');
    while (node.firstChild) body.appendChild(node.firstChild);
    var title = node.dataset.title || node.dataset.headline;
    // 标题已自带表情符号时不再重复渲染左侧图标
    var iconText = node.dataset.icon ||
      (title && /^\p{Extended_Pictographic}/u.test(title) ? '' : def[0]);
    if (title) {
      body.insertBefore(el('div', 'ui-callout-title', title), body.firstChild);
    }
    if (iconText) node.appendChild(el('div', 'ui-callout-icon', iconText));
    node.appendChild(body);
  };

  // ══════════════════════════════════════════════════════════════
  // drawer — 抽屉折叠（div 或 details 均可）
  // ══════════════════════════════════════════════════════════════
  registry.drawer = function (node) {
    var details = node;
    if (node.tagName !== 'DETAILS') {
      details = el('details');
      Array.prototype.slice.call(node.attributes).forEach(function (a) {
        details.setAttribute(a.name, a.value);
      });
      while (node.firstChild) details.appendChild(node.firstChild);
      node.parentNode.replaceChild(details, node);
    }
    details.classList.add('ui-drawer');

    var summary = details.querySelector('summary');
    if (!summary) {
      summary = el('summary');
      details.insertBefore(summary, details.firstChild);
    }
    if (details.dataset.title && !summary.dataset.built) {
      summary.textContent = '';
      if (details.dataset.icon) summary.appendChild(el('span', 'ui-drawer-icon', details.dataset.icon));
      summary.appendChild(el('span', 'ui-drawer-title', details.dataset.title));
      summary.appendChild(el('span', 'ui-drawer-caret', '▸'));
      summary.dataset.built = '1';
    }
    var body = details.querySelector('.ui-drawer-body');
    if (!body) {
      body = el('div', 'ui-drawer-body');
      var kids = [];
      for (var c = details.firstChild; c; c = c.nextSibling) {
        if (c !== summary && !(c.nodeType === 3 && !c.textContent.trim())) kids.push(c);
      }
      kids.forEach(function (k) { body.appendChild(k); });
      details.appendChild(body);
    }
    if (details.dataset.open === 'true' || details.hasAttribute('open')) details.setAttribute('open', '');
  };

  registry['drawer-group'] = function (node) {
    var drawers = function () { return node.querySelectorAll('details.ui-drawer, [data-ui="drawer"]'); };
    if (node.dataset.expandAll !== 'false') {
      var bar = el('div', 'ui-drawer-toolbar');
      var count = el('span', 'ui-drawer-count');
      var btnOpen = el('button', 'ui-mini-btn', '展开全部');
      var btnClose = el('button', 'ui-mini-btn', '收起全部');
      btnOpen.addEventListener('click', function () { setAll(true); });
      btnClose.addEventListener('click', function () { setAll(false); });
      bar.appendChild(count); bar.appendChild(btnOpen); bar.appendChild(btnClose);
      node.insertBefore(bar, node.firstChild);
      var n = drawers().length;
      count.textContent = '共 ' + n + ' 项';
    }
    function setAll(open) {
      Array.prototype.forEach.call(drawers(), function (d) { d.open = open; });
    }
    if (node.dataset.accordion === 'true') {
      node.addEventListener('toggle', function (e) {
        if (!e.target.open) return;
        Array.prototype.forEach.call(drawers(), function (d) { if (d !== e.target) d.open = false; });
      }, true);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // cards / card — 卡片组（响应式）
  // ══════════════════════════════════════════════════════════════
  registry.cards = function (node) {
    node.classList.add('ui-cards');
    var cols = node.dataset.cols;
    if (cols && cols !== 'auto' && /^\d+$/.test(cols)) {
      node.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
      node.dataset.colsFixed = '1';
    }
    if (node.dataset.min) node.style.setProperty('--ui-card-min', parseInt(node.dataset.min, 10) + 'px');
  };

  registry.card = function (node) {
    node.classList.add('ui-card');
    var head = node.querySelector('.ui-card-head');
    if (!head && (node.dataset.title || node.dataset.icon)) {
      head = el('div', 'ui-card-head');
      if (node.dataset.icon) head.appendChild(el('span', 'ui-card-icon', node.dataset.icon));
      if (node.dataset.title) head.appendChild(el('span', 'ui-card-title', node.dataset.title));
      var first = node.querySelector('.ui-card-tags');
      node.insertBefore(head, first || node.firstChild);
    }
    var body = node.querySelector('.ui-card-body');
    if (!body) {
      body = el('div', 'ui-card-body');
      var kids = Array.prototype.slice.call(node.childNodes).filter(function (n) {
        return n !== head && n.className !== 'ui-card-tags';
      });
      kids.forEach(function (k) { body.appendChild(k); });
      node.appendChild(body);
    }
    if (node.dataset.tags) {
      var tags = el('div', 'ui-card-tags');
      node.dataset.tags.split(/[,，|]/).forEach(function (t) {
        if (!t.trim()) return;
        tags.appendChild(el('span', 'ui-badge', t.trim()));
      });
      if (!node.querySelector('.ui-card-tags')) node.appendChild(tags);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // code — 代码块（高亮 + 复制 + 行号 + 高亮行 + 折叠 + 语气）
  // ══════════════════════════════════════════════════════════════
  var LANG_ALIAS = {
    js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', zsh: 'bash',
    shell: 'bash', console: 'bash', cmd: 'bash', yml: 'yaml', md: 'markdown',
    html: 'xml', vue: 'xml', toml: 'ini', conf: 'ini', properties: 'ini',
    env: 'ini', mysql: 'sql', postgres: 'sql', postgresql: 'sql', ddl: 'sql',
    text: 'plaintext', txt: 'plaintext', none: 'plaintext', plain: 'plaintext',
    dockerfile: 'plaintext', docker: 'plaintext', nginx: 'plaintext',
    proto: 'plaintext', thrift: 'plaintext', redis: 'plaintext', wasm: 'plaintext'
  };
  function resolveLang(raw) {
    var key = String(raw || '').toLowerCase().trim();
    var lang = LANG_ALIAS[key] || key;
    if (window.hljs) {
      if (lang && hljs.getLanguage(lang)) return lang;
      if (!lang) return null; // 交给 auto
    }
    return lang || null;
  }

  registry.code = function (node) {
    var source = dedent(node.textContent);
    var lines = source.split('\n');
    var declared = node.dataset.lang || '';
    var lang = resolveLang(declared);

    // 高亮
    var htmlText = null, usedLang = lang || 'plaintext';
    if (window.hljs) {
      try {
        if (lang && hljs.getLanguage(lang)) {
          htmlText = hljs.highlight(source, { language: lang, ignoreIllegals: true }).value;
        } else {
          var auto = hljs.highlightAuto(source);
          htmlText = auto.value;
          usedLang = auto.language || 'auto';
        }
      } catch (e) { htmlText = null; }
    }
    if (htmlText == null) htmlText = source.replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });

    node.textContent = '';
    node.classList.add('ui-code');

    // 头部
    var head = el('div', 'ui-code-head');
    var badge = el('span', 'ui-code-lang', declared || usedLang);
    head.appendChild(badge);
    if (node.dataset.title) head.appendChild(el('span', 'ui-code-title', node.dataset.title));
    var btns = el('div', 'ui-code-head-btns');
    var wrapBtn = el('button', 'ui-code-btn', '换行');
    wrapBtn.title = '切换自动换行';
    wrapBtn.addEventListener('click', function () { node.classList.toggle('wrap'); });
    var copyBtn = el('button', 'ui-code-btn', '📋 复制');
    copyBtn.addEventListener('click', function () { copyText(source, copyBtn); });
    btns.appendChild(wrapBtn); btns.appendChild(copyBtn);
    head.appendChild(btns);
    node.appendChild(head);

    // 主体
    var body = el('div', 'ui-code-body');
    var code = el('code', 'hljs');
    code.innerHTML = htmlText;
    if (lang) code.classList.add('language-' + lang);
    var pre = el('pre', 'ui-code-pre');
    pre.appendChild(code);

    // 行号
    if (node.dataset.lines === 'true' || node.dataset.lines === '') {
      node.setAttribute('data-lines', 'true');
      var gutter = el('div', 'ui-code-gutter', lines.map(function (_, i) { return i + 1; }).join('\n'));
      gutter.style.whiteSpace = 'pre';
      body.appendChild(gutter);
    }
    // 高亮行
    var markSpec = node.dataset.mark, marks = [];
    if (markSpec) marks = marks.concat(parseRanges(markSpec).map(function (n) { return { n: n, t: '' }; }));
    if (node.dataset.del) marks = marks.concat(parseRanges(node.dataset.del).map(function (n) { return { n: n, t: 'del' }; }));
    if (node.dataset.add) marks = marks.concat(parseRanges(node.dataset.add).map(function (n) { return { n: n, t: 'add' }; }));
    if (marks.length) {
      var layer = el('div', 'ui-code-marks');
      marks.forEach(function (m) {
        if (m.n < 1 || m.n > lines.length) return;
        var row = el('i', 'ui-code-mark');
        row.style.top = (PAD_TOP + (m.n - 1) * LINE_H) + 'px';
        if (m.t) row.dataset.tone = m.t;
        layer.appendChild(row);
      });
      body.appendChild(layer);
    }
    body.appendChild(pre);

    // 超长折叠
    if (node.dataset.max) {
      var maxPx = parseInt(node.dataset.max, 10) || 360;
      body.style.setProperty('--ui-code-max', maxPx + 'px');
      node.style.setProperty('--ui-code-max', maxPx + 'px');
      var more = el('div', 'ui-code-more');
      var btn = el('button', null, '展开全文 · 共 ' + lines.length + ' 行');
      btn.addEventListener('click', function () { node.classList.add('expanded'); });
      more.appendChild(btn);
      body.appendChild(more);
    }
    node.appendChild(body);
  };

  // ══════════════════════════════════════════════════════════════
  // flow — 流程图（Mermaid 渲染 + 题注 + 灯箱 + 失败降级）
  // ══════════════════════════════════════════════════════════════
  var flowSeq = 0;
  registry.flow = function (node) {
    var source = dedent(node.textContent);
    node.textContent = '';
    node.classList.add('ui-flow');
    flowSeq++;

    var canvas = el('div', 'ui-flow-canvas');
    var pre = el('pre', 'mermaid');
    pre.textContent = source;
    canvas.appendChild(pre);
    node.appendChild(canvas);

    var tools = el('div', 'ui-flow-tools');
    if (node.dataset.zoom !== 'off') {
      var z = el('button', 'ui-code-btn', '🔍 放大');
      z.addEventListener('click', function () { openLightbox(canvas); });
      tools.appendChild(z);
      tools.appendChild(el('span', 'ui-flow-hint', '点击图或「放大」：滚轮缩放 / 拖拽平移 / 双击复位'));
    }
    var cs = el('button', 'ui-code-btn', '复制源码');
    cs.addEventListener('click', function () { copyText(source, cs); });
    tools.appendChild(cs);
    node.appendChild(tools);
    if (node.dataset.caption) node.appendChild(el('div', 'ui-flow-cap', node.dataset.caption));

    if (window.mermaid) renderFlow(pre, source, node);
    else node.insertBefore(el('pre', 'ui-flow-error', source), tools);
  };

  function renderFlow(pre, source, node) {
    var fail = function (err) {
      pre.remove();
      var box = el('div', 'ui-flow-error');
      box.appendChild(el('div', null, '⚠️ 流程图渲染失败：' + ((err && err.message) || err || '未知错误')));
      box.appendChild(el('pre', null, source));
      node.insertBefore(box, node.firstChild);
      node.dataset.renderError = '1';
    };
    try {
      var parsed = mermaid.parse(source);
      if (parsed && typeof parsed.then === 'function') {
        parsed.then(function () { run(); }, function (e) { fail(e); });
      } else { run(); }
    } catch (e) { fail(e); }

    function run() {
      try {
        var r = mermaid.run ? mermaid.run({ nodes: [pre] }) : mermaid.init(undefined, pre);
        if (r && typeof r.then === 'function') {
          r.then(function () { check(); }, function (e) { fail(e); });
        } else { check(); }
      } catch (e) { fail(e); }
    }
    function check() {
      if (!pre.querySelector('svg')) fail('未生成图形');
      else bindZoom(pre);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // zoom / lightbox — 矢量放大（流程图、图片通用）
  // ══════════════════════════════════════════════════════════════
  var MIN_S = 1, MAX_S = 10;
  function openLightbox(host) {
    var svg = host.querySelector('svg');
    var img = host.querySelector('img');
    if (!svg && !img) return;

    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    var scale = 1, panX = 0, panY = 0, dragging = false, sx = 0, sy = 0;

    var box = el('div', 'ui-lb');
    var view = el('div', 'ui-lb-view');
    var stage = el('div', 'ui-lb-stage');
    var close = el('button', 'ui-lb-close', '✕');
    var bar = el('div', 'ui-lb-bar');
    bar.appendChild(el('span', null, '🖱️ 滚轮缩放 · ✋ 拖拽平移 · 双击复位'));
    var btnIn = el('button', null, '＋'), btnOut = el('button', null, '－'), btnReset = el('button', null, '复位');
    bar.appendChild(btnIn); bar.appendChild(btnOut); bar.appendChild(btnReset);
    btnIn.addEventListener('click', function () { zoomAt(1.25, 0, 0); });
    btnOut.addEventListener('click', function () { zoomAt(0.8, 0, 0); });
    btnReset.addEventListener('click', function () { scale = 1; panX = panY = 0; apply(); });

    var w = 0, h = 0;
    if (svg) {
      var clone = svg.cloneNode(true);
      w = parseFloat(clone.getAttribute('width')) || clone.getBoundingClientRect().width;
      h = parseFloat(clone.getAttribute('height')) || clone.getBoundingClientRect().height;
      if (!clone.getAttribute('viewBox') && w && h) clone.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      clone.removeAttribute('width'); clone.removeAttribute('height');
      clone.style.cssText = 'width:100%;height:100%;display:block';
      stage.appendChild(clone);
    } else {
      var im = el('img', 'ui-lb-img');
      im.src = img.currentSrc || img.src;
      w = img.naturalWidth; h = img.naturalHeight;
      stage.appendChild(im);
    }

    view.appendChild(stage);
    box.appendChild(view); box.appendChild(bar); box.appendChild(close);
    document.body.appendChild(box);

    function fit() {
      var maxW = window.innerWidth - 140, maxH = window.innerHeight - 140;
      if (w && h) {
        var r = Math.min(maxW / w, maxH / h, 1);
        stage.style.width = (w * r) + 'px'; stage.style.height = (h * r) + 'px';
      } else { stage.style.width = maxW + 'px'; stage.style.height = maxH + 'px'; }
    }
    function apply() {
      stage.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
    }
    function zoomAt(factor, mx, my) {
      var old = scale;
      scale = Math.min(MAX_S, Math.max(MIN_S, scale * factor));
      var r = scale / old;
      panX = mx - r * (mx - panX);
      panY = my - r * (my - panY);
      apply();
    }
    fit(); apply();
    requestAnimationFrame(function () { box.classList.add('show'); });

    function onMove(e) {
      if (!dragging) return;
      panX = e.clientX - sx; panY = e.clientY - sy; apply();
    }
    function onUp() { dragging = false; view.classList.remove('dragging'); }
    function onKey(e) { if (e.key === 'Escape') close2(); }
    function close2() {
      box.classList.remove('show');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('keydown', onKey);
      setTimeout(function () {
        box.remove();
        document.body.style.overflow = prevOverflow;
      }, 240);
    }
    close.addEventListener('click', close2);
    document.addEventListener('keydown', onKey);
    box.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = view.getBoundingClientRect();
      zoomAt(e.deltaY > 0 ? 0.92 : 1.08,
        e.clientX - rect.left - rect.width / 2,
        e.clientY - rect.top - rect.height / 2);
    }, { passive: false });
    view.addEventListener('mousedown', function (e) {
      dragging = true; sx = e.clientX - panX; sy = e.clientY - panY;
      view.classList.add('dragging'); e.preventDefault();
    });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    view.addEventListener('dblclick', function (e) {
      e.preventDefault();
      scale = 1; panX = panY = 0;
      stage.style.transition = 'transform .3s ease'; apply();
      setTimeout(function () { stage.style.transition = 'none'; }, 320);
    });
  }
  var zoomBound = new WeakSet();
  function bindZoom(host) {
    if (zoomBound.has(host)) return;
    var clickable = host.querySelector('svg') || host.querySelector('img');
    if (!clickable) return;
    host.addEventListener('click', function () { openLightbox(host); });
    zoomBound.add(host);
  }
  registry.zoom = function (node) {    node.classList.add('ui-flow');
    node.style.cursor = 'zoom-in';
    var img = node.querySelector('img');
    if (img) {
      img.style.maxWidth = '100%';
      if (node.dataset.caption) node.appendChild(el('div', 'ui-flow-cap', node.dataset.caption));
    }
    bindZoom(node);
  };

  // ══════════════════════════════════════════════════════════════
  // table — 表格壳（滚动 + 表头 + 最优列 + 复制为 Markdown）
  // ══════════════════════════════════════════════════════════════
  registry.table = function (node) {
    var table = node;
    if (table.tagName !== 'TABLE') {
      var inner = table.querySelector('table');
      if (!inner) return;
      table = inner;
    }
    var wrap = table.parentNode;
    var shell = el('div', 'ui-table-shell');
    wrap.insertBefore(shell, table);
    var scroll = el('div', 'ui-table-scroll');
    scroll.appendChild(table);
    shell.appendChild(scroll);

    var head = el('div', 'ui-table-head');
    var hasHead = false;
    if (table.dataset.caption) { head.appendChild(el('span', 'ui-table-cap', table.dataset.caption)); hasHead = true; }
    var copyMd = el('button', 'ui-mini-btn', '复制为 Markdown');
    copyMd.addEventListener('click', function () { copyText(toMarkdown(table), copyMd); });
    head.appendChild(copyMd); hasHead = true;
    if (hasHead) shell.insertBefore(head, scroll);

    if (table.dataset.max) scroll.style.setProperty('--ui-table-max', parseInt(table.dataset.max, 10) + 'px');

    // 最优列高亮
    var best = parseRanges(table.dataset.best).map(function (n) { return n - 1; });
    if (best.length) {
      table.querySelectorAll('tr').forEach(function (tr) {
        best.forEach(function (i) {
          var cell = tr.children[i];
          if (cell) cell.classList.add('ui-best-col');
        });
      });
    }
    if (table.dataset.sticky) table.setAttribute('data-sticky', 'true');
  };

  function toMarkdown(table) {
    var rows = [];
    table.querySelectorAll('tr').forEach(function (tr, idx) {
      var cells = [];
      Array.prototype.forEach.call(tr.children, function (td) {
        cells.push((td.textContent || '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|'));
      });
      rows.push('| ' + cells.join(' | ') + ' |');
      if (idx === 0 && tr.parentNode.tagName === 'THEAD') {
        rows.push('| ' + cells.map(function () { return '---'; }).join(' | ') + ' |');
      }
    });
    return rows.join('\n');
  }

  // ══════════════════════════════════════════════════════════════
  // tabs — 选项卡（话术三级 / 多方案对比通用）
  // ══════════════════════════════════════════════════════════════
  registry.tabs = function (node) {
    node.classList.add('ui-tabs');
    var tabs = Array.prototype.slice.call(node.querySelectorAll('[data-ui="tab"]'));
    if (!tabs.length) return;

    var nav = el('div', 'ui-tabs-nav');
    nav.setAttribute('role', 'tablist');
    var body = el('div', 'ui-tabs-body');
    var btns = [];

    tabs.forEach(function (tab, i) {
      var key = tab.dataset.key || slug(tab.dataset.label || '') + '-' + i;
      tab.classList.add('ui-tabs-panel');
      tab.setAttribute('role', 'tabpanel');
      tab.dataset.tabKey = key;
      tab.removeAttribute('data-ui');

      var btn = el('button', 'ui-tabs-btn', tab.dataset.label || ('Tab ' + (i + 1)));
      btn.setAttribute('role', 'tab');
      btn.dataset.tabKey = key;
      btn.addEventListener('click', function () { select(key, true); });
      btn.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var dir = e.key === 'ArrowRight' ? 1 : -1;
        var next = btns[(btns.indexOf(btn) + dir + btns.length) % btns.length];
        select(next.dataset.tabKey, true); next.focus();
      });
      nav.appendChild(btn);
      btns.push(btn);
    });

    // 把 tab 从原位置移到 body 中
    tabs.forEach(function (t) { body.appendChild(t); });
    node.insertBefore(nav, node.firstChild);
    node.appendChild(body);

    function select(key, remember) {
      btns.forEach(function (b) {
        b.setAttribute('aria-selected', b.dataset.tabKey === key ? 'true' : 'false');
      });
      tabs.forEach(function (t) { t.hidden = t.dataset.tabKey !== key; });
      if (remember && node.dataset.mem) store('ui-tab:' + node.dataset.mem, key);
    }

    var initial = null;
    if (location.hash) {
      var hashKey = decodeURIComponent(location.hash.slice(1));
      if (btns.some(function (b) { return b.dataset.tabKey === hashKey; })) initial = hashKey;
    }
    if (!initial && node.dataset.active) initial = node.dataset.active;
    if (!initial && node.dataset.mem) initial = store('ui-tab:' + node.dataset.mem);
    select(initial && btns.some(function (b) { return b.dataset.tabKey === initial; }) ? initial : btns[0].dataset.tabKey, false);
  };

  // ══════════════════════════════════════════════════════════════
  // word — 生词提示（内置词典 → 内联 data-t 兜底）
  // ══════════════════════════════════════════════════════════════
  registry.word = function (node) {
    if (node.dataset.t) return;
    var hit = findWord(node.textContent);
    if (hit) { node.dataset.p = hit[0]; node.dataset.t = hit[1]; }
  };
  registry['words-auto'] = function () { /* 由 initAll 统一处理 */ };

  // 自动标注：[data-ui="words-auto"] 容器内扫描词典命中的词
  var dictKeys = null;
  function norm(s) { return String(s).trim().toLowerCase().replace(/\s+/g, ' '); }
  function findWord(text) {
    var d = window.__DICT__;
    if (!d) return null;
    return d[norm(text)] || null;
  }
  function autoWords(scope) {
    var d = window.__DICT__;
    if (!d) return;
    var keys = Object.keys(d).filter(function (k) { return /^[a-z][a-z\s\-]*$/.test(k) && k.length > 2; });
    if (!keys.length) return;
    keys.sort(function (a, b) { return b.length - a.length; });
    var pattern = new RegExp('\\b(' + keys.map(function (k) {
      return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    }).join('|') + ')\\b', 'gi');
    var probe = new RegExp(pattern.source, 'i');

    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (!p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') return NodeFilter.FILTER_REJECT
        if (p.closest('pre, code, a, textarea, .ui-word, [data-ui="code"], [data-ui="flow"], .ui-code, .ui-word')) {
          return NodeFilter.FILTER_REJECT;
        }
        return probe.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    pattern.lastIndex = 0;
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    var seen = {};
    nodes.forEach(function (textNode) {
      var frag = document.createDocumentFragment();
      var last = 0, text = textNode.nodeValue, m;
      pattern.lastIndex = 0;
      while ((m = pattern.exec(text))) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var key = norm(m[0]);
        var span = el('span', 'ui-word', m[0]);
        span.setAttribute('data-ui', 'word');
        if (d[key]) { span.dataset.p = d[key][0]; span.dataset.t = d[key][1]; }
        frag.appendChild(span);
        seen[key] = (seen[key] || 0) + 1;
        last = m.index + m[0].length;
        if (m.index === pattern.lastIndex) pattern.lastIndex++;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // TOC — 右侧目录（扫描 section 组件）
  // ══════════════════════════════════════════════════════════════
  function initToc() {
    var sections = Array.prototype.slice.call(document.querySelectorAll('[data-ui="section"]'));
    if (sections.length < 2) return;
    var items = sections.map(function (s) {
      return { id: s.id, text: s._uiTocLabel || (s.dataset.title || s.id), el: s };
    });

    var saved = store('toc-panel-collapsed');
    var collapsed = saved !== null ? saved === '1' : window.innerWidth < 1400;
    var panel = el('div', 'ui-toc' + (collapsed ? ' collapsed' : ''));
    panel.id = 'ui-toc';

    var head = el('div', 'ui-toc-head');
    var title = el('span', 'ui-toc-title', '📑 目录');
    var prog = el('div', 'ui-toc-progress');
    var bar = el('i'); prog.appendChild(bar);
    var toggle = el('button', 'ui-toc-toggle', collapsed ? '▶' : '◀');
    toggle.title = '收起 / 展开';
    head.appendChild(title); head.appendChild(prog); head.appendChild(toggle);

    var body = el('div', 'ui-toc-body');
    var ul = el('ul', 'ui-toc-list');
    var links = items.map(function (item) {
      var a = el('li', 'ui-toc-item');
      var link = el('a', 'ui-toc-link', item.text);
      link.href = '#' + item.id;
      link.title = item.text;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        item.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + item.id);
      });
      a.appendChild(link); ul.appendChild(a);
      return link;
    });
    body.appendChild(ul);
    panel.appendChild(head); panel.appendChild(body);
    document.body.appendChild(panel);

    function applyState() {
      panel.classList.toggle('collapsed', collapsed);
      toggle.textContent = collapsed ? '▶' : '◀';
      document.body.classList.toggle('ui-toc-open', !collapsed);
    }
    applyState();
    toggle.addEventListener('click', function () {
      collapsed = !collapsed;
      store('toc-panel-collapsed', collapsed ? '1' : '0');
      applyState();
    });

    var ticking = false;
    function onScroll() {
      var top = window.pageYOffset || document.documentElement.scrollTop;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (docH > 0 ? Math.min(100, top / docH * 100) : 0) + '%';
      var atBottom = (window.innerHeight + top) >= document.documentElement.scrollHeight - 12;
      var current = atBottom ? items.length - 1 : -1;
      if (current < 0) {
        for (var k = items.length - 1; k >= 0; k--) {
          if (items[k].el.getBoundingClientRect().top <= 120) { current = k; break; }
        }
      }
      links.forEach(function (l, i) { l.classList.toggle('active', i === current); });
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { onScroll(); ticking = false; });
    });
    onScroll();
  }

  // ══════════════════════════════════════════════════════════════
  // 代码主题（与 index.html 齿轮联动，兼容 file:// ）
  // ══════════════════════════════════════════════════════════════
  function setCodeTheme(theme) {
    var links = document.querySelectorAll('.code-theme');
    if (!links.length) return;
    Array.prototype.forEach.call(links, function (l) { l.disabled = l.dataset.theme !== theme; });
  }
  function initTheme() {
    var saved = store('notes-code-theme');
    if (saved) setCodeTheme(saved);
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'code-theme-change' && e.data.theme) setCodeTheme(e.data.theme);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 引导
  // ══════════════════════════════════════════════════════════════
  var autoNumber = true;

  function initAll(scope) {
    scope = scope || document;
    var page = scope.querySelector ? scope.querySelector('[data-ui="page"]') : null;
    if (page && page.dataset.number === 'false') autoNumber = false;

    var nodes = scope.querySelectorAll('[data-ui]');
    // 先父后子（document order），cards/drawer-group 需先于其子节点
    Array.prototype.forEach.call(nodes, function (node) {
      var name = node.getAttribute('data-ui');
      // 组件初始化时可能已摘掉 data-ui（如 tab 面板被升级为 tabpanel）
      if (!name) return;
      var handler = registry[name];
      if (!handler) {
        if (window.console && !node._uiWarned) {
          node._uiWarned = 1;
          console.warn('[note-ui] 未知组件 data-ui="' + name + '"，已按普通内容渲染');
        }
        return;
      }
      if (node._uiReady) return;
      node._uiReady = 1;
      try { handler(node); } catch (e) {
        console.error('[note-ui] 组件 ' + name + ' 初始化失败:', e);
      }
    });

    var auto = scope.querySelectorAll('[data-ui="words-auto"], [data-ui="page"][data-words="auto"]');
    Array.prototype.forEach.call(auto, function (n) { autoWords(n); });
  }

  function boot() {
    if (window.mermaid) {
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          fontFamily: 'var(--ui-sans)',
          themeVariables: {
            primaryColor: '#eff6ff', primaryBorderColor: '#3b82f6',
            lineColor: '#64748b', secondaryColor: '#f0fdf4', tertiaryColor: '#fef3c7'
          }
        });
      } catch (e) { }
    }
    initAll(document);
    initToc();
    initTheme();

    // 打印时展开所有折叠内容
    var opened = null;
    window.addEventListener('beforeprint', function () {
      opened = Array.prototype.slice.call(document.querySelectorAll('details.ui-drawer'))
        .map(function (d) { return d.open; });
      document.querySelectorAll('details.ui-drawer').forEach(function (d, i) { d.open = true; });
      document.querySelectorAll('[data-ui="code"][data-max]').forEach(function (c) { c.classList.add('expanded'); });
    });
    window.addEventListener('afterprint', function () {
      if (!opened) return;
      document.querySelectorAll('details.ui-drawer').forEach(function (d, i) { d.open = opened[i]; });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NoteUI = {
    version: '1.0',
    components: registry,
    register: function (name, fn) { registry[name] = fn; },
    refresh: function (scope) { initAll(scope || document); },
    openLightbox: openLightbox,
    setCodeTheme: setCodeTheme,
    expandAll: function (open) {
      document.querySelectorAll('details.ui-drawer').forEach(function (d) { d.open = !!open; });
    }
  };
})();
