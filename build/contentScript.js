/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
/*!******************************!*\
  !*** ./src/contentScript.js ***!
  \******************************/
// Content script for Snip Chrome Extension
// This script runs in the context of web pages and handles:
// - Page content extraction
// - Communication with the sidebar
// - Tab/link context management

console.log('Snip: Content script loaded');

// Track current page info
let currentPageData = {
  url: window.location.href,
  title: document.title,
  content: '',
  timestamp: Date.now()
};

// Extract favicon URL from the page
const extractFavicon = () => {
  // Try to find favicon link tag
  let faviconUrl = null;
  
  // Look for various favicon link tags
  const faviconSelectors = [
    'link[rel*="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="icon"]'
  ];
  
  for (const selector of faviconSelectors) {
    const link = document.querySelector(selector);
    if (link && link.getAttribute('href')) {
      faviconUrl = link.getAttribute('href');
      // Convert relative URLs to absolute
      if (faviconUrl && !faviconUrl.startsWith('http')) {
        faviconUrl = new URL(faviconUrl, window.location.href).href;
      }
      break;
    }
  }
  
  // Fallback to default favicon.ico
  if (!faviconUrl) {
    const url = new URL(window.location.href);
    faviconUrl = `${url.protocol}//${url.host}/favicon.ico`;
  }
  
  return faviconUrl;
};

// Extract page content for LLM context
const extractPageContent = () => {
  try {
    // Get full HTML content including structure, links, etc.
    let content = '';
    
    // Try to get main content areas first (article, main, content areas)
    const mainSelectors = [
      'main',
      'article', 
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '#main'
    ];
    
    let mainElement = null;
    for (const selector of mainSelectors) {
      mainElement = document.querySelector(selector);
      if (mainElement) break;
    }
    
    // If we found a main content area, use that, otherwise use body
    const targetElement = mainElement || document.body;
    
    if (targetElement) {
      // Get the full innerHTML to preserve structure and links
      content = targetElement.innerHTML || '';
      
      // Also include text content as fallback
      if (!content) {
        content = targetElement.innerText || targetElement.textContent || '';
      }
    }
    
    console.log('Snip: Extracted content details:', {
      selector: mainElement ? 'main content area' : 'document.body',
      contentLength: content.length,
      url: window.location.href,
      title: document.title
    });
    
    // Clean up content - remove script tags and excessive whitespace
    let cleanContent = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return {
      url: window.location.href,
      title: document.title,
      content: cleanContent,
      favicon: extractFavicon(),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Snip: Error extracting page content:', error);
    
    // Fallback to basic text extraction
    const fallbackContent = document.body ? (document.body.innerText || document.body.textContent || '') : '';
    
    return {
      url: window.location.href,
      title: document.title,
      content: fallbackContent.replace(/\s+/g, ' ').trim(),
      favicon: extractFavicon(),
      timestamp: Date.now()
    };
  }
};

// Send page data to extension
const sendPageData = (data) => {
  chrome.runtime.sendMessage({
    type: 'PAGE_DATA',
    data: data
  });
};

// Listen for messages from extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PAGE_CONTENT') {
    const pageData = extractPageContent();
    sendResponse(pageData);
  } else if (request.type === 'ADD_CURRENT_PAGE') {
    const pageData = extractPageContent();
    sendPageData(pageData);
    sendResponse({ success: true });
  }
});

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
  console.log('Snip: Page loaded, ready to extract content');
  currentPageData = extractPageContent();
});

// Handle navigation changes
let lastUrl = window.location.href;
const checkForNavigation = () => {
  if (lastUrl !== window.location.href) {
    console.log('Snip: Navigation detected');
    lastUrl = window.location.href;
    currentPageData = extractPageContent();
  }
};

// Check for navigation changes periodically
setInterval(checkForNavigation, 1000);
/******/ })()
;
//# sourceMappingURL=contentScript.js.map