// 即刻灵感收集器 - Popup Script

const STORAGE_KEY = 'jike_inspirations';
let currentFilter = 'all';
let searchQuery = '';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('💡 管理界面已加载');
  loadInspirations();
  setupEventListeners();
  updateStats();
});

// 设置事件监听
function setupEventListeners() {
  // 筛选按钮
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadInspirations();
    });
  });

  // 搜索框
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    loadInspirations();
  });

  // 导出Markdown
  document.getElementById('exportMdBtn').addEventListener('click', exportMarkdown);

  // 导出JSON
  document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);

  // 清空
  document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (confirm('确定要清空所有灵感吗？此操作不可恢复。')) {
      chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
        loadInspirations();
        updateStats();
        alert('✅ 已清空所有灵感');
      });
    }
  });
}

// 加载灵感列表
function loadInspirations() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const inspirations = result[STORAGE_KEY] || [];
    const listEl = document.getElementById('inspirationList');

    // 过滤和搜索
    const filtered = inspirations.filter(item => {
      const matchesFilter = currentFilter === 'all' || item.type === currentFilter;
      const matchesSearch = !searchQuery ||
        item.content.toLowerCase().includes(searchQuery) ||
        item.note.toLowerCase().includes(searchQuery);
      return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>没有找到相关灵感</p></div>';
      return;
    }

    listEl.innerHTML = filtered.map(item => createInspirationCard(item)).join('');

    // 绑定删除按钮事件
    listEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteInspiration(btn.dataset.id);
      });
    });

    // 绑定查看按钮事件
    listEl.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        chrome.tabs.create({ url: url });
      });
    });
  });
}

// 创建灵感卡片
function createInspirationCard(item) {
  const date = new Date(item.collectedAt).toLocaleDateString('zh-CN');
  const content = item.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return '<div class="inspiration-item">' +
    '<div class="inspiration-header">' +
    '<span class="inspiration-type type-' + item.type + '">' + item.typeLabel + '</span>' +
    '<span class="inspiration-date">' + date + '</span>' +
    '</div>' +
    '<div class="inspiration-content">' + content + '</div>' +
    (item.note ? '<div class="inspiration-note">📝 ' + item.note + '</div>' : '') +
    '<div class="inspiration-footer">' +
    '<span>👤 ' + item.author + '</span>' +
    '<div class="inspiration-actions">' +
    '<button class="action-btn view-btn" data-url="' + item.url + '">查看</button>' +
    '<button class="action-btn delete-btn" data-id="' + item.id + '">删除</button>' +
    '</div></div></div>';
}

// 删除灵感
function deleteInspiration(id) {
  if (!confirm('确定要删除这条灵感吗？')) return;

  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const inspirations = result[STORAGE_KEY] || [];
    const filtered = inspirations.filter(item => item.id !== id);

    chrome.storage.local.set({ [STORAGE_KEY]: filtered }, () => {
      loadInspirations();
      updateStats();
    });
  });
}

// 更新统计
function updateStats() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const inspirations = result[STORAGE_KEY] || [];
    const needCount = inspirations.filter(i => i.type === 'need').length;
    const knowledgeCount = inspirations.filter(i => i.type === 'knowledge').length;
    const insightCount = inspirations.filter(i => i.type === 'insight').length;

    document.getElementById('stats').textContent =
      '共收集 ' + inspirations.length + ' 条灵感 | 需求' + needCount + ' | 干货' + knowledgeCount + ' | 洞见' + insightCount;
  });
}

// 导出为Markdown
function exportMarkdown() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const inspirations = result[STORAGE_KEY] || [];

    if (inspirations.length === 0) {
      alert('还没有收集任何灵感');
      return;
    }

    const grouped = {
      need: inspirations.filter(i => i.type === 'need'),
      knowledge: inspirations.filter(i => i.type === 'knowledge'),
      insight: inspirations.filter(i => i.type === 'insight')
    };

    let md = '# 💡 即刻灵感收集\n\n';
    md += '导出时间：' + new Date().toLocaleString('zh-CN') + '\n\n---\n\n';

    Object.entries({
      need: '需求洞察',
      knowledge: '干货分享',
      insight: '洞见思考'
    }).forEach(([type, label]) => {
      if (grouped[type].length > 0) {
        md += '## ' + label + ' (' + grouped[type].length + ')\n\n';
        grouped[type].forEach(item => {
          const date = new Date(item.collectedAt).toLocaleDateString('zh-CN');
          md += '### ' + date + '\n\n';
          md += '**作者**：' + item.author + '\n\n';
          md += '**链接**：' + item.url + '\n\n';
          if (item.note) {
            md += '**我的笔记**：' + item.note + '\n\n';
          }
          md += '**原始内容**：\n\n' + item.content + '\n\n---\n\n';
        });
      }
    });

    downloadFile('即刻灵感_' + new Date().toISOString().split('T')[0] + '.md', md, 'text/markdown');
  });
}

// 导出为JSON
function exportJSON() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const inspirations = result[STORAGE_KEY] || [];

    if (inspirations.length === 0) {
      alert('还没有收集任何灵感');
      return;
    }

    const json = JSON.stringify(inspirations, null, 2);
    downloadFile('即刻灵感_' + new Date().toISOString().split('T')[0] + '.json', json, 'application/json');
  });
}

// 下载文件
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  }, (downloadId) => {
    URL.revokeObjectURL(url);
  });
}
