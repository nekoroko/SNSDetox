// Default settings
const DEFAULT_SETTINGS = {
  sites: [
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "tiktok.com",
    "linkedin.com"
  ],
  grayscaleTime: 15, // minutes
  blockTime: 45      // minutes
};

// Current settings (will be updated from storage)
let settings = { ...DEFAULT_SETTINGS };

// Time thresholds in milliseconds (will be updated from settings)
let GRAYSCALE_THRESHOLD = settings.grayscaleTime * 60 * 1000;
let BLOCK_THRESHOLD = settings.blockTime * 60 * 1000;

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get('settings', (result) => {
    if (result.settings) {
      settings = result.settings;
      
      // Update thresholds
      GRAYSCALE_THRESHOLD = settings.grayscaleTime * 60 * 1000;
      BLOCK_THRESHOLD = settings.blockTime * 60 * 1000;
    }
  });
}

// Load settings when extension starts
loadSettings();

// Store usage data for each tab
const tabData = {};

// Check if a URL is an SNS site
function isSNSSite(url) {
  if (!url) return false;
  return settings.sites.some(site => url.includes(site));
}

// Initialize tab data when a new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id && isSNSSite(tab.url)) {
    initTabData(tab.id, tab.url);
  }
});

// Update tab data when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isSNSSite(tab.url)) {
    initTabData(tabId, tab.url);
  }
});

// Track active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId } = activeInfo;
  
  // Pause all other tabs
  Object.keys(tabData).forEach((id) => {
    if (parseInt(id) !== tabId && tabData[id].isActive) {
      pauseTracking(parseInt(id));
    }
  });
  
  // Get the tab URL
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isSNSSite(tab.url)) {
      // Resume or initialize tracking for this tab
      if (tabData[tabId]) {
        resumeTracking(tabId);
      } else {
        initTabData(tabId, tab.url);
      }
    }
  } catch (error) {
    console.error("Error getting tab:", error);
  }
});

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabData[tabId]) {
    clearInterval(tabData[tabId].intervalId);
    delete tabData[tabId];
  }
});

// Initialize tracking data for a tab
function initTabData(tabId, url) {
  // Clear any existing interval
  if (tabData[tabId] && tabData[tabId].intervalId) {
    clearInterval(tabData[tabId].intervalId);
  }
  
  tabData[tabId] = {
    url: url,
    startTime: Date.now(),
    totalTime: 0,
    lastActiveTime: Date.now(),
    isActive: true,
    status: 'normal', // 'normal', 'grayscale', or 'blocked'
    intervalId: setInterval(() => updateTabTime(tabId), 1000) // Update every second
  };
  
  // Apply any existing restrictions based on stored data
  chrome.storage.local.get([url], (result) => {
    if (result[url]) {
      const storedData = result[url];
      tabData[tabId].totalTime = storedData.totalTime || 0;
      
      // Apply appropriate restrictions based on stored time
      applyRestrictions(tabId);
    }
  });
}

// Update time tracking for a tab
function updateTabTime(tabId) {
  if (!tabData[tabId] || !tabData[tabId].isActive) return;
  
  const now = Date.now();
  const elapsed = now - tabData[tabId].lastActiveTime;
  tabData[tabId].totalTime += elapsed;
  tabData[tabId].lastActiveTime = now;
  
  // Save the updated time to storage
  const url = tabData[tabId].url;
  chrome.storage.local.set({
    [url]: {
      totalTime: tabData[tabId].totalTime,
      lastUpdated: now
    }
  });
  
  // Apply restrictions based on total time
  applyRestrictions(tabId);
}

// Apply time-based restrictions
function applyRestrictions(tabId) {
  if (!tabData[tabId]) return;
  
  const totalTime = tabData[tabId].totalTime;
  let newStatus = 'normal';
  
  if (totalTime >= BLOCK_THRESHOLD) {
    newStatus = 'blocked';
  } else if (totalTime >= GRAYSCALE_THRESHOLD) {
    newStatus = 'grayscale';
  }
  
  // Only send a message if the status has changed
  if (newStatus !== tabData[tabId].status) {
    tabData[tabId].status = newStatus;
    
    // Send message to content script
    chrome.tabs.sendMessage(tabId, {
      action: 'updateRestriction',
      status: newStatus
    }).catch(error => {
      console.error("Error sending message to content script:", error);
    });
  }
}

// Pause time tracking for a tab
function pauseTracking(tabId) {
  if (tabData[tabId]) {
    // Update the total time before pausing
    const now = Date.now();
    const elapsed = now - tabData[tabId].lastActiveTime;
    tabData[tabId].totalTime += elapsed;
    tabData[tabId].isActive = false;
    
    // Save to storage
    const url = tabData[tabId].url;
    chrome.storage.local.set({
      [url]: {
        totalTime: tabData[tabId].totalTime,
        lastUpdated: now
      }
    });
  }
}

// Resume time tracking for a tab
function resumeTracking(tabId) {
  if (tabData[tabId]) {
    tabData[tabId].lastActiveTime = Date.now();
    tabData[tabId].isActive = true;
    
    // Apply any existing restrictions
    applyRestrictions(tabId);
  }
}

// Reset usage data (can be triggered from popup)
function resetUsageData(url) {
  chrome.storage.local.remove(url);
  
  // Reset any active tabs with this URL
  Object.keys(tabData).forEach((tabId) => {
    if (tabData[tabId].url === url) {
      tabData[tabId].totalTime = 0;
      tabData[tabId].startTime = Date.now();
      tabData[tabId].lastActiveTime = Date.now();
      tabData[tabId].status = 'normal';
      
      // First send updateRestriction message
      chrome.tabs.sendMessage(parseInt(tabId), {
        action: 'updateRestriction',
        status: 'normal'
      }).catch(error => {
        console.error("Error sending reset message to content script:", error);
      });
      
      // Then send resetComplete message to ensure proper cleanup
      chrome.tabs.sendMessage(parseInt(tabId), {
        action: 'resetComplete'
      }).catch(error => {
        console.error("Error sending reset completion message to content script:", error);
      });
    }
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStatus') {
    // Return status for a specific tab
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    if (tabData[tabId]) {
      sendResponse({
        status: tabData[tabId].status,
        totalTime: tabData[tabId].totalTime
      });
    } else {
      sendResponse({ status: 'normal', totalTime: 0 });
    }
    return true;
  } else if (message.action === 'resetData') {
    // Reset data for a specific URL
    resetUsageData(message.url);
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'settingsUpdated') {
    // Update settings
    settings = message.settings;
    
    // Update thresholds
    GRAYSCALE_THRESHOLD = settings.grayscaleTime * 60 * 1000;
    BLOCK_THRESHOLD = settings.blockTime * 60 * 1000;
    
    // Re-evaluate all tabs with the new settings
    Object.keys(tabData).forEach((tabId) => {
      applyRestrictions(parseInt(tabId));
    });
    
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'resetAllData') {
    // Reset all usage data
    chrome.storage.local.clear();
    
    // Reset all tab data
    Object.keys(tabData).forEach((tabId) => {
      tabData[tabId].totalTime = 0;
      tabData[tabId].startTime = Date.now();
      tabData[tabId].lastActiveTime = Date.now();
      tabData[tabId].status = 'normal';
      
      // Update the content script
      chrome.tabs.sendMessage(parseInt(tabId), {
        action: 'updateRestriction',
        status: 'normal'
      }).catch(error => {
        console.error("Error sending reset message to content script:", error);
      });
    });
    
    sendResponse({ success: true });
    return true;
  }
});

// Listen for installation or update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on install
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    
    // Open options page on install
    chrome.runtime.openOptionsPage();
  }
});
