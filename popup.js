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
  
  // Update progress bar
  let progressPercentage = 0;
  let progressClass = '';
  
  if (currentTime >= BLOCK_THRESHOLD) {
    progressPercentage = 100;
    progressClass = 'danger';
    statusMessage.textContent = `Access blocked (${settings.blockTime}+ minutes)`;
  } else if (currentTime >= GRAYSCALE_THRESHOLD) {
    progressPercentage = (currentTime - GRAYSCALE_THRESHOLD) / (BLOCK_THRESHOLD - GRAYSCALE_THRESHOLD) * 50 + 50;
    progressClass = 'warning';
    statusMessage.textContent = `Grayscale mode (${settings.grayscaleTime}+ minutes)`;
  } else if (currentTime > 0) {
    progressPercentage = (currentTime / GRAYSCALE_THRESHOLD) * 50;
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
  return settings.sites.some(site => domain && domain.includes(site));
}

// Get data for all monitored sites
async function getAllSitesData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (result) => {
      const sitesData = [];
      
      for (const key in result) {
        // Only include keys that are URLs
        if (key.startsWith('http')) {
          const domain = getDomainFromUrl(key);
          if (domain && isSNSSite(key)) {
            sitesData.push({
              url: key,
              domain: domain,
              totalTime: result[key].totalTime || 0,
              lastUpdated: result[key].lastUpdated || 0
            });
          }
        }
      }
      
      resolve(sitesData);
    });
  });
}

// Populate the site list
async function populateSiteList() {
  const sitesData = await getAllSitesData();
  
  // Group by domain and sum times
  const domainMap = {};
  
  sitesData.forEach(site => {
    if (!domainMap[site.domain]) {
      domainMap[site.domain] = 0;
    }
    domainMap[site.domain] += site.totalTime;
  });
  
  // Clear the list
  siteList.innerHTML = '';
  
  // Add each domain to the list
  Object.keys(domainMap).forEach(domain => {
    const listItem = document.createElement('li');
    listItem.className = 'site-item';
    
    const siteName = document.createElement('span');
    siteName.className = 'site-name';
    siteName.textContent = domain;
    
    const siteTime = document.createElement('span');
    siteTime.className = 'site-time';
    siteTime.textContent = formatTime(domainMap[domain]);
    
    listItem.appendChild(siteName);
    listItem.appendChild(siteTime);
    siteList.appendChild(listItem);
  });
  
  // If no sites, show a message
  if (Object.keys(domainMap).length === 0) {
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
          statusMessage.textContent = 'Data reset successfully';
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

// Counter for site list refresh
let siteListRefreshCounter = 0;

// Refresh data every second
setInterval(() => {
  if (currentTab && currentSite && currentStatus !== 'blocked') {
    currentTime += 1000; // Add 1 second
    updateUI();
  }
  
  // Refresh the site list every 5 seconds to reduce performance impact
  siteListRefreshCounter++;
  if (siteListRefreshCounter >= 5) {
    populateSiteList();
    siteListRefreshCounter = 0;
  }
}, 1000);
