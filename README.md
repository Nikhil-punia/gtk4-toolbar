# GTK4 Toolbar for VS Code

A powerful VS Code extension that streamlines C++ GTK4 development on Windows using MSYS2. It provides a complete integrated development environment with one-click build/run controls, automated CMake configuration, package management, and theme installation.

![GTK4 Toolbar Icon](https://github.com/Nikhil-punia/gtk4-toolbar/blob/main/.vscode/extensions/gtk4-toolbar/logo.png)

## Features

### 🚀 Integrated Build System
*   **Status Bar Controls:** Convenient buttons in the status bar for **Clean**, **Build**, **Run**, and **Build & Run**.
*   **Build Modes:**
    *   **CMake Project:** If a `CMakeLists.txt` file is present, the extension uses CMake for building. Click **CMake Setup** in settings to generate one.
    *   **Single File:** If no `CMakeLists.txt` exists, it falls back to a single-file build using the compiler and flags defined in settings. Use the **C++ IntelliSense** button to configure VS Code for this mode.
*   **MSYS2 Integration:** Seamlessly executes commands within your specified MSYS2 environment (UCRT64, MINGW64, CLANG64).
*   **IntelliSense Setup:** One-click configuration of `c_cpp_properties.json` to link MSYS2 headers with VS Code's C++ IntelliSense.

### ⚙️ Comprehensive Configuration UI
*   **Visual Settings:** A rich web-based settings panel to configure your toolchain without editing JSON files manually.
*   **Toolchain Control:** Select your compiler (`g++`, `clang++`), C++ standard (`C++17`, `C++20`, etc.), and CMake generator (`Ninja`, `Makefiles`).
*   **Environment Variables:** Easily manage environment variables like `GSK_RENDERER`, `GTK_THEME`, and `GST_PLUGIN_PATH`.

### 📦 Package & Theme Manager
*   **MSYS2 Package Browser:** Search for and install MSYS2 packages (e.g., `gtk4`, `libadwaita`, `glade`) directly from the extension.
*   **Theme Installer:** Browse, preview, and install popular GTK themes (Nordic, Dracula, Arc, etc.) from GitHub.
*   **GStreamer Support:** One-click installation for the entire GStreamer multimedia suite.

### 🛠️ Developer Tools
*   **UI Designer:** Quick launch button for **Glade** interface designer.
*   **Project Exporter:** Export your current project setup as a reusable template extension.
*   **Debug Support:** Configurable debug output and build types (Debug/Release).

## Requirements

*   **VS Code** (v1.75.0 or higher)
*   **MSYS2** installed on your Windows machine.
*   **C/C++ Extension** (ms-vscode.cpptools) recommended for IntelliSense.

## Getting Started

1.  **Install MSYS2:** If you haven't already, download and install MSYS2.
2.  **Configure Extension:**
    *   Click the **Settings** gear icon in the status bar (or run `GTK4 Toolbar: Open Settings`).
    *   Set your **MSYS2 Path** (e.g., `C:/msys64`).
    *   Select your **Environment** (recommended: `UCRT64`).
3.  **Install Dependencies:**
    *   Go to the **Plugins** tab in the settings panel.
    *   Install **GTK4**, **LibAdwaita**, and **Toolchain** packages.
4.  **Create Project:**
    *   Open a folder with a `.cpp` file (e.g., `main.cpp`).
    *   Click **CMake Setup** in the settings panel to generate `CMakeLists.txt`.
5.  **Build & Run:**
    *   Click the **Build & Run** button in the status bar.

## Extension Settings

This extension contributes the following settings:

*   `gtk4Toolbar.msys2Path`: Path to your MSYS2 installation directory.
*   `gtk4Toolbar.msys2Environment`: The MSYS2 environment to use (UCRT64, MINGW64, CLANG64).
*   `gtk4Toolbar.compiler`: Compiler to use (`g++` or `clang++`).
*   `gtk4Toolbar.pkgConfigLibraries`: Space-separated list of libraries to link (e.g., `gtk4 libadwaita-1`).
*   `gtk4Toolbar.gskRenderer`: GTK renderer backend (`cairo`, `vulkan`, `gl`, `ngl`).
*   `gtk4Toolbar.cmakeGenerator`: CMake generator to use (default: `Ninja`).

## Commands

*   `GTK4 Toolbar: Build`: Build the project using the configured build task.
*   `GTK4 Toolbar: Run`: Run the built executable.
*   `GTK4 Toolbar: Build & Run`: Build and immediately run the application.
*   `GTK4 Toolbar: Clean`: Remove build artifacts (`.exe`, `.o`, `build/`).
*   `GTK4 Toolbar: Open Settings`: Open the visual configuration panel.
*   `GTK4 Toolbar: Export Project Template`: Export the current project structure as a new extension.

## Troubleshooting

*   **CMake not found:** Ensure the `mingw-w64-ucrt-x86_64-cmake` (or equivalent for your env) package is installed. The extension attempts to install it automatically.
*   **Linker Errors:** Check that all required libraries are listed in the `pkgConfigLibraries` setting and installed in MSYS2.
*   **"GetIfTable" Error:** This is a known issue with some Windows network libraries. The extension automatically links `iphlpapi` to resolve this.

## License

[MIT](LICENSE)

## Community & Development

This extension is developed primarily using advanced AI models, with careful monitoring and testing. However, bugs may exist. Please report any issues on [GitHub](https://github.com/Nikhil-Punia/gtk4-toolbar).

We believe in the power of human creativity to revive GTK, simplify its development, and foster a deeper understanding of C/C++. Your contributions and feedback are vital!

