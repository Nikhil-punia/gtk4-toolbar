# GTK4 Toolbar for VS Code

A powerful VS Code extension that streamlines C++ GTK4 development on Windows using MSYS2. It provides a complete integrated development environment with one-click build/run controls, automated CMake configuration, package management, theme installation, and **Android deployment via Pixiewood**.

![GTK4 Toolbar Icon](logo.png)

## ✨ Features

### 🚀 Integrated Build System
- **Status Bar Controls:** Convenient buttons for **Clean**, **Build**, **Run**, and **Build & Run**
- **Build Modes:**
  - **CMake Project:** Automatic detection and use of `CMakeLists.txt`
  - **Meson Project:** Support for meson.build projects
  - **Single File:** Fallback to single-file compilation with pkg-config
- **MSYS2 Integration:** Seamless execution within UCRT64, MINGW64, or CLANG64 environments
- **IntelliSense Setup:** One-click configuration for VS Code C++ IntelliSense

### 📱 Android Development (Pixiewood)
- **Cross-compilation:** Build GTK4 apps for Android using [gtk-android-builder](https://github.com/sp1ritCS/gtk-android-builder)
- **Automated Setup:** One-click Pixiewood installation and configuration
- **Windows Compatibility:** Automatic patching for MSYS2/Windows environments
- **APK Generation:** Full Gradle integration for debug/release builds
- **Automated libc++_shared.so:** Automatically copies required native library

### ⚙️ Comprehensive Configuration UI
- **Visual Settings Panel:** Rich web-based UI for all configuration options
- **Toolchain Control:** Compiler, C++ standard, CMake generator selection
- **Environment Variables:** Easy management of `GSK_RENDERER`, `GTK_THEME`, etc.
- **Android SDK/NDK:** Configure paths for Android development

### 📦 Package & Theme Manager
- **MSYS2 Package Browser:** Search and install packages directly
- **Theme Installer:** Browse and install GTK themes from GitHub
- **GStreamer Support:** One-click installation of multimedia suite

### 🛠️ Developer Tools
- **UI Designer:** Quick launch for Glade interface designer
- **Project Exporter:** Export project setup as reusable templates
- **Debug Support:** Configurable debug output and build types

## 📁 Project Structure

The extension uses a clean, modular OOP architecture:

```
gtk4-toolbar/
├── src/
│   ├── extension.js           # Main entry point (~60 lines)
│   ├── utils/
│   │   ├── index.js           # Utils exports
│   │   ├── PathUtils.js       # MSYS2/Windows path conversion
│   │   └── Logger.js          # Debug/info logging singleton
│   ├── managers/
│   │   ├── index.js           # Managers exports
│   │   ├── ConfigManager.js   # VS Code configuration handling
│   │   ├── TerminalManager.js # MSYS2 terminal management
│   │   ├── StatusBarManager.js# Status bar buttons
│   │   ├── ThemeManager.js    # GTK theme management
│   │   └── PackageManager.js  # MSYS2 package operations
│   ├── android/
│   │   ├── index.js           # Android exports
│   │   ├── AndroidBuilder.js  # Android build operations
│   │   └── PixiewoodPatcher.js# Windows compatibility patches
│   └── commands/
│       ├── index.js           # Commands exports
│       ├── BuildCommands.js   # Build/run/clean commands
│       └── SettingsPanel.js   # Webview settings UI
├── web/                        # UI assets (HTML, CSS, JS)
├── scripts/                    # Installation scripts
├── exporter.js                 # Project template exporter
└── package.json                # Extension manifest
```

### Architecture Highlights
- **Singleton Pattern:** Managers use singleton instances for consistent state
- **Modular Design:** Each module handles a specific concern
- **Index Exports:** Clean imports via barrel files (`index.js`)

## 📋 Requirements

- **VS Code** v1.75.0 or higher
- **MSYS2** installed on Windows
- **C/C++ Extension** (ms-vscode.cpptools) recommended

### For Android Development
- **Android SDK** with platform-tools
- **Android NDK** (r21+ recommended, tested with r27d)
- **JDK 17** (Eclipse Adoptium or Android Studio JBR)

## 🚀 Getting Started

### Basic Setup

1. **Install MSYS2:** Download from [msys2.org](https://www.msys2.org/)
2. **Configure Extension:**
   - Click the **Settings** gear in the status bar
   - Set your **MSYS2 Path** (e.g., `C:/msys64`)
   - Select **UCRT64** environment
3. **Install Dependencies:**
   - Go to **Plugins** tab → Install **GTK4**, **LibAdwaita**, **Toolchain**
4. **Build & Run:**
   - Open a `.cpp` file and click **Build & Run** in status bar

### Android Setup

1. **Install Android SDK/NDK** via Android Studio or command line
2. **Configure Paths** in the **Android** tab:
   - Android SDK Path
   - Android NDK Path
   - JDK Path (auto-detected if JAVA_HOME is set)
3. **Install Pixiewood:**
   - Click **Install Pixiewood** button
   - Wait for installation and automatic patching
4. **Create `pixiewood.xml`** manifest in your project root
5. **Build Steps:**
   - **Prepare** → Downloads dependencies
   - **Generate** → Creates Android project
   - **Build** → Compiles and creates APK

## ⚙️ Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `gtk4Toolbar.msys2Path` | MSYS2 installation directory | - |
| `gtk4Toolbar.msys2Environment` | Environment (UCRT64/MINGW64/CLANG64) | `UCRT64` |
| `gtk4Toolbar.compiler` | Compiler (`g++`/`clang++`) | `g++` |
| `gtk4Toolbar.cppStandard` | C++ standard version | `c++17` |
| `gtk4Toolbar.pkgConfigLibraries` | Libraries to link | `gtk4 libadwaita-1` |
| `gtk4Toolbar.gskRenderer` | GTK renderer backend | `cairo` |
| `gtk4Toolbar.cmakeGenerator` | CMake generator | `Ninja` |
| `gtk4Toolbar.pixiewoodPath` | Path to pixiewood script | - |
| `gtk4Toolbar.androidSdkPath` | Android SDK directory | - |
| `gtk4Toolbar.androidNdkPath` | Android NDK directory | - |

## 📝 Commands

| Command | Description |
|---------|-------------|
| `GTK4 Toolbar: Build` | Build the project |
| `GTK4 Toolbar: Run` | Run the executable |
| `GTK4 Toolbar: Build & Run` | Build and run |
| `GTK4 Toolbar: Clean` | Remove build artifacts |
| `GTK4 Toolbar: Open Settings` | Open configuration panel |
| `GTK4 Toolbar: Export Project` | Export as template |

## 🔧 Troubleshooting

### Common Issues

**CMake not found:**
```bash
pacman -S mingw-w64-ucrt-x86_64-cmake mingw-w64-ucrt-x86_64-ninja
```

**Linker errors:**
- Ensure all libraries are in `pkgConfigLibraries` setting
- Install missing packages via Plugins tab

**Android build fails:**
- Verify JDK 17 is installed and JAVA_HOME is set
- Check NDK path points to correct version
- Run with verbose mode enabled for detailed logs

**App crashes with libc++_shared.so:**
- The extension now automatically copies this file during build
- Manual fix: Copy from `$NDK/sysroot/usr/lib/$ARCH/libc++_shared.so` to APK

**White screen on Android:**
- Ensure `adw_init()` is called before UI setup
- Check libadwaita version compatibility (1.2.x lacks some widgets like AdwToolbarView)

**"GetIfTable" Error:**
- The extension automatically links `iphlpapi` to resolve this

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📄 License

[MIT](LICENSE)

## 🔗 Links

- [GitHub Repository](https://github.com/Nikhil-Punia/gtk4-toolbar)
- [MSYS2](https://www.msys2.org/)
- [GTK4 Documentation](https://docs.gtk.org/gtk4/)
- [Pixiewood/gtk-android-builder](https://github.com/sp1ritCS/gtk-android-builder)

---

*Built with ❤️ for the GTK community*

