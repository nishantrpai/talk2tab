// Background script for LLM Agent Chrome Extension
// Handles extension lifecycle, tab management, and data storage

console.log('LLM Agent: Background script loaded');

// Storage for page contexts and visited links
let pageContexts = new Map();
let chatHistory = [];

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('LLM Agent: Extension installed');
  
  // Set up side panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
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

// Listen for tab updates to automatically capture page content
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Give the page a moment to load, then extract content
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' }, (response) => {
        if (response && !chrome.runtime.lastError) {
          pageContexts.set(response.url, response);
          console.log('Auto-captured page content for:', response.url);
        }
      });
    }, 2000);
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
