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

// Extract page content for LLM context
const extractPageContent = () => {
  // Get main content, avoiding navigation, ads, etc.
  const content = document.body.innerText || document.body.textContent || '';
  
  // Clean up content - remove extra whitespace
  const cleanContent = content.replace(/\s+/g, ' ').trim();
  
  return {
    url: window.location.href,
    title: document.title,
    content: cleanContent,
    timestamp: Date.now()
  };
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