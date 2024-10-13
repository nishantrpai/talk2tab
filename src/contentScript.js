// Content script file will run in the context of web page.
// With content script you can manipulate the web pages using
// Document Object Model (DOM).
// You can also pass information to the parent extension.

// We execute this script by making an entry in manifest.json file
// under `content_scripts` property

// For more information on Content Scripts,
// See https://developer.chrome.com/extensions/content_scripts

// Log `title` of current active web page
console.log("Content script loaded for xlinks");

// @ts-ignore
let windowurl = window.location.href;
let isProcessing = false;

const replaceSpacedLinks = (text) => {
  console.log("Replacing spaced links");
  const domainRegex = /(?<!\S)([a-zA-Z0-9-]+(?:\s*\.\s*[a-zA-Z0-9-]+)+(?:\s*\/\s*[a-zA-Z0-9-]+)*)\b/g;
  return text.replace(domainRegex, (match, p1, offset, string) => {
    // Check if the match is already part of a link
    const beforeMatch = string.substring(0, offset);
    const afterMatch = string.substring(offset + match.length);
    if (beforeMatch.lastIndexOf('<a') > beforeMatch.lastIndexOf('</a') ||
        afterMatch.indexOf('</a') < afterMatch.indexOf('<a')) {
      // If it's part of an existing link, return the original match
      return match;
    }
    const url = match.replace(/\s+/g, '');
    console.log("Replaced link:", match, "with:", url);
    return `<a href="https://${url}" style="color: #1DA1F2; text-decoration: inherit;" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
};

const renderTweet = (tweetElement) => {
  if (tweetElement instanceof HTMLElement && !tweetElement.dataset.processed) {
    const tweetText = tweetElement.querySelector('[data-testid="tweetText"]');
    const tweetImage = tweetElement.querySelector('[data-testid="tweetPhoto"]');

    if (tweetText) {
      const originalText = tweetText.innerHTML || '';
      const replacedText = replaceSpacedLinks(originalText);
      tweetText.innerHTML = replacedText;
    }

    if (tweetImage && tweetImage instanceof HTMLElement) {
      tweetImage.style.display = 'block';
    }

    tweetElement.dataset.processed = 'true';
  }
};

const main = () => {
  if (isProcessing) return;
  isProcessing = true;
  console.log("Main function called");

  const tweets = document.querySelectorAll('[data-testid="tweet"]');
  for (const tweet of tweets) {
    console.log("Processing tweet", tweet);
    renderTweet(tweet);
  }

  console.log("Tweets processed");
  isProcessing = false;
};

const checkMutations = () => {
  console.log("Setting up mutation observer");
  let observer = new MutationObserver((mutations, observer) => {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    if (tweets.length > 0) {
      const visibleTweets = Array.from(tweets).filter(tweet => {
        const rect = tweet.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      });
      
      if (visibleTweets.length > 0) {
        console.log("Visible tweets detected, calling main function");
        main();
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: false
  });
};

checkMutations();

window.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded");
  main();
});

window.addEventListener('popstate', () => {
  console.log("Route changed");
  main();
});

window.addEventListener("click", () => {
  requestAnimationFrame(() => {
    if (windowurl !== window.location.href) {
      console.log("URL changed");
      windowurl = window.location.href;
      main();
    }
  });
}, true);

window.addEventListener('beforeunload', () => {
  console.log("Page unloading");
});

window.addEventListener('hashchange', () => {
  console.log("Hash changed");
  main();
});