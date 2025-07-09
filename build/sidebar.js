// Sidebar JavaScript for LLM Agent Chrome Extension
// Handles UI interactions, context management, and LLM communication

console.log('LLM Agent: Sidebar loaded');

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
const clearContextBtn = document.getElementById('clearContextBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const formatButtons = document.querySelectorAll('.format-btn');
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
const clearJournalBtn = document.getElementById('clearJournal');

// Initialize sidebar
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  loadSettings();
  setupEventListeners();
  setupContextMenu();
  updateUI();
});

// Listen for context updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Sidebar received message:', message.type, message);
  
  if (message.type === 'CONTEXT_UPDATED') {
    console.log('Received context update from background:', message.context);
    console.log('Current currentTabContext before update:', currentTabContext);
    console.log('Current pinnedContexts before update:', pinnedContexts);
    
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
  // First, get the current tab context
  chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_CONTENT' }, (response) => {
    console.log('Got current tab content on load:', response);
    if (response) {
      contexts = [response]; // Set current tab as the primary context
      updateContextList();
    } else {
      // No current tab context available
      contexts = [];
      updateContextList();
    }
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
  // Format selector
  formatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formatButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFormat = btn.dataset.format;
    });
  });

  // Tab navigation
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });

  // Context buttons
  addContextBtn.addEventListener('click', showContextMenu);
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
  clearJournalBtn.addEventListener('click', clearJournal);
  
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
let journalMessages = [];

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
    
    console.log('Adding current tab context:', { title, hostname });
    
    contextHtml += `
      <div class="context-tab" onclick="openTab('${currentTabContext.url}')">
        <div class="context-tab-favicon"></div>
        <div class="context-tab-info">
          <div class="context-tab-title">
            🔵 ${title} <span style="color: #888; font-size: 11px;">(Current Tab)</span>
          </div>
          <div class="context-tab-url">${hostname}</div>
        </div>
        <button class="context-tab-pin" onclick="event.stopPropagation(); pinCurrentTab()" title="Pin this tab to context">+</button>
      </div>
    `;
  }
  
  // Add pinned contexts
  pinnedContexts.forEach((ctx, index) => {
    const hostname = ctx.url ? new URL(ctx.url).hostname : 'Unknown';
    const title = ctx.title || 'Untitled';
    
    console.log(`Adding pinned context ${index}:`, { title, hostname });
    
    contextHtml += `
      <div class="context-tab" onclick="openTab('${ctx.url}')">
        <div class="context-tab-favicon"></div>
        <div class="context-tab-info">
          <div class="context-tab-title">
            � ${title} <span style="color: #888; font-size: 11px;">(Pinned)</span>
          </div>
          <div class="context-tab-url">${hostname}</div>
        </div>
        <button class="context-tab-close" onclick="event.stopPropagation(); removePinnedContext(${index})" title="Remove from context">×</button>
      </div>
    `;
  });
  
  contextTabs.innerHTML = contextHtml;
  console.log('Context tabs HTML updated');
}

// Remove context item
// Pin/unpin context functions
function pinCurrentTab() {
  if (currentTabContext) {
    // Check if already pinned
    const alreadyPinned = pinnedContexts.some(ctx => ctx.url === currentTabContext.url);
    if (!alreadyPinned) {
      pinnedContexts.push({ ...currentTabContext });
      console.log('Pinned current tab:', currentTabContext.url);
      updateContextList();
    } else {
      console.log('Tab already pinned:', currentTabContext.url);
    }
  }
}

function removePinnedContext(index) {
  if (index >= 0 && index < pinnedContexts.length) {
    const removed = pinnedContexts.splice(index, 1)[0];
    console.log('Removed pinned context:', removed.url);
    updateContextList();
  }
}

// Legacy function - kept for compatibility
function removeContext(index) {
  contexts.splice(index, 1);
  updateContextList();
}

// Make functions globally available for onclick handlers
window.pinCurrentTab = pinCurrentTab;
window.removePinnedContext = removePinnedContext;

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

  // Clear input
  chatInput.value = '';
  setLoading(true);

  try {
    // Prepare context for LLM - use current tab and pinned contexts
    let contextString = '';
    let hasContext = false;
    
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
      setLoading(false);
      return;
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
    
    const saveButton = msg.role === 'assistant' ? 
      `<button class="note-action-btn" onclick="saveMessageToNotepad(${index})" title="Save to notepad" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.5); border: none; color: #a3a3a3; padding: 4px 6px; border-radius: 3px; cursor: pointer;">📋</button>` : '';
    
    return `
      <div class="message ${msg.role}" style="position: relative;">
        ${saveButton}
        ${content.replace(/\n/g, '<br>')}
      </div>
    `;
  }).join('');

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Set loading state
function setLoading(loading) {
  isLoading = loading;
  sendBtn.disabled = loading;
  sendBtn.textContent = loading ? 'Sending...' : 'Send';

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

// Save chat message to notepad
function saveMessageToNotepad(messageIndex) {
  const message = chatHistory[messageIndex];
  if (!message || message.role !== 'assistant') return;
  
  addNoteFromText(message.content, 'AI response');
  
  // Show brief feedback
  const btn = document.querySelector(`[onclick="saveMessageToNotepad(${messageIndex})"]`);
  if (btn) {
    const originalText = btn.textContent;
    btn.textContent = '✓';
    btn.style.color = '#22c55e';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.color = '#a3a3a3';
    }, 1500);
  }
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

// Close menu on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeJournalMessageMenu();
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

// Global functions for inline event handlers
window.removeContext = removeContext;
window.openTab = openTab;
window.showJournalMessageMenu = showJournalMessageMenu;
window.closeJournalMessageMenu = closeJournalMessageMenu;
window.addJournalMessageToChat = addJournalMessageToChat;
window.deleteJournalMessage = deleteJournalMessage;
