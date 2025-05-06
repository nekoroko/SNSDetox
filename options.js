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
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "tiktok.com",
    "linkedin.com"
  ],
  grayscaleTime: 15, // minutes
  blockTime: 45      // minutes
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
    siteName.textContent = site;
    
    const siteActions = document.createElement('div');
    siteActions.className = 'site-actions';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeSite(site));
    
    siteActions.appendChild(removeBtn);
    listItem.appendChild(siteName);
    listItem.appendChild(siteActions);
    siteList.appendChild(listItem);
  });
  
  // Update time inputs
  grayscaleTimeInput.value = currentSettings.grayscaleTime;
  blockTimeInput.value = currentSettings.blockTime;
}

// Add a new site
async function addSite() {
  const site = newSiteInput.value.trim().toLowerCase();
  
  if (!site) {
    showStatus('Please enter a valid domain', 'error');
    return;
  }
  
  // Basic validation
  if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(site)) {
    showStatus('Please enter a valid domain (e.g., facebook.com)', 'error');
    return;
  }
  
  // Check if site already exists
  if (currentSettings.sites.includes(site)) {
    showStatus('This site is already in the list', 'error');
    return;
  }
  
  // Add the site
  currentSettings.sites.push(site);
  await saveSettings();
  
  // Update UI
  updateUI();
  newSiteInput.value = '';
  
  showStatus(`Added ${site} to monitored sites`, 'success');
}

// Remove a site
async function removeSite(site) {
  currentSettings.sites = currentSettings.sites.filter(s => s !== site);
  await saveSettings();
  updateUI();
  showStatus(`Removed ${site} from monitored sites`, 'success');
}

// Update time settings
async function updateTimeSettings() {
  const grayscaleTime = parseInt(grayscaleTimeInput.value);
  const blockTime = parseInt(blockTimeInput.value);
  
  // Validation
  if (isNaN(grayscaleTime) || grayscaleTime < 1 || grayscaleTime > 180) {
    showStatus('Grayscale time must be between 1 and 180 minutes', 'error');
    grayscaleTimeInput.value = currentSettings.grayscaleTime;
    return;
  }
  
  if (isNaN(blockTime) || blockTime < 5 || blockTime > 240) {
    showStatus('Block time must be between 5 and 240 minutes', 'error');
    blockTimeInput.value = currentSettings.blockTime;
    return;
  }
  
  if (blockTime <= grayscaleTime) {
    showStatus('Block time must be greater than grayscale time', 'error');
    return;
  }
  
  // Update settings
  currentSettings.grayscaleTime = grayscaleTime;
  currentSettings.blockTime = blockTime;
  await saveSettings();
  
  showStatus('Time settings updated successfully', 'success');
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
          if (!settings.sites || !Array.isArray(settings.sites) || 
              typeof settings.grayscaleTime !== 'number' || 
              typeof settings.blockTime !== 'number') {
            throw new Error('Invalid settings format');
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
