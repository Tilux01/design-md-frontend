document.addEventListener('DOMContentLoaded', () => {
  // Toast Notification System
  function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconMap = {
      info: 'ℹ️',
      success: '✓',
      warning: '⚠️',
      error: '✕'
    };

    toast.innerHTML = `
      <span class="toast-icon">${iconMap[type] || 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    };

    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

  // Navigation
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view-section');
  
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const targetView = btn.getAttribute('data-view');
      views.forEach(v => {
        if (v.id === targetView) v.classList.remove('hidden');
        else v.classList.add('hidden');
      });
      
      if (targetView === 'library-view') loadLibrary();
    });
  });

  // Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const appSidebar = document.getElementById('app-sidebar');
  if (mobileToggle && appSidebar) {
    mobileToggle.addEventListener('click', () => {
      appSidebar.classList.toggle('open');
    });
    // Close sidebar when a nav btn is clicked on mobile
    appSidebar.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.innerWidth <= 768) appSidebar.classList.remove('open');
      });
    });
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && !appSidebar.contains(e.target) && e.target !== mobileToggle) {
        appSidebar.classList.remove('open');
      }
    });
  }

  // Chat UI Elements
  const chatHistory = document.getElementById('chat-history');
  const chatInput = document.getElementById('chat-input');
  const submitBtn = document.getElementById('submit-btn');
  const attachBtn = document.getElementById('attach-btn');
  const fileInput = document.getElementById('file-input');
  const uploadPreview = document.getElementById('upload-preview');
  const previewItems = document.getElementById('preview-items');
  const clearPreviewBtn = document.getElementById('clear-preview-btn');

  let currentFiles = [];

  // Auto resize scroll
  function scrollToBottom() {
    chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
  }

  // File Handling
  attachBtn.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', function() {
    handleFiles(this.files);
  });

  window.addEventListener('paste', (e) => {
    const activeView = document.querySelector('.view-section:not(.hidden)');
    if (activeView.id !== 'chat-view') return;

    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://'))) {
      chatInput.value = pastedText;
      checkSubmitState();
      return;
    }

    if (e.clipboardData && e.clipboardData.files.length > 0) {
      e.preventDefault();
      handleFiles(e.clipboardData.files);
    }
  });

  function handleFiles(files) {
    let added = false;
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/') || files[i].type.startsWith('video/')) {
        currentFiles.push(files[i]);
        added = true;
      }
    }
    if (added) {
      renderPreviews();
      checkSubmitState();
    }
  }

  function renderPreviews() {
    previewItems.innerHTML = '';
    currentFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        previewItems.appendChild(img);
      } else {
        const vid = document.createElement('video');
        vid.src = URL.createObjectURL(file);
        previewItems.appendChild(vid);
      }
    });
    uploadPreview.classList.remove('hidden');
  }

  clearPreviewBtn.addEventListener('click', () => {
    currentFiles = [];
    fileInput.value = '';
    uploadPreview.classList.add('hidden');
    checkSubmitState();
  });

  chatInput.addEventListener('input', checkSubmitState);

  function checkSubmitState() {
    if (currentFiles.length > 0 || chatInput.value.trim() !== '') {
      submitBtn.disabled = false;
    } else {
      submitBtn.disabled = true;
    }
  }

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !submitBtn.disabled) {
      submitBtn.click();
    }
  });

  // Submit Action
  submitBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    const filesToUpload = [...currentFiles];
    
    // Clear Input UI
    chatInput.value = '';
    clearPreviewBtn.click();
    
    // Determine if it's a URL or File upload
    const isUrl = text.startsWith('http://') || text.startsWith('https://');
    
    // Add User Message to Chat
    appendUserMessage(text, filesToUpload);

    // Add Loading Indicator
    const typingId = appendTypingIndicator();
    scrollToBottom();

    try {
      let response;
      if (filesToUpload.length > 0) {
        // File Upload
        const formData = new FormData();
        filesToUpload.forEach(f => formData.append('designFiles', f));
        response = await fetch('/api/upload-design', { method: 'POST', body: formData });
      } else if (isUrl) {
        // URL Process
        response = await fetch('/api/process-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: text })
        });
      } else {
        // Plain text chat prompt -> RAG search for matching design
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text })
        });
      }

      const result = await response.json();
      removeTypingIndicator(typingId);

      if (result.success) {
        if (result.type === 'info') {
          appendSystemMessage(result.message);
        } else if (result.type === 'design_response') {
          const content = `> 💡 **AI Match Note:** ${result.explanation}\n\n---\n\n${result.markdown}`;
          appendAiMessage(content);
        } else {
          // File upload / URL processing fallback
          const fileId = result.new_design.id;
          const mdRes = await fetch(`/api/designs/${fileId}`);
          const mdText = await mdRes.text();
          appendAiMessage(mdText);
        }
      } else {
        appendSystemMessage(`Extraction failed: ${result.error}`);
      }

    } catch (err) {
      removeTypingIndicator(typingId);
      appendSystemMessage(`Network error: ${err.message}`);
    }
    
    scrollToBottom();
  });

  // Chat Rendering Helpers
  function appendUserMessage(text, files) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message user-message';
    
    let contentHtml = '';
    if (text) contentHtml += `<p>${text}</p>`;
    
    if (files.length > 0) {
      contentHtml += `<div class="chat-media-grid">`;
      files.forEach(f => {
        contentHtml += f.type.startsWith('image/') 
          ? `<img src="${URL.createObjectURL(f)}">`
          : `<video src="${URL.createObjectURL(f)}"></video>`;
      });
      contentHtml += `</div>`;
    }

    wrapper.innerHTML = `
      <div class="avatar user-avatar">U</div>
      <div class="message-content">${contentHtml}</div>
    `;
    chatHistory.appendChild(wrapper);
  }

  function appendAiMessage(markdownContent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message ai-message';

    const isTemplate = markdownContent.includes('# 1.') || markdownContent.length > 800;
    const templateBanner = isTemplate ? `
      <div class="copy-spec-banner">
        <span>✦ Copyable Design.Md Template</span>
        <button class="copy-btn copy-full-spec-btn">Copy Full Template</button>
      </div>` : '';

    wrapper.innerHTML = `
      <div class="avatar ai-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
      </div>
      <div class="message-content markdown-body">
        ${templateBanner}
        <div class="markdown-body-inner">${marked.parse(markdownContent)}</div>
      </div>
    `;

    chatHistory.appendChild(wrapper);

    // Copy full spec
    const fullCopyBtn = wrapper.querySelector('.copy-full-spec-btn');
    if (fullCopyBtn) {
      fullCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(markdownContent);
        fullCopyBtn.textContent = '✓ Copied!';
        showToast('Copied full design template to clipboard!', 'success');
        setTimeout(() => fullCopyBtn.textContent = 'Copy Full Template', 2500);
      });
    }

    // Inject copy buttons on each code block
    wrapper.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;
      const wrap = document.createElement('div');
      wrap.className = 'code-block-wrapper';
      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.textContent = 'Copy Code';
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(code.innerText);
        btn.textContent = '✓ Copied!';
        showToast('Code block copied!', 'success');
        setTimeout(() => btn.textContent = 'Copy Code', 2000);
      });
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(btn);
      wrap.appendChild(pre);
    });

    setTimeout(scrollToBottom, 50);
  }

  function appendSystemMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message ai-message';
    wrapper.innerHTML = `
      <div class="avatar ai-avatar" style="color: #ef4444">!</div>
      <div class="message-content" style="color: #ef4444">${text}</div>
    `;
    chatHistory.appendChild(wrapper);
  }

  function appendTypingIndicator() {
    const id = 'typing-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message ai-message';
    wrapper.id = id;
    wrapper.innerHTML = `
      <div class="avatar ai-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
      </div>
      <div class="message-content">
        <div class="typing-indicator">
          <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
        </div>
      </div>
    `;
    chatHistory.appendChild(wrapper);
    return id;
  }

  function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  // --- Library View Logic ---
  const libraryGrid = document.getElementById('library-grid');
  document.getElementById('refreshLibraryBtn').addEventListener('click', loadLibrary);

  let allLibraryItems = [];
  let activeCategory = 'All';

  async function loadLibrary() {
    libraryGrid.innerHTML = '<p style="color:var(--text-secondary)">Loading index...</p>';
    const filterBar = document.getElementById('category-filter-bar');
    if (filterBar) filterBar.innerHTML = '';

    try {
      const response = await fetch('/api/index');
      const items = await response.json();

      allLibraryItems = [...items].reverse();

      // Update count badges
      const totalBadge = document.getElementById('total-designs-badge');
      if (totalBadge) totalBadge.textContent = `${allLibraryItems.length} Designs`;

      if (allLibraryItems.length === 0) {
        libraryGrid.innerHTML = '<p style="color:var(--text-secondary)">No designs indexed yet. Start the Auto Engine or upload a design!</p>';
        return;
      }

      // Build category map from platform/device/style fields
      const categoryMap = {};
      allLibraryItems.forEach(item => {
        const cats = [];
        if (item.device) cats.push(item.device);
        if (item.platform) cats.push(item.platform);
        cats.forEach(cat => {
          const key = cat.trim();
          if (key && key !== 'N/A' && key !== 'Unknown') {
            categoryMap[key] = (categoryMap[key] || 0) + 1;
          }
        });
      });

      const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
      const totalCatBadge = document.getElementById('total-categories-badge');
      if (totalCatBadge) totalCatBadge.textContent = `${categories.length} Categories`;

      // Render filter bar
      if (filterBar) {
        const allPill = document.createElement('button');
        allPill.className = 'category-pill active';
        allPill.innerHTML = `All <span class="pill-count">${allLibraryItems.length}</span>`;
        allPill.addEventListener('click', () => {
          activeCategory = 'All';
          filterBar.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
          allPill.classList.add('active');
          renderLibraryCards(allLibraryItems);
        });
        filterBar.appendChild(allPill);

        categories.forEach(([cat, count]) => {
          const pill = document.createElement('button');
          pill.className = 'category-pill';
          pill.innerHTML = `${cat} <span class="pill-count">${count}</span>`;
          pill.addEventListener('click', () => {
            activeCategory = cat;
            filterBar.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const filtered = allLibraryItems.filter(i =>
              (i.device || '').includes(cat) || (i.platform || '').includes(cat)
            );
            renderLibraryCards(filtered);
          });
          filterBar.appendChild(pill);
        });
      }

      renderLibraryCards(allLibraryItems);
    } catch (err) {
      libraryGrid.innerHTML = `<p style="color:#ef4444">Error loading library: ${err.message}</p>`;
    }
  }

  function renderLibraryCards(items) {
    libraryGrid.innerHTML = '';
    if (items.length === 0) {
      libraryGrid.innerHTML = '<p style="color:var(--text-secondary)">No designs in this category.</p>';
      return;
    }
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'design-card';
      card.innerHTML = `
        <h3>${item.style || 'Modern UI'}</h3>
        <p>${item.device || ''} ${item.platform ? '&bull; ' + item.platform : ''}</p>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="card-btn view-spec-btn" data-id="${item.id}">View Spec</button>
          <button class="card-btn copy-spec-btn" data-id="${item.id}" style="background:rgba(138,180,248,0.12);color:#8ab4f8;border:1px solid rgba(138,180,248,0.3);">Copy Template</button>
        </div>
      `;
      libraryGrid.appendChild(card);
    });

    libraryGrid.querySelectorAll('.view-spec-btn').forEach(btn => {
      btn.addEventListener('click', () => loadSpec(btn.getAttribute('data-id')));
    });

    libraryGrid.querySelectorAll('.copy-spec-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        btn.textContent = 'Copying...';
        try {
          const res = await fetch(`/api/designs/${id}`);
          if (!res.ok) throw new Error('Not found');
          const text = await res.text();
          await navigator.clipboard.writeText(text);
          btn.textContent = '✓ Copied!';
          showToast('Design template copied to clipboard!', 'success');
          setTimeout(() => btn.textContent = 'Copy Template', 2500);
        } catch (err) {
          btn.textContent = 'Copy Template';
          showToast('Copy failed: ' + err.message, 'error');
        }
      });
    });
  }

  // Modal Logic
  const modal = document.getElementById('spec-modal');
  const closeModal = document.getElementById('close-modal');
  const markdownContainer = document.getElementById('markdown-container');

  closeModal.addEventListener('click', () => modal.classList.add('hidden'));
  window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  async function loadSpec(id) {
    markdownContainer.innerHTML = 'Loading...';
    modal.classList.remove('hidden');
    try {
      const res = await fetch(`/api/designs/${id}`);
      if (!res.ok) throw new Error('Spec not found');
      const text = await res.text();

      // Modal header copy button
      const modalHeader = document.querySelector('.modal-header');
      const existingCopyBtn = modalHeader ? modalHeader.querySelector('.modal-copy-btn') : null;
      if (existingCopyBtn) existingCopyBtn.remove();

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn modal-copy-btn';
      copyBtn.style.marginRight = 'auto';
      copyBtn.textContent = 'Copy Full Template';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text);
        copyBtn.textContent = '✓ Copied!';
        showToast('Design template copied to clipboard!', 'success');
        setTimeout(() => copyBtn.textContent = 'Copy Full Template', 2500);
      });
      if (modalHeader) modalHeader.insertBefore(copyBtn, modalHeader.querySelector('#close-modal'));

      markdownContainer.innerHTML = marked.parse(text);

      // Code block copy buttons in modal
      markdownContainer.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;
        const wrap = document.createElement('div');
        wrap.className = 'code-block-wrapper';
        const btn = document.createElement('button');
        btn.className = 'copy-code-btn';
        btn.textContent = 'Copy Code';
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText(code.innerText);
          btn.textContent = '✓ Copied!';
          showToast('Code block copied!', 'success');
          setTimeout(() => btn.textContent = 'Copy Code', 2000);
        });
        pre.parentNode.insertBefore(wrap, pre);
        wrap.appendChild(btn);
        wrap.appendChild(pre);
      });
    } catch (err) {
      markdownContainer.innerHTML = `<p style="color:#ef4444">${err.message}</p>`;
    }
  }

  // --- Auto Crawler Logic ---
  const startCrawlerBtn = document.getElementById('start-crawler-btn');
  const stopCrawlerBtn = document.getElementById('stop-crawler-btn');
  const statusLabel = document.getElementById('crawler-status-label');
  const statsLabel = document.getElementById('crawler-stats-label');
  let pollInterval = null;

  startCrawlerBtn.addEventListener('click', async () => {
    startCrawlerBtn.disabled = true;
    try {
      await fetch('/api/crawler/start', { method: 'POST' });
      startPolling();
    } catch (err) { showToast(err.message, 'error'); startCrawlerBtn.disabled = false; }
  });

  stopCrawlerBtn.addEventListener('click', async () => {
    stopCrawlerBtn.disabled = true;
    try { await fetch('/api/crawler/stop', { method: 'POST' }); } catch (err) {}
  });

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(fetchCrawlerStatus, 2000);
    fetchCrawlerStatus();
  }

  async function fetchCrawlerStatus() {
    try {
      const res = await fetch('/api/crawler/status');
      const stats = await res.json();
      
      statusLabel.textContent = `Status: ${stats.status.toUpperCase()}`;
      statusLabel.style.color = stats.status === 'running' ? '#8ab4f8' : 'white';
      
      const currentLabel = stats.currentUrl || 'N/A';
      statsLabel.textContent = `Indexed: ${stats.indexedCount} | Current: ${currentLabel.substring(0, 40)}`;
      
      if (stats.status === 'running' || stats.status === 'stopping...') {
        startCrawlerBtn.disabled = true;
        stopCrawlerBtn.disabled = stats.status === 'stopping...';
      } else {
        startCrawlerBtn.disabled = false;
        stopCrawlerBtn.disabled = true;
        clearInterval(pollInterval);
        pollInterval = null;
      }
    } catch (err) {}
  }
  fetchCrawlerStatus();

  // --- Media Extractor & Stager View Logic ---
  const extractorUrlInput = document.getElementById('extractor-url-input');
  const startScrapeBtn = document.getElementById('start-scrape-btn');
  const extractorLoading = document.getElementById('extractor-loading');
  const stagerContainer = document.getElementById('stager-container');
  const stagerGrid = document.getElementById('stager-grid');
  const selectionCounter = document.getElementById('selection-counter');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const proceedBatchBtn = document.getElementById('proceed-batch-btn');
  const btnCount = document.getElementById('btn-count');
  const batchProgress = document.getElementById('batch-progress');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const batchProgressText = document.getElementById('batch-progress-text');

  let extractedMedia = [];

  startScrapeBtn.addEventListener('click', async () => {
    const url = extractorUrlInput.value.trim();
    if (!url) return showToast('Please enter a URL to scrape media from.', 'warning');

    extractorLoading.classList.remove('hidden');
    stagerContainer.classList.add('hidden');
    startScrapeBtn.disabled = true;
    extractedMedia = [];

    try {
      const res = await fetch('/api/scrape-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      extractorLoading.classList.add('hidden');
      startScrapeBtn.disabled = false;

      if (!data.success) {
        return showToast(`Extraction Error: ${data.error}`, 'error');
      }

      if (!data.mediaItems || data.mediaItems.length === 0) {
        return showToast('No downloadable image or video assets found at this URL.', 'warning');
      }

      extractedMedia = data.mediaItems.map(item => ({ ...item, selected: true }));
      renderStagerGrid();
      stagerContainer.classList.remove('hidden');

    } catch (err) {
      extractorLoading.classList.add('hidden');
      startScrapeBtn.disabled = false;
      showToast(`Scrape error: ${err.message}`, 'error');
    }
  });

  function renderStagerGrid() {
    stagerGrid.innerHTML = '';
    extractedMedia.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = `media-card ${item.selected ? 'selected' : ''}`;
      
      const proxyUrl = `/api/proxy-media?url=${encodeURIComponent(item.url)}`;
      const mediaHtml = item.type === 'video'
        ? `<video src="${proxyUrl}" controls muted loop preload="metadata" referrerpolicy="no-referrer"></video>`
        : `<img src="${proxyUrl}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://via.placeholder.com/300x200?text=Preview+Unavailable'">`;

      const statusBadge = item.done
        ? `<span class="media-badge done" style="background:#34a853;color:white;left:auto;right:50px;">✓ Processed</span>`
        : '';

      card.innerHTML = `
        <div class="card-media-wrapper">
          <span class="media-badge ${item.type}">${item.type}</span>
          ${statusBadge}
          <button class="remove-card-btn" data-index="${index}" title="Remove Item">✕</button>
          ${mediaHtml}
        </div>
        <div class="card-footer">
          <input type="checkbox" class="card-checkbox" data-index="${index}" ${item.selected ? 'checked' : ''} ${item.done ? 'disabled' : ''}>
          <span class="card-url-text">${item.url}</span>
        </div>
      `;

      stagerGrid.appendChild(card);
    });

    document.querySelectorAll('.remove-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'));
        extractedMedia.splice(idx, 1);
        renderStagerGrid();
      });
    });

    document.querySelectorAll('.card-media-wrapper').forEach((wrapper, idx) => {
      wrapper.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-card-btn')) return;
        const item = extractedMedia[idx];
        if (item) showMediaModal(item.url, item.type);
      });
    });

    document.querySelectorAll('.card-checkbox').forEach(chk => {
      chk.addEventListener('change', () => {
        const idx = parseInt(chk.getAttribute('data-index'));
        extractedMedia[idx].selected = chk.checked;
        const card = chk.closest('.media-card');
        if (chk.checked) card.classList.add('selected');
        else card.classList.remove('selected');
        updateToolbarState();
      });
    });

    updateToolbarState();
  }

  function showMediaModal(url, type) {
    modal.classList.remove('hidden');
    const proxyUrl = `/api/proxy-media?url=${encodeURIComponent(url)}`;
    if (type === 'video') {
      markdownContainer.innerHTML = `
        <div style="text-align:center;">
          <h3 style="color:white;margin-bottom:12px;">Full Video Preview</h3>
          <video src="${proxyUrl}" controls autoplay loop referrerpolicy="no-referrer" style="width:100%;max-height:70vh;border-radius:12px;background:#000;"></video>
          <p style="color:var(--text-secondary);font-size:0.8rem;margin-top:12px;word-break:break-all;">${url}</p>
        </div>
      `;
    } else {
      markdownContainer.innerHTML = `
        <div style="text-align:center;">
          <h3 style="color:white;margin-bottom:12px;">Full Image Preview</h3>
          <img src="${proxyUrl}" style="max-width:100%;max-height:70vh;object-fit:contain;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
          <p style="color:var(--text-secondary);font-size:0.8rem;margin-top:12px;word-break:break-all;">${url}</p>
        </div>
      `;
    }
  }

  function updateToolbarState() {
    const selectedCount = extractedMedia.filter(m => m.selected && !m.done).length;
    selectionCounter.textContent = `${selectedCount} of ${extractedMedia.length} selected`;
    btnCount.textContent = selectedCount;
    proceedBatchBtn.disabled = selectedCount === 0;
  }

  selectAllBtn.addEventListener('click', () => {
    extractedMedia.forEach(m => { if (!m.done) m.selected = true; });
    renderStagerGrid();
  });

  deselectAllBtn.addEventListener('click', () => {
    extractedMedia.forEach(m => m.selected = false);
    renderStagerGrid();
  });

  proceedBatchBtn.addEventListener('click', async () => {
    const selectedItems = extractedMedia.filter(m => m.selected && !m.done);
    if (selectedItems.length === 0) return showToast('No un-processed items selected.', 'warning');

    proceedBatchBtn.disabled = true;
    batchProgress.classList.remove('hidden');
    
    let processedCount = 0;
    const total = selectedItems.length;

    for (let i = 0; i < total; i++) {
      const item = selectedItems[i];
      const pct = Math.round((i / total) * 100);
      progressBarFill.style.width = `${pct}%`;
      batchProgressText.textContent = `Processing asset ${i + 1} of ${total} (${pct}% complete)...`;

      try {
        const res = await fetch('/api/process-selected-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [item] })
        });
        const data = await res.json();
        if (data.success && data.count > 0) {
          processedCount++;
          item.done = true;
          item.selected = false;
          renderStagerGrid();
        }
      } catch (err) {
        console.warn(`Error processing item ${i + 1}:`, err.message);
      }
    }

    progressBarFill.style.width = '100%';
    batchProgressText.textContent = `Completed! Processed ${processedCount} of ${total} assets.`;
    
    setTimeout(() => {
      batchProgress.classList.add('hidden');
      proceedBatchBtn.disabled = false;
      showToast(`Finished! Successfully generated design specs for ${processedCount} item(s). Check the Library or Chat!`, 'success');
    }, 1500);
  });
});
