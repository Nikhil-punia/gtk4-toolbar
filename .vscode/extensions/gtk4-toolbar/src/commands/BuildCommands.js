/**
 * Build Commands
 * Handles build, run, and clean commands - matching original extension.js functionality
 */
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { ConfigManager, TerminalManager } = require('../managers');
const { PathUtils, Logger } = require('../utils');

class BuildCommands {
    /**
     * Get the workspace folder path
     * @returns {string}
     * @throws {Error}
     */
    getWorkspaceFolder() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    /**
     * Get the current active file
     * @returns {{filePath: string, fileName: string, baseName: string, ext: string}|null}
     */
    getCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return null;

        const filePath = editor.document.uri.fsPath;
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath);
        const baseName = path.basename(filePath, ext);

        return { filePath, fileName, baseName, ext };
    }

    /**
     * Check if CMakeLists.txt exists in workspace
     * @returns {boolean}
     */
    hasCMakeProject() {
        try {
            const workspaceFolder = this.getWorkspaceFolder();
            return fs.existsSync(path.join(workspaceFolder, 'CMakeLists.txt'));
        } catch {
            return false;
        }
    }

    /**
     * Get environment setup commands
     * @returns {string[]}
     */
    getEnvSetupCommands() {
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();
        const msysPath = PathUtils.toMsysPath(config.msys2Path);

        const commands = [
            `export GSK_RENDERER=${config.gskRenderer}`,
            `export PATH=${msysPath}/${envPath}/bin:$PATH`,
            `export PKG_CONFIG_PATH=${msysPath}/${envPath}/lib/pkgconfig:${msysPath}/${envPath}/share/pkgconfig`
        ];

        if (config.gtkTheme) {
            commands.push(`export GTK_THEME="${config.gtkTheme}"`);
        }
        if (config.gtkDebug) {
            commands.push(`export GTK_DEBUG="${config.gtkDebug}"`);
        }

        // Add custom environment variables
        if (config.customEnvVars) {
            Object.entries(config.customEnvVars).forEach(([key, value]) => {
                const resolvedValue = value.replace(/\${msys2Path}/g, msysPath);
                commands.push(`export ${key}=${resolvedValue}`);
            });
        }

        return commands;
    }

    /**
     * Scan file for #pragma comment(lib, ...) and return extra libs
     * @param {string} filePath 
     * @returns {string}
     */
    scanForPragmaLibs(filePath) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const pragmaRegex = /#pragma\s+comment\s*\(\s*lib\s*,\s*"([^"]+)"\s*\)/g;
            let match;
            const libs = new Set();
            while ((match = pragmaRegex.exec(fileContent)) !== null) {
                let libName = match[1];
                if (libName.toLowerCase().endsWith('.lib')) {
                    libName = libName.substring(0, libName.length - 4);
                }
                libs.add(`-l${libName}`);
            }
            return libs.size > 0 ? ' ' + Array.from(libs).join(' ') : '';
        } catch (e) {
            Logger.debug('Failed to scan for pragma comments: ' + e.message);
            return '';
        }
    }

    /**
     * Build current file or CMake project
     */
    async buildCurrent() {
        try {
            const config = ConfigManager.getAll();
            
            // Save all files before building
            await vscode.workspace.saveAll();
            
            const workspaceFolder = this.getWorkspaceFolder();

            // If CMakeLists.txt exists, build with CMake
            if (this.hasCMakeProject()) {
                const buildCommands = [
                    ...this.getEnvSetupCommands(),
                    `echo "Building project with CMake..."`,
                    `mkdir -p build && cd build`,
                    `if [ ! -f CMakeCache.txt ]; then cmake .. -G Ninja; fi`,
                    `cmake --build .`,
                    'if [ $? -eq 0 ]; then echo "Build successful!"; else echo "Build failed!"; fi',
                    'read -p "Press enter to close..."'
                ];
                
                TerminalManager.executeMSYS2Command(buildCommands, 'Building Project...', workspaceFolder);
                
                if (config.showSuccessNotifications) {
                    setTimeout(() => {
                        vscode.window.showInformationMessage('Build command sent...');
                    }, 1000);
                }
                return;
            }

            // Legacy single file build
            const file = this.getCurrentFile();
            if (!file) {
                vscode.window.showErrorMessage('No file is currently open');
                return;
            }

            if (file.ext !== '.cpp' && file.ext !== '.c') {
                vscode.window.showErrorMessage('Current file is not a C/C++ source file');
                return;
            }

            const extraLibs = this.scanForPragmaLibs(file.filePath);
            const compilerFlagsStr = config.compilerFlags.join(' ');

            const buildCommands = [
                ...this.getEnvSetupCommands(),
                `echo "Compiling ${file.fileName}..."`,
                `echo "GTK_THEME is set to: $GTK_THEME"`,
                `echo "GSK_RENDERER is set to: $GSK_RENDERER"`,
                `${config.compiler} ${compilerFlagsStr} -std=${config.cppStandard} $(pkg-config --cflags ${config.pkgConfigLibraries}) -o ${file.baseName}.exe ${file.fileName} $(pkg-config --libs ${config.pkgConfigLibraries})${extraLibs}`,
                'if [ $? -eq 0 ]; then echo "Build successful! Created ' + file.baseName + '.exe"; else echo "Build failed!"; fi',
                'read -p "Press enter to close..."'
            ];

            TerminalManager.executeMSYS2Command(buildCommands, `Building ${file.fileName}...`, workspaceFolder);

            if (config.showSuccessNotifications) {
                setTimeout(() => {
                    vscode.window.showInformationMessage('Build command sent...');
                }, 1000);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to build: ' + error.message);
        }
    }

    /**
     * Run current file or CMake project
     */
    async runCurrent() {
        try {
            const config = ConfigManager.getAll();
            const workspaceFolder = this.getWorkspaceFolder();

            // If CMakeLists.txt exists, run from build folder
            if (this.hasCMakeProject()) {
                const runCommands = [
                    ...this.getEnvSetupCommands(),
                    `echo "Running project executable..."`,
                    `if [ -f ./build/main.exe ]; then ./build/main.exe; else echo "Executable not found in build/ folder. Build first."; fi`,
                    'echo "Program finished."'
                ];

                TerminalManager.executeMSYS2Command(runCommands, 'Running Application...', workspaceFolder);
                return;
            }

            // Legacy single file run
            const file = this.getCurrentFile();
            if (!file) {
                vscode.window.showErrorMessage('No file is currently open');
                return;
            }

            if (file.ext !== '.cpp' && file.ext !== '.c') {
                vscode.window.showErrorMessage('Current file is not a C/C++ source file');
                return;
            }

            const runCommands = [
                ...this.getEnvSetupCommands(),
                `echo "Running ${file.baseName}.exe..."`,
                `if [ -f ./${file.baseName}.exe ]; then ./${file.baseName}.exe && echo "Program finished."; else echo "Executable ${file.baseName}.exe not found. Build the file first."; fi`
            ];

            TerminalManager.executeMSYS2Command(runCommands, 'Running Application...', workspaceFolder);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run: ' + error.message);
        }
    }

    /**
     * Build and run current file or CMake project
     */
    async buildRunCurrent() {
        try {
            const config = ConfigManager.getAll();

            // Save all files before building
            await vscode.workspace.saveAll();

            const workspaceFolder = this.getWorkspaceFolder();

            // If CMakeLists.txt exists, build and run with CMake
            if (this.hasCMakeProject()) {
                const buildRunCommands = [
                    ...this.getEnvSetupCommands(),
                    `echo "Building and running project with CMake..."`,
                    `mkdir -p build && cd build`,
                    `if [ ! -f CMakeCache.txt ]; then cmake .. -G Ninja; fi`,
                    `cmake --build .`,
                    `if [ $? -eq 0 ]; then echo "Build successful! Running..."; if [ -f ./main.exe ]; then ./main.exe; else echo "Executable not found."; fi; echo "Program finished."; else echo "Build failed!"; fi`
                ];

                TerminalManager.executeMSYS2Command(buildRunCommands, 'Building and running...', workspaceFolder);

                if (config.showSuccessNotifications) {
                    setTimeout(() => {
                        vscode.window.showInformationMessage('Build & Run command sent...');
                    }, 1000);
                }
                return;
            }

            // Legacy single file build & run
            const file = this.getCurrentFile();
            if (!file) {
                vscode.window.showErrorMessage('No file is currently open');
                return;
            }

            if (file.ext !== '.cpp' && file.ext !== '.c') {
                vscode.window.showErrorMessage('Current file is not a C/C++ source file');
                return;
            }

            const extraLibs = this.scanForPragmaLibs(file.filePath);
            const compilerFlagsStr = config.compilerFlags.join(' ');

            const buildRunCommands = [
                ...this.getEnvSetupCommands(),
                `echo "Building and running ${file.fileName}..."`,
                `${config.compiler} ${compilerFlagsStr} -std=${config.cppStandard} $(pkg-config --cflags ${config.pkgConfigLibraries}) -o ${file.baseName}.exe ${file.fileName} $(pkg-config --libs ${config.pkgConfigLibraries})${extraLibs}`,
                `if [ $? -eq 0 ]; then echo "Build successful! Running ${file.baseName}.exe..."; ./${file.baseName}.exe; echo "Program finished."; else echo "Build failed!"; fi`
            ];

            TerminalManager.executeMSYS2Command(buildRunCommands, 'Building and running...', workspaceFolder);

            if (config.showSuccessNotifications) {
                setTimeout(() => {
                    vscode.window.showInformationMessage('Build & Run command sent...');
                }, 1000);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to build and run: ' + error.message);
        }
    }

    /**
     * Clean build artifacts
     */
    async clean() {
        try {
            const workspaceFolder = this.getWorkspaceFolder();
            let command = 'rm -f *.exe *.o';

            const cmakePath = path.join(workspaceFolder, 'CMakeLists.txt');
            const makefilePath = path.join(workspaceFolder, 'Makefile');

            if (fs.existsSync(cmakePath)) {
                command = 'rm -rf build';
            } else if (fs.existsSync(makefilePath)) {
                command = 'make clean';
            }

            TerminalManager.executeMSYS2Command([command], 'Cleaning build files...', workspaceFolder);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to clean: ' + error.message);
        }
    }

    /**
     * Register all build commands
     * @param {vscode.ExtensionContext} context 
     */
    registerCommands(context) {
        context.subscriptions.push(
            vscode.commands.registerCommand('gtk4-toolbar.build', async () => {
                try {
                    await vscode.commands.executeCommand('workbench.action.tasks.runTask', 'Build GTK4');
                } catch (error) {
                    vscode.window.showErrorMessage('Failed to run build task: ' + error.message);
                }
            }),
            vscode.commands.registerCommand('gtk4-toolbar.run', async () => {
                try {
                    await vscode.commands.executeCommand('workbench.action.tasks.runTask', 'Run GTK4');
                } catch (error) {
                    vscode.window.showErrorMessage('Failed to run task: ' + error.message);
                }
            }),
            vscode.commands.registerCommand('gtk4-toolbar.buildAndRun', async () => {
                try {
                    await vscode.commands.executeCommand('workbench.action.tasks.runTask', 'Build & Run GTK4');
                } catch (error) {
                    vscode.window.showErrorMessage('Failed to run build & run task: ' + error.message);
                }
            }),
            vscode.commands.registerCommand('gtk4-toolbar.buildCurrent', () => this.buildCurrent()),
            vscode.commands.registerCommand('gtk4-toolbar.runCurrent', () => this.runCurrent()),
            vscode.commands.registerCommand('gtk4-toolbar.buildRunCurrent', () => this.buildRunCurrent()),
            vscode.commands.registerCommand('gtk4-toolbar.clean', () => this.clean())
        );
    }
}

// Singleton
const buildCommands = new BuildCommands();

module.exports = buildCommands;
