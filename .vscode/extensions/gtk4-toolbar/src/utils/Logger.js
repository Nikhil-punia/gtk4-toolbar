/**
 * Logger utility for debug and info logging
 */
class Logger {
    constructor(name = 'GTK4 Toolbar') {
        this.name = name;
        this.debugEnabled = false;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled 
     */
    setDebugEnabled(enabled) {
        this.debugEnabled = enabled;
    }

    /**
     * Log info message
     * @param {string} message 
     */
    info(message) {
        console.log(`[${this.name}] ${message}`);
    }

    /**
     * Log debug message (only if debug is enabled)
     * @param {string} message 
     */
    debug(message) {
        if (this.debugEnabled) {
            console.log(`[${this.name} Debug] ${message}`);
        }
    }

    /**
     * Log warning message
     * @param {string} message 
     */
    warn(message) {
        console.warn(`[${this.name}] ${message}`);
    }

    /**
     * Log error message
     * @param {string} message 
     * @param {Error} [error] 
     */
    error(message, error = null) {
        console.error(`[${this.name}] ${message}`);
        if (error) {
            console.error(error);
        }
    }
}

// Singleton instance
const logger = new Logger();

module.exports = logger;
