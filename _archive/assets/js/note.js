/**
 * note.js — 笔记页面交互逻辑（统一入口）
 * 职责：
 *   1. 代码高亮（highlight.js）
 *   2. 全局代码主题读取（从 localStorage 读取，由 index.html 设置）
 *   3. Mermaid 流程图初始化
 *   4. 代码复制按钮
 *   5. 面试话术 Tab 切换
 *
 * 用法：在 note-template.html 中通过 <script src="assets/js/note.js"> 加载
 * 依赖：highlight.min.js、mermaid.min.js 必须在本文件之前加载
 */
;(function () {
  'use strict';

  // ── 代码高亮 ──────────────────────────────────────────
  if (typeof hljs !== 'undefined') {
    hljs.highlightAll();
  }

  // ── 读取全局代码主题（由 index.html 的齿轮按钮设置） ──
  try {
    var saved = localStorage.getItem('notes-code-theme');
    if (saved) {
      document.querySelectorAll('.code-theme').forEach(function (link) {
        link.disabled = (link.dataset.theme !== saved);
      });
    }
  } catch (e) { /* ignore */ }

  // ── Mermaid 流程图 ────────────────────────────────────
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      themeVariables: {
        primaryColor: '#eff6ff',
        primaryBorderColor: '#3b82f6',
        lineColor: '#64748b',
        secondaryColor: '#f0fdf4',
        tertiaryColor: '#fef3c7',
      },
    });
  }

  // ── 复制代码 ──────────────────────────────────────────
  window.copyCode = function (btn) {
    var text = btn.closest('.code-wrapper').querySelector('pre code').innerText;
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = '✓ 已复制';
      setTimeout(function () { btn.textContent = '📋 复制'; }, 2000);
    }).catch(function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.textContent = '✓ 已复制';
      setTimeout(function () { btn.textContent = '📋 复制'; }, 2000);
    });
  };

  // ── 实时接收主题切换（postMessage，支持 file:// 协议） ──
  function applyTheme(theme) {
    document.querySelectorAll('.code-theme').forEach(function (link) {
      link.disabled = (link.dataset.theme !== theme);
    });
  }

  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'code-theme-change' && e.data.theme) {
      applyTheme(e.data.theme);
    }
  });

  // ── 话术 Tab 切换 ─────────────────────────────────────
  window.switchSpeechLevel = function (btn, level) {
    var speechContainer = btn.closest('.speech-tabs');
    var tabs = speechContainer.querySelectorAll('.speech-tab');
    var contents = speechContainer.querySelectorAll('.speech-content');

    tabs.forEach(function (t) {
      t.classList.remove('active', 'text-blue-600', 'border-b-2', 'border-blue-600', 'bg-white');
      t.classList.add('text-gray-500');
    });
    btn.classList.add('active', 'text-blue-600', 'border-b-2', 'border-blue-600', 'bg-white');
    btn.classList.remove('text-gray-500');

    contents.forEach(function (c) { c.classList.add('hidden'); });
    var target = document.getElementById('speech-' + level);
    if (target) target.classList.remove('hidden');
  };

})();
