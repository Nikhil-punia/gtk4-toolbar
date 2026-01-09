/**
 * Status Bar Manager
 * Handles VS Code status bar items for GTK4 Toolbar
 */
const vscode = require('vscode');

class StatusBarManager {
    constructor() {
        this.items = new Map();
    }

    /**
     * Create a status bar button
     * @param {string} id - Unique identifier
     * @param {Object} options - Button options
     * @returns {vscode.StatusBarItem}
     */
    createButton(id, options) {
        const {
            text,
            tooltip,
            command,
            priority = 0,
            alignment = vscode.StatusBarAlignment.Left,
            color = '#ffffffff'
        } = options;

        const item = vscode.window.createStatusBarItem(alignment, priority);
        item.text = text;
        item.tooltip = tooltip;
        item.command = command;
        item.color = color;

        this.items.set(id, item);
        return item;
    }

    /**
     * Show a status bar item
     * @param {string} id 
     */
    show(id) {
        const item = this.items.get(id);
        if (item) {
            item.show();
        }
    }

    /**
     * Hide a status bar item
     * @param {string} id 
     */
    hide(id) {
        const item = this.items.get(id);
        if (item) {
            item.hide();
        }
    }

    /**
     * Show all status bar items
     */
    showAll() {
        for (const item of this.items.values()) {
            item.show();
        }
    }

    /**
     * Get a status bar item by id
     * @param {string} id 
     * @returns {vscode.StatusBarItem|undefined}
     */
    get(id) {
        return this.items.get(id);
    }

    /**
     * Update button text
     * @param {string} id 
     * @param {string} text 
     */
    updateText(id, text) {
        const item = this.items.get(id);
        if (item) {
            item.text = text;
        }
    }

    /**
     * Initialize default GTK4 toolbar buttons
     */
    initializeDefaultButtons() {
        // Clean button
        this.createButton('clean', {
            text: '$(trash) Clean',
            tooltip: 'Clean Build Files',
            command: 'gtk4-toolbar.clean',
            priority: 97
        });

        // Build button
        this.createButton('build', {
            text: '$(tools) Build',
            tooltip: 'Build Current File',
            command: 'gtk4-toolbar.buildCurrent',
            priority: 96
        });

        // Run button
        this.createButton('run', {
            text: '$(play) Run',
            tooltip: 'Run Current File',
            command: 'gtk4-toolbar.runCurrent',
            priority: 95
        });

        // Build & Run button
        this.createButton('buildRun', {
            text: '$(rocket) Build & Run',
            tooltip: 'Build and Run Current File',
            command: 'gtk4-toolbar.buildRunCurrent',
            priority: 94
        });

        // Settings button
        this.createButton('settings', {
            text: '$(gear) Settings',
            tooltip: 'Open GTK4 Toolbar Settings',
            command: 'gtk4-toolbar.openSettings',
            priority: 93
        });

        this.showAll();
    }

    /**
     * Get all items for subscription
     * @returns {vscode.StatusBarItem[]}
     */
    getAllItems() {
        return Array.from(this.items.values());
    }

    /**
     * Dispose all status bar items
     */
    dispose() {
        for (const item of this.items.values()) {
            item.dispose();
        }
        this.items.clear();
    }
}

// Singleton instance
const statusBarManager = new StatusBarManager();

module.exports = statusBarManager;
