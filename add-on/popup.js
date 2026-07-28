/**
Popup script for Simple User Script Manager
Renders script list and handles user interactions
*/

// ============================================
// SVG ICONS (Modern & Clean)
// ============================================
const ICONS = {
    upload: `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
    loading: `<svg class="icon-svg spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`,
    on: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    off: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    trash: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    warning: `<svg class="icon-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f85149" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
};

let isUploading = false;
let uploadTabId = null;
let pendingDeleteId = null;

/**
Show toast notification
*/
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

/**
Show delete confirmation modal
*/
function showDeleteModal(scriptId, scriptName) {
    const modal = document.getElementById('deleteModal');
    const message = document.getElementById('deleteMessage');
    const icon = document.getElementById('modalIcon');
    
    if (!modal || !message || !icon) return;
    
    pendingDeleteId = scriptId;
    message.textContent = `Are you sure you want to delete "${scriptName || 'this script'}"?`;
    icon.innerHTML = ICONS.warning;
    modal.style.display = 'flex';
}

/**
Hide delete confirmation modal
*/
function hideDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
    pendingDeleteId = null;
}

/**
Create script item element using DOM methods
*/
function createScriptItem(script) {
    const enabled = script.enabled !== false;
    const name = script.metadata?.name || 'Unnamed Script';
    const version = script.metadata?.version || 'Unknown';
    const author = script.metadata?.author || 'Unknown';
    const description = script.metadata?.description || '';
    const filename = script.filename || 'unknown.user.js';

    const item = document.createElement('div');
    item.className = 'script-item';
    item.dataset.id = script.id;

    // Script info section
    const info = document.createElement('div');
    info.className = 'script-info';

    // Script name section
    const nameDiv = document.createElement('div');
    nameDiv.className = 'script-name';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = name;
    nameDiv.appendChild(nameSpan);

    if (version && version !== 'Unknown') {
        const versionSpan = document.createElement('span');
        versionSpan.className = 'version';
        versionSpan.textContent = `v${version}`;
        nameDiv.appendChild(versionSpan);
    }

    if (author && author !== 'Unknown') {
        const authorSpan = document.createElement('span');
        authorSpan.className = 'author';
        authorSpan.textContent = `by ${author}`;
        nameDiv.appendChild(authorSpan);
    }

    if (description) {
        const descSpan = document.createElement('span');
        descSpan.className = 'description';
        descSpan.textContent = description;
        nameDiv.appendChild(descSpan);
    }
    info.appendChild(nameDiv);

    // Actions section
    const actions = document.createElement('div');
    actions.className = 'script-actions';

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = `btn btn-toggle ${enabled ? 'enabled' : 'disabled'}`;
    toggleBtn.dataset.action = 'toggle';
    toggleBtn.dataset.id = script.id;
    toggleBtn.title = enabled ? 'Disable script' : 'Enable script';
    toggleBtn.innerHTML = enabled ? `${ICONS.on} ON` : `${ICONS.off} OFF`;
    toggleBtn.addEventListener('click', handleToggle);
    actions.appendChild(toggleBtn);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.dataset.id = script.id;
    deleteBtn.title = 'Delete script';
    deleteBtn.innerHTML = ICONS.trash;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const scriptName = script.metadata?.name || 'Unnamed Script';
        showDeleteModal(script.id, scriptName);
    });
    actions.appendChild(deleteBtn);

    info.appendChild(actions);
    item.appendChild(info);

    // Status section
    const status = document.createElement('div');
    status.className = 'script-status';
    
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'status-indicator';
    const dot = document.createElement('span');
    dot.className = `dot ${enabled ? 'enabled' : 'disabled'}`;
    statusIndicator.appendChild(dot);
    statusIndicator.appendChild(document.createTextNode(enabled ? 'Active' : 'Disabled'));
    status.appendChild(statusIndicator);

    const filenameSpan = document.createElement('span');
    filenameSpan.className = 'filename';
    filenameSpan.textContent = filename;
    status.appendChild(filenameSpan);

    item.appendChild(status);
    return item;
}

/**
Render script list in popup
*/
function renderScripts(scripts) {
    const scriptList = document.getElementById('scriptList');
    const scriptCount = document.getElementById('scriptCount');

    scriptCount.textContent = scripts.length;
    scriptList.innerHTML = '';

    if (!scripts || scripts.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        const p1 = document.createElement('p');
        p1.textContent = 'No scripts installed';
        emptyState.appendChild(p1);
        const p2 = document.createElement('p');
        p2.className = 'sub-text';
        p2.textContent = 'Upload a .user.js file to get started';
        emptyState.appendChild(p2);
        scriptList.appendChild(emptyState);
        return;
    }

    for (const script of scripts) {
        const item = createScriptItem(script);
        scriptList.appendChild(item);
    }
}

/**
Handle toggle button click
*/
async function handleToggle(event) {
    const button = event.currentTarget;
    const id = button.dataset.id;
    if (!id) return;

    try {
        button.disabled = true;
        button.innerHTML = ICONS.loading;
        
        const response = await browser.runtime.sendMessage({
            action: 'toggle',
            data: { id }
        });

        if (response && response.success) {
            showToast(response.message, 'success');
            await loadScripts();
        } else {
            showToast(response?.error || 'Failed to toggle script', 'error');
            button.disabled = false;
            const enabled = button.classList.contains('enabled');
            button.innerHTML = enabled ? `${ICONS.on} ON` : `${ICONS.off} OFF`;
        }
    } catch (e) {
        console.error('Toggle error:', e);
        showToast('Failed to toggle script: ' + e.message, 'error');
        button.disabled = false;
        const enabled = button.classList.contains('enabled');
        button.innerHTML = enabled ? `${ICONS.on} ON` : `${ICONS.off} OFF`;
    }
}

/**
Handle delete confirmation from modal
*/
async function handleDeleteConfirmed() {
    if (!pendingDeleteId) return;
    try {
        const id = pendingDeleteId;
        hideDeleteModal();
        
        const response = await browser.runtime.sendMessage({
            action: 'delete',
            data: { id }
        });

        if (response && response.success) {
            showToast(response.message, 'success');
            await loadScripts();
        } else {
            showToast(response?.error || 'Failed to delete script', 'error');
        }
    } catch (e) {
        console.error('Delete error:', e);
        showToast('Failed to delete script: ' + e.message, 'error');
    }
}

/**
Load scripts from background
*/
async function loadScripts() {
    const scriptList = document.getElementById('scriptList');
    try {
        scriptList.innerHTML = '';
        const loading = document.createElement('div');
        loading.className = 'loading';
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        loading.appendChild(spinner);
        const p = document.createElement('p');
        p.textContent = 'Loading scripts...';
        loading.appendChild(p);
        scriptList.appendChild(loading);

        const response = await browser.runtime.sendMessage({ action: 'list' });

        if (response && response.success) {
            renderScripts(response.scripts);
        } else {
            throw new Error(response?.error || 'Failed to load scripts');
        }
    } catch (e) {
        console.error('Load scripts error:', e);
        showToast('Failed to load scripts: ' + e.message, 'error');
        scriptList.innerHTML = '';
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        const p1 = document.createElement('p');
        p1.textContent = 'Failed to load scripts';
        emptyState.appendChild(p1);
        const p2 = document.createElement('p');
        p2.className = 'sub-text';
        p2.textContent = 'Please try again';
        emptyState.appendChild(p2);
        scriptList.appendChild(emptyState);
    }
}

/**
Handle upload button click
*/
async function handleUpload() {
    if (isUploading) {
        showToast('Upload already in progress', 'error');
        return;
    }

    if (uploadTabId) {
        try {
            await browser.tabs.get(uploadTabId);
            await browser.tabs.update(uploadTabId, { active: true });
            showToast('Upload page already open', 'success');
            window.close();
            return;
        } catch (e) {
            uploadTabId = null;
            isUploading = false;
        }
    }

    const uploadButton = document.getElementById('uploadButton');
    try {
        isUploading = true;
        uploadButton.disabled = true;
        uploadButton.innerHTML = `${ICONS.loading} Opening...`;

        const tab = await browser.tabs.create({
            url: browser.runtime.getURL('upload.html'),
            active: true 
        });
        uploadTabId = tab.id;

        setTimeout(() => {
            isUploading = false;
            uploadButton.disabled = false;
            uploadButton.innerHTML = `${ICONS.upload} Upload Script`;
        }, 2000);

        const tabListener = (tabId, removeInfo) => {
            if (tabId === uploadTabId) {
                uploadTabId = null;
                isUploading = false;
                const btn = document.getElementById('uploadButton');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `${ICONS.upload} Upload Script`;
                }
                browser.tabs.onRemoved.removeListener(tabListener);
            }
        };
        browser.tabs.onRemoved.addListener(tabListener);

        setTimeout(() => window.close(), 300);
    } catch (error) {
        console.error('Error opening upload tab:', error);
        isUploading = false;
        uploadTabId = null;
        uploadButton.disabled = false;
        uploadButton.innerHTML = `${ICONS.upload} Upload Script`;
        showToast('Failed to open upload page', 'error');
    }
}

/**
Initialize popup
*/
document.addEventListener('DOMContentLoaded', () => {
    // Setup upload button
    const uploadButton = document.getElementById('uploadButton');
    if (uploadButton) {
        uploadButton.innerHTML = `${ICONS.upload} Upload Script`;
        uploadButton.addEventListener('click', handleUpload);
        uploadButton.addEventListener('dblclick', (e) => e.preventDefault());
    }

    // Setup Modal
    const modal = document.getElementById('deleteModal');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    if (cancelBtn) cancelBtn.addEventListener('click', hideDeleteModal);
    if (confirmBtn) confirmBtn.addEventListener('click', handleDeleteConfirmed);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) hideDeleteModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') hideDeleteModal();
        });
    }

    // Load scripts
    loadScripts();

    // Listen for messages from upload page
    browser.runtime.onMessage.addListener(async (message) => {
        if (message.type === 'UPLOAD_COMPLETE') {
            await loadScripts();
            showToast(`✅ "${message.scriptName || 'Script'}" installed successfully!`, 'success');
            isUploading = false;
            uploadTabId = null;
            const btn = document.getElementById('uploadButton');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${ICONS.upload} Upload Script`;
            }
        } else if (message.type === 'UPLOAD_CANCELLED') {
            isUploading = false;
            uploadTabId = null;
            const btn = document.getElementById('uploadButton');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${ICONS.upload} Upload Script`;
            }
        }
    });

    // Check if upload tab already exists
    browser.storage.local.get(['uploadTabId']).then((result) => {
        if (result.uploadTabId) {
            uploadTabId = result.uploadTabId;
            browser.tabs.get(uploadTabId).catch(() => {
                uploadTabId = null;
                isUploading = false;
                browser.storage.local.remove(['uploadTabId']);
            });
        }
    });
});

console.log('Simple User Script Manager popup loaded');