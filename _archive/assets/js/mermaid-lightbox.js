/**
 * mermaid-lightbox.js — Mermaid 流程图灯箱组件
 * 点击 .mermaid-wrapper 弹出白色灯箱，支持：
 *  - 鼠标滚轮矢量缩放（以光标为锚点）
 *  - 拖拽平移
 *  - 双击复位（带过渡动画）
 *  - Esc 关闭
 *
 * 自动等待 Mermaid 渲染完成再绑定，兼容 startOnLoad 及异步渲染场景。
 * 无外部 CSS 依赖，所有样式内联。
 */
;(function () {
  'use strict';

  var MIN_SCALE = 1;
  var MAX_SCALE = 8;
  var bound = new WeakSet();   // 已绑定的 wrapper，防止重复绑定

  // ── 打开灯箱 ────────────────────────────────────────────
  function openLightbox(wrapper) {
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    var scale = 1, panX = 0, panY = 0;
    var isDragging = false, startX = 0, startY = 0;

    // 遮罩
    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:rgba(255,255,255,0.95);z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;' +
      'opacity:0;transition:opacity .25s ease;';

    // 视口（拖拽区域）
    var viewport = document.createElement('div');
    viewport.style.cssText =
      'position:relative;width:100%;height:100%;' +
      'display:flex;align-items:center;justify-content:center;' +
      'cursor:grab;overflow:hidden;';

    // 图表容器（负责 transform）
    var diagram = document.createElement('div');
    diagram.style.cssText = 'transform-origin:center center;transition:none;';

    // 关闭按钮
    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText =
      'position:fixed;top:20px;right:20px;width:36px;height:36px;' +
      'border:none;background:rgba(0,0,0,0.08);border-radius:50%;' +
      'font-size:18px;cursor:pointer;display:flex;align-items:center;' +
      'justify-content:center;color:#475569;z-index:2147483647;transition:background .15s;';
    closeBtn.addEventListener('mouseenter', function () { closeBtn.style.background = 'rgba(0,0,0,0.15)'; });
    closeBtn.addEventListener('mouseleave', function () { closeBtn.style.background = 'rgba(0,0,0,0.08)'; });

    // 底部操作提示
    var hint = document.createElement('div');
    hint.style.cssText =
      'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
      'display:flex;gap:16px;padding:8px 16px;background:rgba(0,0,0,0.6);' +
      'color:#fff;border-radius:8px;font-size:13px;z-index:2147483647;';
    hint.innerHTML =
      '<span>🖱️ 滚轮缩放</span>' +
      '<span>✋ 拖拽平移</span>' +
      '<span>双击复位</span>' +
      '<span>Esc 关闭</span>';

    // 克隆 SVG（矢量，缩放不失真）
    var svg = wrapper.querySelector('svg');
    var w = 0, h = 0;
    if (svg) {
      var cloned = svg.cloneNode(true);
      var vb = cloned.getAttribute('viewBox');
      w = parseFloat(cloned.getAttribute('width'));
      h = parseFloat(cloned.getAttribute('height'));
      if (!vb && w && h) cloned.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      cloned.removeAttribute('width');
      cloned.removeAttribute('height');
      cloned.style.cssText = 'width:100%;height:100%;display:block;';
      diagram.appendChild(cloned);
    }

    viewport.appendChild(diagram);
    overlay.appendChild(viewport);
    overlay.appendChild(closeBtn);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);

    // 自适应尺寸
    function fitDiagram() {
      var maxW = window.innerWidth - 160, maxH = window.innerHeight - 160;
      if (w && h) {
        var ratio = Math.min(maxW / w, maxH / h, 1);
        diagram.style.width  = (w * ratio) + 'px';
        diagram.style.height = (h * ratio) + 'px';
      } else {
        diagram.style.width  = maxW + 'px';
        diagram.style.height = maxH + 'px';
      }
    }
    fitDiagram();

    function applyTransform() {
      diagram.style.transform =
        'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
    }
    applyTransform();

    // 淡入
    requestAnimationFrame(function () { overlay.style.opacity = '1'; });

    // 关闭（含清理全局监听器）
    function onMove(e) {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    }
    function onUp() {
      isDragging = false;
      viewport.style.cursor = 'grab';
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    }

    function close() {
      overlay.style.opacity = '0';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      setTimeout(function () {
        overlay.remove();
        document.body.style.overflow = prevOverflow;
      }, 250);
    }

    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    // 滚轮缩放（以鼠标位置为锚点）
    overlay.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = viewport.getBoundingClientRect();
      var mx = e.clientX - rect.left - rect.width  / 2;
      var my = e.clientY - rect.top  - rect.height / 2;
      var old  = scale;
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE,
        scale * (e.deltaY > 0 ? 0.92 : 1.08)));
      var r  = scale / old;
      panX = mx - r * (mx - panX);
      panY = my - r * (my - panY);
      applyTransform();
    }, { passive: false });

    // 拖拽平移
    viewport.addEventListener('mousedown', function (e) {
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      viewport.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);

    // 双击复位
    viewport.addEventListener('dblclick', function (e) {
      e.preventDefault();
      scale = 1; panX = 0; panY = 0;
      diagram.style.transition = 'transform 0.3s ease';
      applyTransform();
      setTimeout(function () { diagram.style.transition = 'none'; }, 300);
    });
  }

  // ── 绑定所有 .mermaid-wrapper（已含 SVG 的）─────────────
  function bindExisting() {
    var wrappers = document.querySelectorAll('.mermaid-wrapper');
    for (var i = 0; i < wrappers.length; i++) {
      var w = wrappers[i];
      if (bound.has(w)) continue;
      if (w.querySelector('svg')) {
        (function (el) {
          el.addEventListener('click', function () { openLightbox(el); });
        })(w);
        bound.add(w);
      }
    }
  }

  // ── 初始化（等待 Mermaid 渲染完成）──────────────────────
  function init() {
    // 情况1：已配置 mermaid，等 startOnLoad 渲染完毕
    if (typeof mermaid !== 'undefined') {
      // mermaid.run (v10+) 是异步的，用 MutationObserver 监听 SVG 出现
      // mermaid.startOnLoad (旧版) 同步渲染，DOMContentLoaded 后即有 SVG
      // 两种情况统一用 Observer + 兜底 setTimeout 处理
      var observer = new MutationObserver(function () { bindExisting(); });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree:   true,
      });
      // 兜底：Observer 最多跑 5 秒，之后断开（避免长期性能开销）
      setTimeout(function () { observer.disconnect(); }, 5000);
    }
    // 情况2：没有 mermaid，直接绑定（静态 SVG 场景）
    bindExisting();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露公共 API，供外部手动触发
  window.MermaidLightbox = { open: openLightbox };
})();
