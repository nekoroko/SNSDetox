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

// Update the site thresholds cache
function updateSiteThresholds() {
  siteThresholds.clear();
  
  // Cache thresholds for each site
  settings.sites.forEach(site => {
    siteThresholds.set(site.domain, {
      grayscale: site.grayscaleTime * 60 * 1000,
      block: site.blockTime * 60 * 1000
    });
  });
}

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get('settings', (result) => {
    if (result.settings) {
      settings = result.settings;
      
      // Update site thresholds cache
      updateSiteThresholds();
      
      // Update UI if needed
      if (currentTab && currentSite) {
        updateUI();
      }
    }
  });
}

// Load settings when popup opens
loadSettings();

// DOM elements
const timeDisplay = document.getElementById('time-display');
const progressBar = document.getElementById('progress-bar');
const statusMessage = document.getElementById('status-message');
const currentSiteElement = document.getElementById('current-site');
const siteList = document.getElementById('site-list');
const resetButton = document.getElementById('reset-btn');
const settingsButton = document.getElementById('settings-btn');

// Current tab information
let currentTab = null;
let currentSite = null;
let currentStatus = 'normal';
let currentTime = 0;

// Format milliseconds to HH:MM:SS
function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

// Update the UI based on current status and time
function updateUI() {
  // Update time display
  timeDisplay.textContent = formatTime(currentTime);
  
  // Get thresholds for the current site
  let thresholds = { grayscale: 0, block: 0, grayscaleTime: 0, blockTime: 0 };
  
  if (currentTab && currentTab.url) {
    thresholds = getThresholdsForUrl(currentTab.url);
  }
  
  // Update progress bar
  let progressPercentage = 0;
  let progressClass = '';
  
  if (currentTime >= thresholds.block) {
    progressPercentage = 100;
    progressClass = 'danger';
    statusMessage.textContent = `Access blocked (${thresholds.blockTime}+ minutes)`;
  } else if (currentTime >= thresholds.grayscale) {
    progressPercentage = (currentTime - thresholds.grayscale) / (thresholds.block - thresholds.grayscale) * 50 + 50;
    progressClass = 'warning';
    statusMessage.textContent = `Grayscale mode (${thresholds.grayscaleTime}+ minutes)`;
  } else if (currentTime > 0) {
    progressPercentage = (currentTime / thresholds.grayscale) * 50;
    progressClass = '';
    statusMessage.textContent = 'Normal browsing';
  } else {
    statusMessage.textContent = 'No restrictions active';
  }
  
  progressBar.style.width = `${progressPercentage}%`;
  progressBar.className = 'progress-bar ' + progressClass;
  
  // Update current site display
  if (currentSite) {
    currentSiteElement.textContent = `Current site: ${currentSite}`;
  } else {
    currentSiteElement.textContent = 'Not on an SNS site';
  }
}

// Get the domain from a URL
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
  
  // Find the matching site in settings
  for (const site of settings.sites) {
    if (domain && domain.includes(site.domain)) {
      return {
        grayscale: site.grayscaleTime * 60 * 1000,
        block: site.blockTime * 60 * 1000,
        grayscaleTime: site.grayscaleTime,
        blockTime: site.blockTime
      };
    }
  }
  
  // Return default thresholds if no match found
  return {
    grayscale: settings.defaultGrayscaleTime * 60 * 1000,
    block: settings.defaultBlockTime * 60 * 1000,
    grayscaleTime: settings.defaultGrayscaleTime,
    blockTime: settings.defaultBlockTime
  };
}

// Get data for all monitored sites
async function getAllSitesData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (result) => {
      // Create a map to store total time for each configured site
      const siteTimeMap = {};
      
      // Initialize the map with all configured sites
      settings.sites.forEach(site => {
        siteTimeMap[site.domain] = {
          domain: site.domain,
          totalTime: 0,
          lastUpdated: 0
        };
      });
      
      // Process all domains in storage
      for (const key in result) {
        const domain = key;
        
        // Find which configured site this domain belongs to
        for (const site of settings.sites) {
          if (domain && domain.includes(site.domain)) {
            // Add time to the appropriate configured site
            siteTimeMap[site.domain].totalTime += result[key].totalTime || 0;
            
            // Update lastUpdated if this is more recent
            const lastUpdated = result[key].lastUpdated || 0;
            if (lastUpdated > siteTimeMap[site.domain].lastUpdated) {
              siteTimeMap[site.domain].lastUpdated = lastUpdated;
            }
            
            break; // Stop after finding the first match
          }
        }
      }
      
      // Convert map to array
      const sitesData = Object.values(siteTimeMap).filter(site => site.totalTime > 0);
      
      resolve(sitesData);
    });
  });
}

// Populate the site list
async function populateSiteList() {
  const sitesData = await getAllSitesData();
  
  // Clear the list
  siteList.innerHTML = '';
  
  // Add each domain to the list
  sitesData.forEach(site => {
    const listItem = document.createElement('li');
    listItem.className = 'site-item';
    
    // Find site settings for this domain
    const siteSettings = settings.sites.find(s => site.domain.includes(s.domain));
    
    const siteName = document.createElement('span');
    siteName.className = 'site-name';
    siteName.textContent = site.domain;
    
    const siteTime = document.createElement('span');
    siteTime.className = 'site-time';
    siteTime.textContent = formatTime(site.totalTime);
    
    // Add time limits info
    const timeLimits = document.createElement('span');
    timeLimits.className = 'site-limits';
    
    if (siteSettings) {
      timeLimits.textContent = `(${siteSettings.grayscaleTime}/${siteSettings.blockTime} min)`;
    } else {
      // Use default settings if no site-specific settings found
      timeLimits.textContent = `(${settings.defaultGrayscaleTime}/${settings.defaultBlockTime} min)`;
    }
    
    listItem.appendChild(siteName);
    listItem.appendChild(timeLimits);
    listItem.appendChild(siteTime);
    siteList.appendChild(listItem);
  });
  
  // If no sites, show a message
  if (sitesData.length === 0) {
    const listItem = document.createElement('li');
    listItem.className = 'site-item';
    listItem.textContent = 'No SNS usage data yet';
    siteList.appendChild(listItem);
  }
}

// Initialize the popup
async function initPopup() {
  try {
    // Get the current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    
    if (currentTab && currentTab.url) {
      // Check if it's an SNS site
      if (isSNSSite(currentTab.url)) {
        currentSite = getDomainFromUrl(currentTab.url);
        
        // Get the current status from the background script
        chrome.runtime.sendMessage(
          { action: 'getStatus', tabId: currentTab.id },
          (response) => {
            if (response) {
              currentStatus = response.status;
              currentTime = response.totalTime;
              updateUI();
            } else {
              // If no response from background script, try to get data from storage
              const domain = getDomainFromUrl(currentTab.url);
              if (domain) {
                chrome.storage.local.get([domain], (result) => {
                  if (result[domain]) {
                    currentTime = result[domain].totalTime || 0;
                    updateUI();
                  }
                });
              }
            }
          }
        );
      } else {
        // Not an SNS site
        currentSite = null;
        currentStatus = 'normal';
        currentTime = 0;
        updateUI();
      }
    }
    
    // Populate the site list
    await populateSiteList();
    
  } catch (error) {
    console.error("Error initializing popup:", error);
  }
}

// Reset the current site data
function resetCurrentSite() {
  if (currentTab && currentSite) {
    chrome.runtime.sendMessage(
      { action: 'resetData', url: currentTab.url },
      (response) => {
        if (response && response.success) {
          // Reset local state
          currentTime = 0;
          currentStatus = 'normal';
          updateUI();
          
          // Refresh the site list
          populateSiteList();
          
          // Show a success message
          statusMessage.textContent = `Data for ${currentSite} reset successfully`;
          setTimeout(() => {
            statusMessage.textContent = 'No restrictions active';
          }, 2000);
        }
      }
    );
  }
}

// Open the settings page
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Event listeners
document.addEventListener('DOMContentLoaded', initPopup);
resetButton.addEventListener('click', resetCurrentSite);
settingsButton.addEventListener('click', openSettings);

// Refresh data every second
setInterval(() => {
  if (currentTab && currentSite) {
    // Get the latest data from localStorage instead of incrementing locally
    const domain = getDomainFromUrl(currentTab.url);
    if (domain) {
      chrome.storage.local.get([domain], (result) => {
        if (result[domain] && result[domain].totalTime !== undefined) {
          // Update with the latest time from localStorage
          currentTime = result[domain].totalTime;
          
          // Also update status if available
          if (result[domain].status) {
            currentStatus = result[domain].status;
          }
          
          updateUI();
        } else {
          // Fall back to getting time from background.js
          chrome.runtime.sendMessage({ action: 'getStatus', tabId: currentTab.id }, (response) => {
            if (response && response.totalTime !== undefined) {
              currentTime = response.totalTime;
              currentStatus = response.status || currentStatus;
              updateUI();
            }
          });
        }
      });
    }
  }
  
  // Refresh the site list every time
  populateSiteList();
}, 1000);
