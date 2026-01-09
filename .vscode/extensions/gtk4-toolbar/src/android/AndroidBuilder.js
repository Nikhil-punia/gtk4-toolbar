/**
 * Android Builder
 * Handles Android build operations using Pixiewood
 */
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ConfigManager, TerminalManager } = require('../managers');
const PixiewoodPatcher = require('./PixiewoodPatcher');
const { PathUtils, Logger } = require('../utils');

class AndroidBuilder {
    /**
     * Check if JDK is installed
     * @returns {{installed: boolean, path: string|null}}
     */
    checkJdkInstalled() {
        if (os.platform() !== 'win32') {
            return { installed: true, path: null };
        }

        // Check JAVA_HOME environment variable
        if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
            return { installed: true, path: process.env.JAVA_HOME };
        }

        // Check common JDK installation locations
        const javaPaths = [
            'C:/Program Files/Eclipse Adoptium',
            'C:/Program Files/Java',
            'C:/Program Files/Android/Android Studio/jbr',
            'C:/Program Files/Android/Android Studio/jre',
        ];

        for (const base of javaPaths) {
            if (fs.existsSync(base)) {
                try {
                    const entries = fs.readdirSync(base);
                    // Filter for JDK directories and sort in reverse (newest first)
                    const jdks = entries.filter(e => {
                        const itemPath = path.join(base, e);
                        return fs.statSync(itemPath).isDirectory() && /^jdk-?\d/.test(e);
                    }).sort().reverse();
                    
                    if (jdks.length > 0) {
                        return { installed: true, path: path.join(base, jdks[0]) };
                    }
                } catch (e) {
                    // Continue to next path
                }
            }
        }

        return { installed: false, path: null };
    }

    /**
     * Copy libc++_shared.so from NDK to jniLibs
     * @param {string} workspaceFolder 
     * @param {string} ndkPath 
     * @returns {boolean}
     */
    copyLibCppSharedToJniLibs(workspaceFolder, ndkPath) {
        if (os.platform() !== 'win32') return true;

        try {
            const jniLibsPath = path.join(
                workspaceFolder, '.pixiewood', 'android', 
                'app', 'src', 'main', 'jniLibs'
            );
            
            if (!fs.existsSync(jniLibsPath)) {
                Logger.debug('jniLibs directory not found');
                return false;
            }

            const archMap = {
                'arm64-v8a': 'aarch64-linux-android',
                'armeabi-v7a': 'arm-linux-androideabi',
                'x86_64': 'x86_64-linux-android',
                'x86': 'i686-linux-android'
            };

            const entries = fs.readdirSync(jniLibsPath);
            let copied = false;

            for (const archDir of entries) {
                const archPath = path.join(jniLibsPath, archDir);
                if (!fs.statSync(archPath).isDirectory()) continue;

                const ndkArch = archMap[archDir];
                if (!ndkArch) continue;

                const libcppSrc = path.join(
                    ndkPath, 'toolchains', 'llvm', 'prebuilt', 'windows-x86_64',
                    'sysroot', 'usr', 'lib', ndkArch, 'libc++_shared.so'
                );
                const libcppDest = path.join(archPath, 'libc++_shared.so');

                if (fs.existsSync(libcppSrc)) {
                    fs.copyFileSync(libcppSrc, libcppDest);
                    Logger.info(`Copied libc++_shared.so to ${archDir}`);
                    copied = true;
                }
            }

            if (copied) {
                vscode.window.showInformationMessage('Copied libc++_shared.so to jniLibs');
            }
            return copied;
        } catch (error) {
            Logger.error('Failed to copy libc++_shared.so', error);
            return false;
        }
    }

    /**
     * Run pixiewood prepare command
     */
    runPrepare() {
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();

        // Auto-patch pixiewood for Windows
        PixiewoodPatcher.patchForWindows(config.pixiewoodPath);

        const commands = [
            `export PATH=/${envPath}/bin:$PATH`,
            `export PERL5LIB=/${envPath}/lib/perl5/site_perl`,
            `/${envPath}/bin/perl ${PathUtils.toMsysPath(config.pixiewoodPath)} prepare${config.androidVerbose ? ' -v' : ''}`
        ];

        TerminalManager.executeCommand(commands, 'Running Pixiewood Prepare...');
    }

    /**
     * Run pixiewood generate command
     */
    runGenerate() {
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();

        PixiewoodPatcher.patchForWindows(config.pixiewoodPath);

        const commands = [
            `export PATH=/${envPath}/bin:$PATH`,
            `export PERL5LIB=/${envPath}/lib/perl5/site_perl`,
            `/${envPath}/bin/perl ${PathUtils.toMsysPath(config.pixiewoodPath)} generate${config.androidVerbose ? ' -v' : ''}`
        ];

        TerminalManager.executeCommand(commands, 'Running Pixiewood Generate...');
    }

    /**
     * Run pixiewood build command
     */
    runBuild() {
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();

        const commands = [
            `export PATH=/${envPath}/bin:$PATH`,
            `export PERL5LIB=/${envPath}/lib/perl5/site_perl`,
            `/${envPath}/bin/perl ${PathUtils.toMsysPath(config.pixiewoodPath)} build${config.androidVerbose ? ' -v' : ''}`
        ];

        TerminalManager.executeCommand(commands, 'Running Pixiewood Build...');
    }

    /**
     * Install pixiewood to a directory
     * @param {string} targetDir 
     * @param {vscode.ExtensionContext} context 
     */
    async installPixiewood(targetDir, context) {
        const config = ConfigManager.getAll();
        const scriptPath = path.join(context.extensionPath, 'scripts', 'install-pixiewood.sh');
        const scriptMsysPath = PathUtils.toMsysPath(scriptPath);
        const targetMsysPath = PathUtils.toMsysPath(targetDir);

        const commands = [
            'echo "Starting Pixiewood installation..."',
            `chmod +x "${scriptMsysPath}"`,
            `"${scriptMsysPath}" "${targetMsysPath}"`
        ];

        TerminalManager.executeCommand(
            commands, 
            'Installing Pixiewood (this may take several minutes)...'
        );

        // Update configuration
        const pixiewoodScriptPath = path.join(targetDir, 'gtk-android-builder', 'pixiewood');
        await ConfigManager.set('pixiewoodPath', pixiewoodScriptPath);

        vscode.window.showInformationMessage(
            `Pixiewood installed to: ${targetDir}`,
            'Open Folder'
        ).then(selection => {
            if (selection === 'Open Folder') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(targetDir));
            }
        });
    }

    /**
     * Check if pixiewood is installed
     * @returns {boolean}
     */
    isPixiewoodInstalled() {
        const config = ConfigManager.getAll();
        return config.pixiewoodPath && fs.existsSync(config.pixiewoodPath);
    }

    /**
     * Get the APK output path
     * @param {string} workspaceFolder 
     * @returns {string|null}
     */
    getApkPath(workspaceFolder) {
        const config = ConfigManager.getAll();
        const buildType = config.androidReleaseBuild ? 'release' : 'debug';
        const apkPath = path.join(
            workspaceFolder, '.pixiewood', 'android', 
            'app', 'build', 'outputs', 'apk', buildType, `app-${buildType}.apk`
        );
        return fs.existsSync(apkPath) ? apkPath : null;
    }
}

// Singleton instance
const androidBuilder = new AndroidBuilder();

module.exports = androidBuilder;
