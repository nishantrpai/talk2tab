// Sidebar JavaScript for Snip Chrome Extension
// Handles UI interactions, context management, and LLM communication

console.log('Snip: Sidebar loaded');

// State management
let contexts = []; // Legacy - will be phased out
let currentTabContext = null; // Context for currently active tab
let pinnedContexts = []; // User-pinned contexts that persist
let chatHistory = [];
let currentFormat = 'text';
let isLoading = false;
let notes = [];
let currentTab = 'chat';

// Settings with defaults
let settings = {
  responseStyle: 'Be concise and direct. Avoid unnecessary elaboration.',
  apiEndpoint: 'http://localhost:1234/v1/chat/completions',
  maxTokens: 1000,
  renderMarkdown: false // Changed default to false to prevent markdown rendering issues
};

// DOM elements
const contextWindow = document.getElementById('contextWindow');
const contextTabs = document.getElementById('contextTabs');
const contextCount = document.getElementById('contextCount');
const contextCollapseBtn = document.getElementById('contextCollapseBtn');
const addContextBtn = document.getElementById('addContextBtn');
const addJournalContextBtn = document.getElementById('addJournalContextBtn');
const clearContextBtn = document.getElementById('clearContextBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const formatButtons = document.querySelectorAll('.format-btn');
const formatSelect = document.getElementById('formatSelect');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const saveSettingsBtn = document.getElementById('saveSettings');
const resetSettingsBtn = document.getElementById('resetSettings');

// Tab and journal elements
const tabButtons = document.querySelectorAll('.tab-btn');
const chatTab = document.getElementById('chatTab');
const journalTab = document.getElementById('journalTab');
const journalContainer = document.getElementById('journalMessages');
const journalInput = document.getElementById('journalInput');
const journalSendBtn = document.getElementById('journalSendBtn');
const journalMenuBtn = document.getElementById('journalMenuBtn');

// Journal messages array
let journalMessages = [];

// Save chat message to journal - used by event listeners for Add to journal buttons
function addMessageToJournal(messageIndex, buttonElement) {
  const message = chatHistory[messageIndex];
  console.log('Adding message to journal. Index:', messageIndex, 'Message:', message, 'Total history:', chatHistory.length);
  if (!message) return;
  
  // Allow both user questions and assistant responses to be saved
  const messageType = message.role === 'user' ? 'question' : 'quote';
  const sourceTitle = message.role === 'user' ? currentTabContext.title :
                     (currentTabContext ? currentTabContext.title : 'AI Response');
  
  // Add message to journal
  const journalEntry = {
    id: Date.now(),
    type: messageType,
    content: message.content,
    sourceUrl: currentTabContext ? currentTabContext.url : window.location.href,
    sourceTitle: sourceTitle,
    timestamp: new Date().toISOString()
  };
  
  journalMessages.push(journalEntry);
  renderJournalMessages();
  saveJournal();
  
  // Show brief feedback on the button that was clicked
  if (buttonElement) {
    const icon = buttonElement.querySelector('[data-feather]');
    if (icon) {
      icon.setAttribute('data-feather', 'check');
      buttonElement.style.color = '#22c55e';
      if (window.feather) {
        window.feather.replace(); // Re-render icons
      }
      setTimeout(() => {
        icon.setAttribute('data-feather', 'book-open');
        buttonElement.style.color = '#737373';
        if (window.feather) {
          window.feather.replace(); // Re-render icons
        }
      }, 1500);
    }
  }
}


// Initialize sidebar
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  loadSettings();
  setupEventListeners();
  setupContextMenu();
  updateUI();
  
  // Initialize feather icons
  if (window.feather) {
    window.feather.replace();
  }
});

// Listen for context updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Sidebar received message:', message.type, message);
  
  if (message.type === 'CONTEXT_UPDATED') {
    console.log('Received context update from background:', message.context);
    console.log('Current currentTabContext before update:', currentTabContext);
    console.log('Current pinnedContexts before update:', pinnedContexts);
    
    // DETAILED CONTENT DEBUGGING
    if (message.context) {
      console.log('New context content details:', {
        url: message.context.url,
        title: message.context.title,
        hasContent: !!message.context.content,
        contentLength: message.context.content ? message.context.content.length : 0,
        contentPreview: message.context.content ? message.context.content.substring(0, 200) + '...' : 'NO CONTENT'
      });
    }
    
    // Update current tab context (replaces previous current tab context)
    currentTabContext = message.context;
    
    if (message.context) {
      console.log('Updated current tab context to:', message.context.url);
    } else {
      console.log('No context available (probably on non-web page)');
    }
    
    console.log('currentTabContext after update:', currentTabContext);
    console.log('pinnedContexts after update:', pinnedContexts);
    
    // Update UI
    updateContextList();
    console.log('UI updated after context change');
    
    // Send response
    sendResponse({ received: true });
  }
});

// Check for pending journal entries when window becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    checkPendingJournalEntries();
  }
});

// Also check when window gets focus
window.addEventListener('focus', () => {
  checkPendingJournalEntries();
});

// Periodic check for pending journal entries (every 2 seconds)
setInterval(() => {
  checkPendingJournalEntries();
}, 2000);

// Load stored contexts and chat history
function loadStoredData() {
  // Load pinned contexts from storage first
  chrome.storage.local.get(['pinnedContexts'], (result) => {
    if (result.pinnedContexts) {
      pinnedContexts = result.pinnedContexts;
      console.log('Loaded pinned contexts from storage:', pinnedContexts.map(ctx => ({
        url: ctx.url,
        title: ctx.title,
        contentLength: ctx.content ? ctx.content.length : 0,
        hasContent: !!ctx.content,
        contentPreview: ctx.content ? ctx.content.substring(0, 200) + '...' : 'NO CONTENT FOUND'
      })));
      
      // Check if any pinned context is missing content
      const missingContent = pinnedContexts.filter(ctx => !ctx.content || ctx.content.length === 0);
      if (missingContent.length > 0) {
        console.warn('WARNING: Found pinned contexts without content:', missingContent.map(ctx => ({
          url: ctx.url,
          title: ctx.title
        })));
      }
    } else {
      console.log('No pinned contexts found in storage');
    }
    
    // Then get the current tab context
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_CONTENT' }, (response) => {
      console.log('Got current tab content on load:', response ? {
        url: response.url,
        title: response.title,
        contentLength: response.content ? response.content.length : 0,
        hasContent: !!response.content
      } : 'No response');
      
      if (response) {
        currentTabContext = response; // Set as current tab context
        updateContextList();
      } else {
        // No current tab context available
        currentTabContext = null;
        updateContextList();
      }
    });
  });

  chrome.runtime.sendMessage({ type: 'GET_CHAT_HISTORY' }, (response) => {
    if (response && response.history) {
      chatHistory = response.history;
      updateChatMessages();
    }
  });
  
  loadStoredNotes();
  loadJournal();
  checkPendingJournalEntries();
}

// Load stored notes
function loadStoredNotes() {
  chrome.storage.local.get(['notes'], (result) => {
    if (result.notes) {
      notes = result.notes;
      updateNotesList();
    }
  });
}

// Check for pending journal entries from context menu
function checkPendingJournalEntries() {
  console.log('Checking for pending journal entries...');
  chrome.storage.local.get(['pendingJournalEntry'], (result) => {
    console.log('Pending journal entry result:', result);
    if (result.pendingJournalEntry) {
      console.log('Found pending journal entry, adding to journal');
      const entry = result.pendingJournalEntry;
      
      // Add to journal messages
      const message = {
        id: Date.now(),
        type: entry.type,
        content: entry.content,
        sourceUrl: entry.sourceUrl,
        sourceTitle: entry.sourceTitle,
        timestamp: entry.timestamp
      };
      
      journalMessages.push(message);
      renderJournalMessages();
      saveJournal();
      
      // Switch to journal tab
      switchTab('journal');
      
      // Clear the pending entry
      chrome.storage.local.remove(['pendingJournalEntry'], () => {
        console.log('Cleared pending journal entry');
      });
    } else {
      console.log('No pending journal entries found');
    }
  });
}

// Save notes to storage
function saveNotes() {
  chrome.storage.local.set({ notes: notes });
}

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get(['llmSettings'], (result) => {
    if (result.llmSettings) {
      settings = { ...settings, ...result.llmSettings };
    }
    updateSettingsUI();
  });
}

// Save settings to storage
function saveSettings() {
  chrome.storage.local.set({ llmSettings: settings });
}

// Setup event listeners
function setupEventListeners() {
  // Format selector dropdown
  if (formatSelect) {
    formatSelect.addEventListener('change', (e) => {
      currentFormat = e.target.value;
      console.log('Format changed to:', currentFormat);
    });
  }

  // Tab navigation
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });

  // Context buttons
  addContextBtn.addEventListener('click', showContextMenu);
  addJournalContextBtn.addEventListener('click', addJournalToContext);
  clearContextBtn.addEventListener('click', clearContext);
  
  // Context collapse toggle
  contextCollapseBtn.addEventListener('click', toggleContextCollapse);

  // Chat input
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  // Settings
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  saveSettingsBtn.addEventListener('click', handleSaveSettings);
  resetSettingsBtn.addEventListener('click', resetSettings);
  
  // Journal event listeners
  journalSendBtn.addEventListener('click', sendJournalMessage);
  journalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendJournalMessage();
    }
  });
  journalMenuBtn.addEventListener('click', showJournalHeaderMenu);
  
  // Journal message menu event delegation
  document.addEventListener('click', (e) => {
    if (e.target.closest('.journal-message-menu')) {
      const menu = e.target.closest('.journal-message-menu');
      const messageId = parseInt(menu.getAttribute('data-message-id'));
      showJournalMessageMenu(e, messageId);
    }
  });
  
  // Close modal when clicking overlay
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettings();
    }
  });
  
  // Journal context menu
  setupContextMenu();
}

// Add current tab to context
function addCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTENT' }, (response) => {
        if (response) {
          addContext(response);
        }
      });
    }
  });
}

// Add all tabs to context
function addAllTabs() {
  chrome.runtime.sendMessage({ type: 'GET_ALL_TABS' }, (response) => {
    if (response && response.tabs) {
      response.tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://')) {
          chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, (response) => {
            if (response) {
              addContext(response);
            }
          });
        }
      });
    }
  });
}

// Add context item
function addContext(contextData) {
  // Check if context already exists
  const existingIndex = contexts.findIndex(ctx => ctx.url === contextData.url);
  
  if (existingIndex >= 0) {
    // Update existing context
    contexts[existingIndex] = contextData;
  } else {
    // Add new context
    contexts.push(contextData);
  }

  updateContextList();
  
  // Save to background script
  chrome.runtime.sendMessage({
    type: 'PAGE_DATA',
    data: contextData
  });
}

// Clear all context
function clearContext() {
  pinnedContexts = []; // Only clear pinned contexts, keep current tab context
  chatHistory = []; // Also clear chat history since context has changed
  
  // Save cleared pinned contexts to storage
  chrome.storage.local.set({ pinnedContexts: [] }, () => {
    console.log('Cleared pinned contexts from storage');
  });
  
  updateContextList();
  updateChatMessages();
  chrome.runtime.sendMessage({ type: 'CLEAR_CONTEXTS' });
  chrome.runtime.sendMessage({ type: 'CLEAR_CHAT_HISTORY' });
}

// Toggle context section collapse
function toggleContextCollapse() {
  contextWindow.classList.toggle('collapsed');
}

// Show context menu
function showContextMenu() {
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed;
    background: #171717;
    border: 1px solid #262626;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    min-width: 120px;
  `;
  
  menu.innerHTML = `
    <div style="padding: 4px;">
      <button onclick="addCurrentTab(); this.parentElement.parentElement.remove()" style="width: 100%; padding: 8px 12px; background: none; border: none; color: #e5e5e5; text-align: left; cursor: pointer; border-radius: 4px; font-size: 12px;" onmouseover="this.style.background='#262626'" onmouseout="this.style.background='none'">Add Current Tab</button>
      <button onclick="addAllTabs(); this.parentElement.parentElement.remove()" style="width: 100%; padding: 8px 12px; background: none; border: none; color: #e5e5e5; text-align: left; cursor: pointer; border-radius: 4px; font-size: 12px;" onmouseover="this.style.background='#262626'" onmouseout="this.style.background='none'">Add All Tabs</button>
    </div>
  `;
  
  // Position near the button
  const rect = addContextBtn.getBoundingClientRect();
  menu.style.left = rect.left + 'px';
  menu.style.top = (rect.bottom + 4) + 'px';
  
  document.body.appendChild(menu);
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

// Open tab in browser
function openTab(url) {
  chrome.tabs.create({ url: url });
}

// Journal functionality
function loadJournal() {
  chrome.storage.local.get(['journalMessages'], (result) => {
    if (result.journalMessages) {
      journalMessages = result.journalMessages;
      renderJournalMessages();
    }
  });
}

function saveJournal() {
  chrome.storage.local.set({ journalMessages: journalMessages });
}

function sendJournalMessage() {
  const input = journalInput;
  if (!input || !input.value.trim()) return;
  
  const message = {
    id: Date.now(),
    type: 'user',
    content: input.value.trim(),
    timestamp: new Date().toISOString()
  };
  
  journalMessages.push(message);
  input.value = '';
  
  renderJournalMessages();
  saveJournal();
}

function clearJournal() {
  if (confirm('Are you sure you want to clear your journal? This cannot be undone.')) {
    journalMessages = [];
    renderJournalMessages();
    chrome.storage.local.remove('journalMessages');
  }
}

function renderJournalMessages() {
  const container = journalContainer;
  if (!container) return;
  
  container.innerHTML = '';
  
  if (journalMessages.length === 0) {
    container.innerHTML = '<div class="journal-empty">No messages yet. Start writing your thoughts!</div>';
    return;
  }
  
  // Group messages by date
  const messagesByDate = {};
  journalMessages.forEach(message => {
    const date = new Date(message.timestamp).toDateString();
    if (!messagesByDate[date]) {
      messagesByDate[date] = [];
    }
    messagesByDate[date].push(message);
  });

  // Sort dates in ascending order (oldest first)
  const sortedDates = Object.keys(messagesByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  sortedDates.forEach(dateStr => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Create date header
    const dateHeader = document.createElement('div');
    dateHeader.className = 'journal-date-header';
    
    let dateLabel;
    if (date.toDateString() === today.toDateString()) {
      dateLabel = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    
    dateHeader.textContent = dateLabel;
    container.appendChild(dateHeader);
    
    // Add messages for this date
    messagesByDate[dateStr].forEach(message => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `journal-message ${message.type}`;
      
      const timestamp = new Date(message.timestamp).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      if (message.type === 'quote') {
        messageDiv.innerHTML = `
          <div class="journal-message-content">${message.content}</div>
          <div class="journal-quote-source">
            <a href="${message.sourceUrl}" target="_blank">${message.sourceTitle || 'Source'}</a>
          </div>
          <div class="journal-message-time">${timestamp}</div>
          <div class="journal-message-menu" data-message-id="${message.id}">
            <i data-feather="more-horizontal"></i>
          </div>
        `;
      } else if (message.type === 'question') {
        messageDiv.innerHTML = `
          <div class="journal-message-content">${message.content}</div>
          <div class="journal-quote-source">
            <a href="${message.sourceUrl}" target="_blank">${message.sourceTitle}</a>
          </div>
          <div class="journal-message-time">${timestamp}</div>
          <div class="journal-message-menu" data-message-id="${message.id}">
            <i data-feather="more-horizontal"></i>
          </div>
        `;
      } else {
        messageDiv.innerHTML = `
          <div class="journal-message-content">${message.content}</div>
          <div class="journal-message-time">${timestamp}</div>
          <div class="journal-message-menu" data-message-id="${message.id}">
            <i data-feather="more-horizontal"></i>
          </div>
        `;
      }
      
      container.appendChild(messageDiv);
    });
  });
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
  
  // Re-render Feather icons
  if (window.feather) {
    window.feather.replace();
  }
}

// Add text to journal as quote
function addToJournal(text, sourceUrl, sourceTitle) {
  const message = {
    id: Date.now(),
    type: 'quote',
    content: text,
    sourceUrl: sourceUrl,
    sourceTitle: sourceTitle,
    timestamp: new Date().toISOString()
  };
  
  journalMessages.push(message);
  renderJournalMessages();
  saveJournal();
  
  // Switch to journal tab if not already there
  if (currentTab !== 'journal') {
    switchTab('journal');
  }
}

// Right-click context menu handler (disabled - now handled by background script)
function setupContextMenu() {
  // Context menu is now handled by background.js
  // This function is kept for compatibility but does nothing
  console.log('Context menu setup delegated to background script');
}

// Update context list UI
function updateContextList() {
  console.log('updateContextList called');
  console.log('currentTabContext:', currentTabContext);
  console.log('pinnedContexts:', pinnedContexts);
  
  const totalContexts = (currentTabContext ? 1 : 0) + pinnedContexts.length;
  contextCount.textContent = totalContexts.toString();
  
  if (totalContexts === 0) {
    console.log('No contexts, showing empty message');
    contextTabs.innerHTML = '<div class="context-empty">No context available. Switch to a webpage to see content here.</div>';
    return;
  }

  console.log('Updating context tabs with', totalContexts, 'total contexts');
  
  let contextHtml = '';
  
  // Add current tab context (if available)
  if (currentTabContext) {
    const hostname = currentTabContext.url ? new URL(currentTabContext.url).hostname : 'Unknown';
    const title = currentTabContext.title || 'Untitled';
    console.log('Current tab context:', currentTabContext);
    const favicon = currentTabContext.favicon || 'https://www.google.com/s2/favicons?domain=' + hostname;
    
    console.log('Adding current tab context:', { title, hostname });
    
    // replace unicodes and links from title, limit title to 50 chars
    const sanitizedTitle = title.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/<[^>]*>/g, '').substring(0, 50);
    const contentSize = currentTabContext.content ? `${(currentTabContext.content.length / 1024).toFixed(1)}kb` : '0kb';

    contextHtml += `
      <div class="context-tab" onclick="openTab('${currentTabContext.url}')">
        <div class="context-tab-favicon" style="background-image: url('${favicon}');"></div>
        <div class="context-tab-info">
          <div class="context-tab-title">
            ${sanitizedTitle} <span style="color: #888; font-size: 11px;">(Current Tab)</span>
          </div>
          <div class="context-tab-url">${hostname} • ${contentSize}</div>
        </div>
        <button class="context-tab-pin" title="Pin this tab to context">+</button>
      </div>
    `;
  }
  
  // Add pinned contexts
  pinnedContexts.forEach((ctx, index) => {
    const isJournalContext = ctx.id === 'journal-context';
    const hostname = ctx.url ? (isJournalContext ? 'Journal' : new URL(ctx.url).hostname) : 'Unknown';
    const title = ctx.title || 'Untitled';
    const favicon = ctx.favicon || (isJournalContext ? 
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23737373"><path d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm16-8V6H8.023v2zm0 5V11H8.023v2zm0 5v-2H8.023v2z"/></svg>' :
      'https://www.google.com/s2/favicons?domain=' + hostname);
    
    console.log(`Adding pinned context ${index}:`, { title, hostname, isJournal: isJournalContext });
    
    const sanitizedTitle = title.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/<[^>]*>/g, '').substring(0, 50);
    const contentSize = ctx.content ? `${(ctx.content.length / 1024).toFixed(1)}kb` : '0kb';
    
    // Special handling for journal context - no onclick for opening tab
    const onclickAttr = isJournalContext ? '' : `onclick="openTab('${ctx.url}')"`;
    const contextLabel = isJournalContext ? '(Journal)' : '(Pinned)';
    
    contextHtml += `
      <div class="context-tab" ${onclickAttr}>
        ${isJournalContext ? `<i data-feather="book-open" style="width: 12px; height: 12px; margin-right: 4px;"></i>` :
          `<div class="context-tab-favicon" style="background-image: url('${favicon}');"></div>`}
        <div class="context-tab-info">
          <div class="context-tab-title">
            ${sanitizedTitle} <span style="color: #888; font-size: 11px;">${contextLabel}</span>
          </div>
          <div class="context-tab-url">${hostname} • ${contentSize}</div>
        </div>
        <button class="context-tab-close" data-index="${index}" title="Remove from context">×</button>
      </div>
    `;
  });
  
  contextTabs.innerHTML = contextHtml;
  console.log('Context tabs HTML updated');
  
  // Re-attach event listeners for pin/close buttons after DOM update
  attachContextButtonListeners();
}

// Remove context item
// Pin/unpin context functions
function pinCurrentTab() {
  if (currentTabContext) {
    // Check if already pinned
    const alreadyPinned = pinnedContexts.some(ctx => ctx.url === currentTabContext.url);
    if (!alreadyPinned) {
      pinnedContexts.push({ ...currentTabContext });
      console.log('Pinned current tab:', {
        url: currentTabContext.url,
        title: currentTabContext.title,
        contentLength: currentTabContext.content ? currentTabContext.content.length : 0,
        hasContent: !!currentTabContext.content
      });
      
      // Save to storage
      chrome.storage.local.set({ pinnedContexts: pinnedContexts }, () => {
        console.log('Saved pinned contexts to storage');
        console.log('Verifying saved content - checking first pinned context:');
        if (pinnedContexts.length > 0) {
          const firstPinned = pinnedContexts[0];
          console.log('First pinned context content preview:', {
            url: firstPinned.url,
            title: firstPinned.title,
            hasContent: !!firstPinned.content,
            contentLength: firstPinned.content ? firstPinned.content.length : 0,
            contentPreview: firstPinned.content ? firstPinned.content.substring(0, 200) + '...' : 'NO CONTENT'
          });
        }
      });
      
      updateContextList();
    } else {
      console.log('Tab already pinned:', currentTabContext.url);
    }
  } else {
    console.log('Cannot pin tab: no currentTabContext available');
  }
}

function removePinnedContext(index) {
  if (index >= 0 && index < pinnedContexts.length) {
    const removed = pinnedContexts.splice(index, 1)[0];
    console.log('Removed pinned context:', removed.url);
    
    // Save to storage
    chrome.storage.local.set({ pinnedContexts: pinnedContexts }, () => {
      console.log('Saved updated pinned contexts to storage');
    });
    
    updateContextList();
  }
}

// Legacy function - kept for compatibility
function removeContext(index) {
  contexts.splice(index, 1);
  updateContextList();
}

// Make functions globally available for onclick handlers
window.removeContext = removeContext;
window.openTab = openTab;
window.showJournalMessageMenu = showJournalMessageMenu;
window.closeJournalMessageMenu = closeJournalMessageMenu;
window.addJournalMessageToChat = addJournalMessageToChat;
window.deleteJournalMessage = deleteJournalMessage;
window.clearJournal = clearJournal;
window.downloadJournal = downloadJournal;
window.closeJournalHeaderMenu = closeJournalHeaderMenu;
window.searchJournal = searchJournal;
window.renderJournalMessages = renderJournalMessages;
window.exitSearchMode = exitSearchMode;

// Settings functions
function openSettings() {
  updateSettingsUI();
  settingsModal.classList.add('active');
}

function closeSettings() {
  settingsModal.classList.remove('active');
}

function updateSettingsUI() {
  document.getElementById('responseStyle').value = settings.responseStyle;
  document.getElementById('apiEndpoint').value = settings.apiEndpoint;
  document.getElementById('maxTokens').value = settings.maxTokens;
  document.getElementById('renderMarkdown').checked = settings.renderMarkdown;
}

function handleSaveSettings() {
  settings.responseStyle = document.getElementById('responseStyle').value;
  settings.apiEndpoint = document.getElementById('apiEndpoint').value;
  settings.maxTokens = parseInt(document.getElementById('maxTokens').value);
  settings.renderMarkdown = document.getElementById('renderMarkdown').checked;
  
  saveSettings();
  closeSettings();
}

function resetSettings() {
  settings = {
    responseStyle: 'Be concise and direct. Avoid unnecessary elaboration.',
    apiEndpoint: 'http://localhost:1234/v1/chat/completions',
    maxTokens: 1000,
    renderMarkdown: false
  };
  updateSettingsUI();
  saveSettings();
}

// Send message to LLM
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || isLoading) return;

  // Add user message to chat
  chatHistory.push({ role: 'user', content: message });
  updateChatMessages();
  
  // Ensure event listeners are attached for user message
  attachJournalButtonListeners();

  // Clear input
  chatInput.value = '';
  setLoading(true);

  try {
    // Prepare context for LLM - use current tab and pinned contexts
    let contextString = '';
    let hasContext = false;
    
    // ENHANCED DEBUG LOGGING
    console.log('=== SENDING MESSAGE TO LLM ===');
    console.log('User question:', message);
    console.log('Current tab context available:', !!currentTabContext);
    console.log('Number of pinned contexts:', pinnedContexts.length);
    
    if (currentTabContext) {
      console.log('Current tab details:', {
        url: currentTabContext.url,
        title: currentTabContext.title,
        contentLength: currentTabContext.content ? currentTabContext.content.length : 0,
        hasContent: !!currentTabContext.content
      });
    }
    
    console.log('Pinned contexts details:', pinnedContexts.map(ctx => ({
      url: ctx.url,
      title: ctx.title,
      contentLength: ctx.content ? ctx.content.length : 0,
      hasContent: !!ctx.content
    })));
    
    // Add current tab context first (this is what user is referring to by default)
    if (currentTabContext) {
      contextString += `CURRENT TAB (what user is referring to by default):\n`;
      contextString += `URL: ${currentTabContext.url}\n`;
      contextString += `Title: ${currentTabContext.title}\n`;
      contextString += `Content: ${currentTabContext.content.slice(0, 3000)}...\n\n`;
      hasContext = true;
    }

    // Add pinned contexts if they exist
    if (pinnedContexts.length > 0) {
      contextString += `PINNED TABS:\n`;
      contextString += pinnedContexts.map(ctx => 
        `URL: ${ctx.url}\nTitle: ${ctx.title}\nContent: ${ctx.content.slice(0, 2000)}...`
      ).join('\n\n---\n\n');
      hasContext = true;
    }
    
    console.log('Context string length:', contextString.length);
    console.log('Has any context:', hasContext);
    console.log('Full context string preview (first 500 chars):', contextString.substring(0, 500) + '...');

    // Check if we have any context at all
    if (!hasContext) {
      // Add error message to chat indicating no context is available
      chatHistory.push({ 
        role: 'assistant', 
        content: `I don't have any context from your current tab or pinned pages. This could happen if:

1. The page is still loading
2. The page doesn't allow content extraction (like some chrome:// pages)
3. There was an error getting the page content

Try:
- Refreshing the page and asking again
- Adding context by pinning tabs using the + button
- Navigating to a different webpage

You can still ask general questions, but I won't have specific page context to reference.` 
      });
      updateChatMessages();
      attachJournalButtonListeners(); // Ensure event listeners are attached
      setLoading(false);
      return;
    }

    // Console log the context and question being sent for debugging
    console.log('=== SENDING TO LLM ===');
    console.log('User question:', message);
    console.log('Has current tab context:', !!currentTabContext);
    console.log('Number of pinned contexts:', pinnedContexts.length);
    console.log('Full context string length:', contextString.length);
    console.log('Context string preview:', contextString.substring(0, 500) + '...');
    
    if (currentTabContext) {
      console.log('Current tab details:', {
        url: currentTabContext.url,
        title: currentTabContext.title,
        contentLength: currentTabContext.content?.length || 0
      });
    }
    
    if (pinnedContexts.length > 0) {
      console.log('Pinned contexts details:', pinnedContexts.map(ctx => ({
        url: ctx.url,
        title: ctx.title,
        contentLength: ctx.content?.length || 0
      })));
    }

    // Prepare system message with format instructions and response style
    const formatInstructions = {
      text: 'Respond in plain text format.',
      json: 'Respond in valid JSON format.',
      table: 'Respond in markdown table format when appropriate.'
    };

    const systemMessage = `You are an AI assistant that helps users analyze and understand content from their browser tabs and visited pages. 

${settings.responseStyle}

When users ask questions like "summarize this", "what's the main point", "explain this", etc., they are referring to the CURRENT TAB content by default. Only reference additional context when explicitly asked or when it's clearly relevant.

Context from user's tabs and pages:
${contextString}

${formatInstructions[currentFormat]}

Please provide helpful, accurate responses based on the context provided. Focus on the current tab content unless the user specifically asks about other pages.`;

    console.log('System message length:', systemMessage.length);
    console.log('========================');

    // Send to LLM using settings
    const response = await fetch(settings.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'local-model',
        messages: [
          { role: 'system', content: systemMessage },
          ...chatHistory.slice(-10), // Keep last 10 messages for context
        ],
        temperature: 0.7,
        max_tokens: settings.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Add assistant response to chat
    chatHistory.push({ role: 'assistant', content: assistantMessage });
    updateChatMessages();
    
    // Ensure event listeners are attached immediately
    attachJournalButtonListeners();

    // Save chat history
    chrome.runtime.sendMessage({
      type: 'SAVE_CHAT_HISTORY',
      history: chatHistory
    });

  } catch (error) {
    console.error('Error sending message to LLM:', error);
    
    // Add error message to chat
    chatHistory.push({ 
      role: 'assistant', 
      content: `Error: ${error.message}. Please make sure LM Studio is running on http://localhost:1234` 
    });
    updateChatMessages();
    attachJournalButtonListeners(); // Ensure event listeners are attached
  } finally {
    setLoading(false);
  }
}

// Update chat messages UI
function updateChatMessages() {
  if (chatHistory.length === 0) {
    chatMessages.innerHTML = '<div class="empty-state">Context automatically updates when you switch tabs. Ask questions about your current page or add more context using the + button.</div>';
    return;
  }

  chatMessages.innerHTML = chatHistory.map((msg, index) => {
    let content = msg.content;
    
    // Handle markdown rendering based on settings
    if (!settings.renderMarkdown) {
      // Remove markdown formatting
      content = content
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1')     // Remove italic
        .replace(/`(.*?)`/g, '$1')       // Remove code
        .replace(/#{1,6}\s/g, '')        // Remove headers
        .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Remove links, keep text
    }
    
    // Add journal button for both user questions and assistant responses
    const saveButton = (msg.role === 'assistant' || msg.role === 'user') ? 
      `<button class="note-action-btn" data-message-index="${index}" title="Add to journal" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border: none; color: #737373; padding: 4px; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
        <i data-feather="book-open" style="width: 12px; height: 12px;"></i>
      </button>` : '';
    
    return `
      <div class="message ${msg.role}" style="position: relative;">
        ${saveButton}
        ${content.replace(/\n/g, '<br>')}
      </div>
    `;
  }).join('');

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Attach event listeners to journal buttons
  attachJournalButtonListeners();
}

// Helper function to attach event listeners to journal buttons
function attachJournalButtonListeners() {
  // Use a slight delay to ensure DOM is ready
  setTimeout(() => {
    if (!chatMessages) return; // Null check
    
    const noteActionButtons = chatMessages.querySelectorAll('.note-action-btn:not([data-listener-attached])');
    console.log('Attaching listeners to', noteActionButtons.length, 'journal buttons');
    
    noteActionButtons.forEach((btn) => {
      const messageIndex = parseInt(btn.getAttribute('data-message-index') || '0');
      console.log('Attaching listener to button for message index:', messageIndex);
      
      // Mark as having listener attached to avoid duplicates
      btn.setAttribute('data-listener-attached', 'true');
      
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Journal button clicked for message index:', messageIndex);
        addMessageToJournal(messageIndex, btn);
      });
    });
    
    // Replace feather icons after DOM manipulation
    if (window.feather) {
      window.feather.replace();
    }
  }, 10);
}

// Helper function to attach event listeners to context buttons
function attachContextButtonListeners() {
  // Use a slight delay to ensure DOM is ready
  setTimeout(() => {
    if (!contextTabs) return; // Null check
    
    // Attach listeners to pin buttons (for current tab)
    const pinButtons = contextTabs.querySelectorAll('.context-tab-pin:not([data-listener-attached])');
    console.log('Attaching listeners to', pinButtons.length, 'pin buttons');
    
    pinButtons.forEach((btn) => {
      // Mark as having listener attached to avoid duplicates
      btn.setAttribute('data-listener-attached', 'true');
      
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Pin button clicked');
        pinCurrentTab();
      });
    });
    
    // Attach listeners to close buttons (for pinned contexts)
    const closeButtons = contextTabs.querySelectorAll('.context-tab-close:not([data-listener-attached])');
    console.log('Attaching listeners to', closeButtons.length, 'close buttons');
    
    closeButtons.forEach((btn) => {
      // Get the index from the data-index attribute
      const index = parseInt(btn.getAttribute('data-index') || '-1');
      
      if (index >= 0) {
        // Mark as having listener attached to avoid duplicates
        btn.setAttribute('data-listener-attached', 'true');
        
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log('Close button clicked for index:', index);
          removePinnedContext(index);
        });
      }
    });
    
    // Replace feather icons after DOM manipulation
    if (window.feather) {
      window.feather.replace();
    }
  }, 10);
}

// Set loading state
function setLoading(loading) {
  isLoading = loading;
  sendBtn.disabled = loading;
  
  // Update send button content
  if (loading) {
    sendBtn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
  } else {
    sendBtn.innerHTML = '<i data-feather="send" style="width: 14px; height: 14px;"></i>';
    if (window.feather) {
      window.feather.replace();
    }
  }

  if (loading) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = '<div class="spinner"></div> Thinking...';
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } else {
    const loadingDiv = chatMessages.querySelector('.loading');
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }
}

// Update UI based on current state
function updateUI() {
  updateContextList();
  updateChatMessages();
}

// Tab switching functionality
function switchTab(tabName) {
  currentTab = tabName;
  
  // Update tab buttons
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  if (tabName === 'chat') {
    chatTab.classList.add('active');
  } else if (tabName === 'journal') {
    journalTab.classList.add('active');
    loadJournal();
  }
}

// Notepad functionality
function showAddNoteModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="note-input-modal">
      <div class="modal-header">
        <h2>Add New Note</h2>
        <button class="modal-close" onclick="closeAddNoteModal()">×</button>
      </div>
      <div class="note-input-content">
        <textarea class="note-input-textarea" placeholder="Enter your note here..." autofocus></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeAddNoteModal()">Cancel</button>
        <button class="btn primary" onclick="saveNewNote()">Save Note</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus the textarea
  setTimeout(() => {
    const textarea = modal.querySelector('.note-input-textarea');
    textarea.focus();
  }, 100);
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeAddNoteModal();
    }
  });
}

function closeAddNoteModal() {
  const modal = document.querySelector('.modal-overlay.active');
  if (modal && modal.querySelector('.note-input-modal')) {
    modal.remove();
  }
}

function saveNewNote() {
  const modal = document.querySelector('.modal-overlay.active');
  const textarea = modal.querySelector('.note-input-textarea');
  const content = textarea.value.trim();
  
  if (!content) {
    alert('Please enter some content for the note.');
    return;
  }
  
  const note = {
    id: Date.now(),
    content: content,
    timestamp: new Date().toISOString(),
    source: 'manual'
  };
  
  notes.unshift(note); // Add to beginning of array
  saveNotes();
  updateNotesList();
  closeAddNoteModal();
}

function addNoteFromText(text, source = 'chat') {
  const note = {
    id: Date.now(),
    content: text,
    timestamp: new Date().toISOString(),
    source: source
  };
  
  notes.unshift(note);
  saveNotes();
  updateNotesList();
}

function deleteNote(noteId) {
  if (confirm('Are you sure you want to delete this note?')) {
    notes = notes.filter(note => note.id !== noteId);
    saveNotes();
    updateNotesList();
  }
}

function editNote(noteId) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="note-input-modal">
      <div class="modal-header">
        <h2>Edit Note</h2>
        <button class="modal-close" onclick="closeEditNoteModal()">×</button>
      </div>
      <div class="note-input-content">
        <textarea class="note-input-textarea" autofocus>${note.content}</textarea>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeEditNoteModal()">Cancel</button>
        <button class="btn primary" onclick="saveEditedNote(${noteId})">Save Changes</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus the textarea
  setTimeout(() => {
    const textarea = modal.querySelector('.note-input-textarea');
    textarea.focus();
    textarea.select();
  }, 100);
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeEditNoteModal();
    }
  });
}

function closeEditNoteModal() {
  const modal = document.querySelector('.modal-overlay.active');
  if (modal && modal.querySelector('.note-input-modal')) {
    modal.remove();
  }
}

function saveEditedNote(noteId) {
  const modal = document.querySelector('.modal-overlay.active');
  const textarea = modal.querySelector('.note-input-textarea');
  const content = textarea.value.trim();
  
  if (!content) {
    alert('Please enter some content for the note.');
    return;
  }
  
  const noteIndex = notes.findIndex(n => n.id === noteId);
  if (noteIndex >= 0) {
    notes[noteIndex].content = content;
    notes[noteIndex].timestamp = new Date().toISOString();
    saveNotes();
    updateNotesList();
  }
  
  closeEditNoteModal();
}

function clearAllNotes() {
  if (confirm('Are you sure you want to delete all notes? This cannot be undone.')) {
    notes = [];
    saveNotes();
    updateNotesList();
  }
}

function copyNoteToClipboard(noteId) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;
  
  navigator.clipboard.writeText(note.content).then(() => {
    // Show brief feedback
    const btn = document.querySelector(`[onclick="copyNoteToClipboard(${noteId})"]`);
    const originalText = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1000);
  }).catch(err => {
    console.error('Failed to copy to clipboard:', err);
  });
}

function updateNotesList() {
  if (notes.length === 0) {
    notesList.innerHTML = '<div class="empty-state">No notes yet. Click "Add Note" to start.</div>';
    return;
  }
  
  notesList.innerHTML = notes.map(note => {
    const date = new Date(note.timestamp);
    const timeString = date.toLocaleString();
    
    return `
      <div class="note-item">
        <div class="note-header">
          <span class="note-timestamp">${timeString}</span>
          <div class="note-actions">
            <button class="note-action-btn" onclick="copyNoteToClipboard(${note.id})" title="Copy to clipboard">📋</button>
            <button class="note-action-btn" onclick="editNote(${note.id})" title="Edit note">✏️</button>
            <button class="note-action-btn" onclick="deleteNote(${note.id})" title="Delete note">🗑️</button>
          </div>
        </div>
        <div class="note-content">${note.content.replace(/\n/g, '<br>')}</div>
        ${note.source !== 'manual' ? `<div class="note-source">Source: ${note.source}</div>` : ''}
      </div>
    `;
  }).join('');
}

// Show journal message menu
function showJournalMessageMenu(event, messageId) {
  event.preventDefault();
  event.stopPropagation();
  
  // Remove any existing menus
  const existingMenu = document.querySelector('.journal-message-dropdown');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  const menu = document.createElement('div');
  menu.className = 'journal-message-dropdown';
  
  // Position menu relative to the clicked element and viewport
  const clickedElement = event.target.closest('.journal-message-menu');
  const rect = clickedElement.getBoundingClientRect();
  const journalContainer = document.getElementById('journalMessages');
  const containerRect = journalContainer.getBoundingClientRect();
  
  const menuWidth = 140;
  const menuHeight = 80;
  
  // Position relative to the button, but within the journal container
  let left = rect.right + 8; // Position to the right of the button
  let top = rect.top;
  
  // Adjust if menu would go outside viewport or container
  if (left + menuWidth > window.innerWidth) {
    left = rect.left - menuWidth - 8; // Position to the left instead
  }
  
  if (top + menuHeight > window.innerHeight) {
    top = rect.bottom - menuHeight;
  }
  
  // Ensure menu stays within the journal container bounds
  if (left < containerRect.left) {
    left = containerRect.left + 8;
  }
  if (top < containerRect.top) {
    top = containerRect.top + 8;
  }
  
  menu.style.position = 'fixed';
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.zIndex = '1001'; // Higher than other elements
  
  menu.innerHTML = `
    <div style="padding: 4px;">
      <button class="journal-menu-btn" data-action="add-to-chat" data-message-id="${messageId}">
        <i data-feather="message-circle" style="width: 14px; height: 14px; margin-right: 6px;"></i>
        Add to Chat
      </button>
      <button class="journal-menu-btn danger" data-action="delete" data-message-id="${messageId}">
        <i data-feather="trash-2" style="width: 14px; height: 14px; margin-right: 6px;"></i>
        Delete
      </button>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // Re-render Feather icons in the menu
  if (window.feather) {
    window.feather.replace();
  }
  
  // Add click handlers for menu buttons
  menu.addEventListener('click', (e) => {
    const button = e.target.closest('.journal-menu-btn');
    if (button) {
      const action = button.getAttribute('data-action');
      const messageId = parseInt(button.getAttribute('data-message-id'));
      
      if (action === 'add-to-chat') {
        addJournalMessageToChat(messageId);
      } else if (action === 'delete') {
        deleteJournalMessage(messageId);
      }
      
      closeJournalMessageMenu();
    }
  });
  
  // Close menu when clicking outside or scrolling
  setTimeout(() => {
    function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
        journalContainer.removeEventListener('scroll', closeMenu);
      }
    }
    
    // Close on click outside
    document.addEventListener('click', closeMenu);
    
    // Close on scroll within journal container
    journalContainer.addEventListener('scroll', closeMenu);
  }, 0);
}

function closeJournalMessageMenu() {
  const menu = document.querySelector('.journal-message-dropdown');
  if (menu) {
    menu.remove();
  }
}

// Close menu on escape key and handle Ctrl+J for adding to journal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeJournalMessageMenu();
  }
  
  // Ctrl+J to add selected text to journal
  if (e.ctrlKey && e.key === 'j') {
    e.preventDefault();
    addSelectionToJournal();
  }
});

// Add journal message to chat
function addJournalMessageToChat(messageId) {
  const message = journalMessages.find(msg => msg.id === messageId);
  if (!message) return;
  
  // Add message to chat history
  chatHistory.push({ 
    role: 'user', 
    content: message.content 
  });
  
  // Switch to chat tab and update
  switchTab('chat');
  updateChatMessages();
  
  // Save chat history
  chrome.runtime.sendMessage({
    type: 'SAVE_CHAT_HISTORY',
    history: chatHistory
  });
}

// Delete journal message
function deleteJournalMessage(messageId) {
  if (confirm('Are you sure you want to delete this journal entry?')) {
    journalMessages = journalMessages.filter(msg => msg.id !== messageId);
    renderJournalMessages();
    saveJournal();
  }
}

// Show journal header menu
function showJournalHeaderMenu(event) {
  event.stopPropagation();
  
  // Remove any existing menu
  const existingMenu = document.querySelector('.journal-header-dropdown');
  if (existingMenu) {
    existingMenu.remove();
    return;
  }
  
  const menu = document.createElement('div');
  menu.className = 'journal-header-dropdown';
  
  menu.innerHTML = `
    <button onclick="searchJournal(); closeJournalHeaderMenu();" class="search-journal-btn">
      <i data-feather="search" style="width: 12px; height: 12px;"></i>
      Search Journal
    </button>
    <button onclick="downloadJournal(); closeJournalHeaderMenu();">
      <i data-feather="download" style="width: 12px; height: 12px;"></i>
      Download Journal
    </button>
    <button onclick="clearJournal(); closeJournalHeaderMenu();" class="danger">
      <i data-feather="trash-2" style="width: 12px; height: 12px;"></i>
      Clear Journal
    </button>
  `;
  

  // register event listener for search journal
  const searchBtn = menu.querySelector('.search-journal-btn');
  searchBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    searchJournal();
    closeJournalHeaderMenu();
  });

  // register event listener for download journal
  const downloadBtn = menu.querySelector('button:not(.search-journal-btn)');
  downloadBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    downloadJournal();
    closeJournalHeaderMenu();
  });

  // register event listener for clear journal
  const clearBtn = menu.querySelector('.danger');
  clearBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    clearJournal();
    closeJournalHeaderMenu();
  });
  
  // Position the menu relative to the journal header
  const journalHeader = event.target.closest('.journal-header');
  if (journalHeader) {
    journalHeader.appendChild(menu);
  }
  
  // Re-render Feather icons
  if (window.feather) {
    window.feather.replace();
  }
  
  // Close menu when clicking outside
  setTimeout(() => {
    function closeMenu(e) {
      if (!menu.contains(e.target) && !e.target.closest('.journal-menu-btn')) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    }
    document.addEventListener('click', closeMenu);
  }, 0);
}

function closeJournalHeaderMenu() {
  const menu = document.querySelector('.journal-header-dropdown');
  if (menu) {
    menu.remove();
  }
}

// Search journal functionality
function searchJournal() {
  const journalHeader = document.querySelector('.journal-header');
  if (!journalHeader) return;
  
  // Create search header
  const searchHeader = document.createElement('div');
  searchHeader.className = 'journal-search-header-input';
  searchHeader.innerHTML = `
    <div class="journal-search-input-wrapper">
      <input type="text" 
             class="journal-search-input" 
             placeholder="Search journal entries..." 
             autocomplete="off"
             spellcheck="false">
      <button class="journal-search-close-btn">
        <i data-feather="x"></i>
      </button>
    </div>
  `;
  
  // Replace header with search input
  journalHeader.style.display = 'none';
  journalHeader.parentNode.insertBefore(searchHeader, journalHeader);
  
  // Focus the input
  const searchInput = searchHeader.querySelector('.journal-search-input');
  const closeBtn = searchHeader.querySelector('.journal-search-close-btn');
  searchInput.focus();
  
  // Add close button event listener
  closeBtn.addEventListener('click', () => {
    exitSearchMode();
  });
  searchInput.focus();
  
  // Add real-time search functionality
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.trim();
    if (searchTerm === '') {
      renderJournalMessages();
    } else {
      performJournalSearch(searchTerm);
    }
  });
  
  // Handle escape key to exit search
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      exitSearchMode();
    }
  });
  
  // Initialize Feather icons for the close button
  feather.replace();
}

// Exit search mode and return to normal journal view
function exitSearchMode() {
  const searchHeader = document.querySelector('.journal-search-header-input');
  const journalHeader = document.querySelector('.journal-header');
  
  if (searchHeader) {
    searchHeader.remove();
  }
  
  if (journalHeader) {
    journalHeader.style.display = 'flex';
  }
  
  // Show all messages
  renderJournalMessages();
}

// Perform the actual search
function performJournalSearch(searchTerm) {
  const term = searchTerm.toLowerCase();
  
  // Filter messages that contain the search term
  const filteredMessages = journalMessages.filter(message => 
    message.content.toLowerCase().includes(term) ||
    (message.sourceTitle && message.sourceTitle.toLowerCase().includes(term)) ||
    (message.sourceUrl && message.sourceUrl.toLowerCase().includes(term))
  );
  
  // Render filtered messages
  renderFilteredJournalMessages(filteredMessages, term);
}

// Render filtered journal messages with search term highlighted
function renderFilteredJournalMessages(filteredMessages, searchTerm) {
  const container = journalContainer;
  if (!container) return;
  
  container.innerHTML = '';
  
  if (filteredMessages.length === 0) {
    container.innerHTML = `
      <div class="journal-search-info">
        No results found for "${searchTerm}"
      </div>
      <div class="journal-empty">No matching entries found.</div>
    `;
    return;
  }
  
  // Add search results info
  container.innerHTML = `
    <div class="journal-search-info">
      Found ${filteredMessages.length} result${filteredMessages.length === 1 ? '' : 's'} for "${searchTerm}"
    </div>
  `;
  
  // Group filtered messages by date
  const messagesByDate = {};
  filteredMessages.forEach(message => {
    const date = new Date(message.timestamp).toDateString();
    if (!messagesByDate[date]) {
      messagesByDate[date] = [];
    }
    messagesByDate[date].push(message);
  });

  // Sort dates in ascending order (oldest first)
  const sortedDates = Object.keys(messagesByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  sortedDates.forEach(dateStr => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Create date header
    const dateHeader = document.createElement('div');
    dateHeader.className = 'journal-date-header';
    
    let dateLabel;
    if (date.toDateString() === today.toDateString()) {
      dateLabel = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    
    dateHeader.textContent = dateLabel;
    container.appendChild(dateHeader);
    
    // Add messages for this date
    messagesByDate[dateStr].forEach(message => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `journal-message ${message.type}`;
      
      const timestamp = new Date(message.timestamp).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Highlight search term in content
      const highlightedContent = highlightSearchTerm(message.content, searchTerm);
      const highlightedTitle = message.sourceTitle ? highlightSearchTerm(message.sourceTitle, searchTerm) : message.sourceTitle;
      
      if (message.type === 'quote') {
        messageDiv.innerHTML = `
          <div class="journal-message-content">${highlightedContent}</div>
          <div class="journal-quote-source">
            <a href="${message.sourceUrl}" target="_blank">${highlightedTitle || 'Source'}</a>
          </div>
          <div class="journal-message-time">${timestamp}</div>
          <div class="journal-message-menu" data-message-id="${message.id}">
            <i data-feather="more-horizontal"></i>
          </div>
        `;
      } else if (message.type === 'question') {
        messageDiv.innerHTML = `
          <div class="journal-message-content">${highlightedContent}</div>
          <div class="journal-quote-source">
            <a href="${message.sourceUrl}" target="_blank">${highlightedTitle}</a>
          </div>
          <div class="journal-message-time">${timestamp}</div>
          <div class="journal-message-menu" data-message-id="${message.id}">
            <i data-feather="more-horizontal"></i>
          </div>
        `;
      } else {
        messageDiv.innerHTML = `
          <div class="journal-message-content">${highlightedContent}</div>
          <div class="journal-message-time">${timestamp}</div>
          <div class="journal-message-menu" data-message-id="${message.id}">
            <i data-feather="more-horizontal"></i>
          </div>
        `;
      }
      
      container.appendChild(messageDiv);
    });
  });
  
  // Scroll to top to show search results
  container.scrollTop = 0;
  
  // Re-render Feather icons
  if (window.feather) {
    window.feather.replace();
  }
}

// Helper function to highlight search terms
function highlightSearchTerm(text, searchTerm) {
  if (!text || !searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark style="background: #ffd700; color: #000; padding: 1px 2px; border-radius: 2px;">$1</mark>');
}

// Add journal entries to context
function addJournalToContext() {
  // Check if journal has entries
  if (!journalMessages || journalMessages.length === 0) {
    // Show a brief notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #262626;
      color: #e5e5e5;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1001;
      border: 1px solid #404040;
    `;
    notification.textContent = 'No journal entries to add';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 2000);
    return;
  }

  // Create a summary of journal entries to add as context
  const journalContext = {
    id: 'journal-context',
    title: `Journal (${journalMessages.length} entries)`,
    url: 'internal://journal',
    content: journalMessages.map(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString();
      const content = msg.content;
      const type = msg.type || 'note';
      
      let contextEntry = `[${date}] ${content}`;
      
      // Add source info for quotes and questions
      if (msg.sourceTitle && msg.sourceUrl) {
        contextEntry += `\nSource: ${msg.sourceTitle} (${msg.sourceUrl})`;
      }
      
      return contextEntry;
    }).join('\n\n'),
    favicon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23737373"><path d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm16-8V6H8.023v2zm0 5V11H8.023v2zm0 5v-2H8.023v2z"/></svg>',
    size: `${journalMessages.length} entries`
  };

  // Add to pinned contexts instead of legacy contexts array
  const existingIndex = pinnedContexts.findIndex(ctx => ctx.id === 'journal-context');
  if (existingIndex >= 0) {
    // Update existing journal context
    pinnedContexts[existingIndex] = journalContext;
  } else {
    // Add new journal context to pinned contexts
    pinnedContexts.push(journalContext);
  }

  // Save to storage
  chrome.storage.local.set({ pinnedContexts: pinnedContexts }, () => {
    console.log('Saved journal context to pinned contexts');
  });

  // Update the display
  updateContextList();
  
  // Show success notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2563eb;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 1001;
    border: 1px solid #3b82f6;
  `;
  notification.textContent = `Added ${journalMessages.length} journal entries to context`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 2000);
}

// Add selected text to journal using Ctrl+J shortcut
function addSelectionToJournal() {
  // Get the selected text from the page
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    // Show a brief notification if no text is selected
    showNotification('No text selected. Please select some text and try again.', 'warning');
    return;
  }
  
  const selectedText = selection.toString().trim();
  if (!selectedText) {
    showNotification('No text selected. Please select some text and try again.', 'warning');
    return;
  }
  
  // Get the current page info
  let sourceUrl = window.location.href;
  let sourceTitle = document.title;
  
  // Try to get info from current tab context if available
  if (currentTabContext) {
    sourceUrl = currentTabContext.url || sourceUrl;
    sourceTitle = currentTabContext.title || sourceTitle;
  }
  
  // Create journal entry
  const journalEntry = {
    id: Date.now(),
    type: 'quote',
    content: selectedText,
    sourceUrl: sourceUrl,
    sourceTitle: sourceTitle,
    timestamp: new Date().toISOString()
  };
  
  // Add to journal
  journalMessages.push(journalEntry);
  saveJournal();
  
  // Show success notification
  showNotification(`Added "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}" to journal`, 'success');
  
  // Clear selection
  selection.removeAllRanges();
  
  // If we're on the journal tab, update the display
  if (currentTab === 'journal') {
    renderJournalMessages();
  }
}

// Show notification helper function
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  const bgColor = type === 'success' ? '#2563eb' : type === 'warning' ? '#f59e0b' : '#262626';
  const textColor = type === 'warning' ? '#000' : '#fff';
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: ${textColor};
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 1001;
    border: 1px solid ${type === 'success' ? '#3b82f6' : type === 'warning' ? '#fbbf24' : '#404040'};
    max-width: 300px;
    word-wrap: break-word;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Download journal as a file
function downloadJournal() {
  if (!journalMessages || journalMessages.length === 0) {
    showNotification('No journal entries to download', 'warning');
    return;
  }

  // Create formatted content for download
  let content = 'Snip Journal Export\n';
  content += '==================\n\n';
  content += `Exported on: ${new Date().toLocaleString()}\n`;
  content += `Total entries: ${journalMessages.length}\n\n`;

  // Group messages by date
  const messagesByDate = {};
  journalMessages.forEach(message => {
    const date = new Date(message.timestamp).toDateString();
    if (!messagesByDate[date]) {
      messagesByDate[date] = [];
    }
    messagesByDate[date].push(message);
  });

  // Sort dates in ascending order (oldest first)
  const sortedDates = Object.keys(messagesByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  sortedDates.forEach(dateStr => {
    const date = new Date(dateStr);
    content += `\n${date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}\n`;
    content += '='.repeat(50) + '\n\n';

    messagesByDate[dateStr].forEach(message => {
      const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      content += `[${time}] `;
      
      if (message.type === 'quote') {
        content += `"${message.content}"\n`;
        if (message.sourceTitle && message.sourceUrl) {
          content += `Source: ${message.sourceTitle} (${message.sourceUrl})\n`;
        }
      } else if (message.type === 'question') {
        content += `Q: ${message.content}\n`;
        if (message.sourceTitle && message.sourceUrl) {
          content += `Context: ${message.sourceTitle} (${message.sourceUrl})\n`;
        }
      } else {
        content += `${message.content}\n`;
      }
      content += '\n';
    });
  });

  // Create and download file
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `snip-journal-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification(`Downloaded journal with ${journalMessages.length} entries`, 'success');
}
