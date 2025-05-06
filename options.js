// DOM elements
const siteList = document.getElementById('site-list');
const newSiteInput = document.getElementById('new-site');
const addSiteBtn = document.getElementById('add-site-btn');
const grayscaleTimeInput = document.getElementById('grayscale-time');
const blockTimeInput = document.getElementById('block-time');
const resetAllBtn = document.getElementById('reset-all-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const statusMessage = document.getElementById('status-message');

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

// Current settings
let currentSettings = { ...DEFAULT_SETTINGS };

// Load settings from storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result) => {
      if (result.settings) {
        currentSettings = result.settings;
      }
      resolve(currentSettings);
    });
  });
}

// Save settings to storage
async function saveSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings: currentSettings }, () => {
      // Notify background script about the settings change
      chrome.runtime.sendMessage({ action: 'settingsUpdated', settings: currentSettings });
      resolve();
    });
  });
}

// Update the UI with current settings
function updateUI() {
  // Update site list
  siteList.innerHTML = '';
  
  currentSettings.sites.forEach((site) => {
    const listItem = document.createElement('li');
    listItem.className = 'site-item';
    
    const siteName = document.createElement('div');
    siteName.className = 'site-name';
    siteName.textContent = site.domain;
    
    const siteTimeSettings = document.createElement('div');
    siteTimeSettings.className = 'site-time-settings';
    
    // Grayscale time input
    const grayscaleContainer = document.createElement('div');
    grayscaleContainer.className = 'time-input-container';
    
    const grayscaleLabel = document.createElement('label');
    grayscaleLabel.textContent = 'Grayscale:';
    
    const grayscaleInput = document.createElement('input');
    grayscaleInput.type = 'number';
    grayscaleInput.min = '1';
    grayscaleInput.max = '180';
    grayscaleInput.value = site.grayscaleTime;
    grayscaleInput.className = 'site-time-input';
    grayscaleInput.addEventListener('change', () => updateSiteTimeSettings(site.domain, 'grayscaleTime', parseInt(grayscaleInput.value)));
    
    grayscaleContainer.appendChild(grayscaleLabel);
    grayscaleContainer.appendChild(grayscaleInput);
    
    // Block time input
    const blockContainer = document.createElement('div');
    blockContainer.className = 'time-input-container';
    
    const blockLabel = document.createElement('label');
    blockLabel.textContent = 'Block:';
    
    const blockInput = document.createElement('input');
    blockInput.type = 'number';
    blockInput.min = '5';
    blockInput.max = '240';
    blockInput.value = site.blockTime;
    blockInput.className = 'site-time-input';
    blockInput.addEventListener('change', () => updateSiteTimeSettings(site.domain, 'blockTime', parseInt(blockInput.value)));
    
    blockContainer.appendChild(blockLabel);
    blockContainer.appendChild(blockInput);
    
    siteTimeSettings.appendChild(grayscaleContainer);
    siteTimeSettings.appendChild(blockContainer);
    
    const siteActions = document.createElement('div');
    siteActions.className = 'site-actions';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeSite(site.domain));
    
    siteActions.appendChild(removeBtn);
    
    listItem.appendChild(siteName);
    listItem.appendChild(siteTimeSettings);
    listItem.appendChild(siteActions);
    siteList.appendChild(listItem);
  });
  
  // Update default time inputs
  grayscaleTimeInput.value = currentSettings.defaultGrayscaleTime;
  blockTimeInput.value = currentSettings.defaultBlockTime;
}

// Update time settings for a specific site
async function updateSiteTimeSettings(domain, settingType, value) {
  // Find the site in the settings
  const siteIndex = currentSettings.sites.findIndex(site => site.domain === domain);
  
  if (siteIndex === -1) {
    showStatus(`Site ${domain} not found`, 'error');
    return;
  }
  
  // Validate the input
  if (settingType === 'grayscaleTime') {
    if (isNaN(value) || value < 1 || value > 180) {
      showStatus('Grayscale time must be between 1 and 180 minutes', 'error');
      updateUI(); // Reset UI to current settings
      return;
    }
    
    if (currentSettings.sites[siteIndex].blockTime <= value) {
      showStatus('Block time must be greater than grayscale time', 'error');
      updateUI(); // Reset UI to current settings
      return;
    }
    
    currentSettings.sites[siteIndex].grayscaleTime = value;
  } else if (settingType === 'blockTime') {
    if (isNaN(value) || value < 5 || value > 240) {
      showStatus('Block time must be between 5 and 240 minutes', 'error');
      updateUI(); // Reset UI to current settings
      return;
    }
    
    if (value <= currentSettings.sites[siteIndex].grayscaleTime) {
      showStatus('Block time must be greater than grayscale time', 'error');
      updateUI(); // Reset UI to current settings
      return;
    }
    
    currentSettings.sites[siteIndex].blockTime = value;
  }
  
  // Save the updated settings
  await saveSettings();
  showStatus(`Updated ${settingType} for ${domain}`, 'success');
}

// Add a new site
async function addSite() {
  const domain = newSiteInput.value.trim().toLowerCase();
  
  if (!domain) {
    showStatus('Please enter a valid domain', 'error');
    return;
  }
  
  // Basic validation
  if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(domain)) {
    showStatus('Please enter a valid domain (e.g., facebook.com)', 'error');
    return;
  }
  
  // Check if site already exists
  if (currentSettings.sites.some(site => site.domain === domain)) {
    showStatus('This site is already in the list', 'error');
    return;
  }
  
  // Add the site with default time settings
  currentSettings.sites.push({
    domain: domain,
    grayscaleTime: currentSettings.defaultGrayscaleTime,
    blockTime: currentSettings.defaultBlockTime
  });
  
  await saveSettings();
  
  // Update UI
  updateUI();
  newSiteInput.value = '';
  
  showStatus(`Added ${domain} to monitored sites`, 'success');
}

// Remove a site
async function removeSite(domain) {
  currentSettings.sites = currentSettings.sites.filter(site => site.domain !== domain);
  await saveSettings();
  updateUI();
  showStatus(`Removed ${domain} from monitored sites`, 'success');
}

// Update default time settings
async function updateTimeSettings() {
  const grayscaleTime = parseInt(grayscaleTimeInput.value);
  const blockTime = parseInt(blockTimeInput.value);
  
  // Validation
  if (isNaN(grayscaleTime) || grayscaleTime < 1 || grayscaleTime > 180) {
    showStatus('Default grayscale time must be between 1 and 180 minutes', 'error');
    grayscaleTimeInput.value = currentSettings.defaultGrayscaleTime;
    return;
  }
  
  if (isNaN(blockTime) || blockTime < 5 || blockTime > 240) {
    showStatus('Default block time must be between 5 and 240 minutes', 'error');
    blockTimeInput.value = currentSettings.defaultBlockTime;
    return;
  }
  
  if (blockTime <= grayscaleTime) {
    showStatus('Default block time must be greater than grayscale time', 'error');
    return;
  }
  
  // Update settings
  currentSettings.defaultGrayscaleTime = grayscaleTime;
  currentSettings.defaultBlockTime = blockTime;
  await saveSettings();
  
  showStatus('Default time settings updated successfully', 'success');
}

// Reset all usage data
async function resetAllData() {
  if (confirm('Are you sure you want to reset all usage data? This will clear all time tracking for all sites.')) {
    // Clear all storage data except settings
    chrome.storage.local.clear(() => {
      chrome.runtime.sendMessage({ action: 'resetAllData' });
      showStatus('All usage data has been reset', 'success');
    });
  }
}

// Export settings
function exportSettings() {
  const dataStr = JSON.stringify(currentSettings, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const exportFileDefaultName = 'sns_detox_settings.json';
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

// Import settings
function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = (event) => {
    const file = event.target.files[0];
    
    if (file) {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const settings = JSON.parse(e.target.result);
          
          // Validate imported settings
          if (!settings.sites || !Array.isArray(settings.sites)) {
            throw new Error('Invalid settings format: missing or invalid sites array');
          }
          
          // Check if this is the old format (sites as string array) and convert if needed
          if (typeof settings.sites[0] === 'string') {
            // Convert from old format to new format
            const oldSites = [...settings.sites];
            settings.sites = oldSites.map(domain => ({
              domain,
              grayscaleTime: settings.grayscaleTime || 15,
              blockTime: settings.blockTime || 45
            }));
            
            settings.defaultGrayscaleTime = settings.grayscaleTime || 15;
            settings.defaultBlockTime = settings.blockTime || 45;
            
            // Remove old properties
            delete settings.grayscaleTime;
            delete settings.blockTime;
          } else {
            // Validate new format
            for (const site of settings.sites) {
              if (!site.domain || typeof site.grayscaleTime !== 'number' || typeof site.blockTime !== 'number') {
                throw new Error('Invalid site format in imported settings');
              }
            }
            
            if (typeof settings.defaultGrayscaleTime !== 'number' || typeof settings.defaultBlockTime !== 'number') {
              // Set defaults if missing
              settings.defaultGrayscaleTime = settings.defaultGrayscaleTime || 15;
              settings.defaultBlockTime = settings.defaultBlockTime || 45;
            }
          }
          
          // Update settings
          currentSettings = settings;
          await saveSettings();
          updateUI();
          
          showStatus('Settings imported successfully', 'success');
        } catch (error) {
          showStatus('Error importing settings: ' + error.message, 'error');
        }
      };
      
      reader.readAsText(file);
    }
  };
  
  input.click();
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;
  statusMessage.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  updateUI();
});

addSiteBtn.addEventListener('click', addSite);
newSiteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addSite();
  }
});

grayscaleTimeInput.addEventListener('change', updateTimeSettings);
blockTimeInput.addEventListener('change', updateTimeSettings);

resetAllBtn.addEventListener('click', resetAllData);
exportBtn.addEventListener('click', exportSettings);
importBtn.addEventListener('click', importSettings);
