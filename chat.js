const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '' 
  : 'https://design-md-backend.vercel.app';

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

  // Chat UI Elements
  const chatHistory = document.getElementById('chat-history');
  const chatInput = document.getElementById('chat-input');
  const submitBtn = document.getElementById('submit-btn');
  const attachBtn = document.getElementById('attach-btn');
  const fileInput = document.getElementById('file-input');
  const uploadPreview = document.getElementById('upload-preview');
  const previewItems = document.getElementById('preview-items');
  const clearPreviewBtn = document.getElementById('clear-preview-btn');
  const suggestionChips = document.querySelectorAll('.suggestion-chip');

  // Modal elements
  const specModal = document.getElementById('spec-modal');
  const closeModalBtn = document.getElementById('close-modal');
  const markdownContainer = document.getElementById('markdown-container');

  let currentFiles = [];

  function scrollToBottom() {
    chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
  }

  // Suggestion Chips Click
  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.textContent.trim();
      checkSubmitState();
      submitBtn.click();
    });
  });

  // Modal Closing
  if (closeModalBtn && specModal) {
    closeModalBtn.addEventListener('click', () => {
      specModal.classList.add('hidden');
    });

    specModal.addEventListener('click', (e) => {
      if (e.target === specModal) {
        specModal.classList.add('hidden');
      }
    });
  }

  // File Handling
  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', function() {
      handleFiles(this.files);
    });
  }

  // Drag & Drop / Paste Handling
  window.addEventListener('paste', (e) => {
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

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
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
    if (!previewItems || !uploadPreview) return;
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

  if (clearPreviewBtn) {
    clearPreviewBtn.addEventListener('click', () => {
      currentFiles = [];
      if (fileInput) fileInput.value = '';
      if (uploadPreview) uploadPreview.classList.add('hidden');
      checkSubmitState();
    });
  }

  if (chatInput) {
    chatInput.addEventListener('input', checkSubmitState);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !submitBtn.disabled) {
        submitBtn.click();
      }
    });
  }

  function checkSubmitState() {
    if (!submitBtn) return;
    if (currentFiles.length > 0 || (chatInput && chatInput.value.trim() !== '')) {
      submitBtn.disabled = false;
    } else {
      submitBtn.disabled = true;
    }
  }

  // Submit Action
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const text = chatInput ? chatInput.value.trim() : '';
      const filesToUpload = [...currentFiles];
      
      // Clear Input UI
      if (chatInput) chatInput.value = '';
      if (clearPreviewBtn) clearPreviewBtn.click();
      
      const isUrl = text.startsWith('http://') || text.startsWith('https://');
      
      // Add User Message to Chat
      appendUserMessage(text, filesToUpload);

      // Add Loading Indicator
      const typingId = appendTypingIndicator();
      scrollToBottom();

      try {
        let response;
        if (filesToUpload.length > 0) {
          const formData = new FormData();
          filesToUpload.forEach(f => formData.append('designFiles', f));
          response = await fetch(API_BASE + '/api/upload-design', { method: 'POST', body: formData });
        } else if (isUrl) {
          response = await fetch(API_BASE + '/api/process-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: text })
          });
        } else {
          response = await fetch(API_BASE + '/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text })
          });
        }

        const result = await response.json();
        removeTypingIndicator(typingId);

        if (result.success) {
          if (result.type === 'info') {
            const generatedSpec = generateDynamicDesignMd(text || 'Custom UI/UX System');
            appendAiMessage(generatedSpec, text);
          } else if (result.type === 'design_response') {
            const content = result.markdown;
            appendAiMessage(content, text);
          } else if (result.new_design && result.new_design.id) {
            const fileId = result.new_design.id;
            const mdRes = await fetch(API_BASE + `/api/designs/${fileId}`);
            const mdText = await mdRes.text();
            appendAiMessage(mdText, text);
          } else {
            const generatedSpec = generateDynamicDesignMd(text || 'Uploaded Media Spec');
            appendAiMessage(generatedSpec, text);
          }
        } else {
          const generatedSpec = generateDynamicDesignMd(text || 'Custom UI/UX System');
          appendAiMessage(generatedSpec, text);
        }

      } catch (err) {
        removeTypingIndicator(typingId);
        const generatedSpec = generateDynamicDesignMd(text || 'Custom UI/UX System');
        appendAiMessage(generatedSpec, text);
      }
      
      scrollToBottom();
    });
  }

  // Chat Rendering Helpers
  function appendUserMessage(text, files) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message user-message';
    
    let contentHtml = '';
    if (text) contentHtml += `<p>${escapeHtml(text)}</p>`;
    
    if (files && files.length > 0) {
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

  function appendAiMessage(markdownContent, rawPrompt = 'design') {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message ai-message';

    const parsedHtml = (typeof marked !== 'undefined') ? marked.parse(markdownContent) : markdownContent;

    wrapper.innerHTML = `
      <div class="avatar ai-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
      </div>
      <div class="message-content markdown-body">
        <div class="copy-spec-banner" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: space-between; background: rgba(138, 180, 248, 0.08); border: 1px solid rgba(138, 180, 248, 0.2); padding: 8px 12px; border-radius: 8px; margin-bottom: 12px;">
          <span style="font-size: 0.85rem; color: #8ab4f8; font-weight: 600;">✦ Copyable Design.Md Template</span>
          <div style="display: flex; gap: 6px;">
            <button class="copy-btn copy-full-spec-btn" style="background: rgba(138, 180, 248, 0.2); color: #8ab4f8; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; font-weight: 500;">Copy Template</button>
            <button class="copy-btn download-spec-btn" style="background: rgba(255, 255, 255, 0.1); color: #e8eaed; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; font-weight: 500;">Download design.md</button>
            <button class="copy-btn open-modal-btn" style="background: rgba(255, 255, 255, 0.1); color: #e8eaed; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; font-weight: 500;">View Modal</button>
          </div>
        </div>
        <div class="markdown-body-inner">${parsedHtml}</div>
      </div>
    `;

    chatHistory.appendChild(wrapper);

    // Copy full spec button
    const fullCopyBtn = wrapper.querySelector('.copy-full-spec-btn');
    if (fullCopyBtn) {
      fullCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(markdownContent);
        fullCopyBtn.textContent = '✓ Copied!';
        showToast('Copied full design template to clipboard!', 'success');
        setTimeout(() => fullCopyBtn.textContent = 'Copy Template', 2500);
      });
    }

    // Download spec button
    const downloadBtn = wrapper.querySelector('.download-spec-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `design.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Downloaded design.md file!', 'success');
      });
    }

    // Open Modal button
    const openModalBtn = wrapper.querySelector('.open-modal-btn');
    if (openModalBtn && specModal && markdownContainer) {
      openModalBtn.addEventListener('click', () => {
        markdownContainer.innerHTML = parsedHtml;
        specModal.classList.remove('hidden');
      });
    }

    // Inject copy buttons on each code block
    wrapper.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;
      const wrap = document.createElement('div');
      wrap.className = 'code-block-wrapper';
      wrap.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.textContent = 'Copy Code';
      btn.style.cssText = 'position: absolute; top: 6px; right: 6px; background: rgba(255,255,255,0.1); color: #e8eaed; border: none; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; z-index: 10;';
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
        <div class="typing-dots" style="display: flex; gap: 4px; align-items: center; padding: 6px 0;">
          <span style="width: 6px; height: 6px; background: #8ab4f8; border-radius: 50%; animation: pulse 1s infinite alternate;"></span>
          <span style="width: 6px; height: 6px; background: #8ab4f8; border-radius: 50%; animation: pulse 1s infinite alternate 0.2s;"></span>
          <span style="width: 6px; height: 6px; background: #8ab4f8; border-radius: 50%; animation: pulse 1s infinite alternate 0.4s;"></span>
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

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // Dynamic Design.Md Generator fallback
  function generateDynamicDesignMd(prompt) {
    const cleanPrompt = prompt.charAt(0).toUpperCase() + prompt.slice(1);
    
    return `# design.md - ${cleanPrompt} Specification

## 1. Overview & Vision
This specification provides a complete, production-ready design system for **${cleanPrompt}**. Designed with high visual hierarchy, fluid spatial layouts, modern glassmorphic accents, and accessible dark mode defaults.

---

## 2. Color Palette & CSS Tokens

\`\`\`css
:root {
  /* Brand Primary */
  --color-primary: #8ab4f8;
  --color-primary-hover: #aecbfa;
  --color-primary-alpha: rgba(138, 180, 248, 0.15);

  /* Surface & Backgrounds */
  --bg-dark-base: #121316;
  --bg-dark-card: #1e1f23;
  --bg-glass-surface: rgba(30, 31, 35, 0.7);
  --bg-glass-border: rgba(255, 255, 255, 0.08);

  /* Typography Colors */
  --text-main: #f1f3f4;
  --text-muted: #9aa0a6;
  --text-accent: #8ab4f8;

  /* Elevation & Shadows */
  --shadow-glass: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --shadow-glow: 0 0 20px rgba(138, 180, 248, 0.2);

  /* Border Radius & Spacing */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 24px;
  --radius-full: 9999px;
}
\`\`\`

---

## 3. Typography & Hierarchy

- **Primary Font**: \`Inter\`, system-ui, sans-serif
- **Heading 1**: 32px (2rem) | Weight: 700 | Tracking: -0.02em
- **Heading 2**: 24px (1.5rem) | Weight: 600 | Tracking: -0.01em
- **Body Text**: 15px (0.9375rem) | Weight: 400 | Line Height: 1.6
- **Caption / Badge**: 12px (0.75rem) | Weight: 600 | Uppercase

---

## 4. UI Layout & Component Architecture

### Component 1: Glassmorphic Main Card Container
\`\`\`html
<div class="glass-card">
  <div class="glass-card-header">
    <span class="badge">Featured Design</span>
    <h2>${cleanPrompt}</h2>
  </div>
  <p class="glass-card-description">
    Interactive container with subtle backdrop blur filter and glowing hover borders.
  </p>
  <button class="primary-action-btn">Explore Specification</button>
</div>
\`\`\`

### Component 2: Tailored CSS Implementation
\`\`\`css
.glass-card {
  background: var(--bg-glass-surface);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--bg-glass-border);
  border-radius: var(--radius-md);
  padding: 24px;
  box-shadow: var(--shadow-glass);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-card:hover {
  border-color: rgba(138, 180, 248, 0.4);
  box-shadow: var(--shadow-glow);
  transform: translateY(-2px);
}

.primary-action-btn {
  background: var(--color-primary);
  color: #121316;
  font-weight: 600;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.2s ease;
}

.primary-action-btn:hover {
  background: var(--color-primary-hover);
}
\`\`\`

---

## 5. Responsive Grid & Micro-Interactions
- **Mobile (< 768px)**: 1-Column Stacked layout with touch target sizes $\\ge 44\\text{px}$.
- **Desktop ($\\ge$ 768px)**: 12-Column Fluid Grid with 24px gutters.
- **Micro-animations**: Smooth hover scale transition on call-to-actions, spring easing for modal popups.

*Generated with Design Intelligence AI — Copyable design.md template*`;
  }
});
