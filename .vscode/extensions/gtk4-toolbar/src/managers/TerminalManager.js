/**
 * Terminal Manager
 * Handles MSYS2 terminal creation and command execution
 */
const vscode = require('vscode');
const ConfigManager = require('./ConfigManager');
const { PathUtils, Logger } = require('../utils');

class TerminalManager {
    constructor() {
        this.sharedTerminal = null;
    }

    /**
     * Get environment variables for MSYS2 terminal
     * @returns {Object}
     */
    getEnvironment() {
        const config = ConfigManager.getAll();
        const envPath = config.msys2Environment.toLowerCase();
        const msysPath = PathUtils.toMsysPath(config.msys2Path);

        const env = {
            'MSYSTEM': config.msys2Environment,
            'CHERE_INVOKING': '1',
            'GSK_RENDERER': config.gskRenderer,
            'PKG_CONFIG_PATH': `${msysPath}/${envPath}/lib/pkgconfig:${msysPath}/${envPath}/share/pkgconfig`
        };

        if (config.gtkTheme) {
            env['GTK_THEME'] = config.gtkTheme;
        }
        if (config.gtkDebug) {
            env['GTK_DEBUG'] = config.gtkDebug;
        }

        // Add custom environment variables
        if (config.customEnvVars) {
            Object.assign(env, config.customEnvVars);
        }

        return env;
    }

    /**
     * Get or create a shared terminal
     * @returns {vscode.Terminal}
     */
    getSharedTerminal() {
        const config = ConfigManager.getAll();
        
        if (!this.sharedTerminal || this.sharedTerminal.exitStatus !== undefined) {
            this.sharedTerminal = this.createTerminal('GTK4 Development');
            Logger.debug(`Created new shared terminal with GSK_RENDERER=${config.gskRenderer}`);
        }
        
        return this.sharedTerminal;
    }

    /**
     * Create a new MSYS2 terminal
     * @param {string} name - Terminal name
     * @returns {vscode.Terminal}
     */
    createTerminal(name) {
        const config = ConfigManager.getAll();
        
        return vscode.window.createTerminal({
            name: name,
            hideFromUser: false,
            shellPath: `${config.msys2Path}/usr/bin/bash.exe`,
            shellArgs: ['--login', '-i'],
            env: this.getEnvironment()
        });
    }

    /**
     * Execute commands in terminal
     * @param {string|string[]} commands - Command(s) to execute
     * @param {string} description - Description shown to user
     * @param {Object} options - Options
     * @param {boolean} options.useSharedTerminal - Use shared terminal
     * @param {string} options.workingDir - Working directory
     * @returns {vscode.Terminal}
     */
    executeCommand(commands, description, options = {}) {
        const { useSharedTerminal = true, workingDir = null } = options;
        
        const terminal = useSharedTerminal 
            ? this.getSharedTerminal() 
            : this.createTerminal('GTK4 Operation');
        
        Logger.debug(`Executing: ${description}`);
        
        terminal.show();

        // Build full command
        let fullCommand = `echo "${description}" && echo "=========================================="`;
        
        if (workingDir) {
            fullCommand += ` && cd "${workingDir}"`;
        }

        if (Array.isArray(commands)) {
            for (const cmd of commands) {
                if (cmd.trim()) {
                    fullCommand += ` && ${cmd}`;
                }
            }
        } else if (commands.trim()) {
            fullCommand += ` && ${commands}`;
        }

        terminal.sendText(fullCommand);
        
        return terminal;
    }

    /**
     * Execute MSYS2-specific commands
     * Note: Callers should include proper PATH setup in their commands
     * @param {string[]} commands 
     * @param {string} description 
     * @param {string} workspaceFolder 
     * @returns {vscode.Terminal}
     */
    executeMSYS2Command(commands, description, workspaceFolder) {
        return this.executeCommand(commands, description, {
            useSharedTerminal: true,
            workingDir: workspaceFolder
        });
    }

    /**
     * Dispose of all terminals
     */
    dispose() {
        if (this.sharedTerminal) {
            this.sharedTerminal.dispose();
            this.sharedTerminal = null;
        }
    }
}

// Singleton instance
const terminalManager = new TerminalManager();

module.exports = terminalManager;
