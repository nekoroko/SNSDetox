// Default settings
const DEFAULT_SETTINGS = {
  sites: [
    { domain: "facebook.com", grayscaleTime: 15, blockTime: 45 },
    { domain: "twitter.com", grayscaleTime: 15, blockTime: 45 },
    { domain: "instagram.com", grayscaleTime: 15, blockTime: 45 },
    { domain: "tiktok.com", grayscaleTime: 15, blockTime: 45 },
    { domain: "linkedin.com", grayscaleTime: 15, blockTime: 45 }
  ],
  defaultGrayscaleTime: 15, // minutes - used for newly added sites
  defaultBlockTime: 45      // minutes - used for newly added sites
};

// Current settings (will be updated from storage)
let settings = { ...DEFAULT_SETTINGS };

// Site-specific thresholds cache (domain -> thresholds)
const siteThresholds = new Map();

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get('settings', (result) => {
    if (chrome.runtime.lastError) {
      return;
    }
    
    if (result.settings) {
      settings = result.settings;
      
      // Update site thresholds cache
      updateSiteThresholds();
    }
  });
}

// Update the site thresholds cache
function updateSiteThresholds() {
  siteThresholds.clear();
  
  // Cache thresholds for each site
  if (!settings.sites || !Array.isArray(settings.sites)) {
    return;
  }
  
  settings.sites.forEach(site => {
    if (!site.domain) {
      return;
    }
    
    const grayscaleMs = site.grayscaleTime * 60 * 1000;
    const blockMs = site.blockTime * 60 * 1000;
    
    siteThresholds.set(site.domain, {
      grayscale: grayscaleMs,
      block: blockMs
    });
  });
}

// Load settings when extension starts
loadSettings();

// Store usage data for each tab
const tabData = {};

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

// Check if a URL is an SNS site
function isSNSSite(url) {
  if (!url) return false;
  const domain = getDomainFromUrl(url);
  return settings.sites.some(site => domain && domain.includes(site.domain));
}

// Get thresholds for a specific URL
function getThresholdsForUrl(url) {
  const domain = getDomainFromUrl(url);
  
  if (!domain) {
    const defaultThresholds = {
      grayscale: settings.defaultGrayscaleTime * 60 * 1000,
      block: settings.defaultBlockTime * 60 * 1000
    };
    return defaultThresholds;
  }
  
  // Find the matching site in settings
  for (const site of settings.sites) {
    if (domain.includes(site.domain)) {
      const thresholds = {
        grayscale: site.grayscaleTime * 60 * 1000,
        block: site.blockTime * 60 * 1000
      };
      return thresholds;
    }
  }
  
  // Return default thresholds if no match found
  const defaultThresholds = {
    grayscale: settings.defaultGrayscaleTime * 60 * 1000,
    block: settings.defaultBlockTime * 60 * 1000
  };
  return defaultThresholds;
}

// Initialize tab data when a new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id && isSNSSite(tab.url)) {
    const domain = getDomainFromUrl(tab.url);
    
    // Check if this domain has an active restriction
    if (domain) {
      chrome.storage.local.get([`${domain}_restriction`], (result) => {
        const restriction = result[`${domain}_restriction`];
        
        if (restriction && restriction.endTime > Date.now()) {
          // There's an active restriction, initialize with tracking paused
          console.log(`New tab ${tab.id} has an active restriction, initializing with tracking paused`);
          initTabData(tab.id, tab.url, true); // Initialize with paused=true
        } else {
          // No active restriction, initialize normally
          initTabData(tab.id, tab.url);
        }
      });
    } else {
      // No domain, initialize normally
      initTabData(tab.id, tab.url);
    }
  }
});

// Update tab data when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isSNSSite(tab.url)) {
    const domain = getDomainFromUrl(tab.url);
    
    // Check if this domain has an active restriction
    if (domain) {
      chrome.storage.local.get([`${domain}_restriction`], (result) => {
        const restriction = result[`${domain}_restriction`];
        
        if (restriction && restriction.endTime > Date.now()) {
          // There's an active restriction, initialize with tracking paused
          console.log(`Updated tab ${tabId} has an active restriction, initializing with tracking paused`);
          initTabData(tabId, tab.url, true); // Initialize with paused=true
        } else {
          // No active restriction, initialize normally
          initTabData(tabId, tab.url);
        }
      });
    } else {
      // No domain, initialize normally
      initTabData(tabId, tab.url);
    }
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
      const domain = getDomainFromUrl(tab.url);
      
      // Check if this domain has an active restriction
      if (domain) {
        chrome.storage.local.get([`${domain}_restriction`], (result) => {
          const restriction = result[`${domain}_restriction`];
          
          if (restriction && restriction.endTime > Date.now()) {
            // There's an active restriction, don't resume tracking
            console.log(`Tab ${tabId} has an active restriction, not resuming tracking`);
            
            // Make sure tracking is paused for this tab
            if (tabData[tabId] && tabData[tabId].isActive) {
              pauseTracking(tabId);
            }
          } else {
            // No active restriction, resume or initialize tracking
            if (tabData[tabId]) {
              resumeTracking(tabId);
            } else {
              initTabData(tabId, tab.url);
            }
          }
        });
      } else {
        // No domain, resume or initialize tracking
        if (tabData[tabId]) {
          resumeTracking(tabId);
        } else {
          initTabData(tabId, tab.url);
        }
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
function initTabData(tabId, url, paused = false) {
  // Clear any existing interval
  if (tabData[tabId] && tabData[tabId].intervalId) {
    clearInterval(tabData[tabId].intervalId);
  }
  
  const now = Date.now();
  const domain = getDomainFromUrl(url);
  
  // First, preserve the existing totalTime if available
  let existingTotalTime = 0;
  if (tabData[tabId] && tabData[tabId].totalTime !== undefined) {
    existingTotalTime = tabData[tabId].totalTime;
  }
  
  // Check if this domain has an active restriction
  if (domain) {
    // First get any existing data from localStorage to preserve totalTime
    chrome.storage.local.get([domain], (domainResult) => {
      const storedData = domainResult[domain];
      const storedTotalTime = storedData && storedData.totalTime !== undefined ? storedData.totalTime : 0;
      
      // Use the maximum of existing memory value and stored value to prevent time loss
      const initialTotalTime = Math.max(existingTotalTime, storedTotalTime);
      
      // Now check for restrictions
      chrome.storage.local.get([`${domain}_restriction`], (result) => {
        const restriction = result[`${domain}_restriction`];
        const hasActiveRestriction = restriction && restriction.endTime > now;
        
        // If there's an active restriction, update only the endTime in localStorage
        if (hasActiveRestriction && restriction) {
          // Update only the endTime to ensure it's current, but preserve totalTime
          const updatedRestriction = {
            ...restriction,
            endTime: restriction.endTime // Keep the same endTime
          };
          
          chrome.storage.local.set({
            [`${domain}_restriction`]: updatedRestriction
          });
        }
        
        // Set initial status - use '禁止' status if there's an active restriction
        const initialStatus = hasActiveRestriction ? '禁止' : 'normal';
        
        // Create the tab data object first without starting the interval
        tabData[tabId] = {
          url: url,
          domain: domain, // Store the domain in tabData
          startTime: now,
          totalTime: initialTotalTime, // Use preserved totalTime instead of 0
          lastActiveTime: now,
          isActive: !paused && !hasActiveRestriction, // Set to false if paused or has restriction
          status: initialStatus, // 'normal', 'grayscale', 'blocked', or '禁止'
          intervalId: null, // Initialize with no interval
          readyForTracking: false // Flag to indicate if tracking should start
        };
        
        // Apply appropriate restrictions based on stored time
        if (!paused && !hasActiveRestriction) {
          applyRestrictions(tabId);
        }
        
        // Add a small delay before starting the interval to ensure the page is ready
        // This ensures lastActiveTime is properly set before tracking starts
        setTimeout(() => {
          // Only start interval if tab data still exists and should be active
          if (tabData[tabId] && tabData[tabId].isActive) {
            tabData[tabId].readyForTracking = true;
            tabData[tabId].lastActiveTime = Date.now(); // Update lastActiveTime to now
            tabData[tabId].intervalId = setInterval(() => updateTabTime(tabId), 500);
          }
        }, 1000); // 1 second delay to ensure page is loaded
      });
    });
  } else {
    // No domain, initialize with normal status
    // Create the tab data object first without starting the interval
    tabData[tabId] = {
      url: url,
      domain: domain, // Store the domain in tabData
      startTime: now,
      totalTime: existingTotalTime, // Use preserved totalTime instead of 0
      lastActiveTime: now,
      isActive: !paused,
      status: 'normal', // 'normal', 'grayscale', 'blocked', or '禁止'
      intervalId: null, // Initialize with no interval
      readyForTracking: false // Flag to indicate if tracking should start
    };
    
    // Add a small delay before starting the interval to ensure the page is ready
    // This ensures lastActiveTime is properly set before tracking starts
    if (!paused) {
      setTimeout(() => {
        // Only start interval if tab data still exists and should be active
        if (tabData[tabId] && tabData[tabId].isActive) {
          tabData[tabId].readyForTracking = true;
          tabData[tabId].lastActiveTime = Date.now(); // Update lastActiveTime to now
          tabData[tabId].intervalId = setInterval(() => updateTabTime(tabId), 500);
        }
      }, 1000); // 1 second delay to ensure page is loaded
    }
  }
}

// Update time tracking for a tab
function updateTabTime(tabId) {
  if (!tabData[tabId] || !tabData[tabId].isActive || !tabData[tabId].readyForTracking) {
    return;
  }
  
  const url = tabData[tabId].url;
  const domain = getDomainFromUrl(url);
  
  // Check if this domain has an active restriction
  if (domain) {
    chrome.storage.local.get([`${domain}_restriction`], (result) => {
      const restriction = result[`${domain}_restriction`];
      
      if (restriction && restriction.endTime > Date.now()) {
        // There's an active restriction, pause tracking
        pauseTracking(tabId);
        return;
      } else {
        // No active restriction, proceed with updating time
        updateTabTimeInternal(tabId, domain);
      }
    });
  } else {
    // No domain, proceed with updating time
    updateTabTimeInternal(tabId, domain);
  }
}

// Internal function to update time tracking
function updateTabTimeInternal(tabId, domain) {
  if (!tabData[tabId] || !tabData[tabId].isActive || !tabData[tabId].readyForTracking) {
    return;
  }
  
  // Check if the domain has a 禁止 status in localStorage
  if (domain) {
    chrome.storage.local.get([`${domain}_restriction`], (result) => {
      const restriction = result[`${domain}_restriction`];
      
      if (restriction && restriction.status === '禁止') {
        return;
      }
      
      // Also check the domain data itself for 禁止 status
      chrome.storage.local.get([domain], (domainResult) => {
        const domainData = domainResult[domain];
        
        if (domainData && domainData.status === '禁止') {
          return;
        }
        
        // No 禁止 status in localStorage, proceed with updating time
        updateTabTimeActual(tabId, domain);
      });
    });
  } else {
    // No domain, check tab status in memory
    if (tabData[tabId].status === '禁止') {
      return;
    }
    
    // No 禁止 status, proceed with updating time
    updateTabTimeActual(tabId, domain);
  }
}

// Actual function to update time tracking
function updateTabTimeActual(tabId, domain) {
  if (!tabData[tabId] || !tabData[tabId].isActive || !tabData[tabId].readyForTracking) {
    return;
  }
  
  // Check if the window is focused before counting time
  chrome.windows.getCurrent((currentWindow) => {
    if (!currentWindow.focused) {
      // Window is not focused, just update lastActiveTime without counting elapsed time
      tabData[tabId].lastActiveTime = Date.now();
      return;
    }
    
    const now = Date.now();
    const elapsed = now - tabData[tabId].lastActiveTime;
    
    tabData[tabId].totalTime += elapsed;
    tabData[tabId].lastActiveTime = now;
    
    // Use stored domain if available, otherwise use the provided domain
    const domainToUse = tabData[tabId].domain || domain;
  
    // Save the updated time to storage by domain
    if (domainToUse) {
      // Check if the domain has a status in localStorage
      chrome.storage.local.get([domainToUse], (result) => {
        // If the domain exists in localStorage and has a 禁止 status, don't update
        if (result[domainToUse] && result[domainToUse].status === '禁止') {
          return;
        }
        
        // Also check the restriction status
        chrome.storage.local.get([`${domainToUse}_restriction`], (restrictionResult) => {
          const restriction = restrictionResult[`${domainToUse}_restriction`];
          
          // If there's a restriction with 禁止 status, don't update
          if (restriction && restriction.status === '禁止') {
            return;
          }
          
          // No 禁止 status, update storage
          const dataToStore = {
            totalTime: tabData[tabId].totalTime,
            lastUpdated: now,
            status: tabData[tabId].status // Store the status in localStorage
          };
          
          chrome.storage.local.set({
            [domainToUse]: dataToStore
          });
        });
      });
    }
    
    // Apply restrictions based on total time
    applyRestrictions(tabId);
  });
}

// Apply time-based restrictions
function applyRestrictions(tabId) {
  if (!tabData[tabId]) {
    return;
  }
  
  const totalTime = tabData[tabId].totalTime;
  const url = tabData[tabId].url;
  
  // Use stored domain if available, otherwise extract from URL
  const domain = tabData[tabId].domain || getDomainFromUrl(url);
  const thresholds = getThresholdsForUrl(url);
  
  let newStatus = 'normal';
  
  if (totalTime >= thresholds.block) {
    newStatus = 'blocked';
  } else if (totalTime >= thresholds.grayscale) {
    newStatus = 'grayscale';
  }
  
  // Only send a message if the status has changed
  if (newStatus !== tabData[tabId].status) {
    tabData[tabId].status = newStatus;
    
    // Update the status in localStorage for the domain
    if (domain) {
      chrome.storage.local.get([domain], (result) => {
        if (result[domain]) {
          const domainData = result[domain];
          
          // Update the status
          const dataToStore = {
            ...domainData,
            status: newStatus
          };
          
          chrome.storage.local.set({
            [domain]: dataToStore
          });
        } else {
          // Create new entry with status
          chrome.storage.local.set({
            [domain]: {
              totalTime: tabData[tabId].totalTime,
              lastUpdated: Date.now(),
              status: newStatus
            }
          });
        }
      });
    }
    
    // Send message to content script for this specific tab only
    try {
      chrome.tabs.sendMessage(tabId, {
        action: 'updateRestriction',
        status: newStatus
      });
    } catch (error) {
      console.error("Error sending message to content script:", error);
    }
  }
}

// Pause time tracking for a tab
function pauseTracking(tabId) {
  if (!tabData[tabId]) {
    return;
  }
  
  // Only update time if tracking was active and ready
  if (tabData[tabId].isActive && tabData[tabId].readyForTracking) {
    // Update the total time before pausing
    const now = Date.now();
    const elapsed = now - tabData[tabId].lastActiveTime;
    
    tabData[tabId].totalTime += elapsed;
  }
  
  tabData[tabId].isActive = false;
  tabData[tabId].readyForTracking = false;
  
  // Clear the interval to ensure no time is counted
  if (tabData[tabId].intervalId) {
    clearInterval(tabData[tabId].intervalId);
    tabData[tabId].intervalId = null;
  }
  
  // Save to storage by domain - use stored domain if available
  const url = tabData[tabId].url;
  const domain = tabData[tabId].domain || getDomainFromUrl(url);
  
  if (domain) {
    // Get existing data first
    chrome.storage.local.get([domain], (result) => {
      const existingData = result[domain] || {};
      
      // Update with new data, preserving status if it exists
      const dataToStore = {
        ...existingData,
        totalTime: tabData[tabId].totalTime,
        lastUpdated: Date.now(),
        status: tabData[tabId].status // Store the current status
      };
      
      chrome.storage.local.set({
        [domain]: dataToStore
      });
    });
  }
}

// Resume time tracking for a tab
function resumeTracking(tabId) {
  if (!tabData[tabId]) {
    return;
  }
  
  const url = tabData[tabId].url;
  const domain = getDomainFromUrl(url);
  
  // Check if this domain has a 禁止 status in localStorage
  if (domain) {
    chrome.storage.local.get([domain], (result) => {
      const domainData = result[domain];
      
      if (domainData && domainData.status === '禁止') {
        return;
      }
      
      // Also check for active restrictions
      chrome.storage.local.get([`${domain}_restriction`], (restrictionResult) => {
        const restriction = restrictionResult[`${domain}_restriction`];
        
        if (restriction && restriction.endTime > Date.now()) {
          return;
        }
        
        // No 禁止 status in localStorage and no active restriction, proceed with resuming
        resumeTrackingInternal(tabId);
      });
    });
  } else {
    // No domain, check in-memory status
    if (tabData[tabId].status === '禁止') {
      return;
    }
    
    // No 禁止 status, proceed with resuming
    resumeTrackingInternal(tabId);
  }
}

// Internal function to resume tracking
function resumeTrackingInternal(tabId) {
  if (!tabData[tabId]) {
    return;
  }
  
  const now = Date.now();
  
  tabData[tabId].lastActiveTime = now;
  tabData[tabId].isActive = true;
  tabData[tabId].readyForTracking = true;
  
  // Create a new interval if needed
  if (!tabData[tabId].intervalId) {
    tabData[tabId].intervalId = setInterval(() => updateTabTime(tabId), 500);
  }
  
  // Apply any existing restrictions
  applyRestrictions(tabId);
}

// Reset usage data (can be triggered from popup)
function resetUsageData(url) {
  // Get domain from URL and remove domain-based data
  const domain = getDomainFromUrl(url);
  
  if (domain) {
    // Also remove any active restrictions
    chrome.storage.local.get([`${domain}_restriction`], (result) => {
      const restriction = result[`${domain}_restriction`];
      
      if (restriction) {
        chrome.storage.local.remove(`${domain}_restriction`);
      }
    });
    
    // Remove domain data
    chrome.storage.local.remove(domain);
  }
  
  // Reset any active tabs with this domain
  const tabsToReset = [];
  Object.keys(tabData).forEach((tabId) => {
    const tabDomain = getDomainFromUrl(tabData[tabId].url);
    if (tabDomain && tabDomain === domain) {
      tabsToReset.push(parseInt(tabId));
    }
  });
  
  tabsToReset.forEach((tabId) => {
    tabData[tabId].totalTime = 0;
    tabData[tabId].startTime = Date.now();
    tabData[tabId].lastActiveTime = Date.now();
    tabData[tabId].status = 'normal';
    
    // First send updateRestriction message
    try {
      chrome.tabs.sendMessage(tabId, {
        action: 'updateRestriction',
        status: 'normal'
      }).then(() => {
        // Then send resetComplete message to ensure proper cleanup
        return chrome.tabs.sendMessage(tabId, {
          action: 'resetComplete'
        });
      });
    } catch (error) {
      console.error("Error sending messages to content script:", error);
    }
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStatus') {
    // Return status for a specific tab
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    
    if (tabData[tabId]) {
      const url = tabData[tabId].url;
      // Use stored domain if available, otherwise extract from URL
      const domain = tabData[tabId].domain || getDomainFromUrl(url);
      
      if (domain) {
        // Check status in localStorage
        chrome.storage.local.get([domain], (result) => {
          if (result[domain] && result[domain].status) {
            // Use status from localStorage
            sendResponse({
              status: result[domain].status,
              totalTime: tabData[tabId].totalTime
            });
          } else {
            // No status in localStorage, use in-memory status
            sendResponse({
              status: tabData[tabId].status,
              totalTime: tabData[tabId].totalTime
            });
          }
        });
        return true;
      } else {
        // No domain, use in-memory status
        sendResponse({
          status: tabData[tabId].status,
          totalTime: tabData[tabId].totalTime
        });
      }
    } else {
      sendResponse({ status: 'normal', totalTime: 0 });
    }
    return true;
  } else if (message.action === 'setStatus') {
    // Set status for the sender tab
    const tabId = sender.tab ? sender.tab.id : null;
    const domain = message.domain;
    const newStatus = message.status;
    
    if (tabId && tabData[tabId]) {
      tabData[tabId].status = newStatus;
      
      // Store the domain in tabData for later use
      if (domain) {
        tabData[tabId].domain = domain;
      }
      
      // If setting to 禁止 status, make sure tracking is paused
      if (newStatus === '禁止' && tabData[tabId].isActive) {
        pauseTracking(tabId);
      }
      
      // Update the status in localStorage for the domain
      if (domain) {
        chrome.storage.local.get([domain], (result) => {
          if (result[domain]) {
            const domainData = result[domain];
            
            // Update the status
            const dataToStore = {
              ...domainData,
              status: newStatus
            };
            
            chrome.storage.local.set({
              [domain]: dataToStore
            });
          } else {
            // Create new entry with status
            chrome.storage.local.set({
              [domain]: {
                totalTime: tabData[tabId].totalTime || 0,
                lastUpdated: Date.now(),
                status: newStatus
              }
            });
          }
        });
      }
      
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Tab not found' });
    }
    return true;
  } else if (message.action === 'resetData') {
    // Reset data for a specific URL
    const url = message.url;
    
    resetUsageData(url);
    
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'settingsUpdated') {
    // Update settings
    settings = message.settings;
    
    // Update site thresholds cache
    updateSiteThresholds();
    
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
      try {
        chrome.tabs.sendMessage(parseInt(tabId), {
          action: 'updateRestriction',
          status: 'normal'
        });
      } catch (error) {
        console.error("Error sending reset message to content script:", error);
      }
    });
    
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'pauseTracking') {
    // Pause tracking for the sender tab
    const tabId = sender.tab ? sender.tab.id : null;
    const domain = message.domain;
    
    if (tabId && tabData[tabId]) {
      pauseTracking(tabId);
      
      // Store the domain in tabData for later use
      if (domain) {
        tabData[tabId].domain = domain;
      }
      
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Tab not found' });
    }
    return true;
  } else if (message.action === 'resumeTracking') {
    // Resume tracking for the sender tab
    const tabId = sender.tab ? sender.tab.id : null;
    const domain = message.domain;
    
    if (tabId && tabData[tabId]) {
      // Only resume if the tab is not in 禁止 status
      if (tabData[tabId].status === '禁止') {
        sendResponse({ success: false, error: 'Tab is in 禁止 status' });
      } else {
        // Store the domain in tabData for later use
        if (domain) {
          tabData[tabId].domain = domain;
        }
        
        resumeTracking(tabId);
        sendResponse({ success: true });
      }
    } else {
      sendResponse({ success: false, error: 'Tab not found' });
    }
    return true;
  }
});

// Check if data should be reset (based on lastUpdated timestamp)
function checkDataReset() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  // Get all domains from storage
  chrome.storage.local.get(null, (result) => {
    // Filter out entries that are not domain data (like restrictions)
    const domains = Object.keys(result).filter(key => !key.includes('_restriction'));
    
    domains.forEach(domain => {
      const domainData = result[domain];
      
      // Check if lastUpdated exists and is from a previous day
      if (domainData && domainData.lastUpdated) {
        const lastUpdatedDate = new Date(domainData.lastUpdated);
        const lastUpdatedDay = new Date(
          lastUpdatedDate.getFullYear(),
          lastUpdatedDate.getMonth(),
          lastUpdatedDate.getDate()
        ).getTime();
        
        // If lastUpdated is from a previous day, reset this domain's data
        if (lastUpdatedDay < today) {
          console.log(`Resetting data for ${domain} - last updated on ${new Date(lastUpdatedDay).toLocaleDateString()}`);
          
          // Reset this domain's data
          chrome.storage.local.remove(domain);
          
          // Reset any active tabs with this domain
          Object.keys(tabData).forEach((tabId) => {
            const numericTabId = parseInt(tabId);
            const tabDomain = getDomainFromUrl(tabData[numericTabId].url);
            
            if (tabDomain === domain) {
              tabData[numericTabId].totalTime = 0;
              tabData[numericTabId].startTime = Date.now();
              tabData[numericTabId].lastActiveTime = Date.now();
              tabData[numericTabId].status = 'normal';
              
              // Update the content script
              try {
                chrome.tabs.sendMessage(numericTabId, {
                  action: 'updateRestriction',
                  status: 'normal'
                });
              } catch (error) {
                console.error("Error sending reset message to content script:", error);
              }
            }
          });
        }
      }
    });
  });
}

// Set up a timer to check for data reset every hour
setInterval(checkDataReset, 3600000); // Check once per hour instead of every minute

// Listen for installation or update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on install
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    
    // Open options page on install
    chrome.runtime.openOptionsPage();
  }
});
