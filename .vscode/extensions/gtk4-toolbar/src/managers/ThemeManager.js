/**
 * Theme Manager
 * Handles GTK theme installation and management
 */
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const https = require('https');
const ConfigManager = require('./ConfigManager');
const TerminalManager = require('./TerminalManager');
const { PathUtils, Logger } = require('../utils');

class ThemeManager {
    constructor() {
        this.themeDir = null;
    }

    /**
     * Get the themes directory path
     * @returns {string}
     */
    getThemeDirectory() {
        if (this.themeDir) return this.themeDir;
        
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();
        this.themeDir = path.join(config.msys2Path, envPath, 'share', 'themes');
        return this.themeDir;
    }

    /**
     * Get list of installed themes
     * @returns {string[]}
     */
    getInstalledThemes() {
        try {
            const themeDir = this.getThemeDirectory();
            if (!fs.existsSync(themeDir)) {
                return [];
            }
            
            return fs.readdirSync(themeDir)
                .filter(item => {
                    const itemPath = path.join(themeDir, item);
                    return fs.statSync(itemPath).isDirectory();
                });
        } catch (error) {
            Logger.error('Failed to get installed themes', error);
            return [];
        }
    }

    /**
     * Install a theme from GitHub
     * @param {string} repo - GitHub repo URL
     * @param {string} dirName - Directory name for the theme
     * @param {string[]} releaseUrls - URLs to download
     */
    async installTheme(repo, dirName, releaseUrls = []) {
        const themeDir = this.getThemeDirectory();
        const config = ConfigManager.getAll();
        
        // Ensure themes directory exists
        if (!fs.existsSync(themeDir)) {
            fs.mkdirSync(themeDir, { recursive: true });
        }

        if (releaseUrls.length > 0) {
            // Download and extract release files
            await this.downloadReleases(releaseUrls, themeDir);
        } else {
            // Clone from git
            const msysThemeDir = PathUtils.toMsysPath(themeDir);
            TerminalManager.executeCommand(
                `cd "${msysThemeDir}" && git clone --depth 1 "${repo}" "${dirName}"`,
                `Installing theme: ${dirName}`
            );
        }
    }

    /**
     * Download release files
     * @param {string[]} urls 
     * @param {string} destDir 
     */
    async downloadReleases(urls, destDir) {
        for (const url of urls) {
            const fileName = path.basename(url);
            const msysDestDir = PathUtils.toMsysPath(destDir);
            
            TerminalManager.executeCommand(
                `cd "${msysDestDir}" && curl -L -O "${url}" && tar -xf "${fileName}" && rm "${fileName}"`,
                `Downloading: ${fileName}`
            );
        }
    }

    /**
     * Delete a theme
     * @param {string} themePath 
     */
    deleteTheme(themePath) {
        try {
            fs.rmSync(themePath, { recursive: true, force: true });
            vscode.window.showInformationMessage('Theme deleted successfully');
        } catch (error) {
            Logger.error('Failed to delete theme', error);
            vscode.window.showErrorMessage(`Failed to delete theme: ${error.message}`);
        }
    }

    /**
     * Fetch available releases from GitHub
     * @param {string} owner 
     * @param {string} repo 
     * @returns {Promise<Object[]>}
     */
    fetchReleases(owner, repo) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: `/repos/${owner}/${repo}/releases`,
                headers: { 'User-Agent': 'GTK4-Toolbar-VSCode' }
            };

            https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const releases = JSON.parse(data);
                        resolve(releases);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Search for themes on GitHub
     * @param {string} query 
     * @returns {Promise<Object[]>}
     */
    searchThemes(query) {
        return new Promise((resolve, reject) => {
            const searchQuery = encodeURIComponent(`${query} gtk theme`);
            const options = {
                hostname: 'api.github.com',
                path: `/search/repositories?q=${searchQuery}&sort=stars&per_page=12`,
                headers: { 'User-Agent': 'GTK4-Toolbar-VSCode' }
            };

            https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result.items || []);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Open themes folder in file explorer
     */
    openThemeFolder() {
        const themeDir = this.getThemeDirectory();
        if (fs.existsSync(themeDir)) {
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(themeDir));
        } else {
            vscode.window.showWarningMessage('Themes directory does not exist');
        }
    }
}

// Singleton instance
const themeManager = new ThemeManager();

module.exports = themeManager;
