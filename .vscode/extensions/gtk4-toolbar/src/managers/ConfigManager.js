/**
 * Configuration Manager
 * Handles all VS Code configuration for the GTK4 Toolbar extension
 */
const vscode = require('vscode');

class ConfigManager {
    constructor() {
        this.configSection = 'gtk4Toolbar';
    }

    /**
     * Get the VS Code configuration object
     * @returns {vscode.WorkspaceConfiguration}
     */
    getConfiguration() {
        return vscode.workspace.getConfiguration(this.configSection);
    }

    /**
     * Get all configuration values as an object
     * @returns {Object}
     */
    getAll() {
        const config = this.getConfiguration();
        return {
            // MSYS2 Settings
            msys2Path: config.get('msys2Path'),
            msys2Environment: config.get('msys2Environment', 'UCRT64'),
            
            // Compiler Settings
            compiler: config.get('compiler', 'g++'),
            cppStandard: config.get('cppStandard', 'c++17'),
            compilerFlags: config.get('compilerFlags', ['-Wall', '-Wextra']),
            
            // GTK Settings
            gskRenderer: config.get('gskRenderer', 'cairo'),
            gtkTheme: config.get('gtkTheme', ''),
            gtkDebug: config.get('gtkDebug', ''),
            pkgConfigLibraries: config.get('pkgConfigLibraries', 'gtk4 libadwaita-1 gstreamer-1.0'),
            
            // CMake Settings
            cmakeGenerator: config.get('cmakeGenerator', 'Ninja'),
            cmakeBuildType: config.get('cmakeBuildType', 'Debug'),
            cmakeArgs: config.get('cmakeArgs', ''),
            
            // Terminal Settings
            autoCloseTerminal: config.get('autoCloseTerminal', false),
            commandDelay: config.get('commandDelay', 500),
            msys2StartDelay: config.get('msys2StartDelay', 5000),
            
            // UI Settings
            showSuccessNotifications: config.get('showSuccessNotifications', true),
            enableDebugOutput: config.get('enableDebugOutput', false),
            
            // Environment Variables
            customEnvVars: config.get('customEnvVars', {}),
            
            // Android/Pixiewood Settings
            pixiewoodPath: config.get('pixiewoodPath', 'pixiewood'),
            androidManifestPath: config.get('androidManifestPath', 'pixiewood.xml'),
            pixiewoodInstallDir: config.get('pixiewoodInstallDir', ''),
            androidSdkPath: config.get('androidSdkPath', ''),
            androidNdkPath: config.get('androidNdkPath', ''),
            androidStudioPath: config.get('androidStudioPath', ''),
            mesonPath: config.get('mesonPath', ''),
            androidReleaseBuild: config.get('androidReleaseBuild', false),
            androidVerbose: config.get('androidVerbose', false)
        };
    }

    /**
     * Get a single configuration value
     * @param {string} key 
     * @param {*} defaultValue 
     * @returns {*}
     */
    get(key, defaultValue = undefined) {
        return this.getConfiguration().get(key, defaultValue);
    }

    /**
     * Update a configuration value
     * @param {string} key 
     * @param {*} value 
     * @param {boolean} global - Whether to update globally or in workspace
     * @returns {Promise<void>}
     */
    async set(key, value, global = true) {
        const target = global 
            ? vscode.ConfigurationTarget.Global 
            : vscode.ConfigurationTarget.Workspace;
        await this.getConfiguration().update(key, value, target);
    }

    /**
     * Update multiple configuration values
     * @param {Object} values - Key-value pairs to update
     * @param {boolean} global 
     * @returns {Promise<void>}
     */
    async setMultiple(values, global = true) {
        const config = this.getConfiguration();
        const target = global 
            ? vscode.ConfigurationTarget.Global 
            : vscode.ConfigurationTarget.Workspace;
        
        for (const [key, value] of Object.entries(values)) {
            await config.update(key, value, target);
        }
    }

    /**
     * Check if debug output is enabled
     * @returns {boolean}
     */
    isDebugEnabled() {
        return this.get('enableDebugOutput', false);
    }

    /**
     * Get MSYS2 environment path (lowercase)
     * @returns {string}
     */
    getMsys2EnvPath() {
        return this.get('msys2Environment', 'UCRT64').toLowerCase();
    }

    /**
     * Get pkg-config libraries as array
     * @returns {string[]}
     */
    getPkgConfigLibraries() {
        const libs = this.get('pkgConfigLibraries', 'gtk4');
        return libs.split(/\s+/).filter(Boolean);
    }

    /**
     * Get compiler flags as array
     * @returns {string[]}
     */
    getCompilerFlags() {
        const flags = this.get('compilerFlags', ['-Wall', '-Wextra']);
        return Array.isArray(flags) ? flags : flags.split(/\s+/).filter(Boolean);
    }
}

// Singleton instance
const configManager = new ConfigManager();

module.exports = configManager;
