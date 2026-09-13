/**
 * menu.js — 菜单数据源 + 渲染引擎
 * 职责：
 *   1. 从 data/menu-data.js（内联）接收菜单数据
 *   2. 递归渲染 2~3 级树形菜单
 *   3. 提供搜索过滤接口（与 search.js 配合）
 *   4. 管理菜单展开/折叠状态和选中高亮
 */

const MenuEngine = (() => {
  // ── 状态 ──────────────────────────────────────────
  let menuData = [];
  let currentActivePath = null;
  let expandedIds = new Set(); // 记录展开的节点 id
  let onLeafClick = null;     // 叶子节点点击回调

  // ── 加载数据 ──────────────────────────────────────
  async function load(url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      menuData = await resp.json();
    } catch (err) {
      console.error('菜单数据加载失败:', err.message);
      menuData = [];
    }
  }

  // ── 直接设置数据（用于内联 JSON） ─────────────────
  function setData(data) {
    menuData = data;
  }

  // ── 递归渲染菜单 ──────────────────────────────────
  function render(container, data, depth) {
    if (!data || data.length === 0) {
      // 空数据：如果是顶层容器显示空状态，子级递归时直接跳过（不清空父级内容）
      if (depth === 0) {
        container.innerHTML = `
          <div class="menu-empty">
            <span class="icon">📭</span>
            暂无笔记，请运行 <code>node scripts/scan-notes.js</code> 同步菜单
          </div>
        `;
      }
      return;
    }

    const list = document.createElement('ul');
    list.className = 'menu-list';

    for (const item of data) {
      const li = document.createElement('li');
      li.dataset.menuId = item.id;
      li.dataset.menuName = item.name;
      if (item.tags) li.dataset.menuTags = item.tags.join(',');

      if (item.children && item.children.length > 0) {
        // ── 有子节点：分类（可折叠） ──────────────────
        const isExpanded = expandedIds.has(item.id);
        const cssClass = depth === 0 ? 'menu-category' : 'menu-subcategory';

        if (isExpanded) li.classList.add('open');
        li.classList.add(cssClass);

        const toggle = document.createElement('button');
        toggle.className = 'menu-toggle';
        toggle.innerHTML = `
          ${item.icon ? `<span class="icon">${item.icon}</span>` : ''}
          <span class="label">${escapeHtml(item.name)}</span>
          <span class="arrow">▶</span>
        `;
        toggle.addEventListener('click', () => {
          li.classList.toggle('open');
          if (li.classList.contains('open')) {
            expandedIds.add(item.id);
          } else {
            expandedIds.delete(item.id);
          }
        });

        li.appendChild(toggle);

        // 递归子节点（直接 append 到 li，CSS 通过 .open > .menu-list 控制展开/收起）
        render(li, item.children, depth + 1);
      } else {
        // ── 叶子节点：考点题目 ──────────────────────────
        li.classList.add('menu-leaf');
        li.dataset.menuName = item.name;
        li.dataset.menuTags = (item.tags || []).join(',');

        const link = document.createElement('a');
        link.href = '#';
        link.dataset.path = item.path || '';
        link.title = item.name + (item.tags ? ' [' + item.tags.join(', ') + ']' : '');
        link.innerHTML = `
          <span class="dot"></span>
          <span class="label">${escapeHtml(item.name)}</span>
        `;

        link.addEventListener('click', (e) => {
          e.preventDefault();
          setActive(item.path);
          if (onLeafClick) onLeafClick(item);
        });

        if (item.path === currentActivePath) {
          link.classList.add('active');
        }

        li.appendChild(link);
      }

      list.appendChild(li);
    }

    container.appendChild(list);
  }

  // ── 设置活跃项 ────────────────────────────────────
  function setActive(path) {
    currentActivePath = path;
    // 更新 DOM 中的 active 样式
    document.querySelectorAll('.menu-leaf a').forEach((a) => {
      a.classList.toggle('active', a.dataset.path === path);
    });
  }

  // ── 搜索过滤 ──────────────────────────────────────
  // 返回匹配的叶子节点路径列表，同时展开父节点
  function filter(keyword) {
    const kw = keyword.toLowerCase().trim();
    const results = [];

    // 重置所有
    document.querySelectorAll('.menu-item-hidden').forEach((el) => {
      el.classList.remove('menu-item-hidden');
    });

    if (!kw) {
      // 清空搜索，恢复之前的展开状态（保留 expandedIds）
      return [];
    }

    function matchNode(items, parentIds) {
      for (const item of items) {
        const currentParents = [...parentIds, item.id];

        if (item.children && item.children.length > 0) {
          matchNode(item.children, currentParents);
        } else {
          // 叶子节点
          const nameMatch = (item.name || '').toLowerCase().includes(kw);
          const tagMatch = (item.tags || []).some(
            (t) => t.toLowerCase().includes(kw)
          );
          if (nameMatch || tagMatch) {
            results.push({ item, parentIds: currentParents });
          } else {
            // 不匹配则隐藏
            hideLeaf(item.id);
          }
        }
      }
    }

    function hideLeaf(id) {
      const el = document.querySelector(`.menu-leaf [data-path]`);
      const leaves = document.querySelectorAll('.menu-leaf');
      for (const leaf of leaves) {
        const link = leaf.querySelector('a');
        if (link && link.dataset.path) {
          const leafId = link.dataset.path;
          // 通过 path 反向查找对应的 id
        }
      }
    }

    matchNode(menuData, []);

    // 展开所有匹配路径上的父节点
    const parentIds = new Set(results.flatMap((r) => r.parentIds));
    parentIds.forEach((id) => {
      expandedIds.add(id);
      const el = document.querySelector(`[data-menu-id="${id}"]`);
      if (el && (el.classList.contains('menu-category') || el.classList.contains('menu-subcategory'))) {
        el.classList.add('open');
      }
    });

    return results;
  }

  // ── 高亮搜索关键词 ────────────────────────────────
  function highlight(keyword) {
    const kw = keyword.trim();
    if (!kw) {
      document.querySelectorAll('.menu-leaf a .label mark').forEach((m) => {
        m.replaceWith(m.textContent);
      });
      return;
    }

    document.querySelectorAll('.menu-leaf a .label').forEach((label) => {
      const text = label.textContent;
      const regex = new RegExp(`(${escapeRegex(kw)})`, 'gi');
      if (regex.test(text)) {
        label.innerHTML = text.replace(regex, '<mark>$1</mark>');
      }
    });
  }

  // ── 展开到指定路径 ────────────────────────────────
  function expandTo(path) {
    // 根据 path 找到所有祖先 id 并展开
    function findParents(items, target, ancestors) {
      for (const item of items) {
        if (item.path === target) {
          return [...ancestors];
        }
        if (item.children) {
          const result = findParents(item.children, target, [...ancestors, item.id]);
          if (result) return result;
        }
      }
      return null;
    }

    const parents = findParents(menuData, path, []);
    if (parents) {
      parents.forEach((id) => {
        expandedIds.add(id);
        const el = document.querySelector(`[data-menu-id="${id}"]`);
        if (el) el.classList.add('open');
      });
    }
  }

  // ── 工具函数 ──────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── 公开 API ──────────────────────────────────────
  return {
    get data() { return menuData; },
    get currentPath() { return currentActivePath; },
    load,
    setData,
    render,
    setActive,
    expandTo,
    filter,
    highlight,
    set onLeafClick(fn) { onLeafClick = fn; },
  };
})();

// 兼容导出（同时也挂到 window）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MenuEngine;
}
