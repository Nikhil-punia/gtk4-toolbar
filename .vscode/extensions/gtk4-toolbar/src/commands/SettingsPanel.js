/**
 * Settings Panel
 * Handles the webview settings panel - complete implementation matching original extension.js
 */
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const cp = require('child_process');
const { 
    ConfigManager, 
    TerminalManager, 
    ThemeManager, 
    PackageManager 
} = require('../managers');
const { AndroidBuilder, PixiewoodPatcher } = require('../android');
const { PathUtils, Logger } = require('../utils');

class SettingsPanel {
    constructor() {
        this.panel = null;
        this.context = null;
    }

    /**
     * Open the settings panel
     * @param {vscode.ExtensionContext} context 
     */
    open(context) {
        this.context = context;
        
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'gtk4ToolbarSettings',
            'GTK4 Toolbar Settings',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'web'))
                ]
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = null;
        });

        // Load HTML content
        const webPath = path.join(context.extensionPath, 'web');
        this.panel.webview.html = this.getWebviewContent(webPath, this.panel.webview);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message, context),
            undefined,
            context.subscriptions
        );
    }

    /**
     * Get webview HTML content
     * @param {string} webPath 
     * @param {vscode.Webview} webview 
     * @returns {string}
     */
    getWebviewContent(webPath, webview) {
        const indexHtmlPath = path.join(webPath, 'index.html');
        let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

        // Replace paths with webview URIs using robust regex patterns
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'script.js')));
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'style.css')));
        const bootstrapCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'lib', 'bootstrap.min.css')));
        const bootstrapJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'lib', 'bootstrap.bundle.min.js')));
        const fontAwesomeCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'lib', 'fontawesome', 'css', 'all.min.css')));
        const robotoFontCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'lib', 'fonts', 'roboto-local.css')));
        const logoUri = webview.asWebviewUri(vscode.Uri.file(path.join(webPath, 'lib', 'logo.png')));

        const cspSource = webview.cspSource;
        
        // Replace CSP source
        htmlContent = htmlContent.replace(/{{cspSource}}/g, cspSource);
        
        // Use regex to replace only src/href attributes to avoid replacing text content
        htmlContent = htmlContent.replace(/src\s*=\s*["']script\.js["']/g, `src="${scriptUri.toString()}"`);
        htmlContent = htmlContent.replace(/href\s*=\s*["']style\.css["']/g, `href="${styleUri.toString()}"`);
        htmlContent = htmlContent.replace(/href\s*=\s*["']lib\/bootstrap\.min\.css["']/g, `href="${bootstrapCssUri.toString()}"`);
        htmlContent = htmlContent.replace(/src\s*=\s*["']lib\/bootstrap\.bundle\.min\.js["']/g, `src="${bootstrapJsUri.toString()}"`);
        htmlContent = htmlContent.replace(/href\s*=\s*["']lib\/fontawesome\/css\/all\.min\.css["']/g, `href="${fontAwesomeCssUri.toString()}"`);
        htmlContent = htmlContent.replace(/href\s*=\s*["']lib\/fonts\/roboto-local\.css["']/g, `href="${robotoFontCssUri.toString()}"`);
        htmlContent = htmlContent.replace(/src\s*=\s*["']lib\/logo\.png["']/g, `src="${logoUri.toString()}"`);

        return htmlContent;
    }

    /**
     * Handle messages from webview
     * @param {Object} message 
     * @param {vscode.ExtensionContext} context 
     */
    async handleMessage(message, context) {
        Logger.debug(`Received message: ${message.command}`);
        
        switch (message.command) {
            // ============== Configuration ==============
            case 'requestConfig':
                this.sendConfig();
                break;

            case 'saveConfig':
                await this.saveConfig(message.data);
                break;

            case 'saveGtkConfig':
                await this.saveGtkConfig(message.data);
                break;

            case 'saveAndroidConfig':
                await this.saveAndroidConfig(message.data);
                break;

            // ============== Path Pickers ==============
            case 'pickMsys2Path':
                await this.pickFolder('msys2Path', 'Select MSYS2 Installation Directory', 'updateMsys2Path');
                break;

            case 'pickPixiewoodPath':
                await this.pickFile('pixiewoodPath', 'Select Pixiewood Script', 'updatePixiewoodPath');
                break;

            case 'pickPixiewoodInstallDir':
                await this.pickFolder('pixiewoodInstallDir', 'Select Installation Directory', 'updatePixiewoodInstallDir');
                break;

            case 'pickAndroidManifest':
                await this.pickFile('androidManifestPath', 'Select Android Manifest', 'updateAndroidManifestPath', { 'XML Files': ['xml'] });
                break;

            case 'pickAndroidSdkPath':
                await this.pickFolder('androidSdkPath', 'Select Android SDK Directory', 'updateAndroidSdkPath');
                break;

            case 'pickAndroidNdkPath':
                await this.pickFolder('androidNdkPath', 'Select Android NDK Directory', 'updateAndroidNdkPath');
                break;

            case 'pickAndroidStudioPath':
                await this.pickFolder('androidStudioPath', 'Select Android Studio Directory', 'updateAndroidStudioPath');
                break;

            case 'pickMesonPath':
                await this.pickFile('mesonPath', 'Select Meson Executable', 'updateMesonPath');
                break;

            // ============== Environment Setup ==============
            case 'setupEnvironment':
                this.setupEnvironment();
                break;

            case 'openMsys2Folder':
                this.openFolder(message.path);
                break;

            case 'openMsys2Terminal':
                this.openMsys2Terminal();
                break;

            case 'installMsys2':
                await this.installMsys2(message.path);
                break;

            // ============== Package Management ==============
            case 'installPackage':
                this.installPackage(message.package);
                break;

            case 'removePackage':
                this.removePackage(message.package);
                break;

            case 'searchPackages':
                await this.searchPackages(message.query);
                break;

            case 'installGStreamerSuite':
                PackageManager.installGStreamerSuite();
                break;

            // ============== Theme Management ==============
            case 'requestInstalledThemes':
                this.getInstalledThemes();
                break;

            case 'searchOnlineThemes':
                await this.searchOnlineThemes(message.query);
                break;

            case 'fetchReleases':
                await this.fetchReleases(message);
                break;

            case 'installTheme':
                await this.installTheme(message);
                break;

            case 'deleteTheme':
                await this.deleteTheme(message.path);
                break;

            case 'openThemeFolder':
                this.openThemeFolder();
                break;

            // ============== IntelliSense/CMake ==============
            case 'configureGppIntellisense':
                await this.configureGppIntellisense();
                break;

            case 'configureCMake':
                await this.configureCMake();
                break;

            // ============== Android/Pixiewood ==============
            case 'checkPixiewoodStatus':
                this.checkPixiewoodStatus(message.path);
                break;

            case 'runAndroidPrepare':
                await this.runAndroidPrepare();
                break;

            case 'runAndroidGenerate':
                this.runAndroidGenerate();
                break;

            case 'runAndroidBuild':
                this.runAndroidBuild();
                break;

            case 'installPixiewood':
                await this.installPixiewood(message.path, context);
                break;

            case 'copyLibCppShared':
                this.copyLibCppShared();
                break;

            // ============== Tools ==============
            case 'openGlade':
                this.openGlade();
                break;

            // ============== ADB Device Management ==============
            case 'getAdbDevices':
                await this.getAdbDevices();
                break;

            case 'loadAppToDevice':
                await this.loadAppToDevice(message.serial);
                break;

            default:
                Logger.debug(`Unknown message command: ${message.command}`);
        }
    }

    // ==================== Configuration Methods ====================

    /**
     * Send current config to webview
     */
    sendConfig() {
        if (!this.panel) return;
        
        const config = ConfigManager.getAll();
        
        // Convert array to string for display
        if (Array.isArray(config.compilerFlags)) {
            config.compilerFlags = config.compilerFlags.join(' ');
        }
        
        // Send main config
        this.postMessage({ 
            command: 'loadConfig', 
            data: config 
        });
        
        // Also send GTK config separately for the GTK tab
        this.postMessage({
            command: 'loadGtkConfig',
            data: {
                gskRenderer: config.gskRenderer,
                gtkTheme: config.gtkTheme,
                gtkDebug: config.gtkDebug
            }
        });
    }

    /**
     * Save general config
     * @param {Object} data 
     */
    async saveConfig(data) {
        try {
            const configToSave = vscode.workspace.getConfiguration('gtk4Toolbar');
            const target = vscode.ConfigurationTarget.Global;
            
            await configToSave.update('msys2Path', data.msys2Path, target);
            await configToSave.update('msys2Environment', data.msys2Environment, target);
            await configToSave.update('compiler', data.compiler, target);
            await configToSave.update('cppStandard', data.cppStandard, target);
            
            // Convert flags string to array
            const flagsArray = data.compilerFlags.split(' ').filter(f => f.length > 0);
            await configToSave.update('compilerFlags', flagsArray, target);
            
            await configToSave.update('pkgConfigLibraries', data.pkgConfigLibraries, target);
            await configToSave.update('cmakeGenerator', data.cmakeGenerator, target);
            await configToSave.update('cmakeBuildType', data.cmakeBuildType, target);
            await configToSave.update('cmakeArgs', data.cmakeArgs, target);
            await configToSave.update('autoCloseTerminal', data.autoCloseTerminal, target);
            await configToSave.update('showSuccessNotifications', data.showSuccessNotifications, target);
            await configToSave.update('customEnvVars', data.customEnvVars, target);
            
            Logger.info('Configuration saved successfully');
            vscode.window.showInformationMessage('GTK4 Toolbar configuration saved!');
        } catch (error) {
            Logger.error('Save failed', error);
            vscode.window.showErrorMessage('Failed to save configuration: ' + error.message);
        }
    }

    /**
     * Save GTK config
     * @param {Object} data 
     */
    async saveGtkConfig(data) {
        try {
            const configToSave = vscode.workspace.getConfiguration('gtk4Toolbar');
            const target = vscode.ConfigurationTarget.Global;
            
            await configToSave.update('gskRenderer', data.gskRenderer, target);
            await configToSave.update('gtkTheme', data.gtkTheme, target);
            await configToSave.update('gtkDebug', data.gtkDebug, target);
            
            // Dispose shared terminal to force reload of environment variables
            TerminalManager.dispose();
            
            Logger.info('GTK config saved successfully');
            vscode.window.showInformationMessage('GTK Environment updated! Terminal restarted.');
        } catch (error) {
            Logger.error('GTK save failed', error);
            vscode.window.showErrorMessage('Failed to save GTK configuration: ' + error.message);
        }
    }

    /**
     * Save Android config
     * @param {Object} data 
     */
    async saveAndroidConfig(data) {
        try {
            const configToSave = vscode.workspace.getConfiguration('gtk4Toolbar');
            const target = vscode.ConfigurationTarget.Global;
            
            await configToSave.update('pixiewoodPath', data.pixiewoodPath, target);
            await configToSave.update('androidManifestPath', data.androidManifestPath, target);
            await configToSave.update('pixiewoodInstallDir', data.pixiewoodInstallDir, target);
            await configToSave.update('androidSdkPath', data.androidSdkPath, target);
            await configToSave.update('androidNdkPath', data.androidNdkPath, target);
            await configToSave.update('androidStudioPath', data.androidStudioPath, target);
            await configToSave.update('mesonPath', data.mesonPath, target);
            await configToSave.update('androidReleaseBuild', data.androidReleaseBuild, target);
            await configToSave.update('androidVerbose', data.androidVerbose, target);
            
            vscode.window.showInformationMessage('Android configuration saved!');
        } catch (error) {
            vscode.window.showErrorMessage('Failed to save Android configuration: ' + error.message);
        }
    }

    // ==================== Path Picker Methods ====================

    /**
     * Pick a folder and update config
     * @param {string} configKey 
     * @param {string} title 
     * @param {string} responseCommand 
     */
    async pickFolder(configKey, title, responseCommand) {
        const uri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: title
        });

        if (uri && uri[0]) {
            this.postMessage({
                command: responseCommand,
                path: uri[0].fsPath
            });
        }
    }

    /**
     * Pick a file and update config
     * @param {string} configKey 
     * @param {string} title 
     * @param {string} responseCommand 
     * @param {Object} filters 
     */
    async pickFile(configKey, title, responseCommand, filters = null) {
        const options = {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            title: title
        };
        
        if (filters) {
            options.filters = filters;
        }

        const uri = await vscode.window.showOpenDialog(options);

        if (uri && uri[0]) {
            this.postMessage({
                command: responseCommand,
                path: uri[0].fsPath
            });
        }
    }

    // ==================== Environment Setup Methods ====================

    /**
     * Setup development environment
     */
    setupEnvironment() {
        const languages = ['C/C++', 'Python', 'Vala'];
        vscode.window.showQuickPick(languages, {
            placeHolder: 'Select your development language for GTK4',
            title: 'Install GTK4 Dependencies'
        }).then(selection => {
            if (selection) {
                const config = ConfigManager.getAll();
                const terminal = TerminalManager.createTerminal('GTK4 Setup');
                terminal.show();
                
                let packages = 'mingw-w64-ucrt-x86_64-gtk4';
                
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
    }

    /**
     * Open folder in file explorer
     * @param {string} folderPath 
     */
    openFolder(folderPath) {
        if (folderPath && fs.existsSync(folderPath)) {
            vscode.env.openExternal(vscode.Uri.file(folderPath));
        } else {
            vscode.window.showErrorMessage(`Path does not exist: ${folderPath}`);
        }
    }

    /**
     * Open MSYS2 Terminal
     */
    openMsys2Terminal() {
        const config = ConfigManager.getAll();
        const envName = config.msys2Environment.toUpperCase();
        const terminal = vscode.window.createTerminal({
            name: `MSYS2 ${envName}`,
            shellPath: `${config.msys2Path}/usr/bin/bash.exe`,
            shellArgs: ['--login', '-i'],
            env: {
                'MSYSTEM': envName,
                'CHERE_INVOKING': '1'
            }
        });
        terminal.show();
        terminal.sendText(`echo "To install theme dependencies, run: pacman -S --noconfirm git unzip mingw-w64-${config.msys2Environment.toLowerCase()}-x86_64-sassc meson ninja"`);
        vscode.window.showInformationMessage('MSYS2 terminal opened. Run the command shown to install dependencies.');
    }

    /**
     * Install MSYS2
     * @param {string} installPath 
     */
    async installMsys2(installPath = 'C:\\msys64') {
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
                await this.downloadFile(installerUrl, installerPath, progress, token);
                
                vscode.window.showInformationMessage('Launching MSYS2 Installer.');
                const child = cp.spawn(installerPath, [], { detached: true, stdio: 'ignore' });
                child.unref();
            } catch (error) {
                vscode.window.showErrorMessage('Failed to download MSYS2 installer: ' + error.message);
            }
        });
    }

    /**
     * Download file with progress
     * @param {string} url 
     * @param {string} destPath 
     * @param {Object} progress 
     * @param {Object} token 
     */
    downloadFile(url, destPath, progress, token) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            
            const download = (downloadUrl) => {
                const request = https.get(downloadUrl, (response) => {
                    if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                        if (response.headers.location) {
                            download(response.headers.location);
                            return;
                        }
                    }

                    if (response.statusCode !== 200) {
                        file.close();
                        fs.unlink(destPath, () => {});
                        reject(new Error(`Failed to download: ${response.statusCode}`));
                        return;
                    }

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
                                    message: `${percentage}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`, 
                                    increment: increment 
                                });
                            }
                        }
                    });
                    
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close(resolve);
                    });
                });
                
                request.on('error', (err) => {
                    file.close();
                    fs.unlink(destPath, () => {});
                    reject(err);
                });

                if (token) {
                    token.onCancellationRequested(() => {
                        request.destroy();
                        file.close();
                        fs.unlink(destPath, () => {});
                        reject(new Error('Download cancelled'));
                    });
                }
            };

            download(url);
        });
    }

    // ==================== Package Management Methods ====================

    /**
     * Install a package
     * @param {string} packageName 
     */
    installPackage(packageName) {
        const config = ConfigManager.getAll();
        const self = this; // Preserve reference for callbacks
        
        vscode.window.showInformationMessage(`Installing ${packageName}...`);
        
        TerminalManager.executeCommand(
            `pacman -S --noconfirm ${packageName}`,
            `Installing ${packageName}...`
        );
        
        // Poll for installation and update configuration
        if (!config.msys2Path) {
            vscode.window.showErrorMessage('MSYS2 path not configured!');
            return;
        }
        
        const bashPath = path.join(config.msys2Path, 'usr', 'bin', 'bash.exe');
        let attempts = 0;
        const maxAttempts = 30; // 30 attempts * 3 seconds = 90 seconds max wait
        
        const checkInstall = setInterval(() => {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(checkInstall);
                vscode.window.showWarningMessage(`Auto-config timed out for ${packageName}. You may need to configure manually.`);
                return;
            }

            cp.exec(`"${bashPath}" -lc "pacman -Q ${packageName} 2>/dev/null"`, (err, stdout) => {
                if (!err && stdout && stdout.includes(packageName.split('/').pop())) {
                    clearInterval(checkInstall);
                    
                    // Find .pc files for CMake and build integration
                    const pkgName = packageName.includes('/') ? packageName.split('/')[1] : packageName;
                    cp.exec(`"${bashPath}" -lc "pacman -Ql ${pkgName} 2>/dev/null | grep '.pc$'"`, async (err, stdout) => {
                        if (!err && stdout && stdout.trim()) {
                            const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                            const newLibs = [];
                            
                            lines.forEach(line => {
                                // Line format: "pkgname /ucrt64/lib/pkgconfig/libname.pc"
                                const parts = line.split(/\s+/);
                                if (parts.length >= 2) {
                                    const filepath = parts[parts.length - 1];
                                    const filename = filepath.split('/').pop();
                                    if (filename && filename.endsWith('.pc')) {
                                        newLibs.push(filename.replace('.pc', ''));
                                    }
                                }
                            });

                            if (newLibs.length > 0) {
                                try {
                                    // 1. Update pkgConfigLibraries setting
                                    await self.updatePkgConfigLibraries(newLibs);
                                    
                                    // 2. Update c_cpp_properties.json for IntelliSense
                                    await self.updateCppPropertiesWithLibs(newLibs);
                                    
                                    // 3. Update CMakeLists.txt if exists
                                    self.updateCMakeListsWithLibs(newLibs);
                                    
                                    vscode.window.showInformationMessage(`✓ Configured: ${newLibs.join(', ')} - Ready to build!`);
                                } catch (e) {
                                    vscode.window.showErrorMessage(`Failed to configure: ${e.message}`);
                                }
                            } else {
                                vscode.window.showWarningMessage(`No pkg-config files found for ${packageName}`);
                            }
                        } else {
                            vscode.window.showWarningMessage(`Could not find .pc files for ${packageName}`);
                        }
                    });
                }
            });
        }, 3000); // Check every 3 seconds
    }

    /**
     * Update pkgConfigLibraries setting with new libraries
     * @param {string[]} newLibs 
     */
    async updatePkgConfigLibraries(newLibs) {
        try {
            const currentConfig = ConfigManager.getAll();
            const currentLibs = (currentConfig.pkgConfigLibraries || '').split(' ').filter(l => l.trim());
            
            // Check if new libs are already included
            const libsToAdd = newLibs.filter(lib => !currentLibs.includes(lib));
            if (libsToAdd.length === 0) {
                Logger.info('Libraries already in pkgConfigLibraries');
                return;
            }
            
            const allLibs = [...new Set([...currentLibs, ...newLibs])];
            const newPkgConfigLibs = allLibs.join(' ');
            
            const configToSave = vscode.workspace.getConfiguration('gtk4Toolbar');
            
            // Try workspace folder first, fallback to global
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    await configToSave.update('pkgConfigLibraries', newPkgConfigLibs, vscode.ConfigurationTarget.WorkspaceFolder);
                } else {
                    await configToSave.update('pkgConfigLibraries', newPkgConfigLibs, vscode.ConfigurationTarget.Global);
                }
            } catch (e) {
                // Fallback to global if workspace fails
                await configToSave.update('pkgConfigLibraries', newPkgConfigLibs, vscode.ConfigurationTarget.Global);
            }
            
            Logger.info(`Updated pkgConfigLibraries: ${newPkgConfigLibs}`);
            vscode.window.showInformationMessage(`Build flags updated: added ${libsToAdd.join(', ')}`);
            
            // Notify webview to update the field
            this.postMessage({ 
                command: 'configUpdated',
                pkgConfigLibraries: newPkgConfigLibs
            });
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to update build flags: ${e.message}`);
            Logger.error(`Failed to update pkgConfigLibraries: ${e.message}`);
        }
    }

    /**
     * Update c_cpp_properties.json with include paths for new libraries
     * @param {string[]} libs 
     */
    async updateCppPropertiesWithLibs(libs) {
        try {
            const config = ConfigManager.getAll();
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || !config.msys2Path) {
                return;
            }
            
            const rootPath = workspaceFolders[0].uri.fsPath;
            const vscodeDir = path.join(rootPath, '.vscode');
            const propertiesPath = path.join(vscodeDir, 'c_cpp_properties.json');
            
            // Get include paths for new libraries using pkg-config
            const envPath = config.msys2Environment.toLowerCase();
            const pkgConfigPath = path.join(config.msys2Path, envPath, 'bin', 'pkg-config.exe');
            
            if (!fs.existsSync(pkgConfigPath)) {
                vscode.window.showErrorMessage(`pkg-config not found at: ${pkgConfigPath}`);
                return;
            }
            
            const env = { ...process.env };
            env['PKG_CONFIG_PATH'] = `${config.msys2Path}/${envPath}/lib/pkgconfig;${config.msys2Path}/${envPath}/share/pkgconfig`;
            env['PATH'] = `${config.msys2Path}/${envPath}/bin;${env['PATH']}`;
            
            let newIncludePaths = [];
            for (const lib of libs) {
                try {
                    const stdout = cp.execSync(`"${pkgConfigPath}" --cflags-only-I ${lib}`, { env: env, encoding: 'utf8' });
                    
                    const paths = stdout.trim().split(/\s+/).map(p => {
                        let cleanPath = p.replace(/^-I/, '').trim();
                        if (!cleanPath) return null;
                        
                        // Convert UNIX-style paths to Windows paths
                        // pkg-config may return: /ucrt64/include/... or E:/cpp/mysys2/ucrt64/bin/../include/...
                        
                        // Handle UNIX paths like /ucrt64/include/libsoup-3.0
                        if (cleanPath.startsWith(`/${envPath}/`)) {
                            cleanPath = path.join(config.msys2Path, cleanPath);
                        } else if (cleanPath.startsWith('/mingw64/') || cleanPath.startsWith('/mingw32/') || cleanPath.startsWith('/clang64/') || cleanPath.startsWith('/clang32/')) {
                            cleanPath = path.join(config.msys2Path, cleanPath);
                        } else if (cleanPath.match(/^\/[a-zA-Z]\//)) {
                            // Handle /c/path/to/something -> C:/path/to/something
                            cleanPath = cleanPath.replace(/^\/([a-zA-Z])\//, '$1:/');
                        }
                        
                        // Normalize the path - resolve ../ sequences
                        cleanPath = path.normalize(cleanPath);
                        
                        // Ensure forward slashes for consistency in JSON
                        cleanPath = cleanPath.replace(/\\/g, '/');
                        
                        return cleanPath;
                    }).filter(p => p);
                    
                    newIncludePaths = newIncludePaths.concat(paths);
                } catch (e) {
                    Logger.debug(`pkg-config failed for ${lib}: ${e.message}`);
                }
            }
            
            if (newIncludePaths.length === 0) {
                return;
            }
            
            // Read existing properties or create new
            let cCppProperties;
            if (fs.existsSync(propertiesPath)) {
                try {
                    cCppProperties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
                } catch (e) {
                    cCppProperties = null;
                }
            }
            
            if (!cCppProperties) {
                cCppProperties = {
                    "configurations": [{
                        "name": "Win32",
                        "includePath": ["${workspaceFolder}/**"],
                        "defines": ["_DEBUG", "UNICODE", "_UNICODE"],
                        "compilerPath": path.join(config.msys2Path, envPath, 'bin', `${config.compiler}.exe`).replace(/\\/g, '/'),
                        "cStandard": "c17",
                        "cppStandard": "c++17",
                        "intelliSenseMode": "gcc-x64"
                    }],
                    "version": 4
                };
            }
            
            // Find Win32 configuration
            let win32Config = cCppProperties.configurations.find(c => c.name === 'Win32');
            if (!win32Config) {
                win32Config = cCppProperties.configurations[0];
            }
            
            // Normalize existing paths for comparison
            const normalizedExisting = (win32Config.includePath || []).map(p => 
                p.startsWith('${') ? p : path.normalize(p).replace(/\\/g, '/')
            );
            
            // Merge include paths (avoid duplicates using normalized comparison)
            const allPaths = [...normalizedExisting];
            for (const newPath of newIncludePaths) {
                const normalizedNew = path.normalize(newPath).replace(/\\/g, '/');
                if (!allPaths.some(existing => {
                    if (existing.startsWith('${')) return false;
                    return path.normalize(existing).replace(/\\/g, '/').toLowerCase() === normalizedNew.toLowerCase();
                })) {
                    allPaths.push(normalizedNew);
                }
            }
            
            win32Config.includePath = allPaths;
            
            // Ensure .vscode directory exists
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir, { recursive: true });
            }
            
            fs.writeFileSync(propertiesPath, JSON.stringify(cCppProperties, null, 4));
            Logger.info(`Updated c_cpp_properties.json with ${newIncludePaths.length} new include paths`);
            
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to update IntelliSense: ${e.message}`);
        }
    }

    /**
     * Remove a package
     * @param {string} packageName 
     */
    removePackage(packageName) {
        const config = ConfigManager.getAll();
        
        // Extract just the package name if it includes repo prefix (e.g., ucrt64/package-name)
        let pkgToRemove = packageName;
        if (pkgToRemove.includes('/')) {
            pkgToRemove = pkgToRemove.split('/')[1];
        }
        
        Logger.info(`Removing package: ${pkgToRemove}`);
        vscode.window.showInformationMessage(`Removing package: ${pkgToRemove}...`);
        
        // Execute removal with -Rdd to skip dependency checks
        const removeCmd = `pacman -Rdd --noconfirm ${pkgToRemove}`;
        
        TerminalManager.executeCommand(
            removeCmd,
            `Removing ${pkgToRemove}...`
        );
        
        // Poll to verify removal and update configuration
        if (!config.msys2Path) return;
        
        const bashPath = path.join(config.msys2Path, 'usr', 'bin', 'bash.exe');
        let attempts = 0;
        const maxAttempts = 30;
        
        const checkRemoval = setInterval(() => {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(checkRemoval);
                return;
            }

            // Check if package is still installed
            cp.exec(`"${bashPath}" -lc "pacman -Q ${pkgToRemove}"`, (err, stdout, stderr) => {
                // If pacman -Q returns error, package is removed
                if (err) {
                    clearInterval(checkRemoval);
                    Logger.info(`Package ${pkgToRemove} removed successfully`);
                    vscode.window.showInformationMessage(`Package ${pkgToRemove} removed!`);
                    
                    // Notify webview to update
                    this.postMessage({
                        command: 'packageRemoved',
                        package: pkgToRemove
                    });
                    
                    // Also update pkgConfigLibraries setting
                    this.removeLibFromPkgConfig(pkgToRemove, config);
                }
            });
        }, 3000);
    }

    /**
     * Remove library from pkgConfigLibraries setting
     * @param {string} packageName 
     * @param {Object} config 
     */
    async removeLibFromPkgConfig(packageName, config) {
        const bashPath = path.join(config.msys2Path, 'usr', 'bin', 'bash.exe');
        
        // Find .pc files that were part of this package
        // Since package is removed, we need to guess the library name
        // Common pattern: mingw-w64-ucrt-x86_64-libsoup3 -> libsoup-3.0
        
        // Try to update pkgConfigLibraries by removing likely matching libs
        try {
            const currentLibs = (config.pkgConfigLibraries || '').split(' ').filter(l => l.trim());
            
            // Extract likely lib name from package name
            // e.g., mingw-w64-ucrt-x86_64-libsoup3 -> libsoup
            let libName = packageName;
            if (libName.startsWith('mingw-w64-')) {
                libName = libName.replace(/^mingw-w64-(ucrt|mingw64|clang64)-x86_64-/, '');
            }
            
            // Remove any libs that contain the extracted name
            const filteredLibs = currentLibs.filter(lib => {
                // Don't remove if lib doesn't match the package name pattern
                return !lib.toLowerCase().includes(libName.toLowerCase().replace(/[0-9]/g, ''));
            });
            
            if (filteredLibs.length !== currentLibs.length) {
                const newLibsStr = filteredLibs.join(' ');
                const configToSave = vscode.workspace.getConfiguration('gtk4Toolbar');
                await configToSave.update('pkgConfigLibraries', newLibsStr, vscode.ConfigurationTarget.Global);
                
                // Notify webview
                this.postMessage({
                    command: 'configUpdated',
                    pkgConfigLibraries: newLibsStr
                });
                
                Logger.info(`Updated pkgConfigLibraries: ${newLibsStr}`);
            }
        } catch (e) {
            Logger.error(`Failed to update pkgConfigLibraries: ${e.message}`);
        }
    }

    /**
     * Search packages
     * @param {string} query 
     */
    async searchPackages(query) {
        const config = ConfigManager.getAll();
        
        if (!config.msys2Path || !fs.existsSync(config.msys2Path)) {
            vscode.window.showErrorMessage('MSYS2 path not configured or invalid.');
            return;
        }

        const bashPath = path.join(config.msys2Path, 'usr', 'bin', 'bash.exe');
        const searchCmd = `"${bashPath}" -lc "pacman -Ss ${query}"`;
        
        cp.exec(searchCmd, (err, stdout, stderr) => {
            const lines = stdout ? stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];
            this.postMessage({ command: 'searchResults', results: lines });
        });
    }

    /**
     * Update CMakeLists.txt with new libraries
     * @param {string[]} libs 
     */
    updateCMakeListsWithLibs(libs) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            
            const workspaceFolder = workspaceFolders[0].uri.fsPath;
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
            Logger.error('Failed to update CMakeLists.txt', e);
        }
    }

    // ==================== Theme Management Methods ====================

    /**
     * Get installed themes
     */
    getInstalledThemes() {
        const config = ConfigManager.getAll();
        const msys2Path = config.msys2Path;
        const themes = [];
        
        // Add default GTK4 themes
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
                } catch (e) { Logger.error('Error reading system themes', e); }
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
                } catch (e) { Logger.error('Error reading user themes', e); }
            }
        }
        
        this.postMessage({ command: 'updateInstalledThemes', themes: themes });
    }

    /**
     * Search online themes on GitHub
     * @param {string} query 
     */
    async searchOnlineThemes(query = 'topic:gtk-theme') {
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=20`;
        
        const requestOptions = {
            headers: { 'User-Agent': 'VSCode-GTK4-Toolbar-Extension' }
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
                    this.postMessage({ command: 'onlineThemesResult', themes: results });
                } catch (e) {
                    Logger.error('Error parsing GitHub response', e);
                    this.postMessage({ command: 'onlineThemesResult', themes: [] });
                }
            });
        }).on('error', (e) => {
            Logger.error('Error fetching themes', e);
            this.postMessage({ command: 'onlineThemesResult', themes: [] });
        });
    }

    /**
     * Fetch releases from GitHub
     * @param {Object} message 
     */
    async fetchReleases(message) {
        const { repoOwner, repoName, dirName, repo } = message;
        
        const releaseApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
        const releaseFolderUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/release`;
        
        const releases = [];
        
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
                    Logger.error('Error parsing release data', e);
                }
                
                if (releases.length === 0) {
                    // Try release folder
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
                                Logger.error('Error parsing release folder', e);
                            }
                            
                            this.postMessage({
                                command: 'showReleaseSelection',
                                releases: releases,
                                repo: repo,
                                dirName: dirName
                            });
                        });
                    }).on('error', () => {
                        this.postMessage({
                            command: 'showReleaseSelection',
                            releases: releases,
                            repo: repo,
                            dirName: dirName
                        });
                    });
                } else {
                    this.postMessage({
                        command: 'showReleaseSelection',
                        releases: releases,
                        repo: repo,
                        dirName: dirName
                    });
                }
            });
        }).on('error', (e) => {
            Logger.error('Error fetching releases', e);
            this.postMessage({
                command: 'showReleaseSelection',
                releases: [],
                repo: repo,
                dirName: dirName
            });
        });
    }

    /**
     * Install theme
     * @param {Object} message 
     */
    async installTheme(message) {
        const { repo, dirName, releaseUrls } = message;
        const repoOwner = repo.split('/')[3];
        const repoName = repo.split('/')[4].replace('.git', '');
        
        const config = ConfigManager.getAll();
        const installEnv = config.msys2Environment.toLowerCase();

        const installCommands = [
            `export PATH="/${installEnv}/bin:$PATH"`,
            'echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
            `echo "Installing Theme: ${dirName}"`,
            'echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
            'echo ""',
            'mkdir -p ~/.themes',
            'cd ~/.themes',
            'INSTALLED=false'
        ];
        
        if (releaseUrls && releaseUrls.length > 0) {
            // Download selected releases
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
            // Auto-detect and install from source
            this.addAutoInstallCommands(installCommands, repoOwner, repoName, repo, dirName);
        }
        
        TerminalManager.executeCommand(installCommands, `Installing Theme: ${dirName}`);
        vscode.window.showInformationMessage(`Installing ${dirName}... Check the terminal for progress.`);
        
        // Refresh themes list after delay
        setTimeout(() => {
            this.postMessage({ command: 'refreshThemes' });
        }, 5000);
    }

    /**
     * Add auto-install commands for themes without pre-selected releases
     */
    addAutoInstallCommands(commands, repoOwner, repoName, repo, dirName) {
        commands.push(
            'echo "Step 1/4: Auto-detecting releases..."',
            `RELEASE_URLS=$(curl -s "https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest" | grep -E 'browser_download_url.*\\.(tar\\.xz|tar\\.gz|zip)' | grep -v 'Source code' | cut -d '"' -f 4)`,
            'if [ -n "$RELEASE_URLS" ]; then',
            '  echo "✓ Found GitHub Release assets"',
            '  while IFS= read -r RELEASE_URL; do',
            '    if [ -n "$RELEASE_URL" ]; then',
            '      RELEASE_FILE=$(basename "$RELEASE_URL")',
            '      echo "  → Downloading $RELEASE_FILE..."',
            '      curl -L -o "$RELEASE_FILE" "$RELEASE_URL" 2>/dev/null',
            '      if [ $? -eq 0 ]; then',
            '        echo "  → Extracting $RELEASE_FILE..."',
            '        tar -xf "$RELEASE_FILE" 2>/dev/null || unzip -q "$RELEASE_FILE" 2>/dev/null',
            '        rm "$RELEASE_FILE"',
            '        INSTALLED=true',
            '      fi',
            '    fi',
            '  done <<< "$RELEASE_URLS"',
            'fi',
            '',
            '# Try release folder if no GitHub releases',
            'if [ "$INSTALLED" != "true" ]; then',
            `  RELEASE_FOLDER_FILES=$(curl -s "https://api.github.com/repos/${repoOwner}/${repoName}/contents/release" | grep -E '"download_url".*\\.(tar\\.xz|tar\\.gz|tar|zip)"' | cut -d '"' -f 4)`,
            '  if [ -n "$RELEASE_FOLDER_FILES" ]; then',
            '    while IFS= read -r RELEASE_URL; do',
            '      if [ -n "$RELEASE_URL" ]; then',
            '        RELEASE_FILE=$(basename "$RELEASE_URL")',
            '        echo "  → Downloading $RELEASE_FILE..."',
            '        curl -L -o "$RELEASE_FILE" "$RELEASE_URL" 2>/dev/null',
            '        if [ $? -eq 0 ]; then',
            '          tar -xf "$RELEASE_FILE" 2>/dev/null || unzip -q "$RELEASE_FILE" 2>/dev/null',
            '          rm "$RELEASE_FILE"',
            '          INSTALLED=true',
            '        fi',
            '      fi',
            '    done <<< "$RELEASE_FOLDER_FILES"',
            '  fi',
            'fi',
            '',
            '# Fall back to git clone and build',
            'if [ "$INSTALLED" != "true" ]; then',
            '  echo "Step 2/4: Cloning repository..."',
            `  if [ -d "${dirName}" ]; then`,
            `    cd "${dirName}" && git pull`,
            '  else',
            `    git clone "${repo}" "${dirName}"`,
            `    cd "${dirName}"`,
            '  fi',
            '  echo "Step 3/4: Building theme..."',
            '  if [ -f "./install.sh" ]; then',
            '    bash ./install.sh --dest ~/.themes && INSTALLED=true',
            '  elif [ -f "./meson.build" ]; then',
            '    meson setup build --prefix="$HOME/.local" --wipe 2>/dev/null || meson setup build --prefix="$HOME/.local"',
            '    ninja -C build && ninja -C build install && INSTALLED=true',
            '  fi',
            'fi',
            '',
            'if [ "$INSTALLED" = "true" ]; then',
            '  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
            '  echo "✓ Installation complete!"',
            '  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"',
            'else',
            '  echo "⚠ Could not install theme automatically"',
            'fi'
        );
    }

    /**
     * Delete theme
     * @param {string} themePath 
     */
    async deleteTheme(themePath) {
        if (themePath === 'built-in') {
            vscode.window.showErrorMessage('Cannot delete default GTK themes.');
            return;
        }
        
        if (!themePath || !fs.existsSync(themePath)) {
            return;
        }

        const config = ConfigManager.getAll();
        const systemThemesPath = path.join(config.msys2Path, 'usr', 'share', 'themes');
        if (themePath.startsWith(systemThemesPath)) {
            vscode.window.showErrorMessage('Cannot delete system themes.');
            return;
        }

        const answer = await vscode.window.showWarningMessage(
            `Are you sure you want to permanently delete the theme at:\n${themePath}`,
            { modal: true },
            'Delete Theme'
        );

        if (answer === 'Delete Theme') {
            try {
                fs.rmSync(themePath, { recursive: true, force: true });
                vscode.window.showInformationMessage('Theme deleted successfully.');
                this.postMessage({ command: 'refreshThemes' });
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete theme: ${error.message}`);
            }
        }
    }

    /**
     * Open theme folder
     */
    openThemeFolder() {
        const config = ConfigManager.getAll();
        const msys2HomePath = path.join(config.msys2Path, 'home');
        
        if (fs.existsSync(msys2HomePath)) {
            const users = fs.readdirSync(msys2HomePath);
            if (users.length > 0) {
                const themesPath = path.join(msys2HomePath, users[0], '.themes');
                
                if (!fs.existsSync(themesPath)) {
                    fs.mkdirSync(themesPath, { recursive: true });
                }
                
                vscode.env.openExternal(vscode.Uri.file(themesPath));
                vscode.window.showInformationMessage(`Opening theme folder: ${themesPath}`);
            } else {
                vscode.window.showErrorMessage('No user found in MSYS2 home directory.');
            }
        } else {
            vscode.window.showErrorMessage('MSYS2 home directory not found.');
        }
    }

    // ==================== IntelliSense/CMake Methods ====================

    /**
     * Configure G++ IntelliSense
     */
    async configureGppIntellisense() {
        try {
            const config = ConfigManager.getAll();
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder open.');
                return;
            }
            
            const rootPath = workspaceFolders[0].uri.fsPath;
            const vscodeDir = path.join(rootPath, '.vscode');
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir);
            }
            const propertiesPath = path.join(vscodeDir, 'c_cpp_properties.json');

            const envPath = config.msys2Environment.toLowerCase();
            let includePaths = [
                "${workspaceFolder}/**",
                `${config.msys2Path}/${envPath}/include`
            ];

            // Try pkg-config for include paths
            const pkgConfigPath = path.join(config.msys2Path, envPath, 'bin', 'pkg-config.exe');
            if (fs.existsSync(pkgConfigPath)) {
                try {
                    const env = { ...process.env };
                    env['PKG_CONFIG_PATH'] = `${config.msys2Path}/${envPath}/lib/pkgconfig:${config.msys2Path}/${envPath}/share/pkgconfig`;
                    const stdout = cp.execSync(`"${pkgConfigPath}" --cflags-only-I ${config.pkgConfigLibraries}`, { env: env }).toString();
                    const paths = stdout.trim().split(/\s+/).map(p => {
                        let cleanPath = p.replace(/^-I/, '').trim();
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
                    Logger.debug('pkg-config lookup failed, using defaults');
                }
            }

            includePaths = [...new Set(includePaths)];

            const cCppProperties = {
                "configurations": [
                    {
                        "name": "Win32",
                        "includePath": includePaths,
                        "defines": ["_DEBUG", "UNICODE", "_UNICODE"],
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
    }

    /**
     * Configure CMake
     */
    async configureCMake() {
        try {
            const config = ConfigManager.getAll();
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder open.');
                return;
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

`;
                // Generate pkg_check_modules for each library
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

`;
                libs.forEach(lib => {
                    const varName = lib.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                    defaultCMake += `target_link_libraries(main PRIVATE PkgConfig::${varName})\n`;
                });

                defaultCMake += `target_link_libraries(main PRIVATE iphlpapi)
`;
                fs.writeFileSync(cmakePath, defaultCMake);
                vscode.window.showInformationMessage('Generated default CMakeLists.txt');
            }

            // Run CMake
            let cmakePackage = 'mingw-w64-ucrt-x86_64-cmake';
            if (config.msys2Environment === 'MINGW64') {
                cmakePackage = 'mingw-w64-x86_64-cmake';
            } else if (config.msys2Environment === 'CLANG64') {
                cmakePackage = 'mingw-w64-clang-x86_64-cmake';
            }

            const cmd = `if ! command -v cmake &> /dev/null; then echo "CMake not found. Installing..."; pacman -S --noconfirm ${cmakePackage}; fi && mkdir -p build && cd build && cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON .. && cmake --build .`;
            TerminalManager.executeCommand(cmd, 'Configuring and Building CMake Project...');
            
            // Update IntelliSense to use compile_commands.json
            const workspaceConfig = vscode.workspace.getConfiguration();
            await workspaceConfig.update('C_Cpp.default.compileCommands', '${workspaceFolder}/build/compile_commands.json', vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('IntelliSense configured! Running CMake...');

        } catch (error) {
            Logger.error('CMake Setup Error', error);
            vscode.window.showErrorMessage('CMake Setup Failed: ' + error.message);
        }
    }

    // ==================== Android/Pixiewood Methods ====================

    /**
     * Check pixiewood installation status
     * @param {string} checkPath 
     */
    checkPixiewoodStatus(checkPath) {
        let isInstalled = false;
        if (checkPath) {
            const possiblePath1 = path.join(checkPath, 'pixiewood');
            const possiblePath2 = path.join(checkPath, 'gtk-android-builder', 'pixiewood');
            
            if (fs.existsSync(possiblePath1) || fs.existsSync(possiblePath2)) {
                isInstalled = true;
            }
        }
        this.postMessage({
            command: 'updatePixiewoodStatus',
            installed: isInstalled
        });
    }

    /**
     * Run Android Prepare command
     */
    async runAndroidPrepare() {
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();
        
        // Check JDK
        const jdkStatus = AndroidBuilder.checkJdkInstalled();
        if (!jdkStatus.installed) {
            const selection = await vscode.window.showWarningMessage(
                'JDK 17+ is required for Android builds but was not found. Would you like to install it?',
                'Install JDK 17 (winget)',
                'Install JDK 17 (manual)',
                'Continue Anyway'
            );
            
            if (selection === 'Install JDK 17 (winget)') {
                const jdkTerminal = vscode.window.createTerminal({
                    name: 'JDK Installation',
                    shellPath: 'powershell.exe'
                });
                jdkTerminal.show();
                jdkTerminal.sendText('winget install EclipseAdoptium.Temurin.17.JDK --accept-package-agreements --accept-source-agreements');
                jdkTerminal.sendText('Write-Host ""');
                jdkTerminal.sendText('Write-Host "JDK installation complete! Please restart VS Code and run Prepare again." -ForegroundColor Green');
                vscode.window.showInformationMessage('Installing JDK 17... Please restart VS Code after installation completes.');
                return;
            } else if (selection === 'Install JDK 17 (manual)') {
                vscode.env.openExternal(vscode.Uri.parse('https://adoptium.net/temurin/releases/?version=17'));
                vscode.window.showInformationMessage('Download and install JDK 17, then run Prepare again.');
                return;
            } else if (selection !== 'Continue Anyway') {
                return;
            }
        } else {
            Logger.debug(`JDK found at: ${jdkStatus.path}`);
        }
        
        // Auto-patch pixiewood
        if (PixiewoodPatcher.patchForWindows(config.pixiewoodPath)) {
            vscode.window.showInformationMessage('Pixiewood auto-patched for Windows compatibility.');
        }
        
        // Build command with options
        let prepareArgs = 'prepare';
        if (config.androidVerbose) prepareArgs += ' -v';
        if (config.androidReleaseBuild) prepareArgs += ' --release';
        if (config.androidSdkPath) prepareArgs += ` -s "${PathUtils.toMsysPath(config.androidSdkPath)}"`;
        if (config.androidNdkPath) prepareArgs += ` -t "${PathUtils.toMsysPath(config.androidNdkPath)}"`;
        if (config.androidStudioPath) prepareArgs += ` -a "${PathUtils.toMsysPath(config.androidStudioPath)}"`;
        if (config.mesonPath) prepareArgs += ` --meson "${PathUtils.toMsysPath(config.mesonPath)}"`;
        prepareArgs += ` "${PathUtils.toMsysPath(config.androidManifestPath)}"`;
        
        const prepareCmds = [
            `export PATH=/${envPath}/bin:$PATH`,
            `export PERL5LIB=/${envPath}/lib/perl5/site_perl`,
            `/${envPath}/bin/perl ${PathUtils.toMsysPath(config.pixiewoodPath)} ${prepareArgs}`
        ];
        TerminalManager.executeCommand(prepareCmds, 'Running Pixiewood Prepare...');
    }

    /**
     * Run Android Generate command
     */
    runAndroidGenerate() {
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();
        
        PixiewoodPatcher.patchForWindows(config.pixiewoodPath);
        
        let genArgs = 'generate';
        if (config.androidVerbose) genArgs += ' -v';
        
        const genCmds = [
            `export PATH=/${envPath}/bin:$PATH`,
            `export PERL5LIB=/${envPath}/lib/perl5/site_perl`,
            `/${envPath}/bin/perl ${PathUtils.toMsysPath(config.pixiewoodPath)} ${genArgs}`
        ];
        TerminalManager.executeCommand(genCmds, 'Running Pixiewood Generate...');
    }

    /**
     * Run Android Build command
     */
    runAndroidBuild() {
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();
        
        let buildArgs = 'build';
        if (config.androidVerbose) buildArgs += ' -v';
        
        const buildCmds = [
            `export PATH=/${envPath}/bin:$PATH`,
            `export PERL5LIB=/${envPath}/lib/perl5/site_perl`,
            `/${envPath}/bin/perl ${PathUtils.toMsysPath(config.pixiewoodPath)} ${buildArgs}`
        ];
        TerminalManager.executeCommand(buildCmds, 'Running Pixiewood Build...');
    }

    /**
     * Install Pixiewood
     * @param {string} targetDir 
     * @param {vscode.ExtensionContext} context 
     */
    async installPixiewood(targetDir, context) {
        if (!targetDir) {
            vscode.window.showErrorMessage('Please select an installation directory first.');
            return;
        }
        
        const scriptPath = path.join(context.extensionPath, 'scripts', 'install-pixiewood.sh');
        const scriptMsysPath = PathUtils.toMsysPath(scriptPath);
        const targetMsysPath = PathUtils.toMsysPath(targetDir);
        
        const installCmds = [
            'echo "Starting Pixiewood installation..."',
            `chmod +x "${scriptMsysPath}"`,
            `"${scriptMsysPath}" "${targetMsysPath}"`
        ];
        
        TerminalManager.executeCommand(installCmds, 'Installing Pixiewood (this may take several minutes)...');

        // Update configuration
        const pixiewoodScriptPath = path.join(targetDir, 'gtk-android-builder', 'pixiewood');
        const mesonForkPath = path.join(targetDir, 'meson-fork');
        const configToUpdate = vscode.workspace.getConfiguration('gtk4Toolbar');
        await configToUpdate.update('pixiewoodPath', pixiewoodScriptPath, vscode.ConfigurationTarget.Global);
        
        // Notify UI
        this.postMessage({
            command: 'updatePixiewoodPath',
            path: pixiewoodScriptPath
        });
        this.postMessage({
            command: 'updatePixiewoodStatus',
            installed: true
        });
        this.postMessage({
            command: 'installationInfo',
            mesonForkPath: mesonForkPath,
            message: 'Installation complete! Remember to use the forked meson at: ' + mesonForkPath
        });
        
        vscode.window.showInformationMessage(
            'Pixiewood installed! Forked meson is at: ' + mesonForkPath,
            'Open Folder'
        ).then(selection => {
            if (selection === 'Open Folder') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(targetDir));
            }
        });
    }

    /**
     * Copy libc++_shared.so
     */
    copyLibCppShared() {
        const config = ConfigManager.getAll();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && config.androidNdkPath) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            AndroidBuilder.copyLibCppSharedToJniLibs(workspacePath, config.androidNdkPath);
        } else {
            vscode.window.showErrorMessage('Please configure Android NDK path first.');
        }
    }

    // ==================== Tools Methods ====================

    /**
     * Open Glade UI Designer
     */
    openGlade() {
        const config = ConfigManager.getAll();
        const gladeEnv = config.msys2Environment.toUpperCase();
        const gladeTerminal = vscode.window.createTerminal({
            name: 'Glade Designer',
            shellPath: `${config.msys2Path}/usr/bin/bash.exe`,
            shellArgs: ['--login', '-i'],
            env: {
                'MSYSTEM': gladeEnv,
                'CHERE_INVOKING': '1',
                'GTK_THEME': config.gtkTheme || ''
            }
        });
        gladeTerminal.show();
        const gladePkg = `mingw-w64-${config.msys2Environment.toLowerCase()}-x86_64-glade`;
        gladeTerminal.sendText(`if ! command -v glade &> /dev/null; then echo "Glade not found. Installing..."; pacman -S --noconfirm ${gladePkg}; fi; glade &`);
    }

    /**
     * Post message to webview
     * @param {Object} message 
     */
    postMessage(message) {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    /**
     * Get ADB Devices
     */
    async getAdbDevices() {
        try {
            const config = ConfigManager.getAll();
            const adbPath = config.androidSdkPath 
                ? path.join(config.androidSdkPath, 'platform-tools', 'adb.exe')
                : 'adb';

            Logger.debug(`Running ADB: ${adbPath} devices -l`);

            cp.exec(`"${adbPath}" devices -l`, (err, stdout, stderr) => {
                if (err) {
                    Logger.error('ADB Error: ' + err.message);
                    this.postMessage({ command: 'updateAdbDevices', devices: [] });
                    return;
                }

                const devices = [];
                const lines = stdout.split('\n');
                // Skip first line "List of devices attached"
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    const parts = line.split(/\s+/);
                    if (parts.length >= 2) {
                        const serial = parts[0];
                        const state = parts[1];
                        
                        // Extract model: model:Pixel_6 or similar
                        let model = 'Unknown';
                        const modelPart = parts.find(p => p.startsWith('model:'));
                        if (modelPart) model = modelPart.substring(6).replace(/_/g, ' ');
                        
                        devices.push({ serial, state, model });
                    }
                }
                
                this.postMessage({ command: 'updateAdbDevices', devices });
            });
        } catch (e) {
            Logger.error(e);
            this.postMessage({ command: 'updateAdbDevices', devices: [] });
        }
    }

    /**
     * Load App to Device
     */
    async loadAppToDevice(serial) {
        try {
            const config = ConfigManager.getAll();
            const adbPath = config.androidSdkPath 
                ? path.join(config.androidSdkPath, 'platform-tools', 'adb.exe')
                : 'adb';
                
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            const root = workspaceFolders[0].uri.fsPath;
            
            // Expected APK path
            const apkPath = path.join(root, '.pixiewood', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-universal-debug.apk');
            
            if (!fs.existsSync(apkPath)) {
                vscode.window.showErrorMessage('APK not found! Please build the project first.');
                return;
            }

            vscode.window.showInformationMessage(`Installing App to ${serial}...`);
            
            // Use quotes for paths to handle spaces
            const command = `"${adbPath}" -s ${serial} install -r "${apkPath}"`;
            
            cp.exec(command, (err, stdout, stderr) => {
                if (err) {
                    Logger.error('Installation failed: ' + stderr);
                    vscode.window.showErrorMessage('Installation failed. Check "GTK4 Toolbar" output for details.');
                    return;
                }
                vscode.window.showInformationMessage('App installed successfully on ' + serial);
            });
            
        } catch (e) {
            Logger.error(e);
            vscode.window.showErrorMessage('Error loading app: ' + e.message);
        }
    }

    /**
     * Register the settings command
     * @param {vscode.ExtensionContext} context 
     */
    registerCommand(context) {
        context.subscriptions.push(
            vscode.commands.registerCommand('gtk4-toolbar.openSettings', () => this.open(context))
        );
    }
}

// Singleton
const settingsPanel = new SettingsPanel();

module.exports = settingsPanel;
