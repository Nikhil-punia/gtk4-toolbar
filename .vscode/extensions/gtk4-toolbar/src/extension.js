/**
 * GTK4 Toolbar Extension - Main Entry Point
 * 
 * A VS Code extension for GTK4/libadwaita development on Windows using MSYS2.
 * Supports building, running, and Android deployment via Pixiewood.
 * 
 * @author GTK4 Toolbar Team
 * @version 2.0.0
 */

const vscode = require('vscode');
const { Logger } = require('./utils');
const { StatusBarManager, ConfigManager, TerminalManager } = require('./managers');
const { BuildCommands, SettingsPanel } = require('./commands');
const exporter = require('../exporter');

/**
 * Extension activation
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    Logger.info('GTK4 Toolbar extension is now active!');

    // Initialize debug logging
    Logger.setDebugEnabled(ConfigManager.isDebugEnabled());

    // Activate the exporter module
    exporter.activate(context);

    // Initialize status bar buttons
    StatusBarManager.initializeDefaultButtons();

    // Register commands
    BuildCommands.registerCommands(context);
    SettingsPanel.registerCommand(context);

    // Add status bar items to subscriptions
    StatusBarManager.getAllItems().forEach(item => {
        context.subscriptions.push(item);
    });

    // Show welcome message
    if (ConfigManager.get('showSuccessNotifications', true)) {
        vscode.window.showInformationMessage(
            'GTK4 Toolbar loaded! Check the status bar for build buttons.'
        );
    }
}

/**
 * Extension deactivation
 */
function deactivate() {
    Logger.info('GTK4 Toolbar extension deactivated');
    StatusBarManager.dispose();
    TerminalManager.dispose();
}

module.exports = {
    activate,
    deactivate
};
