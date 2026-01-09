/**
 * Package Manager
 * Handles MSYS2 package search and installation
 */
const vscode = require('vscode');
const cp = require('child_process');
const ConfigManager = require('./ConfigManager');
const TerminalManager = require('./TerminalManager');
const { PathUtils, Logger } = require('../utils');

class PackageManager {
    /**
     * Get the pacman executable path
     * @returns {string}
     */
    getPacmanPath() {
        const config = ConfigManager.getAll();
        return `${config.msys2Path}/usr/bin/pacman.exe`;
    }

    /**
     * Search for packages
     * @param {string} query 
     * @returns {Promise<string[]>}
     */
    searchPackages(query) {
        return new Promise((resolve, reject) => {
            const config = ConfigManager.getAll();
            const envPath = config.msys2Environment.toLowerCase();
            const pacman = this.getPacmanPath();

            // Build search command
            const searchTerm = query.includes('mingw-w64') ? query : `mingw-w64-${envPath.replace('ucrt64', 'ucrt')}-x86_64-${query}`;
            
            cp.exec(`"${pacman}" -Ss ${searchTerm}`, (error, stdout, stderr) => {
                if (error) {
                    // pacman returns non-zero if no results found
                    resolve([]);
                    return;
                }
                
                const lines = stdout.split('\n').filter(line => line.trim());
                resolve(lines);
            });
        });
    }

    /**
     * Install a package
     * @param {string} packageName 
     */
    installPackage(packageName) {
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();
        
        // Build full package name if needed
        let fullPackageName = packageName;
        if (!packageName.includes('mingw-w64')) {
            fullPackageName = `mingw-w64-${envPath.replace('ucrt64', 'ucrt')}-x86_64-${packageName}`;
        }

        TerminalManager.executeCommand(
            `pacman -S --noconfirm ${fullPackageName}`,
            `Installing package: ${fullPackageName}`
        );

        vscode.window.showInformationMessage(`Installing ${fullPackageName}...`);
    }

    /**
     * Install GStreamer suite
     */
    installGStreamerSuite() {
        const packages = [
            'gstreamer',
            'gst-plugins-base',
            'gst-plugins-good',
            'gst-plugins-bad',
            'gst-plugins-ugly',
            'gst-libav'
        ];

        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();
        const prefix = `mingw-w64-${envPath.replace('ucrt64', 'ucrt')}-x86_64-`;
        
        const fullPackages = packages.map(p => `${prefix}${p}`).join(' ');

        TerminalManager.executeCommand(
            `pacman -S --noconfirm ${fullPackages}`,
            'Installing GStreamer Multimedia Suite'
        );

        vscode.window.showInformationMessage('Installing GStreamer suite...');
    }

    /**
     * Install common development packages
     */
    installDevPackages() {
        const packages = [
            'gtk4',
            'libadwaita',
            'pkg-config',
            'gcc',
            'gdb',
            'cmake',
            'ninja',
            'meson'
        ];

        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();
        const prefix = `mingw-w64-${envPath.replace('ucrt64', 'ucrt')}-x86_64-`;
        
        const fullPackages = packages.map(p => `${prefix}${p}`).join(' ');

        TerminalManager.executeCommand(
            `pacman -Syu --noconfirm && pacman -S --noconfirm ${fullPackages}`,
            'Setting up GTK4 development environment'
        );
    }

    /**
     * Check if a package is installed
     * @param {string} packageName 
     * @returns {Promise<boolean>}
     */
    isPackageInstalled(packageName) {
        return new Promise((resolve) => {
            const pacman = this.getPacmanPath();
            
            cp.exec(`"${pacman}" -Q ${packageName}`, (error) => {
                resolve(!error);
            });
        });
    }
}

// Singleton instance
const packageManager = new PackageManager();

module.exports = packageManager;
