const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const cp = require('child_process');
const exporter = require('./exporter');

function activate(context) {
    console.log('GTK4 Toolbar extension is now active!');
    exporter.activate(context);

    // Shared terminal reference
    let sharedTerminal = null;

    // Get configuration values
    function getConfig() {
        const config = vscode.workspace.getConfiguration('gtk4Toolbar');
        return {
            msys2Path: config.get('msys2Path'),
            msys2Environment: config.get('msys2Environment', 'UCRT64'),
            compiler: config.get('compiler', 'g++'),
            gskRenderer: config.get('gskRenderer', 'cairo'),
            cppStandard: config.get('cppStandard', 'c++17'),
            compilerFlags: config.get('compilerFlags', ['-Wall', '-Wextra']),
            cmakeGenerator: config.get('cmakeGenerator', 'Ninja'),
            cmakeBuildType: config.get('cmakeBuildType', 'Debug'),
            cmakeArgs: config.get('cmakeArgs', ''),
            autoCloseTerminal: config.get('autoCloseTerminal', false),
            commandDelay: config.get('commandDelay', 500),
            msys2StartDelay: config.get('msys2StartDelay', 5000),
            showSuccessNotifications: config.get('showSuccessNotifications', true),
            enableDebugOutput: config.get('enableDebugOutput', false),
            gtkTheme: config.get('gtkTheme', ''),
            gtkDebug: config.get('gtkDebug', ''),
            pkgConfigLibraries: config.get('pkgConfigLibraries', 'gtk4 libadwaita-1 gstreamer-1.0'),
            customEnvVars: config.get('customEnvVars', {})
        };
    }

    // Debug logging function
    function debugLog(message) {
        const config = getConfig();
        if (config.enableDebugOutput) {
            console.log(`[GTK4 Toolbar Debug] ${message}`);
        }
    }

    // Helper to convert Windows path to MSYS2 path
    function toMsysPath(winPath) {
        if (!winPath) return '';
        return winPath.replace(/^([a-zA-Z]):/, (m, d) => `/${d.toLowerCase()}`).replace(/\\/g, '/');
    }

    // Create status bar items
    const cleanButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);
    
    // Current file buttons
    const buildCurrentButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 96);
    const runCurrentButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 95);
    const buildRunCurrentButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 94);
    
    // Settings button
    const settingsButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 93);

    // Configure Clean button
    cleanButton.text = "$(trash) Clean";
    cleanButton.tooltip = "Clean Build Files";
    cleanButton.command = "gtk4-toolbar.clean";
    cleanButton.color = "#ffffffff";

    // Configure Current File buttons
    buildCurrentButton.text = "$(tools) Build";
    buildCurrentButton.tooltip = "Build Current File";
    buildCurrentButton.command = "gtk4-toolbar.buildCurrent";
    buildCurrentButton.color = "#ffffffff";

    runCurrentButton.text = "$(play) Run";
    runCurrentButton.tooltip = "Run Current File";
    runCurrentButton.command = "gtk4-toolbar.runCurrent";
    runCurrentButton.color = "#ffffffff";

    buildRunCurrentButton.text = "$(rocket) Build & Run";
    buildRunCurrentButton.tooltip = "Build and Run Current File";
    buildRunCurrentButton.command = "gtk4-toolbar.buildRunCurrent";
    buildRunCurrentButton.color = "#ffffffff";

    // Configure Settings button
    settingsButton.text = "$(gear) Settings";
    settingsButton.tooltip = "Open GTK4 Toolbar Settings";
    settingsButton.command = "gtk4-toolbar.openSettings";
    settingsButton.color = "#ffffffff";

    cleanButton.show();
    buildCurrentButton.show();
    runCurrentButton.show();
    buildRunCurrentButton.show();
    settingsButton.show();

    // Helper function to get or create shared terminal
    function getSharedTerminal() {
        const config = getConfig();
        if (!sharedTerminal || sharedTerminal.exitStatus !== undefined) {
            // Create a new terminal if none exists or the current one has exited
            const envName = config.msys2Environment;
            const envPath = envName.toLowerCase();
            const env = {
                'MSYSTEM': envName,
                'CHERE_INVOKING': '1',
                'GSK_RENDERER': config.gskRenderer,
                'PKG_CONFIG_PATH': `${toMsysPath(config.msys2Path)}/${envPath}/lib/pkgconfig:${toMsysPath(config.msys2Path)}/${envPath}/share/pkgconfig`
            };

            if (config.gtkTheme) {
                env['GTK_THEME'] = config.gtkTheme;
            }
            if (config.gtkDebug) {
                env['GTK_DEBUG'] = config.gtkDebug;
            }

            sharedTerminal = vscode.window.createTerminal({
                name: 'GTK4 Development',
                hideFromUser: false,
                shellPath: `${config.msys2Path}/usr/bin/bash.exe`,
                shellArgs: ['--login', '-i'],
                env: env
            });

            debugLog(`Created new shared terminal with GSK_RENDERER=${config.gskRenderer}, GTK_THEME=${config.gtkTheme}, MSYSTEM=${envName}`);
        }
        return sharedTerminal;
    }

    // Helper function to get workspace folder
    function getWorkspaceFolder() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // Helper function to create terminal with MSYS2 environment
    function createMSYS2Terminal(name) {
        const config = getConfig();
        const envName = config.msys2Environment;
        const envPath = envName.toLowerCase();
        const env = {
            'MSYSTEM': envName,
            'CHERE_INVOKING': '1',
            'GSK_RENDERER': config.gskRenderer,
            'PKG_CONFIG_PATH': `${toMsysPath(config.msys2Path)}/${envPath}/lib/pkgconfig:${toMsysPath(config.msys2Path)}/${envPath}/share/pkgconfig`
        };

        if (config.gtkTheme) {
            env['GTK_THEME'] = config.gtkTheme;
        }
        if (config.gtkDebug) {
            env['GTK_DEBUG'] = config.gtkDebug;
        }

        return vscode.window.createTerminal({
            name: name,
            hideFromUser: false,
            shellPath: `${config.msys2Path}/usr/bin/bash.exe`,
            shellArgs: ['--login', '-i'],
            env: env
        });
    }

    // Helper function to update CMakeLists.txt with new libraries
    function updateCMakeListsWithLibs(libs) {
        try {
            const workspaceFolder = getWorkspaceFolder();
            const cmakePath = path.join(workspaceFolder, 'CMakeLists.txt');
            
            if (!fs.existsSync(cmakePath)) return;
            
            let content = fs.readFileSync(cmakePath, 'utf8');
            let modified = false;
            const addedLibs = [];

            libs.forEach(lib => {
                // Sanitize lib name for CMake variable (e.g. json-glib-1.0 -> JSON_GLIB_1_0)
                const varName = lib.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                
                // Check if already exists
                if (!content.includes(`pkg_check_modules(${varName}`)) {
                    // Add pkg_check_modules
                    const checkLine = `pkg_check_modules(${varName} IMPORTED_TARGET ${lib})`;
                    // Insert after last pkg_check_modules or find_package
                    const lastCheck = content.lastIndexOf('pkg_check_modules');
                    const insertPos = lastCheck !== -1 ? content.indexOf('\n', lastCheck) + 1 : content.indexOf('find_package') + 25;
                    
                    content = content.slice(0, insertPos) + checkLine + '\n' + content.slice(insertPos);
                    
                    // Add to target_link_libraries
                    // Look for target_link_libraries(main ...)
                    const linkRegex = /target_link_libraries\s*\(\s*main\s+PRIVATE\s+([^)]+)\)/;
                    const match = content.match(linkRegex);
                    if (match) {
                        const newLinkBlock = `\nif(TARGET PkgConfig::${varName})\n    target_link_libraries(main PRIVATE PkgConfig::${varName})\nendif()`;
                        // Append at the end of file or after the main link block
                        content += newLinkBlock + '\n';
                    }
                    
                    modified = true;
                    addedLibs.push(lib);
                }
            });

            if (modified) {
                fs.writeFileSync(cmakePath, content);
                vscode.window.showInformationMessage(`Updated CMakeLists.txt with: ${addedLibs.join(', ')}`);
                // Trigger re-configure
                vscode.commands.executeCommand('gtk4-toolbar.configureIntellisense');
            }
        } catch (e) {
            console.error('Failed to update CMakeLists.txt:', e);
        }
    }

    // Helper function to execute MSYS2 command with shared terminal
    function executeMSYS2Command(commands, description, useSharedTerminal = true) {
        const config = getConfig();
        const workspaceFolder = getWorkspaceFolder();
        const terminal = useSharedTerminal ? getSharedTerminal() : createMSYS2Terminal('GTK4 Operation');
        
        debugLog(`Executing command: ${description}`);
        debugLog(`Using config: ${JSON.stringify(config)}`);
        
        terminal.show();
        
        // Combine all commands into a single line for faster execution
        let fullCommand = `echo "${description}" && echo "==========================================" && cd "${workspaceFolder}"`;
        
        // Execute commands in MSYS2
        if (Array.isArray(commands)) {
            // Join commands with && to run them sequentially in a single line
            const combinedCommand = commands
                .filter(cmd => cmd !== 'exit')
                .join(' && ');
            
            if (combinedCommand) {
                fullCommand += ` && ${combinedCommand}`;
            }
            
            debugLog(`Sending full command: ${fullCommand}`);
            terminal.sendText(fullCommand);
            
            // Auto-close terminal if enabled
            if (config.autoCloseTerminal) {
                // We can't know exactly when it finishes, so we append an exit command if auto-close is on
                // But since we want to keep the terminal open for errors, maybe just don't auto-close for now
                // or use a very long timeout. For now, let's disable auto-close for combined commands
                // to ensure users see the output.
            }
        } else {
            if (commands !== 'exit') {
                fullCommand += ` && ${commands}`;
                debugLog(`Sending full command: ${fullCommand}`);
                terminal.sendText(fullCommand);
            }
        }

        return terminal;
    }

    // Register command handlers for project-level tasks
    const buildCommand = vscode.commands.registerCommand('gtk4-toolbar.build', async () => {
        try {
            await vscode.commands.executeCommand('workbench.action.tasks.runTask', 'Build GTK4');
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run build task: ' + error.message);
        }
    });

    const runCommand = vscode.commands.registerCommand('gtk4-toolbar.run', async () => {
        try {
            await vscode.commands.executeCommand('workbench.action.tasks.runTask', 'Run GTK4');
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run task: ' + error.message);
        }
    });

    const buildAndRunCommand = vscode.commands.registerCommand('gtk4-toolbar.buildAndRun', async () => {
        try {
            await vscode.commands.executeCommand('workbench.action.tasks.runTask', 'Build & Run GTK4');
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run build & run task: ' + error.message);
        }
    });

    const cleanCommand = vscode.commands.registerCommand('gtk4-toolbar.clean', async () => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let command = 'rm -f *.exe *.o';
            
            if (workspaceFolders) {
                const workspacePath = workspaceFolders[0].uri.fsPath;
                const makefilePath = path.join(workspacePath, 'Makefile');
                const cmakePath = path.join(workspacePath, 'CMakeLists.txt');
                
                if (fs.existsSync(cmakePath)) {
                    command = 'rm -rf build';
                } else if (fs.existsSync(makefilePath)) {
                    command = 'make clean';
                }
            }
            
            executeMSYS2Command(command, 'Cleaning build files...', true);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to clean: ' + error.message);
        }
    });

    // Register command handlers for current file operations
    const buildCurrentCommand = vscode.commands.registerCommand('gtk4-toolbar.buildCurrent', async () => {
        try {
            const config = getConfig();
            const editor = vscode.window.activeTextEditor;
            
            // Save all files before building
            await vscode.workspace.saveAll();

            const workspaceFolder = getWorkspaceFolder();
            const cmakePath = path.join(workspaceFolder, 'CMakeLists.txt');
            
            // If CMakeLists.txt exists, we can build regardless of the current file
            if (fs.existsSync(cmakePath)) {
                const envPath = config.msys2Environment.toLowerCase();
                const buildCommands = [
                    `export GSK_RENDERER=${config.gskRenderer}`,
                    `export PATH=${toMsysPath(config.msys2Path)}/${envPath}/bin:$PATH`,
                    `export PKG_CONFIG_PATH=${toMsysPath(config.msys2Path)}/${envPath}/lib/pkgconfig:${toMsysPath(config.msys2Path)}/${envPath}/share/pkgconfig`
                ];
                
                if (config.gtkTheme) {
                    buildCommands.push(`export GTK_THEME="${config.gtkTheme}"`);
                }
                if (config.gtkDebug) {
                    buildCommands.push(`export GTK_DEBUG="${config.gtkDebug}"`);
                }

                buildCommands.push(
                    `echo "Building project with CMake..."`,
                    `mkdir -p build && cd build`,
                    `if [ ! -f CMakeCache.txt ]; then cmake .. -G Ninja; fi`,
                    `cmake --build .`,
                    'if [ $? -eq 0 ]; then echo "Build successful!"; else echo "Build failed!"; fi',
                    'read -p "Press enter to close..."'
                );
                executeMSYS2Command(buildCommands, 'Building Project...', true);
                
                if (config.showSuccessNotifications) {
                    setTimeout(() => {
                        vscode.window.showInformationMessage(`Build command sent...`);
                    }, 1000);
                }
                return;
            }

            // Legacy single file build
            if (!editor) {
                vscode.window.showErrorMessage('No file is currently open');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const fileName = path.basename(filePath);
            const fileBaseName = path.basename(filePath, path.extname(filePath));
            
            if (!fileName.endsWith('.cpp') && !fileName.endsWith('.c')) {
                vscode.window.showErrorMessage('Current file is not a C/C++ file');
                return;
            }

            // Scan for #pragma comment(lib, "...") to support Windows libs automatically
            let extraLibs = '';
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
                if (libs.size > 0) {
                    extraLibs = ' ' + Array.from(libs).join(' ');
                }
            } catch (e) {
                console.warn('Failed to scan for pragma comments:', e);
            }

            const buildCommands = [
                `export GSK_RENDERER=${config.gskRenderer}`,
                `export PATH=${toMsysPath(config.msys2Path)}/${config.msys2Environment.toLowerCase()}/bin:$PATH`,
                `export PKG_CONFIG_PATH=${toMsysPath(config.msys2Path)}/${config.msys2Environment.toLowerCase()}/lib/pkgconfig:${toMsysPath(config.msys2Path)}/${config.msys2Environment.toLowerCase()}/share/pkgconfig`
            ];
            
            if (config.gtkTheme) {
                buildCommands.push(`export GTK_THEME="${config.gtkTheme}"`);
            }
            if (config.gtkDebug) {
                buildCommands.push(`export GTK_DEBUG="${config.gtkDebug}"`);
            }

            // Fallback to g++ with libadwaita-1 added
            const compilerFlagsStr = config.compilerFlags.join(' ');
            buildCommands.push(
                `echo "Compiling ${fileName}..."`,
                `echo "GTK_THEME is set to: $GTK_THEME"`,
                `echo "GSK_RENDERER is set to: $GSK_RENDERER"`,
                `${config.compiler} ${compilerFlagsStr} -std=${config.cppStandard} $(pkg-config --cflags ${config.pkgConfigLibraries}) -o ${fileBaseName}.exe ${fileName} $(pkg-config --libs ${config.pkgConfigLibraries})${extraLibs}`,
                'if [ $? -eq 0 ]; then echo "Build successful! Created ' + fileBaseName + '.exe"; else echo "Build failed!"; fi',
                'read -p "Press enter to close..."'
            );
            executeMSYS2Command(buildCommands, 'Building ' + fileName + '...', true);
            
            if (config.showSuccessNotifications) {
                setTimeout(() => {
                    vscode.window.showInformationMessage(`Build command sent...`);
                }, 1000);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to build: ' + error.message);
        }
    });

    const runCurrentCommand = vscode.commands.registerCommand('gtk4-toolbar.runCurrent', async () => {
        try {
            const config = getConfig();
            const workspaceFolder = getWorkspaceFolder();
            const cmakePath = path.join(workspaceFolder, 'CMakeLists.txt');
            
            // If CMakeLists.txt exists, run the project executable
            if (fs.existsSync(cmakePath)) {
                const envPath = config.msys2Environment.toLowerCase();
                const runCommands = [
                    `export GSK_RENDERER=${config.gskRenderer}`,
                    `export PATH=${toMsysPath(config.msys2Path)}/${envPath}/bin:$PATH`,
                    `export PKG_CONFIG_PATH=${toMsysPath(config.msys2Path)}/${envPath}/lib/pkgconfig:${toMsysPath(config.msys2Path)}/${envPath}/share/pkgconfig`
                ];

                if (config.customEnvVars) {
                    Object.entries(config.customEnvVars).forEach(([key, value]) => {
                        const resolvedValue = value.replace(/\${msys2Path}/g, toMsysPath(config.msys2Path));
                        runCommands.push(`export ${key}=${resolvedValue}`);
                    });
                }
                
                if (config.gtkTheme) {
                    runCommands.push(`export GTK_THEME="${config.gtkTheme}"`);
                }
                if (config.gtkDebug) {
                    runCommands.push(`export GTK_DEBUG="${config.gtkDebug}"`);
                }
                
                // Try to find executable in build folder. Default to 'main.exe'
                runCommands.push(
                    `echo "Running project executable..."`,
                    `if [ -f ./build/main.exe ]; then ./build/main.exe; else echo "Executable not found in build/ folder. Build first."; fi`,
                    'echo "Program finished."'
                );
                
                executeMSYS2Command(runCommands, 'Running Application...', true);
                return;
            }

            // Legacy single file run
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No file is currently open');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const fileName = path.basename(filePath);
            const fileBaseName = path.basename(filePath, path.extname(filePath));
            
            if (!fileName.endsWith('.cpp') && !fileName.endsWith('.c')) {
                vscode.window.showErrorMessage('Current file is not a C/C++ file');
                return;
            }

            const runCommands = [
                `export GSK_RENDERER=${config.gskRenderer}`,
                `export PATH=${toMsysPath(config.msys2Path)}/${config.msys2Environment.toLowerCase()}/bin:$PATH`,
                `export PKG_CONFIG_PATH=${toMsysPath(config.msys2Path)}/${config.msys2Environment.toLowerCase()}/lib/pkgconfig:${toMsysPath(config.msys2Path)}/${config.msys2Environment.toLowerCase()}/share/pkgconfig`
            ];

            if (config.customEnvVars) {
                Object.entries(config.customEnvVars).forEach(([key, value]) => {
                    const resolvedValue = value.replace(/\${msys2Path}/g, toMsysPath(config.msys2Path));
                    runCommands.push(`export ${key}=${resolvedValue}`);
                });
            }
            
            if (config.gtkTheme) {
                runCommands.push(`export GTK_THEME="${config.gtkTheme}"`);
            }
            if (config.gtkDebug) {
                runCommands.push(`export GTK_DEBUG="${config.gtkDebug}"`);
            }
            
            runCommands.push(
                `echo "Running ${fileBaseName}.exe..."`,
                `if [ -f ./${fileBaseName}.exe ]; then ./${fileBaseName}.exe && echo "Program finished."; else echo "Executable ${fileBaseName}.exe not found. Build the file first."; fi`
            );

            executeMSYS2Command(runCommands, 'Running Application...', true);
        
        } catch (error) {
            vscode.window.showErrorMessage('Failed to run: ' + error.message);
        }
    });

    const buildRunCurrentCommand = vscode.commands.registerCommand('gtk4-toolbar.buildRunCurrent', async () => {
        try {
            const config = getConfig();
            
            // Save all files before building
            await vscode.workspace.saveAll();

            const workspaceFolder = getWorkspaceFolder();
            const cmakePath = path.join(workspaceFolder, 'CMakeLists.txt');
            
            // If CMakeLists.txt exists, build and run project
            if (fs.existsSync(cmakePath)) {
                const envPath = config.msys2Environment.toLowerCase();
                const buildRunCommands = [
                    `export GSK_RENDERER=${config.gskRenderer}`,
                    `export PATH=${toMsysPath(config.msys2Path)}/${envPath}/bin:$PATH`,
                    `export PKG_CONFIG_PATH=${toMsysPath(config.msys2Path)}/${envPath}/lib/pkgconfig:${toMsysPath(config.msys2Path)}/${envPath}/share/pkgconfig`
                ];

                if (config.customEnvVars) {
                    Object.entries(config.customEnvVars).forEach(([key, value]) => {
                        const resolvedValue = value.replace(/\${msys2Path}/g, toMsysPath(config.msys2Path));
                        buildRunCommands.push(`export ${key}=${resolvedValue}`);
                    });
                }
                
                if (config.gtkTheme) {
                    buildRunCommands.push(`export GTK_THEME="${config.gtkTheme}"`);
                }
                if (config.gtkDebug) {
                    buildRunCommands.push(`export GTK_DEBUG="${config.gtkDebug}"`);
                }
                
                buildRunCommands.push(
                    `echo "Building and running project with CMake..."`,
                    `mkdir -p build && cd build`,
                    `if [ ! -f CMakeCache.txt ]; then cmake .. -G Ninja; fi`,
                    `cmake --build .`,
                    `if [ $? -eq 0 ]; then echo "Build successful! Running..."; if [ -f ./main.exe ]; then ./main.exe; else echo "Executable not found."; fi; echo "Program finished."; else echo "Build failed!"; fi`
                );
                
                executeMSYS2Command(buildRunCommands, 'Building and running...', true);
                
                if (config.showSuccessNotifications) {
                    setTimeout(() => {
                        vscode.window.showInformationMessage(`Build & Run command sent...`);
                    }, 1000);
                }
                return;
            }

            // Legacy single file build & run
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No file is currently open');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const fileName = path.basename(filePath);
            const fileBaseName = path.basename(filePath, path.extname(filePath));
            
            if (!fileName.endsWith('.cpp') && !fileName.endsWith('.c')) {
                vscode.window.showErrorMessage('Current file is not a C/C++ file');
                return;
            }

            // Scan for #pragma comment(lib, "...") to support Windows libs automatically
            let extraLibs = '';
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
                if (libs.size > 0) {
                    extraLibs = ' ' + Array.from(libs).join(' ');
                }
            } catch (e) {
                console.warn('Failed to scan for pragma comments:', e);
            }

            const buildRunCommands = [
                `export GSK_RENDERER=${config.gskRenderer}`,
                `export PATH=${toMsysPath(config.msys2Path)}/${config.msys2Environment.toLowerCase()}/bin:$PATH`,
                `export PKG_CONFIG_PATH=${toMsysPath(config.msys2Path)}/${config.msys2Environment.toLowerCase()}/lib/pkgconfig:${toMsysPath(config.msys2Path)}/${config.msys2Environment.toLowerCase()}/share/pkgconfig`
            ];

            if (config.customEnvVars) {
                Object.entries(config.customEnvVars).forEach(([key, value]) => {
                    const resolvedValue = value.replace(/\${msys2Path}/g, toMsysPath(config.msys2Path));
                    buildRunCommands.push(`export ${key}=${resolvedValue}`);
                });
            }
            
            if (config.gtkTheme) {
                buildRunCommands.push(`export GTK_THEME="${config.gtkTheme}"`);
            }
            if (config.gtkDebug) {
                buildRunCommands.push(`export GTK_DEBUG="${config.gtkDebug}"`);
            }
            
            const compilerFlagsStr = config.compilerFlags.join(' ');
            buildRunCommands.push(
                `echo "Building and running ${fileName}..."`,
                `${config.compiler} ${compilerFlagsStr} -std=${config.cppStandard} $(pkg-config --cflags ${config.pkgConfigLibraries}) -o ${fileBaseName}.exe ${fileName} $(pkg-config --libs ${config.pkgConfigLibraries})${extraLibs}`,
                `if [ $? -eq 0 ]; then echo "Build successful! Running ${fileBaseName}.exe..."; ./${fileBaseName}.exe; echo "Program finished."; else echo "Build failed!"; fi`
            );

            executeMSYS2Command(buildRunCommands, 'Building and running...', true);
            
            if (config.showSuccessNotifications) {
                setTimeout(() => {
                    vscode.window.showInformationMessage(`Build & Run command sent...`);
                }, 1000);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to build and run: ' + error.message);
        }
    });

    // Configuration command
    const configCommand = vscode.commands.registerCommand('gtk4-toolbar.openSettings', () => {
        const panel = vscode.window.createWebviewPanel(
            'gtk4ToolbarSettings',
            'GTK4 Toolbar Settings',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'web'))]
            }
        );

        // Get path to web resources
        const webPath = path.join(context.extensionPath, 'web');
        const indexHtmlPath = path.join(webPath, 'index.html');

        // Read HTML content
        let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

        // Replace local paths with Webview URIs
        const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'script.js')));
        const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'style.css')));
        const bootstrapCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'lib', 'bootstrap.min.css')));
        const bootstrapJsUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'lib', 'bootstrap.bundle.min.js')));

        // Inject CSP Source
        const cspSource = panel.webview.cspSource;
        htmlContent = htmlContent.replace(/{{cspSource}}/g, cspSource);

        htmlContent = htmlContent.replace('script.js', scriptUri);
        htmlContent = htmlContent.replace('style.css', styleUri);
        htmlContent = htmlContent.replace('lib/bootstrap.min.css', bootstrapCssUri);
        htmlContent = htmlContent.replace('lib/bootstrap.bundle.min.js', bootstrapJsUri);

        panel.webview.html = htmlContent;

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                console.log('[GTK4 Toolbar] Received message:', message.command, message.data);
                switch (message.command) {
                    case 'requestConfig':
                        const currentConfig = getConfig();
                        // Convert array to string for display
                        if (Array.isArray(currentConfig.compilerFlags)) {
                            currentConfig.compilerFlags = currentConfig.compilerFlags.join(' ');
                        }
                        panel.webview.postMessage({
                            command: 'loadConfig',
                            data: currentConfig
                        });
                        // Use currentConfig which already has all settings loaded
                        panel.webview.postMessage({
                            command: 'loadGtkConfig',
                            data: {
                                gskRenderer: currentConfig.gskRenderer,
                                gtkTheme: currentConfig.gtkTheme,
                                gtkDebug: currentConfig.gtkDebug
                            }
                        });
                        break;
                    case 'saveConfig':
                        const newConfig = message.data;
                        console.log('[GTK4 Toolbar] Saving config:', newConfig);
                        
                        try {
                            const configToSave = vscode.workspace.getConfiguration('gtk4Toolbar');
                            // Try Global first to ensure settings persist
                            const target = vscode.ConfigurationTarget.Global;
                            
                            await configToSave.update('msys2Path', newConfig.msys2Path, target);
                            console.log('[GTK4 Toolbar] Saved msys2Path');

                            await configToSave.update('msys2Environment', newConfig.msys2Environment, target);
                            console.log('[GTK4 Toolbar] Saved msys2Environment');

                            await configToSave.update('compiler', newConfig.compiler, target);
                            console.log('[GTK4 Toolbar] Saved compiler');
                            
                            await configToSave.update('cppStandard', newConfig.cppStandard, target);
                            console.log('[GTK4 Toolbar] Saved cppStandard');
                            
                            const flagsArray = newConfig.compilerFlags.split(' ').filter(f => f.length > 0);
                            await configToSave.update('compilerFlags', flagsArray, target);
                            console.log('[GTK4 Toolbar] Saved compilerFlags');

                            await configToSave.update('pkgConfigLibraries', newConfig.pkgConfigLibraries, target);
                            console.log('[GTK4 Toolbar] Saved pkgConfigLibraries');

                            await configToSave.update('cmakeGenerator', newConfig.cmakeGenerator, target);
                            console.log('[GTK4 Toolbar] Saved cmakeGenerator');

                            await configToSave.update('cmakeBuildType', newConfig.cmakeBuildType, target);
                            console.log('[GTK4 Toolbar] Saved cmakeBuildType');

                            await configToSave.update('cmakeArgs', newConfig.cmakeArgs, target);
                            console.log('[GTK4 Toolbar] Saved cmakeArgs');
                            
                            await configToSave.update('autoCloseTerminal', newConfig.autoCloseTerminal, target);
                            console.log('[GTK4 Toolbar] Saved autoCloseTerminal');
                            
                            await configToSave.update('showSuccessNotifications', newConfig.showSuccessNotifications, target);
                            console.log('[GTK4 Toolbar] Saved showSuccessNotifications');

                            await configToSave.update('customEnvVars', newConfig.customEnvVars, target);
                            console.log('[GTK4 Toolbar] Saved customEnvVars');
                            
                            console.log('[GTK4 Toolbar] Configuration saved successfully to Global settings');
                            vscode.window.showInformationMessage('GTK4 Toolbar configuration saved!');
                        } catch (error) {
                            console.error('[GTK4 Toolbar] Save failed:', error);
                            vscode.window.showErrorMessage('Failed to save configuration: ' + error.message);
                        }
                        break;
                    case 'saveGtkConfig':
                        const gtkConfig = message.data;
                        console.log('[GTK4 Toolbar] Saving GTK config:', gtkConfig);
                        
                        try {
                            const gtkConfigToSave = vscode.workspace.getConfiguration('gtk4Toolbar');
                            const gtkTarget = vscode.ConfigurationTarget.Global;
                            
                            await gtkConfigToSave.update('gskRenderer', gtkConfig.gskRenderer, gtkTarget);
                            console.log('[GTK4 Toolbar] Saved gskRenderer');
                            
                            await gtkConfigToSave.update('gtkTheme', gtkConfig.gtkTheme, gtkTarget);
                            console.log('[GTK4 Toolbar] Saved gtkTheme');
                            
                            await gtkConfigToSave.update('gtkDebug', gtkConfig.gtkDebug, gtkTarget);
                            console.log('[GTK4 Toolbar] Saved gtkDebug');
                            
                            console.log('[GTK4 Toolbar] GTK config saved successfully to Global settings');
                            
                            // Dispose shared terminal to force reload of environment variables
                            if (sharedTerminal) {
                                sharedTerminal.dispose();
                                sharedTerminal = null;
                            }
                            
                            vscode.window.showInformationMessage('GTK Environment updated! Terminal restarted.');
                        } catch (error) {
                            console.error('[GTK4 Toolbar] GTK save failed:', error);
                            vscode.window.showErrorMessage('Failed to save GTK configuration: ' + error.message);
                        }
                        break;
                    case 'configureGppIntellisense':
                        try {
                            const config = getConfig();
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (!workspaceFolders) {
                                vscode.window.showErrorMessage('No workspace folder open.');
                                break;
                            }
                            const rootPath = workspaceFolders[0].uri.fsPath;
                            const vscodeDir = path.join(rootPath, '.vscode');
                            if (!fs.existsSync(vscodeDir)) {
                                fs.mkdirSync(vscodeDir);
                            }
                            const propertiesPath = path.join(vscodeDir, 'c_cpp_properties.json');

                            // Default paths if pkg-config fails
                            const envPath = config.msys2Environment.toLowerCase();
                            let includePaths = [
                                "${workspaceFolder}/**",
                                `${config.msys2Path}/${envPath}/include`
                            ];

                            // Try to get paths from pkg-config
                            const pkgConfigPath = path.join(config.msys2Path, envPath, 'bin', 'pkg-config.exe');
                            if (fs.existsSync(pkgConfigPath)) {
                                try {
                                    const env = { ...process.env };
                                    env['PKG_CONFIG_PATH'] = `${config.msys2Path}/${envPath}/lib/pkgconfig:${config.msys2Path}/${envPath}/share/pkgconfig`;
                                    const stdout = cp.execSync(`"${pkgConfigPath}" --cflags-only-I ${config.pkgConfigLibraries}`, { env: env }).toString();
                                    const paths = stdout.trim().split(/\s+/).map(p => {
                                        let cleanPath = p.replace(/^-I/, '').trim();
                                        // Fix MSYS2 paths if they come back as /ucrt64/...
                                        if (cleanPath.startsWith(`/${envPath}`)) {
                                            return path.join(config.msys2Path, cleanPath);
                                        } else if (cleanPath.match(/^\/[a-zA-Z]\//)) {
                                            return cleanPath.replace(/^\/([a-zA-Z])\//, '$1:/');
                                        }
                                        return cleanPath;
                                    });
                                    if (paths.length > 0) {
                                        includePaths = ["${workspaceFolder}/**", ...paths];
                                    }
                                } catch (e) {
                                    console.log('pkg-config lookup failed, using defaults', e);
                                }
                            }

                            // Deduplicate
                            includePaths = [...new Set(includePaths)];

                            const cCppProperties = {
                                "configurations": [
                                    {
                                        "name": "Win32",
                                        "includePath": includePaths,
                                        "defines": [
                                            "_DEBUG",
                                            "UNICODE",
                                            "_UNICODE"
                                        ],
                                        "compilerPath": `${config.msys2Path}/${envPath}/bin/${config.compiler}.exe`,
                                        "cStandard": "c17",
                                        "cppStandard": "c++17",
                                        "intelliSenseMode": "gcc-x64"
                                    }
                                ],
                                "version": 4
                            };

                            fs.writeFileSync(propertiesPath, JSON.stringify(cCppProperties, null, 4));
                            vscode.window.showInformationMessage('c_cpp_properties.json generated for G++ IntelliSense!');

                        } catch (error) {
                            vscode.window.showErrorMessage('Failed to configure G++ IntelliSense: ' + error.message);
                        }
                        break;
                    case 'configureCMake': {
                        try {
                            const config = getConfig();
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (!workspaceFolders) {
                                vscode.window.showErrorMessage('No workspace folder open.');
                                break;
                            }
                            
                            const workspaceRoot = workspaceFolders[0].uri.fsPath;
                            const cmakePath = path.join(workspaceRoot, 'CMakeLists.txt');
                            
                            // Generate CMakeLists.txt if it doesn't exist
                            if (!fs.existsSync(cmakePath)) {
                                let defaultCMake = `cmake_minimum_required(VERSION 3.20)
project(GTK4Project CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(PkgConfig REQUIRED)

# --- HOW TO ADD NEW LIBRARIES ---
# 1. Install the library in MSYS2 (e.g. 'pacman -S mingw-w64-ucrt64-x86_64-json-glib')
# 2. Find its pkg-config name (e.g. 'json-glib-1.0')
# 3. Add a line below: pkg_check_modules(MYLIB IMPORTED_TARGET json-glib-1.0)
# 4. Add 'PkgConfig::MYLIB' to target_link_libraries

# Dynamic libraries from VS Code settings
# Libraries: ${config.pkgConfigLibraries}
`;
                                // Dynamically generate pkg_check_modules for each library
                                const libs = (config.pkgConfigLibraries || '').split(' ').filter(l => l.trim() !== '');
                                libs.forEach(lib => {
                                    const varName = lib.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                                    defaultCMake += `pkg_check_modules(${varName} REQUIRED IMPORTED_TARGET ${lib})\n`;
                                });

                                defaultCMake += `
file(GLOB SOURCES "*.cpp")
if(NOT SOURCES)
    message(FATAL_ERROR "No .cpp files found.")
endif()

add_executable(main \${SOURCES})

# Link libraries
`;
                                libs.forEach(lib => {
                                    const varName = lib.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                                    defaultCMake += `target_link_libraries(main PRIVATE PkgConfig::${varName})\n`;
                                });

                                // Link Windows specific libraries
                                defaultCMake += `target_link_libraries(main PRIVATE iphlpapi)\n`;

                                defaultCMake += `
# Copy all .ui files to the build directory
file(GLOB UI_FILES "*.ui")
set(UI_OUTPUTS "")
foreach(UI_FILE \${UI_FILES})
    get_filename_component(UI_NAME \${UI_FILE} NAME)
    set(OUTPUT_FILE "\${CMAKE_BINARY_DIR}/\${UI_NAME}")
    add_custom_command(
        OUTPUT \${OUTPUT_FILE}
        COMMAND \${CMAKE_COMMAND} -E copy_if_different
            "\${UI_FILE}"
            "\${OUTPUT_FILE}"
        DEPENDS "\${UI_FILE}"
        COMMENT "Copying \${UI_NAME} to build directory"
    )
    list(APPEND UI_OUTPUTS \${OUTPUT_FILE})
endforeach()

add_custom_target(copy_ui_resources ALL DEPENDS \${UI_OUTPUTS})
add_dependencies(main copy_ui_resources)
`;
                                fs.writeFileSync(cmakePath, defaultCMake);
                                vscode.window.showInformationMessage('Generated default CMakeLists.txt');
                            }

                            // Run CMake commands directly (Portable)
                            const terminal = getSharedTerminal();
                            terminal.show();

                            let cmakePackage = 'mingw-w64-ucrt-x86_64-cmake';
                            if (config.msys2Environment === 'MINGW64') {
                                cmakePackage = 'mingw-w64-x86_64-cmake';
                            } else if (config.msys2Environment === 'CLANG64') {
                                cmakePackage = 'mingw-w64-clang-x86_64-cmake';
                            }

                            // Bash command to check/install cmake, create build dir, configure, and build
                            const cmd = `if ! command -v cmake &> /dev/null; then echo "CMake not found. Installing..."; pacman -S --noconfirm ${cmakePackage}; fi && mkdir -p build && cd build && cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON .. && cmake --build .`;
                            terminal.sendText(cmd);
                            
                            // Update settings.json to point to compile_commands.json
                            const workspaceConfig = vscode.workspace.getConfiguration();
                            await workspaceConfig.update('C_Cpp.default.compileCommands', '${workspaceFolder}/build/compile_commands.json', vscode.ConfigurationTarget.Workspace);
                            vscode.window.showInformationMessage('IntelliSense configured! Running CMake...');

                        } catch (error) {
                            console.error('CMake Setup Error:', error);
                            vscode.window.showErrorMessage('CMake Setup Failed: ' + error.message);
                        }
                        break;
                    }
                    case 'pickMsys2Path':
                        const options = {
                            canSelectFiles: false,
                            canSelectFolders: true,
                            canSelectMany: false,
                            openLabel: 'Select MSYS2 Folder'
                        };
                        
                        vscode.window.showOpenDialog(options).then(fileUri => {
                            if (fileUri && fileUri[0]) {
                                panel.webview.postMessage({
                                    command: 'updateMsys2Path',
                                    path: fileUri[0].fsPath
                                });
                            }
                        });
                        break;
                    case 'installMsys2':
                        const installPath = message.path || 'C:\\msys64';
                        const installerUrl = 'https://github.com/msys2/msys2-installer/releases/latest/download/msys2-x86_64-latest.exe';
                        const tempDir = os.tmpdir();
                        const installerPath = path.join(tempDir, 'msys2-installer.exe');

                        vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: "Downloading MSYS2 Installer",
                            cancellable: true
                        }, async (progress, token) => {
                            progress.report({ message: `Source: ${installerUrl}` });
                            try {
                                await new Promise((resolve, reject) => {
                                    const file = fs.createWriteStream(installerPath);
                                    
                                    const download = (url) => {
                                        const request = https.get(url, (response) => {
                                            // Handle redirects (GitHub uses 302 for releases)
                                            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                                                if (response.headers.location) {
                                                    download(response.headers.location);
                                                    return;
                                                }
                                            }

                                            if (response.statusCode !== 200) {
                                                file.close();
                                                fs.unlink(installerPath, () => {});
                                                reject(new Error(`Failed to download: ${response.statusCode}`));
                                                return;
                                            }

                                            // Progress reporting
                                            const totalBytes = parseInt(response.headers['content-length'], 10);
                                            let downloadedBytes = 0;
                                            let lastPercentage = 0;

                                            response.on('data', (chunk) => {
                                                downloadedBytes += chunk.length;
                                                if (totalBytes) {
                                                    const percentage = Math.floor((downloadedBytes / totalBytes) * 100);
                                                    if (percentage > lastPercentage) {
                                                        const increment = percentage - lastPercentage;
                                                        lastPercentage = percentage;
                                                        progress.report({ 
                                                            message: `${percentage}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB / ${(totalBytes / 1024 / 1024).toFixed(1)} MB) from ${new URL(url).hostname}`, 
                                                            increment: increment 
                                                        });
                                                    }
                                                } else {
                                                    progress.report({ message: `${(downloadedBytes / 1024 / 1024).toFixed(1)} MB downloaded` });
                                                }
                                            });
                                            
                                            response.pipe(file);
                                            file.on('finish', () => {
                                                file.close(resolve);
                                            });
                                        });
                                        
                                        request.on('error', (err) => {
                                            file.close();
                                            fs.unlink(installerPath, () => {});
                                            reject(err);
                                        });

                                        token.onCancellationRequested(() => {
                                            request.destroy();
                                            file.close();
                                            fs.unlink(installerPath, () => {});
                                            reject(new Error('Download cancelled'));
                                        });
                                    };

                                    download(installerUrl);
                                });

                                vscode.window.showInformationMessage(`Launching MSYS2 Installer.`);
                                
                                const child = cp.spawn(installerPath, [], { detached: true, stdio: 'ignore' });
                                child.unref();

                            } catch (error) {
                                vscode.window.showErrorMessage('Failed to download MSYS2 installer: ' + error.message);
                            }
                        });
                        break;
                    case 'setupEnvironment':
                        const languages = ['C/C++', 'Python', 'Vala'];
                        vscode.window.showQuickPick(languages, {
                            placeHolder: 'Select your development language for GTK4',
                            title: 'Install GTK4 Dependencies'
                        }).then(selection => {
                            if (selection) {
                                const config = getConfig();
                                const terminal = createMSYS2Terminal('GTK4 Setup');
                                terminal.show();
                                
                                let packages = 'mingw-w64-ucrt-x86_64-gtk4'; // Base GTK4
                                
                                switch (selection) {
                                    case 'C/C++':
                                        packages += ' mingw-w64-ucrt-x86_64-toolchain base-devel';
                                        break;
                                    case 'Python':
                                        packages += ' mingw-w64-ucrt-x86_64-python-gobject';
                                        break;
                                    case 'Vala':
                                        packages += ' mingw-w64-ucrt-x86_64-vala';
                                        break;
                                }

                                terminal.sendText(`echo "Installing GTK4 environment for ${selection}..."`);
                                terminal.sendText(`pacman -S --noconfirm ${packages}`);
                                vscode.window.showInformationMessage(`Installing dependencies for ${selection}. Check the terminal.`);
                            }
                        });
                        break;
                    case 'openMsys2Folder':
                        const folderPath = message.path;
                        if (folderPath && fs.existsSync(folderPath)) {
                            vscode.env.openExternal(vscode.Uri.file(folderPath));
                        } else {
                            vscode.window.showErrorMessage(`Path does not exist: ${folderPath}`);
                        }
                        break;
                    case 'openMsys2Terminal':
                        const msys2Config = getConfig();
                        const envName = msys2Config.msys2Environment.toUpperCase();
                        const msys2Terminal = vscode.window.createTerminal({
                            name: `MSYS2 ${envName}`,
                            shellPath: `${msys2Config.msys2Path}/usr/bin/bash.exe`,
                            shellArgs: ['--login', '-i'],
                            env: {
                                'MSYSTEM': envName,
                                'CHERE_INVOKING': '1'
                            }
                        });
                        msys2Terminal.show();
                        msys2Terminal.sendText(`echo "To install theme dependencies, run: pacman -S --noconfirm git unzip mingw-w64-${msys2Config.msys2Environment.toLowerCase()}-x86_64-sassc meson ninja"`);
                        vscode.window.showInformationMessage('MSYS2 terminal opened. Run the command shown to install dependencies.');
                        break;
                    case 'openThemeFolder':
                        const themeFolderConfig = getConfig();
                        const msys2HomePath = path.join(themeFolderConfig.msys2Path, 'home');
                        
                        // Find the first user directory
                        if (fs.existsSync(msys2HomePath)) {
                            const users = fs.readdirSync(msys2HomePath);
                            if (users.length > 0) {
                                const themesPath = path.join(msys2HomePath, users[0], '.themes');
                                
                                // Create .themes directory if it doesn't exist
                                if (!fs.existsSync(themesPath)) {
                                    fs.mkdirSync(themesPath, { recursive: true });
                                }
                                
                                // Open the folder in file explorer
                                vscode.env.openExternal(vscode.Uri.file(themesPath));
                                vscode.window.showInformationMessage(`Opening theme folder: ${themesPath}`);
                            } else {
                                vscode.window.showErrorMessage('No user found in MSYS2 home directory.');
                            }
                        } else {
                            vscode.window.showErrorMessage('MSYS2 home directory not found. Check your MSYS2 path in settings.');
                        }
                        break;
                    case 'openGlade':
                        const gladeConfig = getConfig();
                        const gladeEnv = gladeConfig.msys2Environment.toUpperCase();
                        const gladeTerminal = vscode.window.createTerminal({
                            name: 'Glade Designer',
                            shellPath: `${gladeConfig.msys2Path}/usr/bin/bash.exe`,
                            shellArgs: ['--login', '-i'],
                            env: {
                                'MSYSTEM': gladeEnv,
                                'CHERE_INVOKING': '1',
                                'GTK_THEME': gladeConfig.gtkTheme || ''
                            }
                        });
                        gladeTerminal.show();
                        // Check if glade is installed, if not install it, then run it
                        const gladePkg = `mingw-w64-${gladeConfig.msys2Environment.toLowerCase()}-x86_64-glade`;
                        gladeTerminal.sendText(`if ! command -v glade &> /dev/null; then echo "Glade not found. Installing..."; pacman -S --noconfirm ${gladePkg}; fi; glade &`);
                        break;
                    case 'deleteTheme':
                        const themePathToDelete = message.path;
                        
                        // Don't allow deleting built-in themes
                        if (themePathToDelete === 'built-in') {
                            vscode.window.showErrorMessage('Cannot delete default GTK themes.');
                            break;
                        }
                        
                        if (themePathToDelete && fs.existsSync(themePathToDelete)) {
                            // Safety check: Don't delete system themes
                            const deleteConfig = getConfig();
                            const systemThemesPath = path.join(deleteConfig.msys2Path, 'usr', 'share', 'themes');
                            if (themePathToDelete.startsWith(systemThemesPath)) {
                                vscode.window.showErrorMessage('Cannot delete system themes.');
                                break;
                            }

                            // Native confirmation dialog
                            const answer = await vscode.window.showWarningMessage(
                                `Are you sure you want to permanently delete the theme at:\n${themePathToDelete}`,
                                { modal: true },
                                'Delete Theme'
                            );

                            if (answer === 'Delete Theme') {
                                try {
                                    fs.rmSync(themePathToDelete, { recursive: true, force: true });
                                    vscode.window.showInformationMessage(`Theme deleted successfully.`);
                                    // Refresh the list
                                    panel.webview.postMessage({ command: 'refreshThemes' });
                                } catch (error) {
                                    vscode.window.showErrorMessage(`Failed to delete theme: ${error.message}`);
                                }
                            }
                        }
                        break;
                    case 'fetchReleases':
                        const fetchRepoOwner = message.repoOwner;
                        const fetchRepoName = message.repoName;
                        const fetchDirName = message.dirName;
                        const fetchRepo = message.repo;
                        
                        // Fetch releases from GitHub API
                        const releaseApiUrl = `https://api.github.com/repos/${fetchRepoOwner}/${fetchRepoName}/releases/latest`;
                        const releaseFolderUrl = `https://api.github.com/repos/${fetchRepoOwner}/${fetchRepoName}/contents/release`;
                        
                        const releases = [];
                        
                        // Try GitHub Releases first
                        https.get(releaseApiUrl, { headers: { 'User-Agent': 'VSCode-GTK4-Extension' } }, (res) => {
                            let data = '';
                            res.on('data', chunk => data += chunk);
                            res.on('end', () => {
                                try {
                                    const releaseData = JSON.parse(data);
                                    if (releaseData.assets) {
                                        releaseData.assets.forEach(asset => {
                                            if (asset.name.match(/\.(tar\.xz|tar\.gz|tar|zip)$/)) {
                                                releases.push({
                                                    name: asset.name,
                                                    url: asset.browser_download_url,
                                                    size: (asset.size / 1024 / 1024).toFixed(2) + ' MB'
                                                });
                                            }
                                        });
                                    }
                                } catch (e) {
                                    console.error('Error parsing release data:', e);
                                }
                                
                                // If no GitHub releases, try release folder
                                if (releases.length === 0) {
                                    https.get(releaseFolderUrl, { headers: { 'User-Agent': 'VSCode-GTK4-Extension' } }, (folderRes) => {
                                        let folderData = '';
                                        folderRes.on('data', chunk => folderData += chunk);
                                        folderRes.on('end', () => {
                                            try {
                                                const folderFiles = JSON.parse(folderData);
                                                if (Array.isArray(folderFiles)) {
                                                    folderFiles.forEach(file => {
                                                        if (file.name.match(/\.(tar\.xz|tar\.gz|tar|zip)$/) && file.download_url) {
                                                            releases.push({
                                                                name: file.name,
                                                                url: file.download_url,
                                                                size: (file.size / 1024).toFixed(2) + ' KB'
                                                            });
                                                        }
                                                    });
                                                }
                                            } catch (e) {
                                                console.error('Error parsing release folder:', e);
                                            }
                                            
                                            // Send releases back to webview
                                            panel.webview.postMessage({
                                                command: 'showReleaseSelection',
                                                releases: releases,
                                                repo: fetchRepo,
                                                dirName: fetchDirName
                                            });
                                        });
                                    }).on('error', () => {
                                        // Send empty releases
                                        panel.webview.postMessage({
                                            command: 'showReleaseSelection',
                                            releases: releases,
                                            repo: fetchRepo,
                                            dirName: fetchDirName
                                        });
                                    });
                                } else {
                                    // Send releases back to webview
                                    panel.webview.postMessage({
                                        command: 'showReleaseSelection',
                                        releases: releases,
                                        repo: fetchRepo,
                                        dirName: fetchDirName
                                    });
                                }
                            });
                        }).on('error', (e) => {
                            console.error('Error fetching releases:', e);
                            panel.webview.postMessage({
                                command: 'showReleaseSelection',
                                releases: [],
                                repo: fetchRepo,
                                dirName: fetchDirName
                            });
                        });
                        break;
                    case 'installTheme':
                        const repo = message.repo;
                        const dirName = message.dirName;
                        const releaseUrls = message.releaseUrls || [];
                        const repoOwner = repo.split('/')[3]; // Extract owner from github.com/owner/repo.git
                        const repoName = repo.split('/')[4].replace('.git', '');
                        
                        const installConfig = getConfig();
                        const installEnv = installConfig.msys2Environment.toLowerCase();

                        const installCommands = [
                            `export PATH="/${installEnv}/bin:$PATH"`,  // Ensure environment tools (npm, sassc, etc.) are in PATH
                            'echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
                            `echo "Installing Theme: ${dirName}"`,
                            'echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
                            'echo ""',
                            'mkdir -p ~/.themes',
                            'cd ~/.themes',
                            'INSTALLED=false'
                        ];
                        
                        // If user selected specific releases, download those
                        if (releaseUrls && releaseUrls.length > 0) {
                            installCommands.push(
                                'echo "Step 1/2: Downloading selected releases..."',
                                `echo "Downloading ${releaseUrls.length} selected variant(s)..."`
                            );
                            
                            releaseUrls.forEach((url) => {
                                const fileName = url.split('/').pop();
                                installCommands.push(
                                    `echo "  → Downloading ${fileName}..."`,
                                    `curl -L -o "${fileName}" "${url}" 2>/dev/null`,
                                    'if [ $? -eq 0 ]; then',
                                    `  echo "  → Extracting ${fileName}..."`,
                                    `  if [[ "${fileName}" == *.tar.xz ]]; then`,
                                    `    tar -xf "${fileName}" 2>/dev/null`,
                                    `  elif [[ "${fileName}" == *.tar.gz || "${fileName}" == *.tar ]]; then`,
                                    `    tar -xzf "${fileName}" 2>/dev/null || tar -xf "${fileName}" 2>/dev/null`,
                                    `  elif [[ "${fileName}" == *.zip ]]; then`,
                                    `    unzip -q "${fileName}" 2>/dev/null`,
                                    '  fi',
                                    `  rm "${fileName}"`,
                                    '  INSTALLED=true',
                                    'fi'
                                );
                            });
                            
                            installCommands.push(
                                'if [ "$INSTALLED" = "true" ]; then',
                                '  echo "✓ Selected themes installed successfully!"',
                                'fi'
                            );
                        } else {
                            // Auto-detect releases (old behavior)
                            installCommands.push(
                                'echo "Step 1/4: Auto-detecting releases..."',
                                '# First, check GitHub Releases',
                                `RELEASE_URLS=$(curl -s "https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest" | grep -E 'browser_download_url.*\\.(tar\\.xz|tar\\.gz|zip)' | grep -v 'Source code' | cut -d '"' -f 4)`,
                                'if [ -n "$RELEASE_URLS" ]; then',
                            '  echo "✓ Found GitHub Release assets"',
                            '  RELEASE_COUNT=$(echo "$RELEASE_URLS" | wc -l)',
                            '  echo "✓ Found $RELEASE_COUNT release variant(s)"',
                            '  echo "Downloading all theme variants..."',
                            '  INSTALLED=false',
                            '  while IFS= read -r RELEASE_URL; do',
                            '    if [ -n "$RELEASE_URL" ]; then',
                            '      RELEASE_FILE=$(basename "$RELEASE_URL")',
                            '      echo "  → Downloading $RELEASE_FILE..."',
                            '      curl -L -o "$RELEASE_FILE" "$RELEASE_URL" 2>/dev/null',
                            '      if [ $? -eq 0 ]; then',
                            '        echo "  → Extracting $RELEASE_FILE..."',
                            '        if [[ "$RELEASE_FILE" == *.tar.xz ]]; then',
                            '          tar -xf "$RELEASE_FILE" 2>/dev/null',
                            '        elif [[ "$RELEASE_FILE" == *.tar.gz ]]; then',
                            '          tar -xzf "$RELEASE_FILE" 2>/dev/null',
                            '        elif [[ "$RELEASE_FILE" == *.zip ]]; then',
                            '          unzip -q "$RELEASE_FILE" 2>/dev/null',
                            '        fi',
                            '        rm "$RELEASE_FILE"',
                            '        INSTALLED=true',
                            '      fi',
                            '    fi',
                            '  done <<< "$RELEASE_URLS"',
                            '  if [ "$INSTALLED" = "true" ]; then',
                            '    echo "✓ All theme variants installed from GitHub Releases!"',
                            '  fi',
                            'fi',
                            '',
                            '# If no GitHub Release, check for release folder in repository',
                            'if [ "$INSTALLED" != "true" ]; then',
                            '  echo "Checking for release folder in repository..."',
                            `  RELEASE_FOLDER_FILES=$(curl -s "https://api.github.com/repos/${repoOwner}/${repoName}/contents/release" | grep -E '"download_url".*\\.(tar\\.xz|tar\\.gz|tar|zip)"' | cut -d '"' -f 4)`,
                            '  if [ -n "$RELEASE_FOLDER_FILES" ]; then',
                            '    RELEASE_COUNT=$(echo "$RELEASE_FOLDER_FILES" | wc -l)',
                            '    echo "✓ Found $RELEASE_COUNT pre-built theme(s) in release folder"',
                            '    echo "Downloading theme variants from release folder..."',
                            '    while IFS= read -r RELEASE_URL; do',
                            '      if [ -n "$RELEASE_URL" ]; then',
                            '        RELEASE_FILE=$(basename "$RELEASE_URL")',
                            '        echo "  → Downloading $RELEASE_FILE..."',
                            '        curl -L -o "$RELEASE_FILE" "$RELEASE_URL" 2>/dev/null',
                            '        if [ $? -eq 0 ]; then',
                            '          echo "  → Extracting $RELEASE_FILE..."',
                            '          if [[ "$RELEASE_FILE" == *.tar.xz ]]; then',
                            '            tar -xf "$RELEASE_FILE" 2>/dev/null',
                            '          elif [[ "$RELEASE_FILE" == *.tar.gz || "$RELEASE_FILE" == *.tar ]]; then',
                            '            tar -xzf "$RELEASE_FILE" 2>/dev/null || tar -xf "$RELEASE_FILE" 2>/dev/null',
                            '          elif [[ "$RELEASE_FILE" == *.zip ]]; then',
                            '            unzip -q "$RELEASE_FILE" 2>/dev/null',
                            '          fi',
                            '          rm "$RELEASE_FILE"',
                            '          INSTALLED=true',
                            '        fi',
                            '      fi',
                            '    done <<< "$RELEASE_FOLDER_FILES"',
                            '    if [ "$INSTALLED" = "true" ]; then',
                            '      echo "✓ All theme variants installed from release folder!"',
                            '    fi',
                            '  else',
                            '    echo "No release folder found, will build from source..."',
                            '  fi',
                            'fi',
                            'echo ""',
                            'if [ "$INSTALLED" != "true" ]; then',
                            '  echo "Step 2/4: Checking dependencies..."',
                            '  MISSING_DEPS=""',
                            '  command -v git &> /dev/null || MISSING_DEPS="$MISSING_DEPS git"',
                            '  command -v unzip &> /dev/null || MISSING_DEPS="$MISSING_DEPS unzip"',
                            '  command -v sassc &> /dev/null || MISSING_DEPS="$MISSING_DEPS mingw-w64-ucrt-x86_64-sassc"',
                            '  command -v meson &> /dev/null || MISSING_DEPS="$MISSING_DEPS meson"',
                            '  command -v ninja &> /dev/null || MISSING_DEPS="$MISSING_DEPS ninja"',
                            '  if [ -n "$MISSING_DEPS" ]; then',
                            '    echo "⚠ Missing dependencies:$MISSING_DEPS"',
                            '    echo "Please install manually: pacman -S --noconfirm$MISSING_DEPS"',
                            '    echo "Or click the Open Terminal button in the Online Themes tab."',
                            '  else',
                            '    echo "✓ All dependencies installed"',
                            '  fi',
                            '  echo ""',
                            '  echo "Step 3/4: Downloading theme source..."',
                            `  if [ -d "${dirName}" ]; then`,
                            `    # Check if it's a git repository`,
                            `    if [ -d "${dirName}/.git" ]; then`,
                            `      echo "Theme ${dirName} already exists. Updating..."`,
                            `      cd "${dirName}" && git pull`,
                            `    else`,
                            `      echo "Theme ${dirName} exists but is not a git repository. Removing and re-cloning..."`,
                            `      rm -rf "${dirName}"`,
                            `      git clone "${repo}" "${dirName}"`,
                            `      cd "${dirName}"`,
                            `    fi`,
                            '  else',
                            `    git clone "${repo}" "${dirName}"`,
                            `    cd "${dirName}"`,
                            '  fi',
                            '  echo ""',
                            '  echo "Step 4/4: Building theme..."',
                            '  BUILT=false',
                            '# Try parse-sass.sh first (works better on Windows)',
                            'if [ -f "./parse-sass.sh" ]; then',
                            '  echo "Building with parse-sass.sh..."',
                            '  if bash ./parse-sass.sh 2>/dev/null; then',
                            '    echo "✓ CSS generated successfully"',
                            '    # For WhiteSur and similar themes, copy src/main to theme directory',
                            '    if [ -d "./src/main" ]; then',
                            `      THEME_NAME="$(basename '${dirName}' | sed 's/-gtk-theme//')"`,
                            '      echo "Installing theme files to ~/.themes/$THEME_NAME..."',
                            '      mkdir -p ~/.themes/"$THEME_NAME"',
                            '      cp -r ./src/main/* ~/.themes/"$THEME_NAME"/',
                            '      # Fix GTK4 CSS naming (gtk-Light.css -> gtk.css, gtk-Dark.css -> gtk-dark.css)',
                            '      if [ -f ~/.themes/"$THEME_NAME"/gtk-4.0/gtk-Light.css ] && [ ! -f ~/.themes/"$THEME_NAME"/gtk-4.0/gtk.css ]; then',
                            '        cp ~/.themes/"$THEME_NAME"/gtk-4.0/gtk-Light.css ~/.themes/"$THEME_NAME"/gtk-4.0/gtk.css',
                            '        echo "✓ Created gtk.css from gtk-Light.css"',
                            '      fi',
                            '      if [ -f ~/.themes/"$THEME_NAME"/gtk-3.0/gtk-Light.css ] && [ ! -f ~/.themes/"$THEME_NAME"/gtk-3.0/gtk.css ]; then',
                            '        cp ~/.themes/"$THEME_NAME"/gtk-3.0/gtk-Light.css ~/.themes/"$THEME_NAME"/gtk-3.0/gtk.css',
                            '      fi',
                            '      # Create index.theme if it doesn\'t exist',
                            '      if [ ! -f ~/.themes/"$THEME_NAME"/index.theme ]; then',
                            '        cat > ~/.themes/"$THEME_NAME"/index.theme << "EOFindex"',
                            '[Desktop Entry]',
                            'Type=X-GNOME-Metatheme',
                            'Name=Theme',
                            'Comment=GTK Theme',
                            'Encoding=UTF-8',
                            '',
                            '[X-GNOME-Metatheme]',
                            'GtkTheme=Theme',
                            'MetacityTheme=Theme',
                            'EOFindex',
                            '        # Replace "Theme" with actual theme name',
                            '        sed -i "s/Theme/$THEME_NAME/g" ~/.themes/"$THEME_NAME"/index.theme',
                            '      fi',
                            '      echo "✓ Theme installed to ~/.themes/$THEME_NAME"',
                            '      BUILT=true',
                            '    fi',
                            '  fi',
                            'fi',
                            '# Try meson build if not yet installed',
                            'if [ "$BUILT" = false ] && [ -f "./meson.build" ] && command -v meson &> /dev/null; then',
                            '  echo "Trying meson build system..."',
                            '  MESON_PREFIX="$(cd ~ && pwd)/.local"',  // Get absolute MSYS2 path
                            '  meson setup build --prefix="$MESON_PREFIX" --wipe 2>/dev/null || meson setup build --prefix="$MESON_PREFIX"',
                            '  if ninja -C build 2>/dev/null && ninja -C build install 2>/dev/null; then',
                            '    BUILT=true',
                            '    echo "✓ Meson build successful"',
                            '  else',
                            '    echo "⚠ Meson build failed (this is OK, theme may still work)"',
                            '  fi',
                            'fi',
                            '# Try install.sh if available',
                            '  if [ "$BUILT" = false ] && [ -f "./install.sh" ]; then',
                            '    echo "Running install.sh..."',
                            '    bash ./install.sh --dest ~/.themes && BUILT=true',
                            '  fi',
                            '  # Check if theme is already built',
                            '  if [ "$BUILT" = false ]; then',
                            '    if [ -d "./gtk-4.0" ] || [ -d "./gtk-3.0" ]; then',
                            '      echo "✓ Theme appears to be pre-built"',
                            '      BUILT=true',
                            '    else',
                            '      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
                            '      echo "⚠ Could not build theme"',
                            '      echo ""',
                            '      echo "This theme requires building from source, which may not work"',
                            '      echo "properly on Windows due to path compatibility issues."',
                            '      echo ""',
                            '      echo "💡 TIP: For best results on Windows, choose themes that have:"',
                            '      echo "  • GitHub Releases (pre-built archives)"',
                            '      echo "  • A /release folder in the repository"',
                            '      echo "  • Pre-compiled CSS files"',
                            '      echo ""',
                            '      echo "Examples: WhiteSur, Nordic, Dracula, Arc"',
                            '      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
                            '    fi',
                            '  fi',
                            'fi',
                            'echo ""',
                            'if [ "$BUILT" = true ]; then',
                            '  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
                            '  echo "✓ Installation complete!"',
                            '  echo "  1. Go to GTK Environment tab"',
                            '  echo "  2. Click Refresh List"',
                            '  echo "  3. Select your theme and Apply"',
                            '  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
                            'fi'
                            );
                        }
                        
                        executeMSYS2Command(installCommands, `Installing Theme: ${dirName}`, true);
                        vscode.window.showInformationMessage(`Installing ${dirName}... Check the terminal for progress.`);
                        
                        // Refresh the installed themes list after a delay
                        setTimeout(() => {
                            panel.webview.postMessage({ command: 'refreshThemes' });
                        }, 5000);
                        break;
                    case 'requestInstalledThemes':
                        const themeConfig = getConfig();
                        const msys2Path = themeConfig.msys2Path;
                        const themes = [];
                        
                        // Add default GTK4 themes that are always available
                        const defaultThemes = [
                            { name: 'Adwaita', type: 'Default (Light)', path: 'built-in', builtIn: true },
                            { name: 'Adwaita-dark', type: 'Default (Dark)', path: 'built-in', builtIn: true }
                        ];
                        themes.push(...defaultThemes);

                        if (msys2Path && fs.existsSync(msys2Path)) {
                            // Check /usr/share/themes
                            const systemThemesPath = path.join(msys2Path, 'usr', 'share', 'themes');
                            if (fs.existsSync(systemThemesPath)) {
                                try {
                                    const items = fs.readdirSync(systemThemesPath);
                                    items.forEach(item => {
                                        try {
                                            if (fs.statSync(path.join(systemThemesPath, item)).isDirectory()) {
                                                themes.push({ 
                                                    name: item, 
                                                    type: 'System',
                                                    path: path.join(systemThemesPath, item)
                                                });
                                            }
                                        } catch (e) {}
                                    });
                                } catch (e) { console.error('Error reading system themes:', e); }
                            }

                            // Check user themes in /home/<user>/.themes
                            const homeRoot = path.join(msys2Path, 'home');
                            if (fs.existsSync(homeRoot)) {
                                try {
                                    const users = fs.readdirSync(homeRoot);
                                    users.forEach(user => {
                                        const userThemePath = path.join(homeRoot, user, '.themes');
                                        if (fs.existsSync(userThemePath)) {
                                            try {
                                                const items = fs.readdirSync(userThemePath);
                                                items.forEach(item => {
                                                    try {
                                                        if (fs.statSync(path.join(userThemePath, item)).isDirectory()) {
                                                            // Avoid duplicates if possible, or tag with user
                                                            // Check if already added (e.g. via custom path)
                                                            if (!themes.some(t => t.name === item)) {
                                                                themes.push({ 
                                                                    name: item, 
                                                                    type: `User (${user})`,
                                                                    path: path.join(userThemePath, item)
                                                                });
                                                            }
                                                        }
                                                    } catch (e) {}
                                                });
                                            } catch (e) {}
                                        }
                                    });
                                } catch (e) { console.error('Error reading user themes:', e); }
                            }
                        }
                        
                        panel.webview.postMessage({ command: 'updateInstalledThemes', themes: themes });
                        break;
                    case 'searchOnlineThemes':
                        const query = message.query || 'topic:gtk-theme';
                        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=20`;
                        
                        const requestOptions = {
                            headers: {
                                'User-Agent': 'VSCode-GTK4-Toolbar-Extension'
                            }
                        };

                        https.get(url, requestOptions, (res) => {
                            let data = '';
                            res.on('data', (chunk) => { data += chunk; });
                            res.on('end', () => {
                                try {
                                    const json = JSON.parse(data);
                                    const results = json.items ? json.items.map(item => ({
                                        name: item.name,
                                        author: item.owner.login,
                                        description: item.description,
                                        stars: item.stargazers_count,
                                        repo: item.clone_url,
                                        dirName: item.name
                                    })) : [];
                                    panel.webview.postMessage({ command: 'onlineThemesResult', themes: results });
                                } catch (e) {
                                    console.error('Error parsing GitHub response:', e);
                                    panel.webview.postMessage({ command: 'onlineThemesResult', themes: [] });
                                }
                            });
                        }).on('error', (e) => {
                            console.error('Error fetching themes:', e);
                            panel.webview.postMessage({ command: 'onlineThemesResult', themes: [] });
                        });
                        break;
                    case 'searchPackages':
                        const pkgConfig = getConfig();
                        const pkgMsys2Path = pkgConfig.msys2Path;
                        const pkgQuery = message.query;
                        
                        if (!pkgMsys2Path || !fs.existsSync(pkgMsys2Path)) {
                            vscode.window.showErrorMessage('MSYS2 path not configured or invalid.');
                            return;
                        }

                        const bashPath = path.join(pkgMsys2Path, 'usr', 'bin', 'bash.exe');
                        // Use -lc to run in login shell context
                        const searchCmd = `"${bashPath}" -lc "pacman -Ss ${pkgQuery}"`;
                        
                        cp.exec(searchCmd, (err, stdout, stderr) => {
                            // pacman returns 1 if no results found, but we still want to send empty list
                            const lines = stdout ? stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];
                            panel.webview.postMessage({ command: 'searchResults', results: lines });
                        });
                        break;

                    case 'installPackage':
                        const pkgToInstall = message.package;
                        executeMSYS2Command(`pacman -S --noconfirm ${pkgToInstall}`, `Installing ${pkgToInstall}...`, true);
                        
                        // Poll for installation completion and update CMakeLists.txt
                        const config = getConfig();
                        if (!config.msys2Path) break;
                        
                        const installBashPath = path.join(config.msys2Path, 'usr', 'bin', 'bash.exe');
                        let attempts = 0;
                        const maxAttempts = 60; // 5 minutes max
                        
                        const checkInstall = setInterval(() => {
                            attempts++;
                            if (attempts > maxAttempts) {
                                clearInterval(checkInstall);
                                return;
                            }

                            cp.exec(`"${installBashPath}" -lc "pacman -Q ${pkgToInstall}"`, (err, stdout) => {
                                if (!err && stdout.includes(pkgToInstall)) {
                                    clearInterval(checkInstall);
                                    // Package is installed. Find .pc files.
                                    cp.exec(`"${installBashPath}" -lc "pacman -Ql ${pkgToInstall} | grep '\\.pc$'"`, (err, stdout) => {
                                        if (!err && stdout) {
                                            const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                                            const newLibs = [];
                                            
                                            lines.forEach(line => {
                                                // Extract filename from path (e.g. /mingw64/lib/pkgconfig/json-glib-1.0.pc)
                                                const filename = line.split('/').pop(); 
                                                if (filename && filename.endsWith('.pc')) {
                                                    newLibs.push(filename.replace('.pc', ''));
                                                }
                                            });

                                            if (newLibs.length > 0) {
                                                updateCMakeListsWithLibs(newLibs);
                                            }
                                        }
                                    });
                                }
                            });
                        }, 5000);
                        break;
                    case 'installGStreamerSuite':
                        const gstPackages = [
                            'mingw-w64-ucrt-x86_64-gstreamer',
                            'mingw-w64-ucrt-x86_64-gst-plugins-base',
                            'mingw-w64-ucrt-x86_64-gst-plugins-good',
                            'mingw-w64-ucrt-x86_64-gst-plugins-bad',
                            'mingw-w64-ucrt-x86_64-gst-plugins-ugly',
                            'mingw-w64-ucrt-x86_64-gst-libav',
                            'mingw-w64-ucrt-x86_64-glib-networking'
                        ].join(' ');
                        executeMSYS2Command(`pacman -S --noconfirm ${gstPackages}`, 'Installing GStreamer Suite...', true);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    // Add all items to context subscriptions
    context.subscriptions.push(
        cleanButton,
        buildCurrentButton,
        runCurrentButton,
        buildRunCurrentButton,
        settingsButton,
        buildCommand,
        runCommand,
        buildAndRunCommand,
        cleanCommand,
        buildCurrentCommand,
        runCurrentCommand,
        buildRunCurrentCommand,
        configCommand
    );

    // Show welcome message
    vscode.window.showInformationMessage('GTK4 Toolbar with integrated build system loaded! Check the status bar for build buttons.');
}

function deactivate() {
    console.log('GTK4 Toolbar extension deactivated');
}

module.exports = {
    activate,
    deactivate
};