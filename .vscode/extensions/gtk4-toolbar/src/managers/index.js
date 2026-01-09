/**
 * Managers index - exports all manager modules
 */
const ConfigManager = require('./ConfigManager');
const TerminalManager = require('./TerminalManager');
const StatusBarManager = require('./StatusBarManager');
const ThemeManager = require('./ThemeManager');
const PackageManager = require('./PackageManager');

module.exports = {
    ConfigManager,
    TerminalManager,
    StatusBarManager,
    ThemeManager,
    PackageManager
};
