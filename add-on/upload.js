/**
 * Upload page script for Simple User Script Manager
 * Handles file selection and sends to background for installation
 */

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const uploadButton = document.getElementById('uploadButton');
const clearButton = document.getElementById('clearButton');
const statusMessage = document.getElementById('statusMessage');
const statusTitle = document.getElementById('statusTitle');
const statusDetail = document.getElementById('statusDetail');
const backLink = document.getElementById('backLink');

let selectedFile = null;

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate file
 * @param {File} file - File to validate
 * @returns {Object} Validation result
 */
function validateFile(file) {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }
  
  // Check file extension
  const fileNameLower = file.name.toLowerCase();
  if (!fileNameLower.endsWith('.user.js') && !fileNameLower.endsWith('.js')) {
    return { valid: false, error: 'File must have .user.js or .js extension' };
  }
  
  // Check file size (max 1MB)
  const maxSize = 1 * 1024 * 1024; // 1MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 1MB limit' };
  }
  
  // Check if file is empty
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }
  
  return { valid: true, error: null };
}

/**
 * Read file content
 * @param {File} file - File to read
 * @returns {Promise<string>} File content
 */
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    reader.onerror = (e) => {
      reject(new Error('Failed to read file: ' + e.target.error));
    };
    reader.readAsText(file);
  });
}

/**
 * Update file info display
 * @param {File} file - Selected file
 */
function updateFileInfo(file) {
  if (file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.add('show');
    uploadButton.disabled = false;
  } else {
    fileInfo.classList.remove('show');
    uploadButton.disabled = true;
  }
}

/**
 * Show status message
 * @param {string} title - Status title
 * @param {string} detail - Status detail
 * @param {string} type - 'success' or 'error'
 */
function showStatus(title, detail, type = 'success') {
  statusMessage.className = 'status-message show ' + type;
  statusTitle.textContent = title;
  statusDetail.textContent = detail;
}

/**
 * Clear status message
 */
function clearStatus() {
  statusMessage.className = 'status-message';
  statusMessage.classList.remove('show', 'success', 'error');
}

/**
 * Handle file selection
 * @param {File} file - Selected file
 */
async function handleFileSelect(file) {
  try {
    clearStatus();
    selectedFile = file;
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      showStatus('Invalid File', validation.error, 'error');
      updateFileInfo(null);
      selectedFile = null;
      return;
    }
    
    // Update UI
    updateFileInfo(file);
    
    // Check if file has UserScript metadata
    const content = await readFileContent(file);
    if (!content.includes('==UserScript==') || !content.includes('==/UserScript==')) {
      showStatus('Invalid Script', 'File does not contain UserScript metadata block', 'error');
      updateFileInfo(null);
      selectedFile = null;
      return;
    }
    
    // Show success message
    showStatus('File Ready', 'File validated successfully', 'success');
    
  } catch (e) {
    console.error('File selection error:', e);
    showStatus('Error', e.message, 'error');
    updateFileInfo(null);
    selectedFile = null;
  }
}

/**
 * Handle upload/install
 */
async function handleUpload() {
  if (!selectedFile) {
    showStatus('Error', 'No file selected', 'error');
    return;
  }
  
  try {
    // Disable upload button
    uploadButton.disabled = true;
    uploadButton.textContent = 'Installing...';
    clearStatus();
    
    // Read file content
    const source = await readFileContent(selectedFile);
    
    // Send to background for installation
    const response = await browser.runtime.sendMessage({
      action: 'install',
      data: {
        source: source,
        filename: selectedFile.name
      }
    });
    
    if (response && response.success) {
      showStatus(
        'Installation Successful',
        response.isUpdate ? 'Script updated successfully' : 'Script installed successfully',
        'success'
      );
      
      // Reset file selection after successful install
      selectedFile = null;
      fileInput.value = '';
      updateFileInfo(null);
      
      // Add option to close page
      setTimeout(() => {
        if (confirm('Script installed successfully! Close this page?')) {
          window.close();
        }
      }, 1000);
      
    } else {
      showStatus(
        'Installation Failed',
        response?.error || 'Unknown error occurred',
        'error'
      );
    }
    
  } catch (e) {
    console.error('Upload error:', e);
    showStatus('Error', e.message, 'error');
  } finally {
    // Re-enable upload button
    uploadButton.disabled = false;
    uploadButton.textContent = 'Install Script';
  }
}

/**
 * Handle clear button
 */
function handleClear() {
  selectedFile = null;
  fileInput.value = '';
  updateFileInfo(null);
  clearStatus();
}

/**
 * Handle back link
 */
function handleBack(e) {
  e.preventDefault();
  window.close();
}

/**
 * Setup drag and drop events
 */
function setupDragAndDrop() {
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
  
  // Highlight drop zone when dragging over
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('dragover');
    });
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('dragover');
    });
  });
  
  // Handle drop
  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });
  
  // Click to open file dialog
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
}

/**
 * Initialize upload page
 */
document.addEventListener('DOMContentLoaded', () => {
  // Setup file input
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });
  
  // Setup upload button
  uploadButton.addEventListener('click', handleUpload);
  
  // Setup clear button
  clearButton.addEventListener('click', handleClear);
  
  // Setup back link
  backLink.addEventListener('click', handleBack);
  
  // Setup drag and drop
  setupDragAndDrop();
  
  console.log('Simple User Script Manager upload page loaded');
});