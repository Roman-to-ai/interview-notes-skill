/**
 * app.js — 主控逻辑
 * 职责：
 *   1. 初始化应用：加载菜单、渲染、设置搜索
 *   2. 管理 iframe 加载考点笔记
 *   3. 响应式：移动端汉堡菜单
 *   4. URL hash 路由（支持直接链接到具体笔记）
 */

(function () {
  'use strict';

  // ── DOM 元素 ──────────────────────────────────────
  const menuContainer = document.getElementById('menu-container');
  const contentFrame = document.getElementById('content-frame');
  const welcomePage = document.getElementById('welcome-page');
  const searchInput = document.getElementById('search-input');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const mobileToggle = document.getElementById('mobile-toggle');
  const sidebarToggle = document.getElementById('sidebar-toggle');

  // ── 配置 ──────────────────────────────────────────
  const DEFAULT_WELCOME = true;

  // ── 加载菜单并渲染 ─────────────────────────────────
  async function initMenu() {
    if (!menuContainer) return;

    // 优先使用内联数据（file:// 协议下 fetch 会被 CORS 阻止）
    if (window.__MENU_DATA__) {
      MenuEngine.setData(window.__MENU_DATA__);
    }

    menuContainer.innerHTML = '';
    MenuEngine.render(menuContainer, MenuEngine.data, 0);

    // 叶子节点点击 → 加载到 iframe
    MenuEngine.onLeafClick = (item) => {
      loadNote(item.path);
      // 移动端自动收起菜单
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    };
  }

  // ── 加载笔记到 iframe ─────────────────────────────
  function loadNote(path) {
    if (!contentFrame) return;

    // 隐藏欢迎页
    if (welcomePage) welcomePage.style.display = 'none';
    contentFrame.style.display = 'block';

    // 更新 hash
    window.location.hash = path;

    // 加载
    contentFrame.src = path;

    // 更新菜单高亮
    MenuEngine.setActive(path);

    // 保存最近阅读
    try {
      localStorage.setItem('notes-last-read', path);
    } catch (e) { /* ignore */ }
  }

  // ── URL Hash 路由 ─────────────────────────────────
  function handleHash() {
    const hash = window.location.hash.slice(1); // 去掉 #
    if (hash && hash.endsWith('.html')) {
      // 展开菜单到对应路径
      MenuEngine.expandTo(hash);

      // 重新渲染菜单以反映展开状态
      if (menuContainer) {
        menuContainer.innerHTML = '';
    MenuEngine.render(menuContainer, MenuEngine.data, 0);
        MenuEngine.onLeafClick = (item) => loadNote(item.path);
      }

      loadNote(hash);
    }
  }

  // ── 移动端：打开/关闭菜单 ──────────────────────────
  function openSidebar() {
    sidebar?.classList.add('open');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ── 事件绑定 ──────────────────────────────────────
  function bindEvents() {
    // 移动端切换按钮
    mobileToggle?.addEventListener('click', () => {
      if (sidebar?.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    // PC 端收起/展开按钮
    sidebarToggle?.addEventListener('click', () => {
      const isCollapsed = sidebar?.classList.toggle('collapsed');
      sidebarToggle.textContent = isCollapsed ? '▶' : '◀';
      sidebarToggle.title = isCollapsed ? '展开菜单' : '收起菜单';
      sidebarToggle.classList.toggle('shifted', isCollapsed);
      try {
        localStorage.setItem('notes-sidebar-collapsed', isCollapsed ? '1' : '');
      } catch (e) { /* ignore */ }
    });

    // 点击遮罩关闭
    overlay?.addEventListener('click', closeSidebar);

    // Hash 变化
    window.addEventListener('hashchange', handleHash);

    // 窗口大小变化时，大屏自动关闭移动端遮罩；切到移动端时清除 PC 收起状态
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        closeSidebar();
      } else if (sidebar?.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        sidebarToggle?.classList.remove('shifted');
        if (sidebarToggle) {
          sidebarToggle.textContent = '◀';
          sidebarToggle.title = '收起菜单';
        }
      }
    });

    // iframe 加载完成后的处理
    contentFrame?.addEventListener('load', () => {
      // 可以在这里做一些 iframe 内页面的后处理
      // 比如同步滚动位置等
    });
  }

  // ── 恢复侧边栏收起状态 ─────────────────────────────
  function restoreSidebarState() {
    try {
      if (localStorage.getItem('notes-sidebar-collapsed') === '1') {
        sidebar?.classList.add('collapsed');
        if (sidebarToggle) {
          sidebarToggle.textContent = '▶';
          sidebarToggle.title = '展开菜单';
          sidebarToggle.classList.add('shifted');
        }
      }
    } catch (e) { /* ignore */ }
  }

  // ── 恢复上次阅读位置 ──────────────────────────────
  function restoreLastRead() {
    try {
      const lastPath = localStorage.getItem('notes-last-read');
      if (lastPath) {
        MenuEngine.expandTo(lastPath);
        // 重新渲染
        if (menuContainer) {
          menuContainer.innerHTML = '';
    MenuEngine.render(menuContainer, MenuEngine.data, 0);
          MenuEngine.onLeafClick = (item) => loadNote(item.path);
        }
        // 不自动跳转，仅展开菜单并高亮
        MenuEngine.setActive(lastPath);
      }
    } catch (e) { /* ignore */ }
  }

  // ── 初始化 ────────────────────────────────────────
  async function init() {
    await initMenu();
    bindEvents();
    SearchEngine.init('#search-input', '#menu-container');
    restoreSidebarState();

    // 处理初始 hash
    if (window.location.hash) {
      handleHash();
    } else {
      // 尝试恢复上次阅读
      restoreLastRead();
    }
  }

  // ── 启动 ──────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
