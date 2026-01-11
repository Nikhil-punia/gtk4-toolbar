# GTK4 Toolbar Extension - Debug & Testing Guide

## Overview
This document provides comprehensive guidance for testing and debugging the GTK4 Toolbar extension.

## Architecture

### Communication Flow
```
VS Code Extension (src/extension.js)
          ↓
SettingsPanel (src/commands/SettingsPanel.js)
          ↓
Webview HTML/CSS/JS (web/index.html, script.js, style.css)
          ↓ (postMessage)
Extension Backend (MessageHandler in SettingsPanel.js)
```

## Key Components

### 1. **Extension Entry Point** (`src/extension.js`)
- **Activation Events**: `onLanguage:cpp`, `onLanguage:c`, `onCommand:gtk4-toolbar.openSettings`
- **Main Command**: `gtk4-toolbar.openSettings` - Opens the settings webview
- **Modules Initialized**:
  - ConfigManager - Handles workspace settings
  - TerminalManager - Creates and manages terminals
  - StatusBarManager - Manages status bar buttons
  - BuildCommands - Registers build/run commands
  - SettingsPanel - Opens the webview panel

### 2. **Settings Panel** (`src/commands/SettingsPanel.js`)
- **Key Method**: `open(context)` - Creates and displays webview
- **Message Handler**: `handleMessage(message, context)` - Routes all webview messages
- **Webview HTML Loading**: `getWebviewContent(webPath, webview)` - Replaces local paths with webview URIs using regex patterns

### 3. **Webview** (`web/index.html`, `web/script.js`)
- **Entry Point**: `acquireVsCodeApi()` - Obtains VS Code API reference
- **Message Queue**: `DOMContentLoaded` event initializes config, themes, plugins, and ADB button
- **Communication**: `vscode.postMessage(message)` sends commands to extension
- **Event Listener**: `window.addEventListener('message')` receives responses from extension

## Testing Checklist

### Basic Extension Loading
- [ ] Extension activates when opening a `.cpp` or `.c` file
- [ ] "GTK4 Toolbar loaded!" message appears in VS Code notification
- [ ] Status bar shows build/run buttons
- [ ] Command Palette shows `GTK4: Open GTK4 Toolbar Settings`

### Webview Opening
- [ ] Click status bar button or run command `gtk4-toolbar.openSettings`
- [ ] Webview panel opens without errors
- [ ] Check **Developer Tools** → **Output** → **GTK4 Toolbar** for messages
- [ ] Check **Webview Developer Tools** (Ctrl+Shift+P → "Developer: Toggle Webview Developer Tools")

### Console Logging (Webview DevTools)
Expected logs on startup:
```
[GTK4 WebView] VS Code API acquired successfully
[GTK4 WebView] DOM Content Loaded - Starting initialization
[GTK4 WebView] Config loaded
[GTK4 WebView] Themes rendered
[GTK4 WebView] Installed themes refreshed
[GTK4 WebView] Common plugins rendered
[GTK4 WebView] ADB floating button bound successfully
[GTK4 WebView] Initialization complete
```

## Debugging Workflow

### Step 1: Enable Extension Debug Output
1. Open VS Code Settings (Ctrl+,)
2. Search for `gtk4-toolbar`
3. Set `gtk4Toolbar.debugEnabled: true`
4. Reload VS Code

### Step 2: Monitor Output Channels
1. Open Output panel (Ctrl+J)
2. Select "GTK4 Toolbar" from dropdown (shows extension backend logs)
3. Select "Extension Host" (shows higher-level errors)

### Step 3: Monitor Webview Console
1. Open Webview DevTools (Ctrl+Shift+P → "Developer: Toggle Webview Developer Tools")
2. Go to Console tab
3. Filter by `[GTK4 WebView]` to see webview-specific logs

### Step 4: Test Message Flow
1. Open both Extension Output and Webview Console side-by-side
2. Click a button (e.g., "Save Changes")
3. You should see:
   - **Webview Console**: `[GTK4 WebView] Sending saveConfig: {...}`
   - **Extension Output**: `Received message: saveConfig`

## Message Handler Reference

All webview commands are routed through `SettingsPanel.handleMessage()`. Implemented commands:

**Configuration**
- `requestConfig` - Load settings from workspace
- `saveConfig` - Save general settings
- `saveGtkConfig` - Save GTK environment settings
- `saveAndroidConfig` - Save Android build settings

**Path Selection**
- `pickMsys2Path` - Select MSYS2 installation folder
- `pickPixiewoodPath` - Select Pixiewood script file
- `pickAndroidSdkPath` - Select Android SDK folder
- `pickAndroidNdkPath` - Select Android NDK folder

**Package Management**
- `searchPackages` - Search MSYS2 database
- `installPackage` - Install MSYS2 package
- `removePackage` - Remove MSYS2 package
- `installGStreamerSuite` - Install GStreamer collection

**ADB Device Management**
- `getAdbDevices` - List connected Android devices
- `loadAppToDevice` - Deploy APK to device

**Theme Management**
- `requestInstalledThemes` - List installed themes
- `searchOnlineThemes` - Search GitHub for themes
- `fetchReleases` - Get releases for a theme repo
- `installTheme` - Clone and build theme
- `deleteTheme` - Remove theme folder

**Development Tools**
- `openGlade` - Launch Glade UI designer
- `setupEnvironment` - Install GTK4 dependencies
- `configureCMake` - Setup CMake project
- `configureGppIntellisense` - Configure C++ IntelliSense

## Performance Tips

1. **Use Webview DevTools to find slow operations** - Check Performance tab
2. **Monitor memory usage** - Open DevTools → Memory tab
3. **Check for console errors** - Even warnings can cause performance issues
4. **Minimize re-renders** - Avoid unnecessary DOM updates
5. **Use event delegation** - For dynamically generated elements

## Next Steps After Testing

1. **Document any issues** - Create GitHub issues with console logs
2. **Test all commands** - Go through each tab systematically
3. **Test on multiple projects** - Different C/C++ project types
4. **Performance testing** - Monitor resource usage with DevTools
5. **Integration testing** - Test with actual MSYS2 build commands
