// 即刻灵感收集器 - Content Script
console.log('💡 即刻灵感收集器已加载');

const CONFIG = {
  storageKey: 'jike_inspirations'
};

// 生成唯一ID
function generateId() {
  return 'insp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 提取动态数据
function extractPostData(button, postContainer) {
  try {
    console.log('🔍 开始提取动态数据...');

    // 优先使用传入的容器
    if (!postContainer) {
      // 向上查找动态容器 - 扩展查找范围
      postContainer = button.closest('article, [class*="post"], [class*="Post"], [class*="item"], [class*="Item"], [class*="card"], [class*="Card"]');

      if (!postContainer) {
        // 如果没找到，向上查找最多10层
        let current = button.parentElement;
        for (let i = 0; i < 10 && current; i++) {
          const textLength = current.innerText?.length || 0;
          if (textLength > 50 && textLength < 5000) {  // 合理的动态内容长度
            postContainer = current;
            break;
          }
          current = current.parentElement;
        }
      }
    }

    console.log('📍 动态容器:', postContainer?.className || postContainer?.tagName);

    // 先提取作者 - 改进的选择器，优先查找更精确的类名
    const authorSelectors = [
      '[class*="nickname"]',
      '[class*="userName"]',
      '[class*="username"]',
      '[class*="user-name"]',
      '[class*="authorName"]',
      '[class*="author-name"]',
      '[class*="Author"] [class*="name"]',
      '[class*="User"] [class*="name"]',
      'a[class*="user"]',
      'a[class*="author"]',
    ];

    let author = '即刻用户';
    let authorElement = null;

    for (const selector of authorSelectors) {
      const elements = postContainer?.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.innerText?.trim() || element.textContent?.trim();
        // 验证：长度合理，不包含数字，不包含常见的按钮文字
        if (text && text.length > 0 && text.length < 30 &&
            !text.includes('点赞') &&
            !text.includes('评论') &&
            !text.includes('分享') &&
            !/\d{4,}/.test(text)) {  // 不包含长数字（可能是ID）
          author = text;
          authorElement = element;
          console.log('👤 找到作者:', author, '选择器:', selector);
          break;
        }
      }
      if (authorElement) break;
    }

    // 如果还是没找到，尝试从链接中提取
    if (!authorElement) {
      const links = postContainer?.querySelectorAll('a[href*="/u/"], a[href*="/user"]');
      for (const link of links) {
        const text = link.innerText?.trim();
        if (text && text.length > 0 && text.length < 30) {
          author = text;
          authorElement = link;
          console.log('👤 从链接找到作者:', author);
          break;
        }
      }
    }

    // 然后提取内容 - 尝试多个选择器，并排除作者信息
    const contentSelectors = [
      '[class*="content"]',
      '[class*="text"]',
      '[class*="Content"]',
      '[class*="Text"]',
      '[class*="message"]',
      '[class*="description"]',
      '[class*="detail"]',
      'p',
    ];

    let content = '';
    let contentElement = null;

    // 首先尝试找到主要内容元素
    for (const selector of contentSelectors) {
      const elements = postContainer?.querySelectorAll(selector);
      for (const element of elements) {
        // 排除作者元素
        if (authorElement && element.contains(authorElement)) {
          continue;
        }

        const text = element.innerText?.trim();
        // 验证：长度合理，不包含按钮文字
        if (text && text.length > 10 &&
            !text.includes('点赞') &&
            !text.includes('评论') &&
            !text.includes('分享') &&
            !text.includes('转发') &&
            !text.includes('💡')) {
          content = text;
          contentElement = element;
          console.log('📝 找到内容:', content.substring(0, 50) + '...', '选择器:', selector);
          break;
        }
      }
      if (contentElement) break;
    }

    // 如果还是没找到内容，尝试获取整个容器的文本并清理
    if (!content && postContainer) {
      const allText = postContainer.innerText;
      const lines = allText.split('\n').filter(line => {
        const trimmed = line.trim();
        // 排除：短行、按钮文字、作者名
        return trimmed.length > 5 &&
          !trimmed.includes('点赞') &&
          !trimmed.includes('评论') &&
          !trimmed.includes('分享') &&
          !trimmed.includes('转发') &&
          !trimmed.includes('展开') &&
          !trimmed.includes('收起') &&
          !trimmed.includes('💡') &&
          trimmed !== author;  // 排除作者名
      });

      // 取所有行，限制最多2000字符
      content = lines.join('\n').substring(0, 2000);
      console.log('📝 从容器提取内容:', content.substring(0, 50) + '...', '总长度:', content.length);
    }

    // 提取动态链接 - 改进逻辑，处理各种动态卡片结构
    let postUrl = window.location.href;

    // 策略1: 检查动态容器本身是否是链接
    if (postContainer && postContainer.tagName === 'A' && postContainer.href) {
      postUrl = postContainer.href;
      console.log('🔗 容器本身是链接:', postUrl);
    }

    // 策略2: 检查容器是否有 data-href、data-url 等属性
    if (postUrl === window.location.href && postContainer) {
      const dataAttributes = ['data-href', 'data-url', 'data-link', 'data-to'];
      for (const attr of dataAttributes) {
        const value = postContainer.getAttribute(attr);
        if (value && (value.startsWith('http') || value.startsWith('/'))) {
          postUrl = value.startsWith('http') ? value : 'https://web.okjike.com' + value;
          console.log(`🔗 从${attr}属性找到链接:`, postUrl);
          break;
        }
      }
    }

    // 策略3: 查找动态卡片内的链接元素
    if (postUrl === window.location.href) {
      // 查找所有链接
      const allLinks = postContainer?.querySelectorAll('a[href]');

      if (allLinks && allLinks.length > 0) {
        console.log(`🔍 容器内找到 ${allLinks.length} 个链接`);

        for (const link of allLinks) {
          const href = link.href;
          console.log('  检查链接:', href);

          // 排除条件：
          // 1. 必须是完整的HTTP链接
          // 2. 不是用户主页链接（/u/ 或 /user/）
          // 3. 不是当前页面URL（避免重复）
          // 4. 不包含话题、标签等链接
          if (href && href.startsWith('http') &&
              !href.includes('/u/') &&
              !href.includes('/user/') &&
              !href.includes('/topic/') &&
              !href.includes('/tag/') &&
              href !== window.location.href) {

            postUrl = href;
            console.log('✅ 找到动态链接:', postUrl);
            break;
          }
        }
      }
    }

    // 策略4: 尝试从点击事件或父元素中查找链接
    if (postUrl === window.location.href) {
      // 向上查找3层，看是否有链接元素
      let current = postContainer;
      for (let i = 0; i < 3 && current; i++) {
        // 检查是否有 onclick 属性包含导航
        const onclick = current.getAttribute('onclick');
        if (onclick && onclick.includes('navigate')) {
          console.log('🔗 发现onclick导航:', onclick);
          // 尝试从onclick中提取URL（正则匹配）
          const urlMatch = onclick.match(/navigate\s*\(\s*['"`]([^'"`]+)['"`]/);
          if (urlMatch && urlMatch[1]) {
            postUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : 'https://web.okjike.com' + urlMatch[1];
            console.log('✅ 从onclick提取链接:', postUrl);
            break;
          }
        }

        // 检查父元素是否是链接
        if (current.parentElement && current.parentElement.tagName === 'A') {
          postUrl = current.parentElement.href;
          console.log('✅ 父元素是链接:', postUrl);
          break;
        }

        current = current.parentElement;
      }
    }

    // 策略5: 检查动态ID并构建链接
    if (postUrl === window.location.href) {
      // 尝试从容器的 id、class 等属性中提取动态ID
      const containerId = postContainer?.id || '';
      const containerClass = postContainer?.className || '';

      // 即刻的动态ID通常是特定格式（如 jk-xxxxxxxx）
      const idMatch = containerId.match(/jk-[a-z0-9]+/i) ||
                     containerClass.match(/jk-[a-z0-9]+/i);

      if (idMatch) {
        const postId = idMatch[0];
        console.log('🔍 找到动态ID:', postId);
        // 注意：这只是ID，无法直接构建URL，记录一下
        console.log('⚠️ 找到动态ID但无法构建URL，ID:', postId);
      }
    }

    // 策略6: 如果当前页面本身就是动态详情页，直接使用当前URL
    if (postUrl === window.location.href) {
      if (window.location.pathname.includes('/original') ||
          window.location.pathname.includes('/post') ||
          window.location.pathname.includes('/p/')) {
        console.log('🔗 当前是动态详情页，使用当前URL:', postUrl);
      } else {
        console.log('⚠️ 未能找到独立动态链接，使用当前页面URL');
        console.log('💡 提示：在首页/搜索页直接收藏时，可能无法获取独立链接');
        console.log('💡 建议：点击进入动态详情页后再收藏，可获得准确的独立链接');
      }
    }

    const postData = {
      content: content || '无法提取内容',
      author,
      url: postUrl,
      collectedAt: new Date().toISOString()
    };

    // 如果找到了动态容器，保存容器的class/id等信息
    if (postContainer && postUrl === window.location.href) {
      // 保存动态容器的标识，用于后续查找
      postData.containerId = postContainer.id || '';
      postData.containerClass = postContainer.className || '';
      console.log('💾 保存容器信息:', {
        id: postData.containerId,
        class: postData.containerClass
      });
    }

    console.log('✅ 提取成功:', {
      author: postData.author,
      contentLength: postData.content.length,
      url: postData.url
    });
    return postData;

  } catch (error) {
    console.error('❌ 提取数据失败:', error);
    return {
      content: '无法提取内容',
      author: '即刻用户',
      url: window.location.href,
      collectedAt: new Date().toISOString()
    };
  }
}

// 创建弹窗
function createModal(postData, warningHtml = '') {
  const modal = document.createElement('div');
  modal.id = 'jike-modal';
  modal.className = 'jike-modal-container';

  const contentPreview = postData.content.length > 200
    ? postData.content.substring(0, 200) + '...'
    : postData.content;

  modal.innerHTML = `
    <div class="jike-overlay"></div>
    <div class="jike-modal-content">
      <h3>💡 收集灵感</h3>
      ${warningHtml}
      <div class="jike-post-info">
        <p class="jike-author">👤 <strong>${postData.author}</strong></p>
        <p class="jike-content-preview">${contentPreview}</p>
      </div>
      <div class="jike-form-group">
        <label>📁 类型：</label>
        <select id="insp-type">
          <option value="need">需求洞察 - 痛点、问题、需求</option>
          <option value="knowledge">干货分享 - 文章感悟、技巧</option>
          <option value="insight">洞见思考 - 深度观点、独特视角</option>
        </select>
      </div>
      <div class="jike-form-group">
        <label>📝 笔记：</label>
        <textarea id="insp-note" placeholder="添加你的想法、备注..."></textarea>
      </div>
      <div class="jike-actions">
        <button id="insp-cancel" class="jike-btn-cancel">取消</button>
        <button id="insp-save" class="jike-btn-save">保存</button>
      </div>
    </div>
  `;

  // 添加样式
  if (!document.getElementById('jike-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'jike-modal-styles';
    style.textContent = `
      .jike-modal-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 999999 !important;
        pointer-events: none !important;
      }
      .jike-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(0, 0, 0, 0.5) !important;
        pointer-events: auto !important;
        z-index: 1 !important;
      }
      .jike-modal-content {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: white !important;
        border: 2px solid #FFE411 !important;
        border-radius: 16px !important;
        padding: 28px !important;
        min-width: 420px !important;
        max-width: 500px !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3) !important;
        pointer-events: auto !important;
        z-index: 2 !important;
        animation: modalSlideIn 0.3s ease-out !important;
      }
      @keyframes modalSlideIn {
        from { opacity: 0; transform: translate(-50%, -60%); }
        to { opacity: 1; transform: translate(-50%, -50%); }
      }
      .jike-modal-content h3 {
        margin: 0 0 16px 0 !important;
        font-size: 20px !important;
        color: #333 !important;
      }
      .jike-post-info {
        background: #fafafa !important;
        border: 1px solid #FFE411 !important;
        padding: 12px !important;
        border-radius: 8px !important;
        margin-bottom: 16px !important;
      }
      .jike-post-info .jike-author {
        color: #666 !important;
        font-size: 13px !important;
        margin: 0 0 6px 0 !important;
      }
      .jike-post-info .jike-content-preview {
        color: #888 !important;
        font-size: 13px !important;
        margin: 0 !important;
        line-height: 1.5 !important;
      }
      .jike-form-group {
        margin-bottom: 16px !important;
      }
      .jike-form-group label {
        display: block !important;
        margin-bottom: 8px !important;
        font-weight: 600 !important;
        color: #333 !important;
        font-size: 14px !important;
      }
      .jike-form-group select,
      .jike-form-group textarea {
        width: 100% !important;
        padding: 10px !important;
        border: 1px solid #FFE411 !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-family: inherit !important;
        box-sizing: border-box !important;
        background: white !important;
        color: #333 !important;
      }
      .jike-form-group select:focus,
      .jike-form-group textarea:focus {
        outline: none !important;
        border-color: #FFE411 !important;
        box-shadow: 0 0 0 3px rgba(255, 228, 17, 0.1) !important;
      }
      .jike-form-group textarea {
        min-height: 80px !important;
        resize: vertical !important;
      }
      .jike-actions {
        display: flex !important;
        gap: 12px !important;
        justify-content: flex-end !important;
      }
      .jike-btn-cancel,
      .jike-btn-save {
        padding: 10px 20px !important;
        border-radius: 20px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        font-weight: 400 !important;
        transition: all 0.2s !important;
        border: 1px solid #FFE411 !important;
        background: white !important;
        color: #999999 !important;
      }
      .jike-btn-cancel:hover,
      .jike-btn-save:hover {
        background: #FFE411 !important;
        color: #333333 !important;
        border-color: #FFE411 !important;
      }
    `;
    document.head.appendChild(style);
  }

  return modal;
}

// 保存灵感
function saveInspiration(postData, type, note) {
  const typeLabels = {
    need: '需求洞察',
    knowledge: '干货分享',
    insight: '洞见思考'
  };

  const inspiration = {
    id: generateId(),
    type: type,
    typeLabel: typeLabels[type],
    content: postData.content,
    author: postData.author,
    url: postData.url,
    note: note,
    tags: [],
    collectedAt: postData.collectedAt,
    updatedAt: new Date().toISOString()
  };

  console.log('💾 正在保存灵感:', inspiration);

  chrome.storage.local.get([CONFIG.storageKey], (result) => {
    const inspirations = result[CONFIG.storageKey] || [];
    inspirations.unshift(inspiration);

    chrome.storage.local.set({ [CONFIG.storageKey]: inspirations }, () => {
      console.log('✅ 保存成功!');

      // 显示成功提示
      showNotification('✅ 已收集到灵感库');
    });
  });
}

// 显示通知
function showNotification(message) {
  // 移除旧通知
  const oldNotification = document.querySelector('.jike-notification');
  if (oldNotification) {
    oldNotification.remove();
  }

  const notification = document.createElement('div');
  notification.className = 'jike-notification';
  notification.textContent = message;

  // 添加样式
  if (!document.getElementById('jike-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'jike-notification-styles';
    style.textContent = `
      .jike-notification {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        padding: 16px 24px !important;
        border-radius: 12px !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
        z-index: 1000000 !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        animation: slideIn 0.3s ease-out !important;
      }
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// 打开弹窗
function openModal(button, postContainer) {
  console.log('🎯 点击了灵感按钮');

  try {
    // 检查当前是否在首页/搜索页
    const isNotDetailPage = !window.location.pathname.includes('/original') &&
                            !window.location.pathname.includes('/post');

    if (isNotDetailPage) {
      // 在首页/搜索页，需要先跳转到详情页
      console.log('📍 当前在首页/搜索页，准备跳转到详情页...');

      // 显示加载提示
      const loadingTip = document.createElement('div');
      loadingTip.innerHTML = '⏳ 正在跳转到详情页...';
      loadingTip.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #FFE411;
        color: #333333;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        z-index: 1000000;
        font-size: 14px;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
      `;
      document.body.appendChild(loadingTip);

      // 如果没有传入容器，先查找
      if (!postContainer) {
        postContainer = button.closest('article, [class*="post"], [class*="Post"], [class*="item"], [class*="Item"], [class*="card"], [class*="Card"]');
      }

      if (!postContainer) {
        // 如果没找到，向上查找
        let current = button.parentElement;
        for (let i = 0; i < 10 && current; i++) {
          if (current.innerText.length > 50 && current.innerText.length < 5000) {
            postContainer = current;
            break;
          }
          current = current.parentElement;
        }
      }

      console.log('📍 找到动态容器:', postContainer);

      // 尝试多种方式点击进入详情页
      let clicked = false;

      // 方式1: 优先查找指向动态详情页的链接（包含 /original、/post 的）
      if (postContainer) {
        const detailLinks = postContainer.querySelectorAll('a[href*="/original"], a[href*="/post/"], a[href*="/p/"]');
        for (const link of detailLinks) {
          const href = link.href;
          if (href && href.includes('http')) {
            console.log('🔗 找到动态详情页链接，点击跳转:', href);
            link.click();
            clicked = true;
            break;
          }
        }
      }

      // 方式2: 如果容器本身是链接
      if (!clicked && postContainer && postContainer.tagName === 'A' && postContainer.href) {
        const href = postContainer.href;
        // 排除外链（非即刻域名）
        if (href.includes('web.okjike.com') || href.includes('okjk.co')) {
          console.log('🔗 容器是即刻链接，直接跳转:', href);
          window.location.href = href;
          clicked = true;
        } else {
          console.log('⚠️ 容器是外链，跳过:', href);
        }
      }

      // 方式3: 点击整个容器（触发SPA路由）
      if (!clicked && postContainer) {
        console.log('🔗 尝试点击容器本身');
        postContainer.click();
        clicked = true;
      }

      // 移除加载提示（延迟一点，让用户看到）
      setTimeout(() => {
        loadingTip.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => loadingTip.remove(), 300);
      }, 1000);

      // 监听URL变化，当跳转到详情页后自动打开弹窗
      const checkUrl = setInterval(() => {
        if (window.location.pathname.includes('/original') ||
            window.location.pathname.includes('/post')) {
          clearInterval(checkUrl);
          console.log('✅ 已跳转到详情页，自动打开收集弹窗');

          // 延迟一下，等待页面加载完成
          setTimeout(() => {
            // 重新查找按钮并打开弹窗
            const newButtons = document.querySelectorAll('[data-inspiration-btn]');
            if (newButtons.length > 0) {
              // 找到对应的按钮（第一个应该就是）
              openModal(newButtons[0]);
            }
          }, 1000);
        }
      }, 500);

      // 10秒后停止检查（避免无限循环）
      setTimeout(() => clearInterval(checkUrl), 10000);

      return;
    }

    // 在详情页，直接打开弹窗（使用传入的容器）
    const postData = extractPostData(button, postContainer);
    const modal = createModal(postData, '');
    document.body.appendChild(modal);

    // 绑定事件 - 确保在 DOM 中找到元素后再绑定
    setTimeout(() => {
      const overlay = modal.querySelector('.jike-overlay');
      const cancelBtn = document.getElementById('insp-cancel');
      const saveBtn = document.getElementById('insp-save');

      if (overlay) {
        overlay.onclick = () => {
          console.log('❌ 点击了遮罩，关闭弹窗');
          modal.remove();
        };
      }

      if (cancelBtn) {
        cancelBtn.onclick = () => {
          console.log('❌ 点击了取消');
          modal.remove();
        };
      }

      if (saveBtn) {
        saveBtn.onclick = () => {
          console.log('💾 点击了保存');
          const type = document.getElementById('insp-type').value;
          const note = document.getElementById('insp-note').value.trim();
          saveInspiration(postData, type, note);
          modal.remove();
        };
      }

      // ESC 键关闭
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', handleEsc);
        }
      };
      document.addEventListener('keydown', handleEsc);
    }, 0);

  } catch (error) {
    console.error('❌ 打开弹窗失败:', error);
    alert('弹窗打开失败，请重试');
  }
}

// 创建灵感按钮
function createInspirationButton(postContainer) {
  const button = document.createElement('button');
  button.innerHTML = '💡 灵感';
  button.className = 'jike-inspiration-btn';
  button.setAttribute('data-inspiration-btn', 'true');
  button.type = 'button';

  // 保存对应的动态容器引用
  button._postContainer = postContainer;

  // 内联样式 - 空心设计，即刻主题色
  button.style.cssText = `
    background: transparent !important;
    color: #999999 !important;
    border: 1px solid #FFE411 !important;
    padding: 5px 12px !important;
    border-radius: 20px !important;
    cursor: pointer !important;
    font-size: 13px !important;
    font-weight: 400 !important;
    margin: 0 6px !important;
    transition: all 0.2s !important;
    flex-shrink: 0 !important;
    width: auto !important;
    height: auto !important;
    min-width: auto !important;
    max-width: none !important;
    display: inline-block !important;
    box-sizing: border-box !important;
    line-height: normal !important;
  `.replace(/\n/g, '');

  // 鼠标悬停效果
  button.onmouseenter = () => {
    button.style.background = '#FFE411';
    button.style.color = '#333333';
  };

  button.onmouseleave = () => {
    button.style.background = 'transparent';
    button.style.color = '#999999';
  };

  // 点击事件 - 直接绑定
  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🖱️ 灵感按钮被点击');
    console.log('📍 绑定的容器:', button._postContainer);
    openModal(button, button._postContainer);
  };

  return button;
}

// 检查容器是否被折叠或隐藏
function isCollapsedOrHidden(container) {
  if (!container) return false;

  // 检查类名是否包含折叠相关的关键词
  const className = container.className || '';
  const classStr = typeof className === 'string' ? className : '';

  const collapsedKeywords = [
    'collapsed', 'Collapsed',
    'folded', 'Folded',
    'hidden', 'Hidden',
    'collapsed-children',
    'folded-children',
    '折叠', '收起'
  ];

  for (const keyword of collapsedKeywords) {
    if (classStr.includes(keyword)) {
      return true;
    }
  }

  // 检查元素的 display 样式
  const style = window.getComputedStyle(container);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return true;
  }

  return false;
}

// 检查是否在弹窗中
function isInModal(container) {
  if (!container) return false;

  // 向上查找，看是否有弹窗相关的元素
  let current = container;
  for (let i = 0; i < 10 && current; i++) {
    const className = current.className || '';
    const classStr = typeof className === 'string' ? className : '';
    const id = current.id || '';

    // 检查是否在弹窗中
    if (classStr.includes('modal') ||
        classStr.includes('popup') ||
        classStr.includes('dialog') ||
        id.includes('modal') ||
        id.includes('popup') ||
        id === 'jike-modal') {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

// 判断是否是详情页
function isDetailPage() {
  const pathname = window.location.pathname;
  return pathname.includes('/original') || pathname.includes('/post/');
}

// 注入按钮 - 新方案
function injectButtons() {
  console.log('🔍 开始注入按钮...');

  let injectedCount = 0;
  const detailPage = isDetailPage();

  // 查找所有按钮
  const allButtons = document.querySelectorAll('button, [role="button"]');
  console.log(`📊 找到 ${allButtons.length} 个按钮，${detailPage ? '详情页模式' : '列表页模式'}`);

  // 用于存储找到的按钮组
  const buttonGroups = [];
  const processedContainers = new Set();

  allButtons.forEach((btn) => {
    let container = btn.parentElement;

    // 向上查找最多3层，找按钮组
    for (let level = 0; level < 3 && container; level++) {
      // 跳过已经处理过的容器
      if (processedContainers.has(container)) {
        break;
      }

      // 检查是否已经有灵感按钮
      if (container.querySelector('[data-inspiration-btn]')) {
        break;
      }

      // 计算容器内的按钮数量
      const buttonsInContainer = container.querySelectorAll('button, [role="button"]');

      // 如果容器内有2个或更多按钮，说明这是一个按钮组
      if (buttonsInContainer.length >= 2) {
        // 检查是否被折叠或隐藏
        if (isCollapsedOrHidden(container)) {
          console.log('⏭️  跳过折叠容器');
          break;
        }

        // 检查是否在弹窗中
        if (isInModal(container)) {
          console.log('⏭️  跳过弹窗中的容器');
          break;
        }

        // 检查是否在发帖区
        if (isInComposerArea(container)) {
          console.log('⏭️  跳过发帖区');
          break;
        }

        // 检查容器是否有足够的内容（不是空的按钮包装容器）
        const textLength = container.innerText?.length || 0;
        if (textLength < 50) {
          console.log('⏭️  跳过内容太少的容器，长度:', textLength);
          break;
        }

        // 添加到按钮组列表
        if (!buttonGroups.includes(container)) {
          buttonGroups.push(container);
          processedContainers.add(container);
          console.log('✅ 找到有效按钮组，内容长度:', textLength);
        }

        break;
      }

      // 继续向上查找
      container = container.parentElement;
    }
  });

  console.log(`📊 找到 ${buttonGroups.length} 个按钮组`);

  // 根据页面类型决定注入策略
  if (detailPage) {
    // 详情页：只注入第一个按钮组（主动态的）
    if (buttonGroups.length > 0) {
      const firstGroup = buttonGroups[0];
      const inspirationBtn = createInspirationButton(firstGroup);
      firstGroup.appendChild(inspirationBtn);
      injectedCount = 1;
      console.log(`✅ 详情页：已注入按钮到第一个按钮组`);
    }
  } else {
    // 列表页：注入所有按钮组
    buttonGroups.forEach((group, index) => {
      const inspirationBtn = createInspirationButton(group);
      group.appendChild(inspirationBtn);
      injectedCount++;
      console.log(`✅ 列表页：已注入按钮 #${injectedCount}`);
    });
  }

  console.log(`📊 本次注入了 ${injectedCount} 个按钮`);
  return injectedCount;
}

// 检查是否在发帖区
function isInComposerArea(container) {
  if (!container) return false;

  let current = container;
  for (let i = 0; i < 5 && current; i++) {
    const className = current.className || '';
    const classStr = typeof className === 'string' ? className : '';
    const id = current.id || '';

    // 检查是否是发帖区
    if (classStr.includes('composer') ||
        classStr.includes('Editor') ||
        id.includes('composer') ||
        id.includes('editor')) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

// 防抖定时器
let injectTimer = null;

// 使用 MutationObserver 监听动态加载的内容
const observer = new MutationObserver((mutations) => {
  // 防抖，避免频繁注入
  clearTimeout(injectTimer);
  injectTimer = setTimeout(() => {
    const count = injectButtons();
    if (count > 0) {
      console.log(`🔄 检测到页面变化，注入了 ${count} 个新按钮`);
    }
  }, 500);
});

// 开始观察整个页面
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 页面加载完成后初次注入
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const count = injectButtons();
      console.log(`🎉 初始注入完成，共注入 ${count} 个按钮`);
    }, 1000);
  });
} else {
  setTimeout(() => {
    const count = injectButtons();
    console.log(`🎉 初始注入完成，共注入 ${count} 个按钮`);
  }, 1000);
}

console.log('✅ 即刻灵感收集器已就绪');
