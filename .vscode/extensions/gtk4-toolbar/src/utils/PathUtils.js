/**
 * Path utilities for MSYS2 and Windows path conversions
 */
const path = require('path');

class PathUtils {
    /**
     * Convert Windows path to MSYS2 path format
     * @param {string} winPath - Windows path (e.g., C:\Users\...)
     * @returns {string} MSYS2 path (e.g., /c/Users/...)
     */
    static toMsysPath(winPath) {
        if (!winPath) return '';
        return winPath
            .replace(/^([a-zA-Z]):/, (_, drive) => `/${drive.toLowerCase()}`)
            .replace(/\\/g, '/');
    }

    /**
     * Convert MSYS2 path to Windows path format
     * @param {string} msysPath - MSYS2 path
     * @returns {string} Windows path
     */
    static toWindowsPath(msysPath) {
        if (!msysPath) return '';
        return msysPath
            .replace(/^\/([a-zA-Z])\//, (_, drive) => `${drive.toUpperCase()}:\\`)
            .replace(/\//g, '\\');
    }

    /**
     * Normalize path separators for the current platform
     * @param {string} inputPath 
     * @returns {string}
     */
    static normalize(inputPath) {
        return path.normalize(inputPath);
    }

    /**
     * Join paths safely
     * @param  {...string} paths 
     * @returns {string}
     */
    static join(...paths) {
        return path.join(...paths);
    }

    /**
     * Get directory name from path
     * @param {string} filePath 
     * @returns {string}
     */
    static dirname(filePath) {
        return path.dirname(filePath);
    }

    /**
     * Get base name from path
     * @param {string} filePath 
     * @returns {string}
     */
    static basename(filePath) {
        return path.basename(filePath);
    }

    /**
     * Get file extension
     * @param {string} filePath 
     * @returns {string}
     */
    static extname(filePath) {
        return path.extname(filePath);
    }
}

module.exports = PathUtils;
