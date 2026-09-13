/**
 * toc.js — 右侧快速定位锚点导航组件
 * 自动扫描页面中的 section 标题，生成浮动目录面板
 * 功能：展开/收起、滚动高亮、阅读进度条
 */
;(function () {
  'use strict';

  // ── 收集标题 ────────────────────────────────────────
  function collectHeadings() {
    var sections = document.querySelectorAll('section.mb-10');
    var items = [];
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var heading = sec.querySelector('h1, h2, .section-title, .summary-card h1');
      if (!heading) continue;
      var text = (heading.textContent || '').replace(/^\s+|\s+$/g, '');
      if (!text) continue;
      if (!sec.id) sec.id = 'toc-section-' + i;
      items.push({ id: sec.id, text: text, el: sec });
    }
    return items;
  }

  // ── 初始化 ──────────────────────────────────────────
  function init() {
    var items = collectHeadings();
    if (items.length === 0) return;

    // 状态：读取 localStorage，无记录时按视口宽度决定默认值
    var saved = localStorage.getItem('toc-panel-collapsed');
    var collapsed = saved !== null ? saved === '1' : window.innerWidth <= 768;
    var ticking = false;
    var links = [];

    // ── 创建面板 ──────────────────────────────────────
    var panel = document.createElement('div');
    panel.id = 'toc-panel';

    // 全部用内联样式，不依赖任何 CSS class
    var cssPanel = [
      'position:fixed', 'top:80px', 'right:2px', 'width:220px',
      'max-height:calc(100vh - 120px)', 'background:#fff',
      'border:1px solid #e2e8f0', 'border-radius:12px',
      'box-shadow:0 2px 8px rgba(0,0,0,0.12)',
      'z-index:2147483647', 'overflow:hidden',
      'display:flex !important', 'flex-direction:column',
      'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif'
    ].join(';');

    panel.style.cssText = cssPanel;

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#f8fafc;flex-shrink:0;';

    var title = document.createElement('span');
    title.textContent = '📑 目录';
    title.style.cssText = 'font-size:13px;font-weight:600;color:#475569;white-space:nowrap;';

    var progressWrap = document.createElement('div');
    progressWrap.style.cssText = 'flex:1;height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden;';

    var progressBar = document.createElement('div');
    progressBar.style.cssText = 'height:100%;width:0%;background:#3b82f6;border-radius:2px;transition:width .15s ease;';
    progressWrap.appendChild(progressBar);

    var toggleBtn = document.createElement('button');
    toggleBtn.textContent = '◀';
    toggleBtn.title = '收起/展开';
    toggleBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;color:#64748b;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;flex-shrink:0;transition:background .15s,color .15s;';
    toggleBtn.addEventListener('mouseenter', function(){ toggleBtn.style.background='#e2e8f0'; toggleBtn.style.color='#334155'; });
    toggleBtn.addEventListener('mouseleave', function(){ toggleBtn.style.background='none'; toggleBtn.style.color='#64748b'; });

    header.appendChild(title);
    header.appendChild(progressWrap);
    header.appendChild(toggleBtn);

    // Body
    var body = document.createElement('div');
    body.style.cssText = 'overflow-y:auto;flex:1;padding:8px 0;';

    var ul = document.createElement('ul');
    ul.style.cssText = 'list-style:none;margin:0;padding:0;';

    // 渲染链接
    for (var j = 0; j < items.length; j++) {
      (function (item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.textContent = item.text;
        a.href = '#' + item.id;
        a.style.cssText = 'display:block;padding:6px 14px;font-size:12px;color:#64748b;text-decoration:none;line-height:1.5;border-left:3px solid transparent;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .15s,background .15s,border-color .15s;';

        a.addEventListener('click', function (e) {
          e.preventDefault();
          item.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        a.addEventListener('mouseenter', function () {
          a.style.color = '#3b82f6';
          a.style.background = '#f0f9ff';
        });
        a.addEventListener('mouseleave', function () {
          if (!a._active) {
            a.style.color = '#64748b';
            a.style.background = 'transparent';
          }
        });

        li.appendChild(a);
        ul.appendChild(li);
        links.push(a);
      })(items[j]);
    }

    body.appendChild(ul);
    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);

    // 若初始状态为收起，立即应用收起样式
    if (collapsed) {
      panel.style.width = '40px';
      body.style.display = 'none';
      title.style.display = 'none';
      progressWrap.style.display = 'none';
      toggleBtn.textContent = '▶';
      toggleBtn.style.margin = '0 auto';
      header.style.justifyContent = 'center';
    }

    // 为 body 加右 padding，防止内容被面板遮挡
    document.body.style.paddingRight = collapsed ? '0' : '260px';
    document.body.style.maxWidth = '1200px';

    // ── 收起/展开 ─────────────────────────────────────
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      collapsed = !collapsed;
      try { localStorage.setItem('toc-panel-collapsed', collapsed ? '1' : '0'); } catch (err) {}
      if (collapsed) {
        panel.style.width = '40px';
        body.style.display = 'none';
        title.style.display = 'none';
        progressWrap.style.display = 'none';
        toggleBtn.textContent = '▶';
        toggleBtn.style.margin = '0 auto';
        header.style.justifyContent = 'center';
        document.body.style.paddingRight = '0';
      } else {
        panel.style.width = '220px';
        body.style.display = '';
        title.style.display = '';
        progressWrap.style.display = '';
        toggleBtn.textContent = '◀';
        toggleBtn.style.margin = '';
        header.style.justifyContent = '';
        document.body.style.paddingRight = '260px';
      }
    });

    // ── 滚动高亮 ──────────────────────────────────────
    function onScroll() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      progressBar.style.width = pct + '%';

      var current = -1;
      var atBottom = (window.innerHeight + scrollTop) >= (document.documentElement.scrollHeight - 10);
      if (atBottom) {
        // 滚到底部 → 强制高亮最后一项
        current = items.length - 1;
      } else {
        for (var k = items.length - 1; k >= 0; k--) {
          if (items[k].el.getBoundingClientRect().top <= 120) {
            current = k;
            break;
          }
        }
      }
      for (var m = 0; m < links.length; m++) {
        if (m === current) {
          links[m].style.color = '#3b82f6';
          links[m].style.background = '#eff6ff';
          links[m].style.borderLeftColor = '#3b82f6';
          links[m].style.fontWeight = '600';
          links[m]._active = true;
        } else {
          links[m].style.color = '#64748b';
          links[m].style.background = 'transparent';
          links[m].style.borderLeftColor = 'transparent';
          links[m].style.fontWeight = 'normal';
          links[m]._active = false;
        }
      }
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () { onScroll(); ticking = false; });
        ticking = true;
      }
    });
    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
