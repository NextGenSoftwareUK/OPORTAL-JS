(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var logsInterval = null;
  var logsTabActive = false;

  function getById(id) { return document.getElementById(id); }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setText(id, val) {
    var el = getById(id); if (el) el.textContent = val;
  }

  function showStatus(type, msg) {
    var el = getById('onode-modal-status');
    if (!el) return;
    el.className = 'onode-status onode-status--' + type;
    el.textContent = msg;
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('onode-modal-status');
    if (el) el.hidden = true;
  }

  function setBtn(id, text, disabled) {
    var b = getById(id);
    if (!b) return;
    b.textContent = text;
    b.disabled = !!disabled;
  }

  // ── API helpers ───────────────────────────────────────────────────────────────

  async function apiFetch(path) {
    try {
      var res = await fetch(API_BASE + path);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function apiPost(path) {
    try {
      var res = await fetch(API_BASE + path, { method: 'POST' });
      if (!res.ok) return { ok: false, status: res.status };
      var data = await res.json().catch(function () { return {}; });
      return { ok: true, data: data };
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  function extractResult(data) {
    if (!data) return data;
    if (data.result != null) return data.result;
    return data;
  }

  // ── Status banner ─────────────────────────────────────────────────────────────

  function updateBanner(status, unreachable) {
    var s = extractResult(status);
    var running = s && (s.isRunning || String(s.status || s.Status || '').toLowerCase() === 'running');
    var banner = getById('onode-status-banner');
    var dot = getById('onode-status-dot');
    var label = getById('onode-status-label');
    var desc = getById('onode-status-desc');
    if (!banner) return;

    if (unreachable) {
      banner.className = 'hd-mode-banner hd-mode-banner--offline';
      if (dot) dot.className = 'hd-mode-dot hd-mode-dot--offline';
      if (label) label.textContent = 'UNAVAILABLE';
      if (desc) desc.textContent = 'ONODE could not be reached. Make sure your local ONODE is running.';
      return;
    }

    var cls = running ? 'online' : 'offline';
    banner.className = 'hd-mode-banner hd-mode-banner--' + cls;
    if (dot) dot.className = 'hd-mode-dot hd-mode-dot--' + cls;
    if (label) label.textContent = running ? 'RUNNING' : 'STOPPED';
    if (desc) {
      desc.textContent = running
        ? 'Your ONODE is active and connected to the ONET.'
        : (s && s.statusMessage) ? s.statusMessage : 'Your ONODE is not running.';
    }
  }

  // ── Stat bar ──────────────────────────────────────────────────────────────────

  function updateStatBar(status, info) {
    var s = extractResult(status);
    var inf = extractResult(info);
    var running = s && (s.isRunning || String(s.status || '').toLowerCase() === 'running');
    setText('onode-stat-status', running ? 'Running' : 'Stopped');
    setText('onode-stat-uptime', inf ? (inf.uptime || inf.Uptime || '—') : '—');
    setText('onode-stat-peers', inf ? (inf.peers || inf.Peers || inf.peerCount || inf.PeerCount || '—') : '—');
    setText('onode-stat-version', inf ? (inf.version || inf.Version || '—') : '—');
  }

  // ── Info grid ─────────────────────────────────────────────────────────────────

  function buildInfoGrid(info) {
    var grid = getById('onode-info-grid');
    if (!grid) return;
    var inf = extractResult(info);
    if (!inf || typeof inf !== 'object') {
      grid.innerHTML = '<div class="onode-empty"><div class="onode-empty-icon">🖥️</div><p>No node information available.</p></div>';
      return;
    }

    var FIELDS = [
      ['name', 'Name'], ['Name', 'Name'],
      ['nodeId', 'Node ID'], ['NodeId', 'Node ID'],
      ['version', 'Version'], ['Version', 'Version'],
      ['address', 'Address'], ['Address', 'Address'],
      ['publicKey', 'Public Key'], ['PublicKey', 'Public Key'],
      ['startTime', 'Start Time'], ['StartTime', 'Start Time'],
      ['uptime', 'Uptime'], ['Uptime', 'Uptime'],
      ['peers', 'Peers'], ['Peers', 'Peers'],
      ['peerCount', 'Peer Count'], ['PeerCount', 'Peer Count'],
    ];

    var seen = new Set();
    var rows = '';
    FIELDS.forEach(function (f) {
      if (seen.has(f[1])) return;
      var v = inf[f[0]];
      if (v == null || v === '') return;
      seen.add(f[1]);
      rows += '<div class="onode-info-row">' +
        '<span class="onode-info-label">' + escapeHtml(f[1]) + '</span>' +
        '<span class="onode-info-value">' + escapeHtml(String(v)) + '</span>' +
        '</div>';
    });

    // Fallback: show all scalar fields
    if (!rows) {
      Object.entries(inf).forEach(function (kv) {
        if (typeof kv[1] === 'object' && kv[1] !== null) return;
        rows += '<div class="onode-info-row">' +
          '<span class="onode-info-label">' + escapeHtml(kv[0]) + '</span>' +
          '<span class="onode-info-value">' + escapeHtml(String(kv[1])) + '</span>' +
          '</div>';
      });
    }

    grid.innerHTML = rows || '<div class="onode-empty"><p>No node info fields available.</p></div>';
  }

  // ── Metrics grid ──────────────────────────────────────────────────────────────

  function buildMetricsGrid(metrics) {
    var grid = getById('onode-metrics-grid');
    if (!grid) return;
    var m = extractResult(metrics);
    if (!m) { grid.innerHTML = '<div class="onode-empty"><p>No metrics available.</p></div>'; return; }

    var bars = [];
    if (m.cpu != null) bars.push({ label: 'CPU Usage', value: m.cpu, unit: '%' });
    if (m.cpuUsage != null) bars.push({ label: 'CPU Usage', value: m.cpuUsage, unit: '%' });
    if (m.memory != null) bars.push({ label: 'Memory Usage', value: m.memory, unit: '%' });
    if (m.memoryUsage != null) bars.push({ label: 'Memory Usage', value: m.memoryUsage, unit: '%' });
    if (m.bandwidth != null) bars.push({ label: 'Bandwidth', value: m.bandwidth, unit: '%' });
    if (m.requestCount != null) bars.push({ label: 'Requests', value: Math.min(100, m.requestCount / 10), unit: '' });
    if (m.RequestCount != null) bars.push({ label: 'Requests', value: Math.min(100, m.RequestCount / 10), unit: '' });

    if (!bars.length) {
      // Show as key/value
      grid.innerHTML = Object.entries(m).filter(function (kv) {
        return typeof kv[1] !== 'object' || kv[1] == null;
      }).map(function (kv) {
        return '<div class="onode-info-row"><span class="onode-info-label">' + escapeHtml(kv[0]) + '</span>' +
          '<span class="onode-info-value">' + escapeHtml(String(kv[1])) + '</span></div>';
      }).join('') || '<div class="onode-empty"><p>No metrics available.</p></div>';
      return;
    }

    grid.innerHTML = bars.map(function (b) {
      var pct = Math.min(100, Math.max(0, parseFloat(b.value) || 0));
      var cls = pct < 50 ? 'good' : pct < 80 ? 'warn' : 'crit';
      return '<div class="onode-metric-row">' +
        '<div class="onode-metric-label">' + escapeHtml(b.label) + '</div>' +
        '<div class="onode-metric-bar-wrap">' +
          '<div class="onode-metric-bar onode-metric-bar--' + cls + '" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="onode-metric-val">' + pct.toFixed(1) + (b.unit || '') + '</div>' +
        '</div>';
    }).join('');
  }

  // ── Logs ──────────────────────────────────────────────────────────────────────

  async function renderLogs() {
    if (!logsTabActive) return;
    var client = window.oasisClient && window.oasisClient.oNODE;
    var sdkRes = client ? await client.getNodeLogs().catch(function () { return { isError: true }; }) : { isError: true };
    var data = sdkRes.isError ? null : sdkRes.result;
    var el = getById('onode-logs');
    if (!el) return;
    var d = extractResult(data);
    if (!d) { el.textContent = 'No logs available.'; return; }
    if (Array.isArray(d)) {
      el.textContent = d.join('\n');
    } else if (typeof d === 'string') {
      el.textContent = d;
    } else {
      el.textContent = JSON.stringify(d, null, 2);
    }
    el.scrollTop = el.scrollHeight;
  }

  function startLogsAutoRefresh() {
    logsTabActive = true;
    renderLogs();
    if (!logsInterval) {
      logsInterval = setInterval(renderLogs, 5000);
    }
  }

  function stopLogsAutoRefresh() {
    logsTabActive = false;
    if (logsInterval) { clearInterval(logsInterval); logsInterval = null; }
  }

  // ── Peers ─────────────────────────────────────────────────────────────────────

  function buildPeerRow(peer) {
    var id = peer.peerId || peer.PeerId || peer.id || peer.Id || '—';
    var shortId = id.length > 16 ? id.slice(0, 8) + '…' + id.slice(-4) : id;
    var addr = peer.address || peer.Address || '—';
    var latency = peer.latency || peer.Latency || peer.ping || '—';
    var status = peer.status || peer.Status || 'Connected';
    return '<div class="onode-peer-row">' +
      '<div class="onode-peer-id" title="' + escapeHtml(id) + '">' + escapeHtml(shortId) + '</div>' +
      '<div class="onode-peer-addr">' + escapeHtml(String(addr)) + '</div>' +
      '<div class="onode-peer-latency">' + escapeHtml(String(latency)) + (typeof latency === 'number' ? 'ms' : '') + '</div>' +
      '<div class="onode-peer-status">' + escapeHtml(String(status)) + '</div>' +
      '</div>';
  }

  function renderPeers(peers) {
    var list = getById('onode-peers-list');
    if (!list) return;
    var arr = Array.isArray(peers) ? peers : (peers && (peers.result || peers.data));
    if (!arr || !arr.length) {
      list.innerHTML = '<div class="onode-empty"><div class="onode-empty-icon">🔗</div><p>No peers connected.</p></div>';
      return;
    }
    list.innerHTML = arr.map(buildPeerRow).join('');
  }

  // ── Config / OASISDNA ─────────────────────────────────────────────────────────

  function renderPreformatted(id, data) {
    var el = getById(id);
    if (!el) return;
    var d = extractResult(data);
    el.textContent = d ? JSON.stringify(d, null, 2) : 'No data available.';
  }

  // ── Load all ──────────────────────────────────────────────────────────────────

  async function loadAll() {
    showStatus('loading', 'Loading node data…');
    var client = window.oasisClient && window.oasisClient.oNODE;
    if (!client) { showStatus('warn', 'ONODE SDK not available.'); return; }

    var [statusRes, infoRes, metricsRes] = await Promise.all([
      client.getNodeStatus().catch(function () { return { isError: true }; }),
      client.getNodeInfo().catch(function () { return { isError: true }; }),
      client.getNodeMetrics().catch(function () { return { isError: true }; }),
    ]);

    var status  = statusRes.isError  ? null : (statusRes.result  || statusRes);
    var info    = infoRes.isError    ? null : (infoRes.result    || infoRes);
    var metrics = metricsRes.isError ? null : (metricsRes.result || metricsRes);

    var allFailed = statusRes.isError && infoRes.isError && metricsRes.isError;
    hideStatus();
    updateBanner(status || {}, allFailed);
    updateStatBar(status, info);
    buildInfoGrid(info);
    buildMetricsGrid(metrics);
  }

  // ── Controls ──────────────────────────────────────────────────────────────────

  async function doControl(btnId, method, label, confirmMsg) {
    var client = window.oasisClient && window.oasisClient.oNODE;
    if (!client) { showStatus('error', 'ONODE SDK not initialised — please refresh the page.'); return; }
    if (!client[method]) { showStatus('error', 'Action not available in this SDK version.'); return; }
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBtn(btnId, label + '…', true);
    var sdkRes = await client[method]().catch(function () { return { isError: true }; });
    if (!sdkRes.isError) {
      showStatus('success', label + ' command sent successfully.');
      setTimeout(function () { hideStatus(); loadAll(); }, 2500);
    } else {
      showStatus('error', label + ' failed. Please try again.');
    }
    setBtn(btnId, label, false);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  function switchTab(tab) {
    var block = getById('onode-modal-block');
    if (!block) return;

    if (tab !== 'logs') stopLogsAutoRefresh();

    block.querySelectorAll('.onode-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    block.querySelectorAll('.onode-tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'onode-tab-' + tab;
    });

    if (tab === 'logs') startLogsAutoRefresh();
    if (tab === 'peers') {
      var pc = window.oasisClient && window.oasisClient.oNODE;
      if (pc) pc.getConnectedPeers().then(function (r) { renderPeers(r.isError ? null : r.result); }).catch(function () { renderPeers(null); });
    }
    if (tab === 'config') {
      var cc = window.oasisClient && window.oasisClient.oNODE;
      if (cc) cc.getNodeConfig().then(function (r) { renderPreformatted('onode-config', r.isError ? null : r.result); }).catch(function () { renderPreformatted('onode-config', null); });
    }
    if (tab === 'oasisdna') initDNATab();
  }

  // ── OASIS DNA — password gate ─────────────────────────────────────────────────

  function isONODELinked() {
    // Check if this ONODE is linked to the logged-in avatar
    try {
      var avatar = JSON.parse(localStorage.getItem('avatar') || 'null');
      var nodeId = avatar && (avatar.nodeId || avatar.NodeId || avatar.onodeId || avatar.ONODEId);
      return !!nodeId;
    } catch (e) { return false; }
  }

  function initDNATab() {
    var notLinked = getById('onode-dna-not-linked');
    var gate      = getById('onode-dna-gate');
    var content   = getById('onode-dna-content');
    if (!gate) return;

    if (!isONODELinked()) {
      if (notLinked) notLinked.hidden = false;
      gate.hidden    = true;
      if (content) content.hidden = true;
      return;
    }
    // Reset to gate state each time the tab is opened
    if (notLinked) notLinked.hidden = true;
    gate.hidden = false;
    if (content) content.hidden = true;
    var pwInput = getById('onode-dna-password');
    var errEl   = getById('onode-dna-gate-error');
    if (pwInput) pwInput.value = '';
    if (errEl)   errEl.hidden  = true;
  }

  function bindDNAGate(block) {
    var unlockBtn = getById('onode-dna-unlock-btn');
    var lockBtn   = getById('onode-dna-lock-btn');

    if (unlockBtn) unlockBtn.addEventListener('click', async function () {
      var pwInput = getById('onode-dna-password');
      var errEl   = getById('onode-dna-gate-error');
      var pw = pwInput ? pwInput.value.trim() : '';
      if (!pw) { if (errEl) { errEl.textContent = 'Please enter your password.'; errEl.hidden = false; } return; }

      // Verify password via SDK
      var ok = false;
      try {
        var avatar = JSON.parse(localStorage.getItem('avatar') || 'null');
        var username = avatar && (avatar.username || avatar.userName || avatar.UserName || avatar.email || avatar.Email);
        var authRes = await window.oasisClient.avatar.authenticate({ username: username, password: pw });
        ok = authRes && !authRes.isError;
      } catch (e) { ok = false; }

      if (!ok) {
        if (errEl) { errEl.textContent = 'Incorrect password. Please try again.'; errEl.hidden = false; }
        return;
      }

      // Unlock — fetch DNA and show
      var gate    = getById('onode-dna-gate');
      var content = getById('onode-dna-content');
      if (gate)    gate.hidden    = true;
      if (content) content.hidden = false;
      if (errEl)   errEl.hidden   = true;
      var dc = window.oasisClient && window.oasisClient.oNODE;
      if (dc) dc.getOASISDNA().then(function (r) { renderPreformatted('onode-oasisdna', r.isError ? null : r.result); }).catch(function () {});
    });

    if (lockBtn) lockBtn.addEventListener('click', function () {
      var gate    = getById('onode-dna-gate');
      var content = getById('onode-dna-content');
      var pwInput = getById('onode-dna-password');
      var pre     = getById('onode-oasisdna');
      if (gate)    gate.hidden    = false;
      if (content) content.hidden = true;
      if (pwInput) pwInput.value  = '';
      if (pre)     pre.textContent = '';
    });
  }

  // ── Open / close ──────────────────────────────────────────────────────────────

  function openONODEModal() {
    var loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
      if (typeof window.addAuthPopup === 'function') window.addAuthPopup(true, 'Please beam in to manage your ONODE.', null);
      return false;
    }
    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('onode-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    switchTab('overview');
    loadAll();
    return false;
  }

  function closeONODEModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('onode-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
    stopLogsAutoRefresh();
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('onode-modal-block');
    if (!block || block.dataset.onodeBound === 'true') {
      window.openONODEModal = openONODEModal;
      window.closeONODEModal = closeONODEModal;
      return;
    }

    var closeBtn = getById('onode-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeONODEModal(); });

    var refreshBtn = getById('onode-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAll);

    var tabBar = block.querySelector('.onode-tabs');
    if (tabBar) {
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.onode-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    var clearLogsBtn = getById('onode-clear-logs-btn');
    if (clearLogsBtn) clearLogsBtn.addEventListener('click', function () {
      var el = getById('onode-logs'); if (el) el.textContent = '';
    });

    var startBtn = getById('onode-start-btn');
    if (startBtn) startBtn.addEventListener('click', function () { doControl('onode-start-btn', 'startNode', 'Start', null); });

    var stopBtn = getById('onode-stop-btn');
    if (stopBtn) stopBtn.addEventListener('click', function () { doControl('onode-stop-btn', 'stopNode', 'Stop', 'Stop your ONODE? It will disconnect from the ONET.'); });

    var restartBtn = getById('onode-restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', function () { doControl('onode-restart-btn', 'restartNode', 'Restart', 'Restart your ONODE? It will briefly disconnect from the ONET.'); });

    bindDNAGate(block);
    block.dataset.onodeBound = 'true';
    window.openONODEModal = openONODEModal;
    window.closeONODEModal = closeONODEModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
