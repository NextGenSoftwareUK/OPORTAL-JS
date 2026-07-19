(function () {
  'use strict';

  function getById(id) { return document.getElementById(id); }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function showStatus(type, msg) { var el = getById('files-status'); if (!el) return; el.className = 'files-status files-status--' + type; el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : ''); el.hidden = false; }
  function hideStatus() { var el = getById('files-status'); if (el) el.hidden = true; }
  function showStatusBrief(type, msg) { showStatus(type, msg); setTimeout(hideStatus, 3500); }
  function setText(id, v) { var el = getById(id); if (el) el.textContent = v; }
  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    return [];
  }
  function fmtSize(bytes) {
    if (!bytes) return '—';
    var b = Number(bytes);
    if (isNaN(b)) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  function buildFileRow(f) {
    var id   = f.id || f.Id || f.fileId || f.FileId || '';
    var name = f.name || f.Name || f.fileName || f.FileName || f.displayName || 'Unnamed file';
    var size = f.size || f.Size || f.fileSize || f.FileSize || 0;
    var type = f.mimeType || f.MimeType || f.contentType || f.ContentType || '';
    var date = f.createdDate || f.CreatedDate || f.uploadedDate || '';
    var dateStr = '';
    if (date) { try { dateStr = new Date(date).toLocaleDateString(); } catch(e){} }
    return '<div class="modal-item-row">' +
      '<div class="modal-item-icon">📄</div>' +
      '<div class="modal-item-body">' +
        '<div class="modal-item-title">' + escHtml(name) + '</div>' +
        '<div class="modal-item-meta">' + escHtml(type || 'file') + (dateStr ? ' · ' + dateStr : '') + ' · ' + fmtSize(size) + '</div>' +
      '</div>' +
      '<div class="modal-item-actions">' +
        (id ? '<button class="button button--ghost modal-btn-sm" data-file-download="' + escHtml(id) + '">⬇ Download</button>' : '') +
        (id ? '<button class="button button--ghost modal-btn-sm modal-btn-danger" data-file-delete="' + escHtml(id) + '">✕ Delete</button>' : '') +
      '</div>' +
    '</div>';
  }

  async function loadFiles() {
    var list = getById('files-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) { if (list) list.innerHTML = '<div class="map-empty"><p>SDK not ready.</p></div>'; return; }
    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.files.getAllFilesStoredForCurrentLoggedInAvatar();
      var files = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      setText('files-stat-count', files.length || '0');
      var totalBytes = files.reduce(function(s, f) { return s + (Number(f.size || f.Size || f.fileSize || 0)); }, 0);
      setText('files-stat-size', fmtSize(totalBytes));
      if (!list) return;
      if (!files.length) { list.innerHTML = '<div class="map-empty"><div class="map-empty-icon">📁</div><p>No files stored yet. Upload one!</p></div>'; return; }
      list.innerHTML = files.map(buildFileRow).join('');
      bindFileActions(list);
    } catch(e) {
      if (list) list.innerHTML = '<div class="map-empty"><p>Could not load files.</p></div>';
    }
  }

  function bindFileActions(container) {
    container.querySelectorAll('[data-file-download]').forEach(function(btn) {
      btn.addEventListener('click', function() { downloadFile(btn.dataset.fileDownload); });
    });
    container.querySelectorAll('[data-file-delete]').forEach(function(btn) {
      btn.addEventListener('click', function() { deleteFile(btn.dataset.fileDelete, btn); });
    });
  }

  async function downloadFile(fileId) {
    if (!window.oasisClient) return;
    showStatus('loading', 'Preparing download…');
    try {
      var sdkRes = await window.oasisClient.files.downloadFile({ fileId: fileId });
      if (sdkRes && !sdkRes.isError) {
        showStatusBrief('success', 'Download ready.');
      } else {
        showStatusBrief('error', (sdkRes && sdkRes.message) || 'Download failed.');
      }
    } catch(e) { showStatusBrief('error', 'Download error.'); }
  }

  async function deleteFile(fileId, btn) {
    if (!window.oasisClient) return;
    if (!confirm('Delete this file?')) return;
    if (btn) btn.disabled = true;
    try {
      var sdkRes = await window.oasisClient.files.deleteFile({ fileId: fileId });
      if (sdkRes && !sdkRes.isError) { showStatusBrief('success', 'File deleted.'); loadFiles(); }
      else { showStatusBrief('error', (sdkRes && sdkRes.message) || 'Delete failed.'); if (btn) btn.disabled = false; }
    } catch(e) { showStatusBrief('error', 'Delete error.'); if (btn) btn.disabled = false; }
  }

  async function uploadFile() {
    var fileInput = getById('files-upload-input');
    var nameInput = getById('files-upload-name');
    var descInput = getById('files-upload-desc');
    var btn       = getById('files-upload-btn');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) { showStatusBrief('warn', 'Please select a file.'); return; }
    if (!window.oasisClient) { showStatusBrief('error', 'SDK not ready.'); return; }
    var file = fileInput.files[0];
    var reader = new FileReader();
    reader.onload = async function(e) {
      var b64 = e.target.result.split(',')[1];
      if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
      showStatus('loading', 'Uploading…');
      try {
        var payload = {
          fileName: nameInput && nameInput.value.trim() ? nameInput.value.trim() : file.name,
          description: descInput ? descInput.value.trim() : '',
          mimeType: file.type || 'application/octet-stream',
          fileBase64: b64,
        };
        var sdkRes = await window.oasisClient.files.uploadFile(payload);
        if (sdkRes && !sdkRes.isError) {
          showStatusBrief('success', 'File uploaded successfully!');
          fileInput.value = ''; if (nameInput) nameInput.value = ''; if (descInput) descInput.value = '';
          switchTab('list'); loadFiles();
        } else { showStatusBrief('error', (sdkRes && sdkRes.message) || 'Upload failed.'); }
      } catch(err) { showStatusBrief('error', 'Upload error.'); }
      if (btn) { btn.disabled = false; btn.textContent = 'Upload File'; }
    };
    reader.readAsDataURL(file);
  }

  function switchTab(tab) {
    var block = getById('files-modal-block');
    if (!block) return;
    block.querySelectorAll('.map-tab').forEach(function(t) { t.classList.toggle('is-active', t.dataset.tab === tab); });
    block.querySelectorAll('.map-tab-panel').forEach(function(p) { p.hidden = p.id !== 'files-tab-' + tab; });
  }

  function openFilesModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('files-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('list'); loadFiles();
    return false;
  }

  function closeFilesModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('files-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = getById('files-modal-block');
    if (!block || block.dataset.filesBound === 'true') { window.openFilesModal = openFilesModal; window.closeFilesModal = closeFilesModal; return; }
    var closeBtn = getById('files-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e) { e.preventDefault(); closeFilesModal(); });
    var tabBar = block.querySelector('.map-tabs');
    if (tabBar) tabBar.addEventListener('click', function(e) { var t = e.target.closest('.map-tab'); if (t) switchTab(t.dataset.tab); });
    var refreshBtn = getById('files-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadFiles);
    var uploadBtn = getById('files-upload-btn');
    if (uploadBtn) uploadBtn.addEventListener('click', uploadFile);
    block.dataset.filesBound = 'true';
    window.openFilesModal = openFilesModal; window.closeFilesModal = closeFilesModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); } else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
