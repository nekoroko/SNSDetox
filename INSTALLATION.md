# SNS Detox Installation Guide

This guide will help you install and start using the SNS Detox Chrome extension.

## Installation

### Method 1: Manual Installation (Developer Mode)

1. **Download the Extension**
   - Download or clone this repository to your computer

2. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Type `chrome://extensions/` in the address bar and press Enter
   - Or navigate through: Chrome menu (three dots) > More Tools > Extensions

3. **Enable Developer Mode**
   - Toggle on "Developer mode" in the top-right corner of the Extensions page

4. **Load the Extension**
   - Click the "Load unpacked" button that appears
   - Navigate to and select the SNSDetox folder
   - Click "Select Folder"

5. **Verify Installation**
   - The SNS Detox extension should now appear in your extensions list
   - You should see the SNS Detox icon in your browser toolbar

### Method 2: Chrome Web Store (When Available)

1. Visit the Chrome Web Store (link to be added when published)
2. Click "Add to Chrome"
3. Confirm the installation in the popup dialog

## First-Time Setup

1. **Generate Icons**
   - Open the `generate_icons.html` file in your browser
   - Download each icon size by clicking the respective "Download" buttons
   - Save the icons to the `images` folder with the correct names (icon16.png, icon48.png, icon128.png)

2. **Configure Settings**
   - After installation, the settings page should open automatically
   - If not, click the SNS Detox icon in your toolbar and select "Settings"
   - Review the default monitored sites and time thresholds
   - Make any desired changes

## Basic Usage

1. **Browse Normally**
   - The extension will automatically monitor your time on social media sites
   - Time is only counted when the tab is active

2. **Restrictions**
   - After 15 minutes of active use: The screen turns grayscale
   - After 45 minutes of active use: Access is blocked

3. **View Your Usage**
   - Click the SNS Detox icon in your toolbar to see your current usage
   - The popup shows your time spent on the current site and all monitored sites

4. **Reset Data**
   - To reset data for the current site: Click the "Reset Current Site Data" button in the popup
   - To reset all data: Go to Settings > Data Management > Reset All Usage Data

## Troubleshooting

If the extension doesn't work as expected:

1. **Check Installation**
   - Make sure the extension is enabled in `chrome://extensions/`
   - Verify that the icons are properly placed in the `images` folder

2. **Reload the Extension**
   - Go to `chrome://extensions/`
   - Find SNS Detox and click the refresh icon

3. **Restart Chrome**
   - Close and reopen Chrome

4. **Reinstall**
   - If problems persist, try removing the extension and reinstalling it

## Need Help?

If you encounter any issues or have questions, please refer to the README.md file or open an issue on the GitHub repository.
