// VS Code API integration
const vscode = acquireVsCodeApi();

// Toast notification function
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(container);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
    toast.style.cssText = `
        background: ${bgColor}; color: white; padding: 12px 20px; border-radius: 6px;
        margin-bottom: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out; font-size: 14px;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    
    // Add animation keyframes if not already present
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        `;
        document.head.appendChild(style);
    }
    
    // Remove toast after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Configuration Management
function saveConfig() {
    const config = {
        msys2Path: document.getElementById('msys2Path').value,
        msys2Environment: document.getElementById('msys2Environment').value,
        compiler: document.getElementById('compiler').value,
        cppStandard: document.getElementById('cppStandard').value,
        compilerFlags: document.getElementById('compilerFlags').value,
        pkgConfigLibraries: document.getElementById('pkgConfigLibraries').value,
        cmakeGenerator: document.getElementById('cmakeGenerator').value,
        cmakeBuildType: document.getElementById('cmakeBuildType').value,
        cmakeArgs: document.getElementById('cmakeArgs').value,
        autoCloseTerminal: document.getElementById('autoCloseTerminal').checked,
        showSuccessNotifications: document.getElementById('showSuccessNotifications').checked,
        customEnvVars: getEnvVarsFromUI()
    };

    console.log('[GTK4 WebView] Sending saveConfig:', config);

    // Send message to extension
    vscode.postMessage({
        command: 'saveConfig',
        data: config
    });

    // Visual Feedback
    const btn = document.querySelector('button[onclick="saveConfig()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check me-2"></i>Saved!';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
    }, 2000);
}

// --- Environment Variables Logic ---

function getEnvVarsFromUI() {
    const container = document.getElementById('envVarsContainer');
    const rows = container.querySelectorAll('.env-var-row');
    const envVars = {};
    
    rows.forEach(row => {
        const key = row.querySelector('.env-key').value.trim();
        const value = row.querySelector('.env-value').value.trim();
        if (key) {
            envVars[key] = value;
        }
    });
    
    return envVars;
}

function renderEnvVars(envVars) {
    const container = document.getElementById('envVarsContainer');
    container.innerHTML = '';
    
    if (!envVars || Object.keys(envVars).length === 0) {
        // Add default empty row if none exist
        // Or maybe just leave it empty? Let's add one empty row for guidance if truly empty
        // But better to just let user click Add.
        return;
    }
    
    Object.entries(envVars).forEach(([key, value]) => {
        addEnvVarRow(key, value);
    });
}

function addEnvVarRow(key = '', value = '') {
    const container = document.getElementById('envVarsContainer');
    const rowId = 'env-row-' + Date.now() + Math.random().toString(36).substr(2, 9);
    
    const rowHtml = `
        <div class="input-group mb-2 env-var-row" id="${rowId}">
            <input type="text" class="form-control env-key" placeholder="Variable Name (e.g. GST_PLUGIN_PATH)" value="${key}">
            <span class="input-group-text">=</span>
            <input type="text" class="form-control env-value" placeholder="Value" value="${value}">
            <button class="btn btn-outline-danger" type="button" onclick="removeEnvVarRow('${rowId}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', rowHtml);
}

function addGStreamerPreset() {
    // Check if they already exist to avoid duplicates
    const currentVars = getEnvVarsFromUI();
    if (!currentVars['GST_PLUGIN_PATH']) {
        addEnvVarRow('GST_PLUGIN_PATH', '${msys2Path}/ucrt64/lib/gstreamer-1.0');
    }
    if (!currentVars['GIO_MODULE_DIR']) {
        addEnvVarRow('GIO_MODULE_DIR', '${msys2Path}/ucrt64/lib/gio/modules');
    }
    if (!currentVars['GTK_MEDIA_DRIVER']) {
        addEnvVarRow('GTK_MEDIA_DRIVER', 'gstreamer');
    }
}

function removeEnvVarRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
}

function saveGtkConfig() {
    const config = {
        gskRenderer: document.getElementById('gskRenderer').value,
        gtkTheme: document.getElementById('gtkTheme').value,
        gtkDebug: document.getElementById('gtkDebug').value
    };

    console.log('[GTK4 WebView] Sending saveGtkConfig:', config);

    vscode.postMessage({
        command: 'saveGtkConfig',
        data: config
    });

    // Visual Feedback
    const btn = document.querySelector('button[onclick="saveGtkConfig()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check me-2"></i>Applied!';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
    }, 2000);
}

function loadConfig() {
    vscode.postMessage({
        command: 'requestConfig'
    });
}

function pickMsys2Path() {
    vscode.postMessage({
        command: 'pickMsys2Path'
    });
}

function installMsys2() {
    const path = document.getElementById('msys2Path').value;
    vscode.postMessage({
        command: 'installMsys2',
        path: path
    });
}

function updateMsys2Buttons() {
    const path = document.getElementById('msys2Path').value;
    const installBtn = document.getElementById('btn-install-msys2');
    const showBtn = document.getElementById('btn-show-msys2');
    
    if (path && path.trim() !== '') {
        installBtn.style.display = 'none';
        showBtn.style.display = 'block';
    } else {
        installBtn.style.display = 'block';
        showBtn.style.display = 'none';
    }
}

function openMsys2Folder() {
    const path = document.getElementById('msys2Path').value;
    if (path) {
        vscode.postMessage({
            command: 'openMsys2Folder',
            path: path
        });
    }
}

function setupEnvironment() {
    vscode.postMessage({
        command: 'setupEnvironment'
    });
}

function configureCMake() {
    vscode.postMessage({
        command: 'configureCMake'
    });
}

function configureGppIntellisense() {
    vscode.postMessage({
        command: 'configureGppIntellisense'
    });
}

function deleteTheme(themePath) {
    vscode.postMessage({
        command: 'deleteTheme',
        path: themePath
    });
}

function applyTheme(themeName) {
    document.getElementById('gtkTheme').value = themeName;
}

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
        case 'loadConfig':
            const config = message.data;
            if (config) {
                document.getElementById('msys2Path').value = config.msys2Path || '';
                document.getElementById('msys2Environment').value = config.msys2Environment || 'ucrt64';
                document.getElementById('compiler').value = config.compiler || 'g++';
                document.getElementById('cppStandard').value = config.cppStandard || 'c++17';
                document.getElementById('compilerFlags').value = config.compilerFlags || '';
                document.getElementById('pkgConfigLibraries').value = config.pkgConfigLibraries || 'gtk4 libadwaita-1 gstreamer-1.0';
                document.getElementById('cmakeGenerator').value = config.cmakeGenerator || 'Ninja';
                document.getElementById('cmakeBuildType').value = config.cmakeBuildType || 'Debug';
                document.getElementById('cmakeArgs').value = config.cmakeArgs || '';
                document.getElementById('autoCloseTerminal').checked = config.autoCloseTerminal || false;
                document.getElementById('showSuccessNotifications').checked = config.showSuccessNotifications || true;
                document.getElementById('pixiewoodPath').value = config.pixiewoodPath || 'pixiewood';
                document.getElementById('androidManifestPath').value = config.androidManifestPath || 'pixiewood.xml';
                document.getElementById('pixiewoodInstallDir').value = config.pixiewoodInstallDir || '';
                // Android SDK/NDK settings
                document.getElementById('androidSdkPath').value = config.androidSdkPath || '';
                document.getElementById('androidNdkPath').value = config.androidNdkPath || '';
                document.getElementById('androidStudioPath').value = config.androidStudioPath || '';
                document.getElementById('mesonPath').value = config.mesonPath || '';
                document.getElementById('androidReleaseBuild').checked = config.androidReleaseBuild || false;
                document.getElementById('androidVerbose').checked = config.androidVerbose || false;
                updateMsys2Buttons();
                
                // Check status after loading config
                if (config.pixiewoodInstallDir) {
                    checkPixiewoodStatus();
                }
                renderEnvVars(config.customEnvVars);
            }
            break;
        case 'loadGtkConfig':
            const gtkConfig = message.data;
            if (gtkConfig) {
                document.getElementById('gskRenderer').value = gtkConfig.gskRenderer || 'gl';
                document.getElementById('gtkTheme').value = gtkConfig.gtkTheme || '';
                document.getElementById('gtkDebug').value = gtkConfig.gtkDebug || '';
            }
            break;
        case 'updateMsys2Path':
            if (message.path) {
                document.getElementById('msys2Path').value = message.path;
                updateMsys2Buttons();
            }
            break;
        case 'updatePixiewoodPath':
            if (message.path) {
                document.getElementById('pixiewoodPath').value = message.path;
            }
            break;
        case 'updateAndroidManifestPath':
            if (message.path) {
                document.getElementById('androidManifestPath').value = message.path;
            }
            break;
        case 'updatePixiewoodInstallDir':
            if (message.path) {
                document.getElementById('pixiewoodInstallDir').value = message.path;
                checkPixiewoodStatus();
            }
            break;
        case 'updateAndroidSdkPath':
            if (message.path) {
                document.getElementById('androidSdkPath').value = message.path;
            }
            break;
        case 'updateAndroidNdkPath':
            if (message.path) {
                document.getElementById('androidNdkPath').value = message.path;
            }
            break;
        case 'updateAndroidStudioPath':
            if (message.path) {
                document.getElementById('androidStudioPath').value = message.path;
            }
            break;
        case 'updateMesonPath':
            if (message.path) {
                document.getElementById('mesonPath').value = message.path;
            }
            break;
        case 'updatePixiewoodStatus':
            const installBtn = document.getElementById('installButtonContainer');
            const installedBadge = document.getElementById('installedBadgeContainer');
            
            if (message.installed) {
                installBtn.style.display = 'none';
                installedBadge.style.display = 'block';
                // Auto-update the script path if empty or default
                const currentScriptPath = document.getElementById('pixiewoodPath').value;
                if (!currentScriptPath || currentScriptPath === 'pixiewood') {
                    // We can't easily guess the full path here without more info, 
                    // but the user can browse for it.
                }
            } else {
                installBtn.style.display = 'block';
                installedBadge.style.display = 'none';
            }
            break;
        case 'configUpdated':
            // Update pkgConfigLibraries field when a library is installed/removed
            if (message.pkgConfigLibraries !== undefined) {
                document.getElementById('pkgConfigLibraries').value = message.pkgConfigLibraries;
                showToast('Build configuration updated!', 'success');
            }
            break;
        case 'packageRemoved':
            showToast(`Package ${message.package} removed!`, 'success');
            // Refresh the search results to update the installed status
            const searchInput = document.getElementById('packageSearchInput');
            if (searchInput && searchInput.value) {
                searchPackages();
            }
            break;
        case 'refreshThemes':
            vscode.postMessage({ command: 'requestInstalledThemes' });
            break;
        case 'updateInstalledThemes':
            const themes = message.themes;
            const list = document.getElementById('installedThemesList');
            list.innerHTML = '';
            
            if (!themes || themes.length === 0) {
                list.innerHTML = '<div class="list-group-item text-muted">No themes found.</div>';
            } else {
                // Sort by name
                themes.sort((a, b) => a.name.localeCompare(b.name));
                
                themes.forEach(theme => {
                    const item = document.createElement('div');
                    item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                    
                    const content = document.createElement('div');
                    content.style.cursor = 'pointer';
                    content.className = 'flex-grow-1';
                    content.onclick = () => applyTheme(theme.name);
                    
                    const header = document.createElement('div');
                    header.className = 'd-flex w-100 justify-content-between align-items-center';
                    
                    const name = document.createElement('h6');
                    name.className = 'mb-1';
                    name.textContent = theme.name;
                    
                    const typeBadge = document.createElement('span');
                    typeBadge.className = `badge rounded-pill me-2 ${theme.builtIn ? 'bg-success' : (theme.type.includes('System') ? 'bg-secondary' : 'bg-primary')}`;
                    typeBadge.textContent = theme.type;
                    
                    header.appendChild(name);
                    header.appendChild(typeBadge);
                    
                    const pathInfo = document.createElement('small');
                    pathInfo.className = 'text-muted d-block';
                    pathInfo.style.fontSize = '0.75em';
                    pathInfo.textContent = theme.builtIn ? 'Built-in GTK4 theme' : theme.path;
                    
                    content.appendChild(header);
                    content.appendChild(pathInfo);
                    
                    item.appendChild(content);

                    // Delete Button - Only for user-installed themes (not built-in or system)
                    if (!theme.builtIn && !theme.type.includes('System')) {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'btn btn-sm btn-outline-danger ms-2';
                        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                        deleteBtn.title = 'Delete Theme';
                        deleteBtn.onclick = (e) => {
                            e.stopPropagation();
                            deleteTheme(theme.path);
                        };
                        item.appendChild(deleteBtn);
                    }

                    list.appendChild(item);
                });
            }
            break;
        case 'onlineThemesResult':
            renderThemes(message.themes);
            break;
        case 'showReleaseSelection':
            showReleaseSelectionModal(message.releases, message.repo, message.dirName);
            break;
    }
});

// Theme Data
const onlineThemes = [
    {
        name: 'Adwaita (Built-in)',
        author: 'GNOME',
        preview: '✅',
        description: 'Default GTK4 light theme - always available',
        builtIn: true
    },
    {
        name: 'Adwaita-dark (Built-in)',
        author: 'GNOME',
        preview: '🌙',
        description: 'Default GTK4 dark theme - always available',
        builtIn: true
    },
    {
        name: 'Nordic',
        author: 'EliverLara',
        preview: '❄️',
        repo: 'https://github.com/EliverLara/Nordic.git',
        dirName: 'Nordic',
        description: 'Nordic-bluish GTK theme - GTK3/GTK4 compatible'
    },
    {
        name: 'Dracula',
        author: 'Dracula Theme',
        preview: '🧛',
        repo: 'https://github.com/dracula/gtk.git',
        dirName: 'Dracula',
        description: 'Dark theme with purple accents'
    },
    {
        name: 'Arc Theme',
        author: 'jnsh',
        preview: '🔵',
        repo: 'https://github.com/jnsh/arc-theme.git',
        dirName: 'Arc-Dark',
        description: 'Flat theme with transparent elements (GTK3 only)'
    }
];

function renderThemes(themes = onlineThemes) {
    const grid = document.getElementById('themeGrid');
    grid.innerHTML = '';

    if (!themes || themes.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center p-4 text-muted">No themes found.</div>';
        return;
    }

    themes.forEach(theme => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-4';
        
        const preview = theme.stars ? `⭐ ${theme.stars}` : (theme.preview || '🎨');
        const buttonHtml = theme.builtIn 
            ? `<span class="badge bg-success">Built-in</span>`
            : `<button class="btn btn-primary btn-sm mt-2" onclick="installTheme('${theme.repo}', '${theme.dirName}')">
                   <i class="fas fa-download me-1"></i> Install
               </button>`;
        
        col.innerHTML = `
            <div class="card h-100">
                <div class="card-body text-center">
                    <div class="display-4 mb-3">${preview}</div>
                    <h5 class="card-title">${theme.name}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">by ${theme.author}</h6>
                    ${theme.description ? `<p class="card-text small text-muted">${theme.description}</p>` : ''}
                    ${buttonHtml}
                </div>
            </div>
        `;
        grid.appendChild(col);
    });
}

function getSearchQuery(baseQuery) {
    const gtkFilter = document.getElementById('gtkFilter').checked;
    if (gtkFilter && !baseQuery.toLowerCase().includes('gtk')) {
        return `${baseQuery} topic:gtk-theme`;
    }
    return baseQuery;
}

function searchTag(tag) {
    const searchInput = document.getElementById('themeSearch');
    searchInput.value = tag;
    
    const finalQuery = getSearchQuery(tag);

    // Trigger search immediately
    vscode.postMessage({
        command: 'searchOnlineThemes',
        query: finalQuery
    });
    document.getElementById('themeGrid').innerHTML = '<div class="col-12 text-center p-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
}

let searchTimeout;
function handleSearch(event) {
    clearTimeout(searchTimeout);
    const query = event.target.value;
    
    if (event.key === 'Enter' || query.length > 2) {
        searchTimeout = setTimeout(() => {
            const finalQuery = getSearchQuery(query);
            vscode.postMessage({
                command: 'searchOnlineThemes',
                query: finalQuery
            });
            document.getElementById('themeGrid').innerHTML = '<div class="col-12 text-center p-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        }, 800);
    } else if (query.length === 0) {
        renderThemes(onlineThemes);
    }
}

function installTheme(repo, dirName) {
    // Extract owner and repo name
    const repoMatch = repo.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!repoMatch) {
        alert('Invalid repository URL');
        return;
    }
    const repoOwner = repoMatch[1];
    const repoName = repoMatch[2];
    
    // Show loading modal
    showReleaseLoadingModal(dirName);
    
    // Fetch available releases
    vscode.postMessage({
        command: 'fetchReleases',
        repoOwner: repoOwner,
        repoName: repoName,
        dirName: dirName,
        repo: repo
    });
}

function showReleaseLoadingModal(themeName) {
    const modalHtml = `
        <div class="modal fade" id="releaseModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Loading Releases...</h5>
                    </div>
                    <div class="modal-body text-center">
                        <div class="spinner-border text-primary mb-3" role="status"></div>
                        <p>Fetching available releases for <strong>${themeName}</strong></p>
                    </div>
                </div>
            </div>
        </div>`;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('releaseModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('releaseModal'));
    modal.show();
}

function showReleaseSelectionModal(releases, repo, dirName) {
    const modalHtml = `
        <div class="modal fade" id="releaseModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Select Release Files</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted">Select which theme variants to install:</p>
                        <div id="releaseList"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="installSelectedReleases()">Install Selected</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    // Remove existing modal
    const existingModal = document.getElementById('releaseModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const releaseList = document.getElementById('releaseList');
    
    if (releases.length === 0) {
        releaseList.innerHTML = '<div class="alert alert-info">No pre-built releases found. Will build from source.</div>';
        setTimeout(() => {
            startInstallation(repo, dirName, []);
        }, 2000);
        return;
    }
    
    // Render release checkboxes
    releases.forEach((release, index) => {
        const checkbox = document.createElement('div');
        checkbox.className = 'form-check mb-2';
        checkbox.innerHTML = `
            <input class="form-check-input release-checkbox" type="checkbox" value="${release.url}" 
                   id="release${index}" data-name="${release.name}" ${index === 0 ? 'checked' : ''}>
            <label class="form-check-label" for="release${index}">
                <strong>${release.name}</strong> <span class="text-muted">(${release.size})</span>
            </label>`;
        releaseList.appendChild(checkbox);
    });
    
    // Add select all button
    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'btn btn-sm btn-outline-primary mt-2';
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.onclick = () => {
        document.querySelectorAll('.release-checkbox').forEach(cb => cb.checked = true);
    };
    releaseList.appendChild(selectAllBtn);
    
    // Store data for installation
    window.pendingInstall = { repo, dirName, releases };
    
    const modal = new bootstrap.Modal(document.getElementById('releaseModal'));
    modal.show();
}

function installSelectedReleases() {
    const selectedUrls = Array.from(document.querySelectorAll('.release-checkbox:checked'))
        .map(cb => cb.value);
    
    if (selectedUrls.length === 0) {
        alert('Please select at least one release to install');
        return;
    }
    
    const { repo, dirName } = window.pendingInstall;
    
    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('releaseModal')).hide();
    
    // Start installation
    startInstallation(repo, dirName, selectedUrls);
}

function startInstallation(repo, dirName, releaseUrls) {
    vscode.postMessage({
        command: 'installTheme',
        repo: repo,
        dirName: dirName,
        releaseUrls: releaseUrls
    });
    
    // Show installation notification
    const installAlert = document.createElement('div');
    installAlert.className = 'alert alert-info alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    installAlert.style.zIndex = '9999';
    installAlert.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            <div>Installing <strong>${dirName}</strong>... Check the terminal for progress.</div>
        </div>
    `;
    document.body.appendChild(installAlert);
    
    setTimeout(() => {
        installAlert.remove();
    }, 10000);
}

function refreshInstalledThemes() {
    vscode.postMessage({ command: 'requestInstalledThemes' });
}

function openThemeFolder() {
    vscode.postMessage({ command: 'openThemeFolder' });
}

function openGlade() {
    vscode.postMessage({ command: 'openGlade' });
}

function openMsys2Terminal() {
    vscode.postMessage({ command: 'openMsys2Terminal' });
}

// --- Android Logic ---

function saveAndroidConfig() {
    const config = {
        pixiewoodPath: document.getElementById('pixiewoodPath').value,
        androidManifestPath: document.getElementById('androidManifestPath').value,
        pixiewoodInstallDir: document.getElementById('pixiewoodInstallDir').value,
        androidSdkPath: document.getElementById('androidSdkPath').value,
        androidNdkPath: document.getElementById('androidNdkPath').value,
        androidStudioPath: document.getElementById('androidStudioPath').value,
        mesonPath: document.getElementById('mesonPath').value,
        androidReleaseBuild: document.getElementById('androidReleaseBuild').checked,
        androidVerbose: document.getElementById('androidVerbose').checked
    };

    console.log('[GTK4 WebView] Sending saveAndroidConfig:', config);

    vscode.postMessage({
        command: 'saveAndroidConfig',
        data: config
    });

    // Visual Feedback
    const btn = document.querySelector('button[onclick="saveAndroidConfig()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check me-2"></i>Saved!';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
        
        // Re-check status after save
        checkPixiewoodStatus();
    }, 2000);
}

function checkPixiewoodStatus() {
    const installDir = document.getElementById('pixiewoodInstallDir').value;
    if (installDir) {
        vscode.postMessage({ 
            command: 'checkPixiewoodStatus',
            path: installDir
        });
    }
}

function pickAndroidSdkPath() {
    vscode.postMessage({ command: 'pickAndroidSdkPath' });
}

function pickAndroidNdkPath() {
    vscode.postMessage({ command: 'pickAndroidNdkPath' });
}

function pickAndroidStudioPath() {
    vscode.postMessage({ command: 'pickAndroidStudioPath' });
}

function pickMesonPath() {
    vscode.postMessage({ command: 'pickMesonPath' });
}

function pickPixiewoodInstallDir() {
    vscode.postMessage({ command: 'pickPixiewoodInstallDir' });
}

function runAndroidPrepare() {
    vscode.postMessage({ command: 'runAndroidPrepare' });
}

function runAndroidGenerate() {
    vscode.postMessage({ command: 'runAndroidGenerate' });
}

function runAndroidBuild() {
    vscode.postMessage({ command: 'runAndroidBuild' });
}

function pickPixiewoodPath() {
    vscode.postMessage({ command: 'pickPixiewoodPath' });
}

function pickAndroidManifest() {
    vscode.postMessage({ command: 'pickAndroidManifest' });
}

function installPixiewood() {
    const installDir = document.getElementById('pixiewoodInstallDir').value;
    if (!installDir) {
        // If no dir selected, maybe prompt or error? 
        // For now, let extension handle default or error
    }
    vscode.postMessage({ 
        command: 'installPixiewood',
        path: installDir
    });
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    renderThemes();
    refreshInstalledThemes();
    renderCommonPlugins();
    // Status check will happen after config load
});

// --- Plugins Manager Logic ---

const commonPlugins = [
    { name: 'LibAdwaita', package: 'mingw-w64-ucrt-x86_64-libadwaita', description: 'Building blocks for modern GNOME apps' },
    { name: 'GTK4', package: 'mingw-w64-ucrt-x86_64-gtk4', description: 'The GTK4 toolkit itself' },
    { name: 'Glade', package: 'mingw-w64-ucrt-x86_64-glade', description: 'User Interface Designer' },
    { name: 'SQLite3', package: 'mingw-w64-ucrt-x86_64-sqlite3', description: 'SQL database engine' },
    { name: 'JSON-Glib', package: 'mingw-w64-ucrt-x86_64-json-glib', description: 'JSON manipulation library' },
    { name: 'LibSoup 3', package: 'mingw-w64-ucrt-x86_64-libsoup3', description: 'HTTP client/server library' },
    { name: 'GLib Networking', package: 'mingw-w64-ucrt-x86_64-glib-networking', description: 'TLS/SSL support for HTTPS' }
];

function renderCommonPlugins() {
    const container = document.getElementById('commonPluginsList');
    if (!container) return;
    
    container.innerHTML = commonPlugins.map(plugin => `
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm">
                <div class="card-body">
                    <h6 class="card-title fw-bold">${plugin.name}</h6>
                    <p class="card-text small text-muted">${plugin.description}</p>
                    <code class="d-block mb-2 small text-truncate" title="${plugin.package}">${plugin.package}</code>
                    <button class="btn btn-sm btn-outline-primary w-100" onclick="installPackage('${plugin.package}')">
                        <i class="fas fa-download me-1"></i> Install
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function searchPackages() {
    const query = document.getElementById('packageSearchInput').value;
    if (!query) return;
    
    const resultsSection = document.getElementById('searchResultsSection');
    const resultsList = document.getElementById('searchResultsList');
    
    resultsSection.style.display = 'block';
    resultsList.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div><div class="mt-2">Searching MSYS2 database...</div></div>';
    
    vscode.postMessage({
        command: 'searchPackages',
        query: query
    });
}

function installPackage(packageName) {
    console.log('[GTK4 WebView] installPackage called with:', packageName);
    vscode.postMessage({
        command: 'installPackage',
        package: packageName
    });
    showToast(`Installing ${packageName}...`, 'info');
}

// Remove package function
function removePackage(packageName) {
    vscode.postMessage({
        command: 'removePackage',
        package: packageName
    });
    showToast(`Removing ${packageName}...`, 'info');
}

// Expose functions to global scope for onclick handlers in dynamically generated HTML
window.installPackage = installPackage;
window.removePackage = removePackage;

function installGStreamerSuite() {
    vscode.postMessage({
        command: 'installGStreamerSuite'
    });
}

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'searchResults':
            displaySearchResults(message.results);
            break;
        // ... existing cases ...
    }
});

function displaySearchResults(results) {
    const resultsList = document.getElementById('searchResultsList');
    if (!results || results.length === 0) {
        resultsList.innerHTML = '<div class="list-group-item text-center text-muted">No packages found.</div>';
        return;
    }
    
    // Results come as raw text lines from pacman -Ss
    // Format: "mingw64/package-name version [installed]\n    Description"
    
    // Simple parsing logic (can be improved)
    const items = [];
    let currentItem = null;
    
    results.forEach(line => {
        if (line.startsWith('mingw') || line.startsWith('ucrt')) {
            if (currentItem) items.push(currentItem);
            const parts = line.split(' ');
            const fullName = parts[0]; // e.g., ucrt64/mingw-w64-ucrt-x86_64-pkg
            // Extract just the package name without the repo prefix
            const packageName = fullName.includes('/') ? fullName.split('/')[1] : fullName;
            currentItem = {
                fullName: fullName,
                packageName: packageName,
                version: parts[1],
                installed: line.includes('[installed]'),
                desc: ''
            };
        } else if (currentItem && line.trim().length > 0) {
            currentItem.desc += line.trim() + ' ';
        }
    });
    if (currentItem) items.push(currentItem);
    
    resultsList.innerHTML = items.map((item, index) => {
        return `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <div class="fw-bold">${item.fullName} <span class="badge bg-secondary ms-2">${item.version}</span> ${item.installed ? '<span class="badge bg-success">Installed</span>' : ''}</div>
                <div class="small text-muted">${item.desc}</div>
            </div>
            <div class="btn-group">
                ${item.installed ? `
                    <button class="btn btn-sm btn-outline-danger remove-pkg-btn" data-package="${item.packageName}">
                        Remove
                    </button>
                ` : `
                    <button class="btn btn-sm btn-primary install-pkg-btn" data-package="${item.packageName}">
                        Install
                    </button>
                `}
            </div>
        </div>
    `;
    }).join('');
    
    // Attach event listeners after rendering
    resultsList.querySelectorAll('.install-pkg-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pkg = this.getAttribute('data-package');
            console.log('[GTK4 WebView] Install button clicked for:', pkg);
            installPackage(pkg);
        });
    });
    
    resultsList.querySelectorAll('.remove-pkg-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pkg = this.getAttribute('data-package');
            console.log('[GTK4 WebView] Remove button clicked for:', pkg);
            removePackage(pkg);
        });
    });
}

