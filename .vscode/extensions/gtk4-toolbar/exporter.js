const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function activate(context) {
    console.log('GTK4 Project Exporter is active!');

    // Register the export command
    let exportCommand = vscode.commands.registerCommand('gtk4-toolbar.exportProject', async () => {
        try {
            // 1. Ask user for destination folder
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Export Destination'
            });

            if (!folderUri || folderUri.length === 0) {
                return;
            }

            const destFolder = folderUri[0].fsPath;
            const extensionName = 'gtk4-project-template';
            const exportPath = path.join(destFolder, extensionName);

            // Create extension structure
            if (!fs.existsSync(exportPath)) fs.mkdirSync(exportPath);
            if (!fs.existsSync(path.join(exportPath, 'scripts'))) fs.mkdirSync(path.join(exportPath, 'scripts'));
            if (!fs.existsSync(path.join(exportPath, 'templates'))) fs.mkdirSync(path.join(exportPath, 'templates'));

            // 2. Copy .ps1 script
            const ps1Content = `# Create build directory
New-Item -ItemType Directory -Force -Path build | Out-Null

# Navigate to build directory
Push-Location build

# Configure CMake (Auto-detect generator) and generate compile_commands.json
cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ..

# Build the project
cmake --build .

# Return to original directory
Pop-Location
`;
            fs.writeFileSync(path.join(exportPath, 'scripts', 'configure.ps1'), ps1Content);

            // 3. Create package.json
            const packageJson = {
                "name": "gtk4-project-template",
                "displayName": "GTK4 Project Template",
                "description": "GTK4 C++ Project Template with CMake and MSYS2 support",
                "version": "0.0.1",
                "publisher": "user",
                "engines": {
                    "vscode": "^1.80.0"
                },
                "categories": [
                    "Other"
                ],
                "activationEvents": [
                    "onCommand:gtk4-template.init"
                ],
                "main": "./extension.js",
                "contributes": {
                    "commands": [
                        {
                            "command": "gtk4-template.init",
                            "title": "GTK4: Initialize Project"
                        }
                    ]
                }
            };
            fs.writeFileSync(path.join(exportPath, 'package.json'), JSON.stringify(packageJson, null, 4));

            // 4. Create extension.js (The logic to restore files)
            const extensionJsContent = `const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
    let disposable = vscode.commands.registerCommand('gtk4-template.init', async function () {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Please open a folder first.');
            return;
        }
        
        const rootPath = workspaceFolders[0].uri.fsPath;
        const vscodePath = path.join(rootPath, '.vscode');
        
        if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath);
        }

        const libraries = await vscode.window.showInputBox({
            prompt: 'Enter pkg-config libraries (space separated)',
            placeHolder: 'e.g. gtk4 libadwaita-1',
            value: 'gtk4 libadwaita-1'
        });

        if (libraries === undefined) {
            return;
        }
        const libString = libraries || 'gtk4';

        // 1. Restore tasks.json
        const tasksJson = {
            "version": "2.0.0",
            "tasks": [
                {
                    "label": "Build App",
                    "type": "shell",
                    "command": "g++",
                    "args": [
                        "main.cpp",
                        "-o",
                        "main.exe",
                        "$(pkg-config --cflags --libs " + libString + ").Split()"
                    ],
                    "isBackground": false,
                    "problemMatcher": ["$gcc"],
                    "group": "build"
                },
                {
                    "label": "Build with PowerShell Script",
                    "type": "shell",
                    "command": "\${workspaceFolder}/.vscode/configure.ps1",
                    "isBackground": false,
                    "problemMatcher": ["$gcc"],
                    "group": "build"
                }
            ]
        };
        fs.writeFileSync(path.join(vscodePath, 'tasks.json'), JSON.stringify(tasksJson, null, 4));

        // 2. Restore settings.json
        const settingsJson = {
            "extensions.autoCheckUpdates": false,
            "extensions.autoUpdate": false,
            "extensions.ignoreRecommendations": false,
            "C_Cpp.default.compileCommands": "\${workspaceFolder}/build/compile_commands.json",
            "gtk4.statusBar.enabled": true
        };
        fs.writeFileSync(path.join(vscodePath, 'settings.json'), JSON.stringify(settingsJson, null, 4));

        // 3. Restore configure.ps1
        const scriptPath = path.join(context.extensionPath, 'scripts', 'configure.ps1');
        if (fs.existsSync(scriptPath)) {
            const destScriptPath = path.join(vscodePath, 'configure.ps1');
            fs.copyFileSync(scriptPath, destScriptPath);
        }

        vscode.window.showInformationMessage('GTK4 Project Initialized! (.vscode folder created)');
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
`;
            fs.writeFileSync(path.join(exportPath, 'extension.js'), extensionJsContent);

            vscode.window.showInformationMessage(`Extension exported successfully to: ${exportPath}`);

        } catch (error) {
            vscode.window.showErrorMessage('Export failed: ' + error.message);
        }
    });

    context.subscriptions.push(exportCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
