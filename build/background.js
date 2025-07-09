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
      
      // Function to try getting page content with fallback to script injection
      const getPageContentWithFallback = () => {
        // First attempt - try to communicate with existing content script
        chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not available, injecting manually:', chrome.runtime.lastError.message);
            
            // Content script not available, inject it manually
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['contentScript.js']
            }).then(() => {
              console.log('Content script injected successfully');
              
              // Wait a moment for script to initialize, then try again
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, (response) => {
                  if (response && !chrome.runtime.lastError) {
                    // Success after injection
                    pageContexts.set('current_tab', response);
                    console.log('Auto-updated context after injection:', response.url);
                    
                    chrome.runtime.sendMessage({ 
                      type: 'CONTEXT_UPDATED', 
                      context: response 
                    }).catch(() => {});
                  } else {
                    console.log('Still no response after injection');
                    chrome.runtime.sendMessage({ 
                      type: 'CONTEXT_UPDATED', 
                      context: null 
                    }).catch(() => {});
                  }
                });
              }, 1000);
              
            }).catch((error) => {
              console.log('Failed to inject content script:', error);
              chrome.runtime.sendMessage({ 
                type: 'CONTEXT_UPDATED', 
                context: null 
              }).catch(() => {});
            });
            
          } else if (response) {
            // Success on first try
            pageContexts.set('current_tab', response);
            console.log('Auto-updated context for tab switch:', response.url);
            
            chrome.runtime.sendMessage({ 
              type: 'CONTEXT_UPDATED', 
              context: response 
            }).catch(() => {});
          }
        });
      };
      
      // Wait a moment for page to be ready, then try to get content
      setTimeout(getPageContentWithFallback, 1000);
      
    } else {
      console.log('Skipping non-web page:', tab.url);
      
      // For non-web pages, clear the current context and notify sidebar
      pageContexts.delete('current_tab');
      chrome.runtime.sendMessage({ 
        type: 'CONTEXT_UPDATED', 
        context: null 
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

// Handle tab updates (when a tab's URL changes, like navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('Tab updated:', tabId, 'changeInfo:', changeInfo, 'tab URL:', tab.url);
  
  // Process when the tab is completely loaded 
  if (changeInfo.status === 'complete' && tab.url && 
      (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    
    console.log('Tab completed loading with URL:', tab.url);
    
    // Check if this is the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      if (activeTabs[0] && activeTabs[0].id === tabId) {
        console.log('This is the active tab, updating context for navigation to:', tab.url);
        
        // This is the active tab, update context with fallback injection
        const getPageContentWithFallback = () => {
          console.log('Attempting to get page content for navigation...');
          chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Content script not available for URL change, injecting...', chrome.runtime.lastError.message);
              
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['contentScript.js']
              }).then(() => {
                console.log('Content script injected for navigation');
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' }, (response) => {
                    if (response && !chrome.runtime.lastError) {
                      pageContexts.set('current_tab', response);
                      console.log('Auto-updated context for URL change after injection:', response.url);
                      
                      chrome.runtime.sendMessage({ 
                        type: 'CONTEXT_UPDATED', 
                        context: response 
                      }).catch(() => {});
                    } else {
                      console.log('No response after injection for URL change');
                      chrome.runtime.sendMessage({ 
                        type: 'CONTEXT_UPDATED', 
                        context: null 
                      }).catch(() => {});
                    }
                  });
                }, 1500); // Longer wait after injection for navigation
              }).catch((error) => {
                console.log('Failed to inject content script for URL change:', error);
                chrome.runtime.sendMessage({ 
                  type: 'CONTEXT_UPDATED', 
                  context: null 
                }).catch(() => {});
              });
            } else if (response) {
              pageContexts.set('current_tab', response);
              console.log('Auto-updated context for URL change:', response.url);
              
              chrome.runtime.sendMessage({ 
                type: 'CONTEXT_UPDATED', 
                context: response 
              }).catch(() => {});
            } else {
              console.log('No response from content script for URL change');
              chrome.runtime.sendMessage({ 
                type: 'CONTEXT_UPDATED', 
                context: null 
              }).catch(() => {});
            }
          });
        };
        
        // Wait longer for navigation to complete fully
        setTimeout(getPageContentWithFallback, 2000);
      } else {
        console.log('Not the active tab, ignoring URL change for tab:', tabId);
      }
    });
  } else if (changeInfo.status === 'complete' && tab.url && 
             (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
              tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
    // Handle non-web pages for active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      if (activeTabs[0] && activeTabs[0].id === tabId) {
        console.log('Active tab navigated to non-web page:', tab.url);
        pageContexts.delete('current_tab');
        chrome.runtime.sendMessage({ 
          type: 'CONTEXT_UPDATED', 
          context: null 
        }).catch(() => {});
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
      // Add current page to context with fallback injection
      chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Content script not available for context menu, injecting...');
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['contentScript.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, (response) => {
                if (response && !chrome.runtime.lastError) {
                  pageContexts.set(response.url, response);
                  console.log('Added page to context via context menu after injection:', response.url);
                }
              });
            }, 1000);
          }).catch(() => {
            console.log('Failed to inject content script for context menu');
          });
        } else if (response) {
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
      // Get content from current active tab with fallback injection
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
          const tabId = tabs[0].id;
          
          // Try to get content, fallback to injection if needed
          chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('GET_CURRENT_TAB_CONTENT: Content script not available, injecting...');
              
              // Inject content script and try again
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['contentScript.js']
              }).then(() => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' }, (response) => {
                    sendResponse(response || null);
                  });
                }, 1000);
              }).catch(() => {
                sendResponse(null);
              });
            } else {
              sendResponse(response || null);
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
