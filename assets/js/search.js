/**
 * search.js — 搜索过滤引擎（增强版）
 * 职责：
 *   1. 实时过滤菜单项（防抖 300ms）
 *   2. 支持空格分隔的多关键词 AND 搜索
 *   3. 精准匹配题目名 + tags，同时匹配一级/二级分类名
 *   4. 搜索结果自动展开父节点、高亮关键词
 *   5. 支持 Ctrl+K 聚焦，↑↓ 键盘导航，Enter 打开
 */

const SearchEngine = (() => {
  const DEBOUNCE_MS = 250;
  let debounceTimer = null;
  let inputEl = null;
  let menuContainerEl = null;
  let noResultEl = null;
  let resultCountEl = null;

  // ── 初始化 ────────────────────────────────────────
  function init(inputSelector, menuSelector) {
    inputEl = document.querySelector(inputSelector);
    menuContainerEl = document.querySelector(menuSelector);

    if (!inputEl || !menuContainerEl) {
      console.warn('SearchEngine: 未找到搜索框或菜单容器');
      return;
    }

    // 无结果提示
    noResultEl = document.createElement('div');
    noResultEl.className = 'menu-empty';
    noResultEl.style.display = 'none';
    noResultEl.innerHTML = `
      <span class="icon">🔍</span>
      未找到匹配的笔记
      <br><small style="color:#94a3b8">试试其他关键词？</small>
    `;
    menuContainerEl.parentElement?.appendChild(noResultEl);

    // 结果计数
    resultCountEl = document.createElement('div');
    resultCountEl.className = 'search-result-count';
    resultCountEl.style.cssText = 'text-align:center;font-size:12px;color:#64748b;padding:4px 0;display:none;';
    menuContainerEl.parentElement?.insertBefore(resultCountEl, menuContainerEl);

    // 输入事件
    inputEl.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, DEBOUNCE_MS);
    });

    // 键盘事件
    inputEl.addEventListener('keydown', onSearchKeydown);

    // 全局 Ctrl+K
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputEl.focus();
        inputEl.select();
      }
    });
  }

  // ── 搜索键盘导航 ──────────────────────────────────
  function onSearchKeydown(e) {
    if (e.key === 'Escape') {
      inputEl.value = '';
      doSearch();
      inputEl.blur();
    }
    // ↓ 跳转到第一个可见笔记
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = menuContainerEl.querySelector('.menu-leaf:not(.menu-item-hidden) a');
      if (first) { first.focus(); first.classList.add('key-focus'); }
    }
    // Enter 打开第一个可见笔记
    if (e.key === 'Enter') {
      const first = menuContainerEl.querySelector('.menu-leaf:not(.menu-item-hidden) a');
      if (first) first.click();
    }
  }

  // ── 执行搜索 ──────────────────────────────────────
  function doSearch() {
    const raw = inputEl.value.trim();
    if (!raw) { resetAll(); return; }

    // 按空格拆分为多个关键词，全部匹配才算命中（AND 逻辑）
    const keywords = raw.split(/\s+/).map(k => k.toLowerCase()).filter(Boolean);

    clearHighlight();
    const allLeaves = menuContainerEl.querySelectorAll('.menu-leaf');
    const allCategories = menuContainerEl.querySelectorAll('.menu-category, .menu-subcategory');
    let matchCount = 0;

    allLeaves.forEach((leaf) => {
      const link = leaf.querySelector('a');
      if (!link) return;

      // 搜索范围：dataset 中的 name + tags + path + 父级分类名
      const name = (leaf.dataset.menuName || link.textContent || '').toLowerCase();
      const tags = (leaf.dataset.menuTags || '').toLowerCase();
      const path = (link.dataset.path || '').toLowerCase();

      // 收集所属分类名
      let categoryChain = '';
      let p = leaf.parentElement;
      while (p) {
        const cat = p.closest('.menu-category, .menu-subcategory');
        if (cat) {
          const catName = (cat.dataset.menuName || '').toLowerCase();
          if (catName) categoryChain = catName + ' ' + categoryChain;
        }
        p = p.parentElement;
      }

      const searchText = name + ' ' + tags + ' ' + path + ' ' + categoryChain;

      // 多关键词 AND 匹配
      const allMatch = keywords.every(kw => searchText.includes(kw));

      if (allMatch) {
        leaf.classList.remove('menu-item-hidden');
        matchCount++;

        // 展开所有祖先
        let parent = leaf.parentElement;
        while (parent) {
          if (parent.classList.contains('menu-category') || parent.classList.contains('menu-subcategory')) {
            parent.classList.add('open');
          }
          if (parent.tagName === 'UL' && parent.classList.contains('menu-list')) {
            const parentLi = parent.closest('.menu-category, .menu-subcategory');
            if (parentLi) parentLi.classList.add('open');
          }
          parent = parent.parentElement;
        }
      } else {
        leaf.classList.add('menu-item-hidden');
      }
    });

    // 隐藏无可见子节点的分类
    allCategories.forEach((cat) => {
      const visible = cat.querySelectorAll('.menu-leaf:not(.menu-item-hidden)');
      if (visible.length === 0) {
        cat.classList.add('menu-item-hidden');
      }
    });

    // 结果计数
    if (resultCountEl) {
      if (matchCount > 0) {
        resultCountEl.style.display = 'block';
        resultCountEl.textContent = `找到 ${matchCount} 道面试题`;
      } else {
        resultCountEl.style.display = 'none';
      }
    }

    if (noResultEl) {
      noResultEl.style.display = matchCount === 0 ? 'block' : 'none';
    }

    // 高亮
    keywords.forEach(kw => highlightKeyword(kw));
  }

  // ── 高亮 ──────────────────────────────────────────
  function highlightKeyword(keyword) {
    const labels = menuContainerEl.querySelectorAll('.menu-leaf:not(.menu-item-hidden) a .label');
    labels.forEach((label) => {
      const text = label.textContent;
      const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
      if (regex.test(text)) {
        label.innerHTML = text.replace(regex, '<mark>$1</mark>');
      }
    });
  }

  function clearHighlight() {
    menuContainerEl.querySelectorAll('.menu-leaf a .label mark').forEach(m => {
      m.replaceWith(m.textContent);
    });
    if (resultCountEl) resultCountEl.style.display = 'none';
  }

  function resetAll() {
    menuContainerEl.querySelectorAll('.menu-item-hidden').forEach(el => el.classList.remove('menu-item-hidden'));
    clearHighlight();
    if (noResultEl) noResultEl.style.display = 'none';
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── API ───────────────────────────────────────────
  return {
    init,
    search: doSearch,
    clear() { if (inputEl) inputEl.value = ''; doSearch(); },
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchEngine;
}
