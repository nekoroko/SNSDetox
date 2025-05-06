// Initialize variables
let currentStatus = 'normal';
let styleElement = null;
let timerElement = null;
let timerInterval = null;

// Create a style element for CSS modifications
function createStyleElement() {
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'sns-detox-style';
    document.head.appendChild(styleElement);
  }
  return styleElement;
}

// Apply grayscale effect to the page
function applyGrayscale() {
  const style = createStyleElement();
  
  // Simplified CSS that won't interfere with scrolling
  style.textContent = `
    html {
      filter: grayscale(100%) !important;
      -webkit-filter: grayscale(100%) !important;
    }
  `;
  
  // Add a notification banner
  showNotification('grayscale');
  
  // Add scroll event listener to ensure grayscale persists during scrolling
  if (!window.snsDetoxScrollHandler) {
    window.snsDetoxScrollHandler = () => {
      // Ensure the style element still exists and has content
      if (!styleElement || !styleElement.textContent) {
        applyGrayscale();
      }
    };
    
    // Add passive listener for better performance
    window.addEventListener('scroll', window.snsDetoxScrollHandler, { passive: true });
  }
}

// Block the page content
async function blockPage() {
  // Get current settings
  const settings = await getSettings();
  
  // Create a full-page overlay
  let overlay = document.getElementById('sns-detox-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sns-detox-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.9);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: white;
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 20px;
    `;
    
    const message = document.createElement('h1');
    message.textContent = 'SNS Access Blocked';
    message.style.cssText = 'margin-bottom: 20px; font-size: 24px;';
    
    const description = document.createElement('p');
    description.textContent = `You have reached your ${settings.blockTime}-minute time limit for this site today.`;
    description.style.cssText = 'margin-bottom: 30px; font-size: 18px;';
    
    const suggestion = document.createElement('p');
    suggestion.textContent = 'Consider doing something else, like taking a walk, reading a book, or working on a project.';
    suggestion.style.cssText = 'margin-bottom: 40px; font-size: 16px;';
    
    // Add a reset button (optional)
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Timer (Emergency Only)';
    resetButton.style.cssText = `
      padding: 10px 20px;
      background-color: #e74c3c;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 20px;
    `;
    resetButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'resetData',
        url: window.location.href
      }, (response) => {
        if (response && response.success) {
          removeOverlay();
          removeGrayscale();
          currentStatus = 'normal';
        }
      });
    });
    
    overlay.appendChild(message);
    overlay.appendChild(description);
    overlay.appendChild(suggestion);
    overlay.appendChild(resetButton);
    
    document.body.appendChild(overlay);
    
    // Prevent scrolling
    document.body.style.overflow = 'hidden';
  }
}

// Remove the overlay
function removeOverlay() {
  const overlay = document.getElementById('sns-detox-overlay');
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
}

// Remove grayscale effect
function removeGrayscale() {
  // Remove the style
  if (styleElement) {
    styleElement.textContent = '';
  }
  
  // Remove scroll event listener
  if (window.snsDetoxScrollHandler) {
    window.removeEventListener('scroll', window.snsDetoxScrollHandler);
    window.snsDetoxScrollHandler = null;
  }
  
  // Remove notification if present
  const notification = document.getElementById('sns-detox-notification');
  if (notification) {
    notification.remove();
  }
}

// Format milliseconds to MM:SS
function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Create and show the timer element
function createTimer() {
  // Remove existing timer if any
  removeTimer();
  
  // Create timer element
  timerElement = document.createElement('div');
  timerElement.id = 'sns-detox-timer';
  timerElement.style.cssText = `
    position: fixed;
    top: 60px;
    left: 10px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    z-index: 2147483645;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  `;
  
  document.body.appendChild(timerElement);
  
  // Start timer update interval
  startTimerUpdate();
}

// Start updating the timer
function startTimerUpdate() {
  // Clear any existing interval
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Get initial status
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response && response.totalTime) {
      updateTimerDisplay(response.totalTime);
      
      // Update timer every second
      timerInterval = setInterval(() => {
        chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
          if (response && response.totalTime) {
            updateTimerDisplay(response.totalTime);
          }
        });
      }, 1000);
    }
  });
}

// Update the timer display
function updateTimerDisplay(totalTime) {
  if (timerElement) {
    timerElement.textContent = formatTime(totalTime);
  }
}

// Remove the timer
function removeTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  if (timerElement) {
    timerElement.remove();
    timerElement = null;
  }
}

// Get domain from URL
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Extract the domain (e.g., facebook.com from www.facebook.com)
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts.slice(parts.length - 2).join('.');
    }
    return hostname;
  } catch (error) {
    console.error("Error parsing URL:", error);
    return null;
  }
}

// Get settings from storage
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result) => {
      if (result.settings) {
        // Get the current domain
        const domain = getDomainFromUrl(window.location.href);
        
        // Find site-specific settings
        const siteSettings = result.settings.sites.find(site => 
          domain && domain.includes(site.domain)
        );
        
        if (siteSettings) {
          // Return site-specific settings
          resolve({
            grayscaleTime: siteSettings.grayscaleTime,
            blockTime: siteSettings.blockTime,
            domain: siteSettings.domain
          });
        } else {
          // Return default settings if no site-specific settings found
          resolve({
            grayscaleTime: result.settings.defaultGrayscaleTime,
            blockTime: result.settings.defaultBlockTime,
            domain: domain
          });
        }
      } else {
        // Default settings if not found
        resolve({
          grayscaleTime: 15,
          blockTime: 45,
          domain: getDomainFromUrl(window.location.href)
        });
      }
    });
  });
}

// Show a notification banner
async function showNotification(type) {
  // Remove any existing notification
  const existingNotification = document.getElementById('sns-detox-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Get current settings
  const settings = await getSettings();
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'sns-detox-notification';
  
  let message = '';
  let backgroundColor = '';
  
  if (type === 'grayscale') {
    message = `You have been using this site for ${settings.grayscaleTime} minutes. Screen is now grayscale.`;
    backgroundColor = '#f39c12'; // Orange/yellow warning color
  } else if (type === 'blocked') {
    message = `You have reached your ${settings.blockTime}-minute time limit for this site.`;
    backgroundColor = '#e74c3c'; // Red for blocked
  }
  
  notification.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    padding: 10px;
    background-color: ${backgroundColor};
    color: white;
    text-align: center;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 2147483646;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-hide after 10 seconds if it's just a grayscale notification
  if (type === 'grayscale') {
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 1s ease';
        setTimeout(() => {
          if (notification && notification.parentNode) {
            notification.remove();
          }
        }, 1000);
      }
    }, 10000);
  }
}

// Update the page based on restriction status
function updateRestriction(status) {
  // Always process if status is 'normal' (reset case)
  // Otherwise, only process if the status has changed
  if (status !== 'normal' && status === currentStatus) return;
  
  currentStatus = status;
  
  // Remove all restrictions first
  removeGrayscale();
  removeOverlay();
  
  // Apply the appropriate restriction
  if (status === 'grayscale') {
    applyGrayscale();
  } else if (status === 'blocked') {
    blockPage();
    // We can still apply grayscale in the background
    applyGrayscale();
  }
  // For 'normal' status, we've already removed all restrictions
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateRestriction') {
    updateRestriction(message.status);
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'resetComplete') {
    // Handle reset completion
    removeGrayscale();
    removeOverlay();
    currentStatus = 'normal';
    sendResponse({ success: true });
    return true;
  }
});

// Check if a URL is an SNS site
async function checkIfSNSSite(url) {
  if (!url) return false;
  const domain = getDomainFromUrl(url);
  if (!domain) return false;
  
  try {
    // Get settings from storage
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get('settings', (result) => {
        resolve(result.settings);
      });
    });
    
    // Check if the domain is in the monitored sites list
    if (settings && settings.sites && Array.isArray(settings.sites)) {
      return settings.sites.some(site => domain.includes(site.domain));
    }
  } catch (error) {
    console.error("Error checking if site is SNS:", error);
  }
  
  return false;
}

// Check current status when the page loads
window.addEventListener('load', async () => {
  // Get current status
  chrome.runtime.sendMessage({ action: 'getStatus' }, async (response) => {
    if (response) {
      updateRestriction(response.status);
      
      // Check if this is an SNS site
      const isSNS = await checkIfSNSSite(window.location.href);
      
      // Create and show timer if on an SNS site
      if (isSNS) {
        createTimer();
      }
    }
  });
});

// Make sure the restrictions are applied even if the page was already loaded
// when the extension was activated
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  chrome.runtime.sendMessage({ action: 'getStatus' }, async (response) => {
    if (response) {
      updateRestriction(response.status);
      
      // Check if this is an SNS site
      const isSNS = await checkIfSNSSite(window.location.href);
      
      // Create and show timer if on an SNS site
      if (isSNS) {
        createTimer();
      }
    }
  });
}
