# SNS Detox

A Chrome extension to help you manage and limit your social media usage by applying time-based restrictions.

## Overview

SNS Detox monitors your time spent on social media sites and applies progressive restrictions to help you maintain a healthy balance:

1. After 15 minutes of active use: The screen turns grayscale to reduce the visual appeal
2. After 45 minutes of active use: Access is blocked completely

The extension only counts time when the tab is active, ensuring accurate tracking of your actual usage.

## Features

- **Time-based restrictions**: Grayscale mode after 15 minutes, complete blocking after 45 minutes
- **Active tab tracking**: Only counts time when you're actively using the tab
- **Customizable sites**: Add or remove social media sites to monitor
- **Adjustable time limits**: Set your own thresholds for grayscale and blocking
- **Usage statistics**: View your usage time for each social media site
- **Data management**: Reset usage data, export/import settings

## Installation

### From Chrome Web Store (Recommended)

1. Visit the Chrome Web Store (link to be added when published)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the SNSDetox folder
5. The extension should now be installed and active

## Usage

### Basic Usage

1. Browse the web as normal
2. When you visit a monitored social media site, the extension will start tracking your time
3. After 15 minutes of active use, the screen will turn grayscale
4. After 45 minutes of active use, access will be blocked

### Extension Popup

Click the SNS Detox icon in your browser toolbar to:
- See your current usage time for the active site
- View a list of monitored sites and your usage time for each
- Reset the usage data for the current site
- Access the settings page

### Settings

Access the settings page by:
- Clicking the "Settings" button in the extension popup, or
- Right-clicking the extension icon and selecting "Options"

In the settings page, you can:
- Add or remove sites to monitor
- Adjust the time thresholds for grayscale and blocking
- Reset all usage data
- Export or import your settings

## Customization

### Monitored Sites

By default, the extension monitors:
- facebook.com
- twitter.com
- instagram.com
- tiktok.com
- linkedin.com

You can add or remove sites in the settings page.

### Time Thresholds

The default time thresholds are:
- Grayscale: 15 minutes
- Blocking: 45 minutes

You can adjust these in the settings page to suit your preferences.

## Privacy

SNS Detox respects your privacy:
- All data is stored locally on your device
- No data is sent to external servers
- No tracking or analytics

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.
