// Background script for LLM Agent Chrome Extension
// Handles extension lifecycle, tab management, and data storage

console.log('LLM Agent: Background script loaded');

// Storage for page contexts and visited links
let pageContexts = new Map();
let chatHistory = [];

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('LLM Agent: Extension installed');
  
  // Set up side panel behavior - this should be enough for icon click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  // Create context menu items
  chrome.contextMenus.create({
    id: 'open-llm-agent',
    title: 'Open LLM Agent',
    contexts: ['page', 'selection', 'link']
  });
  
  chrome.contextMenus.create({
    id: 'add-page-to-context',
    title: 'Add Page to LLM Context',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'add-selection-to-context',
    title: 'Add Selection to LLM Context',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'add-selection-to-journal',
    title: 'Add to Journal',
    contexts: ['selection']
  });
  
  // Initialize current tab context
  setTimeout(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTENT' }, (response) => {
          if (response && !chrome.runtime.lastError) {
            pageContexts.set('current_tab', response);
            console.log('Initialized current tab context:', response.url);
          }
        });
      }
    });
  }, 1000);
});

// Handle tab activation (when user switches to a different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
  
  try {
    // Get the activated tab information
    const tab = await chrome.tabs.get(activeInfo.tabId);
    
    // Only process web pages (not chrome:// pages, extensions, etc.)
    if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      console.log('Processing web page:', tab.url);
      // Wait a moment for the page to be ready
      setTimeout(() => {
        // Send message to content script to get page content
        chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not ready yet:', chrome.runtime.lastError.message);
            // Content script not ready, but don't treat as error
            return;
          }
          
          if (response) {
            // Update the current tab context
            pageContexts.set('current_tab', response);
            console.log('Auto-updated context for tab switch:', response.url);
            
            // Notify sidebar of context update
            chrome.runtime.sendMessage({ 
              type: 'CONTEXT_UPDATED', 
              context: response 
            }).catch(() => {
              // Sidebar might not be open, that's ok
            });
          }
        });
      }, 500); // Small delay to ensure page is ready
    } else {
      console.log('Skipping non-web page:', tab.url);
      
      // For non-web pages, clear the current context and notify sidebar
      pageContexts.delete('current_tab');
      chrome.runtime.sendMessage({ 
        type: 'CONTEXT_UPDATED', 
        context: null 
      }).catch(() => {
        // Sidebar might not be open, that's ok
      });
    }
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

// Handle tab updates (when a tab's URL changes, like navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process when the tab is completely loaded and has a URL change
  if (changeInfo.status === 'complete' && changeInfo.url && 
      (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    
    console.log('Tab updated with new URL:', tab.url);
    
    // Check if this is the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      if (activeTabs[0] && activeTabs[0].id === tabId) {
        // This is the active tab, update context
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' }, (response) => {
            if (response && !chrome.runtime.lastError) {
              // Update the current tab context
              pageContexts.set('current_tab', response);
              console.log('Auto-updated context for URL change:', response.url);
              
              // Notify sidebar of context update
              chrome.runtime.sendMessage({ 
                type: 'CONTEXT_UPDATED', 
                context: response 
              }).catch(() => {
                // Sidebar might not be open, that's ok
              });
            }
          });
        }, 1000); // Longer delay for navigation
      }
    });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);
  
  switch (info.menuItemId) {
    case 'open-llm-agent':
      // Open side panel - try window first, then tab
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
        chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
          console.error('Failed to open side panel:', error);
        });
      });
      break;
      
    case 'add-page-to-context':
      // Add current page to context
      chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, (response) => {
        if (response && !chrome.runtime.lastError) {
          pageContexts.set(response.url, response);
          console.log('Added page to context via context menu:', response.url);
        }
      });
      break;
      
    case 'add-selection-to-context':
      // Add selected text to context
      if (info.selectionText) {
        const selectionContext = {
          url: tab.url,
          title: `Selection from ${tab.title}`,
          content: info.selectionText,
          timestamp: Date.now()
        };
        pageContexts.set(`selection_${Date.now()}`, selectionContext);
        console.log('Added selection to context:', info.selectionText.substring(0, 50) + '...');
      }
      break;
      
    case 'add-selection-to-journal':
      // Add selected text to journal
      if (info.selectionText) {
        // Store the selection data temporarily so sidebar can pick it up
        const journalEntry = {
          type: 'quote',
          content: info.selectionText,
          sourceUrl: tab.url,
          sourceTitle: tab.title,
          timestamp: new Date().toISOString()
        };
        
        // Store temporarily for sidebar to pick up
        chrome.storage.local.set({ 
          pendingJournalEntry: journalEntry 
        }, () => {
          console.log('Stored pending journal entry for sidebar pickup');
        });
        
        // Open side panel to show the journal
        chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
          chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
            console.error('Failed to open side panel:', error);
          });
        });
      }
      break;
  }
});

// Handle messages from content scripts and sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.type);
  
  switch (request.type) {
    case 'PAGE_DATA':
      // Store page data from content script
      if (request.data) {
        pageContexts.set(request.data.url, request.data);
        console.log('Stored page data for:', request.data.url);
      }
      break;
      
    case 'GET_ALL_TABS':
      // Get all open tabs
      chrome.tabs.query({}, (tabs) => {
        const tabData = tabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active
        }));
        sendResponse({ tabs: tabData });
      });
      return true; // Keep message channel open for async response
      
    case 'GET_CURRENT_TAB':
      // Get current active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          sendResponse({ tab: tabs[0] });
        } else {
          sendResponse({ tab: null });
        }
      });
      return true;
      
    case 'GET_CURRENT_TAB_CONTENT':
      // Get content from current active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTENT' }, (response) => {
            if (response && !chrome.runtime.lastError) {
              sendResponse(response);
            } else {
              sendResponse(null);
            }
          });
        } else {
          sendResponse(null);
        }
      });
      return true;
      
    case 'GET_TAB_CONTENT':
      // Get content from specific tab
      if (request.tabId) {
        chrome.tabs.sendMessage(request.tabId, { type: 'GET_PAGE_CONTENT' }, (response) => {
          sendResponse(response);
        });
      }
      return true;
      
    case 'GET_STORED_CONTEXTS':
      // Return all stored page contexts
      sendResponse({ contexts: Array.from(pageContexts.values()) });
      break;
      
    case 'CLEAR_CONTEXTS':
      // Clear all stored contexts
      pageContexts.clear();
      sendResponse({ success: true });
      break;
      
    case 'SAVE_CHAT_HISTORY':
      // Save chat history
      chatHistory = request.history || [];
      sendResponse({ success: true });
      break;
      
    case 'GET_CHAT_HISTORY':
      // Get chat history
      sendResponse({ history: chatHistory });
      break;
  }
});

// Clean up old contexts (keep only last 50 pages)
setInterval(() => {
  if (pageContexts.size > 50) {
    const entries = Array.from(pageContexts.entries());
    // Sort by timestamp and keep only the most recent 50
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    pageContexts.clear();
    entries.slice(0, 50).forEach(([url, data]) => {
      pageContexts.set(url, data);
    });
    console.log('Cleaned up old contexts, keeping 50 most recent');
  }
}, 300000); // Run every 5 minutes
