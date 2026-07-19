(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var logsInterval = null;
  var logsTabActive = false;
  var pollInterval = null;
  var lastSyncTime = null;

  // ── Services tracked (Web4–Web10) ─────────────────────────────────────────────
  var ALL_SERVICES = ['web4','web5','web6','web7','web8','web9','web10'];

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
    el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : '');
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

  // ── Mode detection ────────────────────────────────────────────────────────────
  // Determines whether OPORTAL can reach Web4 directly (same machine / LAN)
  // or must use the Holon bridge (remote, e.g. mobile away from home).

  var _isLocal = null; // cached result
  var _ws = null;      // active WebSocket (local mode only)
  var _wsNodeId = '';  // nodeId the WS is subscribed to

  function getWsBase() {
    var base = API_BASE || '';
    return base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  }

  function openWebSocket(nodeId) {
    if (_ws && _ws.readyState <= 1 && _wsNodeId === nodeId) return; // already open/connecting
    closeWebSocket();
    _wsNodeId = nodeId;
    try {
      _ws = new WebSocket(getWsBase() + '/ws/onode/' + encodeURIComponent(nodeId));
      _ws.onmessage = function (evt) {
        try {
          var state = JSON.parse(evt.data);
          onWsStateUpdate(state);
        } catch (e) { /* ignore parse error */ }
      };
      _ws.onclose = function () {
        _ws = null;
        // Fall back to polling if WS closes unexpectedly
        if (!pollInterval) pollInterval = setInterval(loadAll, 5000);
      };
      _ws.onerror = function () { _ws = null; };
      _ws.onopen = function () {
        // WebSocket open — stop polling (WS replaces it)
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      };
    } catch (e) { _ws = null; }
  }

  function closeWebSocket() {
    if (_ws) { try { _ws.close(); } catch (e) {} _ws = null; }
  }

  function onWsStateUpdate(state) {
    // Called when ONODEService pushes state via WS (no polling lag)
    lastSyncTime = Date.now();
    updateSyncLabel();
    if (state.services) buildServicesPanel(state.services, true);
    if (state.metrics) {
      updateStatBar({ status: 'Running' }, {
        uptime: '—', peers: state.metrics.peersConnected, version: state.version || '—'
      });
    }
    if (state.services) {
      var providerMap = {};
      state.services.forEach(function (svc) {
        (svc.providers || []).forEach(function (p) {
          var key = p.providerType || p.ProviderType || '';
          if (key && !providerMap[key]) providerMap[key] = p;
        });
      });
      var providerList = Object.values(providerMap);
      if (providerList.length && !getById('onode-tab-providers').hidden)
        buildProvidersPanel(providerList, true);
    }
  }

  async function canReachLocal() {
    if (_isLocal !== null) return _isLocal;
    try {
      var res = await fetch(API_BASE + '/api/v1/onode/status', { signal: AbortSignal.timeout(2000) });
      _isLocal = res.ok;
    } catch (e) {
      _isLocal = false;
    }
    return _isLocal;
  }

  function resetLocalCache() { _isLocal = null; }

  // ── Direct Web4 API helpers (local mode) ──────────────────────────────────────

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

  // ── Holon bridge (remote mode) ────────────────────────────────────────────────

  async function fetchNodeStateHolon(avatarId) {
    if (!avatarId) return null;
    try {
      var res = await fetch(API_BASE + '/api/v1/onode/node-state/' + encodeURIComponent(avatarId));
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function sendCommandHolon(command, service, payload) {
    var avatar = getLoggedInAvatar();
    if (!avatar) return null;
    var cmd = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      holonType: 'ONODECommand',
      targetNodeId: avatar.nodeId || avatar.NodeId || '',
      issuedByAvatarId: avatar.id || avatar.Id || '',
      command: command,
      service: service || null,
      payload: payload || null,
      status: 'Pending',
      issuedAt: new Date().toISOString()
    };
    try {
      var res = await fetch(API_BASE + '/api/v1/onode/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
      });
      if (!res.ok) return null;
      return { commandId: cmd.id };
    } catch (e) { return null; }
  }

  async function pollCommandResult(commandId, timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise(function(r) { setTimeout(r, 1500); });
      try {
        var res = await fetch(API_BASE + '/api/v1/onode/commands/' + encodeURIComponent(commandId));
        if (!res.ok) continue;
        var cmd = await res.json();
        if (cmd.status === 'Done' || cmd.status === 'Error') return cmd;
      } catch (e) { /* keep polling */ }
    }
    return null;
  }

  // ── Avatar helpers ────────────────────────────────────────────────────────────

  function getLoggedInAvatar() {
    try { return JSON.parse(localStorage.getItem('avatar') || 'null'); }
    catch (e) { return null; }
  }

  function getAvatarId() {
    var a = getLoggedInAvatar();
    return a ? (a.id || a.Id || a.avatarId || a.AvatarId || '') : '';
  }

  function extractResult(data) {
    if (!data) return data;
    if (data.result != null) return data.result;
    return data;
  }

  // ── Last sync counter ─────────────────────────────────────────────────────────

  function updateSyncLabel() {
    var el = getById('onode-sync-label');
    if (!el) return;
    if (!lastSyncTime) { el.textContent = 'Never synced'; return; }
    var sec = Math.round((Date.now() - lastSyncTime) / 1000);
    el.textContent = sec < 5 ? 'Just now' : sec + 's ago';
  }

  // ── Services panel (multi-service) ────────────────────────────────────────────

  function buildServicesPanel(services, isLocal) {
    var container = getById('onode-services-grid');
    if (!container) return;

    var rows = services.map(function (svc) {
      var id = (svc.id || svc.Id || '').toLowerCase();
      var status = svc.status || svc.Status || 'Unknown';
      var uptime = svc.uptime || svc.UptimeSeconds
        ? formatUptime(svc.uptime || svc.UptimeSeconds || 0) : '—';
      var port = svc.port || svc.Port || '—';
      var installed = svc.installed !== false;
      var statusClass = statusColour(status);

      var controls = isLocal
        ? '<button class="onode-svc-btn" onclick="window._onodeSvcStart(\'' + escapeHtml(id) + '\')">▶</button>' +
          '<button class="onode-svc-btn onode-svc-btn--danger" onclick="window._onodeSvcStop(\'' + escapeHtml(id) + '\')">■</button>' +
          '<button class="onode-svc-btn" onclick="window._onodeSvcRestart(\'' + escapeHtml(id) + '\')">↺</button>'
        : '<button class="onode-svc-btn onode-svc-btn--remote" onclick="window._onodeRemoteStart(\'' + escapeHtml(id) + '\')">▶ Remote</button>' +
          '<button class="onode-svc-btn onode-svc-btn--remote onode-svc-btn--danger" onclick="window._onodeRemoteStop(\'' + escapeHtml(id) + '\')">■</button>';

      return '<div class="onode-svc-row" data-service="' + escapeHtml(id) + '">' +
        '<div class="onode-svc-dot" style="background:' + statusClass + '"></div>' +
        '<div class="onode-svc-id">' + escapeHtml(id.toUpperCase()) + '</div>' +
        '<div class="onode-svc-status" style="color:' + statusClass + '">' + escapeHtml(status) + '</div>' +
        '<div class="onode-svc-uptime">' + escapeHtml(uptime) + '</div>' +
        '<div class="onode-svc-port">' + escapeHtml(String(port)) + '</div>' +
        (installed ? controls : '<span class="onode-svc-na">Not installed</span>') +
        '</div>';
    }).join('');

    container.innerHTML = rows || '<div class="onode-empty"><p>No service data available.</p></div>';
  }

  function statusColour(status) {
    var s = (status || '').toLowerCase();
    if (s === 'running')  return '#00BFFF';
    if (s === 'stopped')  return '#808080';
    if (s === 'starting' || s === 'stopping') return '#87CEEB';
    if (s === 'crashed' || s === 'degraded') return '#FF4444';
    return '#808080';
  }

  function formatUptime(sec) {
    sec = parseFloat(sec) || 0;
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    if (h > 0) return h + 'h ' + String(m).padStart(2,'0') + 'm';
    if (m > 0) return m + 'm ' + String(s).padStart(2,'0') + 's';
    return s + 's';
  }

  // ── Local service control (direct Web4 API calls) ─────────────────────────────

  window._onodeSvcStart = async function (id) {
    await apiPost('/api/v1/onode/start');
    showStatus('success', id.toUpperCase() + ' start sent.');
    setTimeout(loadAll, 2000);
  };
  window._onodeSvcStop = async function (id) {
    if (!confirm('Stop ' + id.toUpperCase() + '?')) return;
    await apiPost('/api/v1/onode/stop');
    showStatus('success', id.toUpperCase() + ' stop sent.');
    setTimeout(loadAll, 2000);
  };
  window._onodeSvcRestart = async function (id) {
    if (!confirm('Restart ' + id.toUpperCase() + '?')) return;
    await apiPost('/api/v1/onode/restart');
    showStatus('success', id.toUpperCase() + ' restart sent.');
    setTimeout(loadAll, 3000);
  };

  // ── Remote service control (CommandHolon) ─────────────────────────────────────

  window._onodeRemoteStart = async function (id) {
    showStatus('loading', 'Sending start command to your ONODE…');
    var r = await sendCommandHolon('Start', id);
    if (!r) { showStatus('error', 'Failed to send command.'); return; }
    showStatus('loading', 'Waiting for confirmation (up to 15s)…');
    var result = await pollCommandResult(r.commandId);
    if (result && result.status === 'Done') {
      showStatus('success', id.toUpperCase() + ' started remotely.');
    } else {
      showStatus('error', result ? result.result : 'Timed out waiting for response.');
    }
    setTimeout(loadAll, 2000);
  };

  window._onodeRemoteStop = async function (id) {
    if (!confirm('Send remote stop to ' + id.toUpperCase() + '?')) return;
    showStatus('loading', 'Sending stop command…');
    var r = await sendCommandHolon('Stop', id);
    if (!r) { showStatus('error', 'Failed to send command.'); return; }
    var result = await pollCommandResult(r.commandId);
    showStatus(result && result.status === 'Done' ? 'success' : 'error',
      result ? (result.status === 'Done' ? id.toUpperCase() + ' stopped.' : result.result) : 'Timed out.');
    setTimeout(loadAll, 2000);
  };

  // ── Remote: all-services controls ────────────────────────────────────────────

  async function remoteStartAll() {
    showStatus('loading', 'Sending Start All to your ONODE…');
    var r = await sendCommandHolon('Start', null);
    if (!r) { showStatus('error', 'Failed.'); return; }
    var result = await pollCommandResult(r.commandId);
    showStatus(result && result.status === 'Done' ? 'success' : 'error',
      result && result.status === 'Done' ? 'All services started.' : (result ? result.result : 'Timed out.'));
    setTimeout(loadAll, 3000);
  }

  async function remoteStopAll() {
    if (!confirm('Stop ALL services on your ONODE?')) return;
    showStatus('loading', 'Sending Stop All…');
    var r = await sendCommandHolon('Stop', null);
    if (!r) { showStatus('error', 'Failed.'); return; }
    var result = await pollCommandResult(r.commandId);
    showStatus(result && result.status === 'Done' ? 'success' : 'error',
      result && result.status === 'Done' ? 'All services stopped.' : 'Timed out.');
    setTimeout(loadAll, 3000);
  }

  // ── Load all data ─────────────────────────────────────────────────────────────

  async function loadAll() {
    showStatus('loading', 'Loading node data…');
    resetLocalCache();
    var local = await canReachLocal();

    if (local) {
      await loadAllLocal();
    } else {
      await loadAllRemote();
    }

    lastSyncTime = Date.now();
    updateSyncLabel();
    hideStatus();
  }

  async function loadAllLocal() {
    var client = window.oasisClient && window.oasisClient.oNODE;
    if (!client) return;

    var [statusRes, infoRes, metricsRes, peersRes] = await Promise.all([
      client.getNodeStatus().catch(function () { return { isError: true }; }),
      client.getNodeInfo().catch(function () { return { isError: true }; }),
      client.getNodeMetrics().catch(function () { return { isError: true }; }),
      client.getConnectedPeers().catch(function () { return { isError: true }; }),
    ]);

    var status  = statusRes.isError  ? null : (statusRes.result  || statusRes);
    var info    = infoRes.isError    ? null : (infoRes.result    || infoRes);
    var metrics = metricsRes.isError ? null : (metricsRes.result || metricsRes);
    var peers   = peersRes.isError   ? null : (peersRes.result   || peersRes);

    var allFailed = statusRes.isError && infoRes.isError;
    updateBanner(status || {}, allFailed, true);
    updateStatBar(status, info);
    buildInfoGrid(info);
    buildMetricsGrid(metrics);
    renderPeers(peers);

    // Build a synthetic services list from what the Web4 API tells us
    var svcStatus = status ? (status.status || status.Status || 'Unknown') : 'Unknown';
    var services = ALL_SERVICES.map(function (id) {
      return { id: id, status: id === 'web4' ? svcStatus : 'Unknown', installed: true };
    });
    buildServicesPanel(services, true);
    // Pre-load providers if providers tab visible
    if (!getById('onode-tab-providers').hidden) loadProvidersLocal();
    updateRemoteControlPanel(true, status);

    // Upgrade to WebSocket push for real-time state
    var avatarId = getAvatarId();
    if (avatarId) openWebSocket(avatarId);
  }

  async function loadAllRemote() {
    var avatarId = getAvatarId();
    var holon = await fetchNodeStateHolon(avatarId);

    if (!holon) {
      updateBanner({}, true, false);
      updateRemoteControlPanel(false, null);
      return;
    }

    var secAgo = holon.lastSeen
      ? Math.round((Date.now() - new Date(holon.lastSeen).getTime()) / 1000)
      : 999;
    var nodeOnline = secAgo < 60;

    updateBanner({ status: nodeOnline ? 'Running' : 'Offline' }, !nodeOnline, false);
    updateStatBar({ status: nodeOnline ? 'Running' : 'Offline' }, {
      uptime: holon.services && holon.services.find(function(s){ return s.id === 'web4'; })
        ? formatUptime(holon.services.find(function(s){ return s.id === 'web4'; }).uptimeSeconds) : '—',
      peers: holon.metrics ? holon.metrics.peersConnected : '—',
      version: holon.version || '—'
    });

    if (holon.services) buildServicesPanel(holon.services, false);
    // Providers come embedded in each service's Providers list; extract distinct set
    if (holon.services) {
      var providerMap = {};
      holon.services.forEach(function (svc) {
        if (svc.providers || svc.Providers) {
          (svc.providers || svc.Providers).forEach(function (p) {
            var key = p.providerType || p.ProviderType || '';
            if (key && !providerMap[key]) providerMap[key] = p;
          });
        }
      });
      var providerList = Object.values(providerMap);
      if (providerList.length) buildProvidersPanel(providerList, false);
    }

    if (holon.metrics) buildMetricsGrid({
      peersConnected: holon.metrics.peersConnected,
      bytesReadPerSec: holon.metrics.bytesReadPerSec,
      bytesWrittenPerSec: holon.metrics.bytesWrittenPerSec,
      requestsPerSec: holon.metrics.requestsPerSec,
    });

    updateRemoteControlPanel(false, holon, secAgo);
  }

  // ── Banner ────────────────────────────────────────────────────────────────────

  function updateBanner(status, unreachable, isLocal) {
    var s = extractResult(status);
    var running = s && (s.isRunning || String(s.status || s.Status || '').toLowerCase() === 'running');
    var banner = getById('onode-status-banner');
    var dot = getById('onode-status-dot');
    var label = getById('onode-status-label');
    var desc = getById('onode-status-desc');
    var modeEl = getById('onode-mode-label');
    if (!banner) return;

    if (modeEl) modeEl.textContent = isLocal ? '(Local)' : '(Remote — via OASIS Holons)';

    if (unreachable) {
      banner.className = 'hd-mode-banner hd-mode-banner--offline';
      if (dot)   dot.className = 'hd-mode-dot hd-mode-dot--offline';
      if (label) label.textContent = 'UNAVAILABLE';
      if (desc)  desc.textContent = isLocal
        ? 'ONODE could not be reached. Make sure your local ONODE is running.'
        : 'ONODE is offline or has not synced recently.';
      return;
    }

    var cls = running ? 'online' : 'offline';
    banner.className = 'hd-mode-banner hd-mode-banner--' + cls;
    if (dot)   dot.className   = 'hd-mode-dot hd-mode-dot--' + cls;
    if (label) label.textContent = running ? 'RUNNING' : 'STOPPED';
    if (desc)  desc.textContent = running
      ? 'Your ONODE is active and connected to the ONET.'
      : 'Your ONODE is not running.';
  }

  // ── Remote Control Panel ──────────────────────────────────────────────────────

  function updateRemoteControlPanel(isLocal, nodeData, secondsAgo) {
    var panel = getById('onode-remote-control');
    if (!panel) return;

    var syncEl = getById('onode-sync-label');
    if (syncEl && secondsAgo != null) {
      syncEl.textContent = secondsAgo < 5 ? 'Just now' : secondsAgo + 's ago';
    }

    var startBtn        = getById('onode-start-btn');
    var stopBtn         = getById('onode-stop-btn');
    var restartBtn      = getById('onode-restart-btn');
    var remoteStartBtn  = getById('onode-remote-start-all');
    var remoteStopBtn   = getById('onode-remote-stop-all');
    var modeNote        = getById('onode-control-mode-note');

    if (isLocal) {
      if (startBtn)       startBtn.style.display = '';
      if (stopBtn)        stopBtn.style.display  = '';
      if (restartBtn)     restartBtn.style.display = '';
      if (remoteStartBtn) remoteStartBtn.style.display = 'none';
      if (remoteStopBtn)  remoteStopBtn.style.display  = 'none';
      if (modeNote) modeNote.textContent = 'Direct control (local connection)';
    } else {
      if (startBtn)       startBtn.style.display = 'none';
      if (stopBtn)        stopBtn.style.display  = 'none';
      if (restartBtn)     restartBtn.style.display = 'none';
      if (remoteStartBtn) remoteStartBtn.style.display = '';
      if (remoteStopBtn)  remoteStopBtn.style.display  = '';
      if (modeNote) modeNote.textContent = 'Remote control via OASIS Holons (~6s response)';
    }

    panel.hidden = false;
  }

  // ── Stat bar ──────────────────────────────────────────────────────────────────

  function updateStatBar(status, info) {
    var s = extractResult(status);
    var inf = extractResult(info);
    var running = s && (s.isRunning || String(s.status || '').toLowerCase() === 'running');
    setText('onode-stat-status', running ? 'Running' : 'Stopped');
    setText('onode-stat-uptime', inf ? (inf.uptime || inf.Uptime || '—') : '—');
    setText('onode-stat-peers',  inf ? (inf.peers || inf.Peers || inf.peerCount || inf.PeerCount || '—') : '—');
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
      ['name','Name'],['Name','Name'],['nodeId','Node ID'],['NodeId','Node ID'],
      ['version','Version'],['Version','Version'],['address','Address'],['Address','Address'],
      ['publicKey','Public Key'],['PublicKey','Public Key'],
      ['startTime','Start Time'],['StartTime','Start Time'],
      ['uptime','Uptime'],['Uptime','Uptime'],['peers','Peers'],['Peers','Peers'],
    ];

    var seen = new Set();
    var rows = '';
    FIELDS.forEach(function (f) {
      if (seen.has(f[1])) return;
      var v = inf[f[0]];
      if (v == null || v === '') return;
      seen.add(f[1]);
      rows += '<div class="onode-info-row"><span class="onode-info-label">' + escapeHtml(f[1]) + '</span>' +
        '<span class="onode-info-value">' + escapeHtml(String(v)) + '</span></div>';
    });

    if (!rows) {
      Object.entries(inf).forEach(function (kv) {
        if (typeof kv[1] === 'object' && kv[1] !== null) return;
        rows += '<div class="onode-info-row"><span class="onode-info-label">' + escapeHtml(kv[0]) + '</span>' +
          '<span class="onode-info-value">' + escapeHtml(String(kv[1])) + '</span></div>';
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
    if (m.cpu != null || m.cpuUsage != null) bars.push({ label:'CPU Usage', value: m.cpu || m.cpuUsage, unit:'%' });
    if (m.memory != null || m.memoryUsage != null) bars.push({ label:'Memory Usage', value: m.memory || m.memoryUsage, unit:'%' });
    if (m.peersConnected != null) bars.push({ label:'Peers Connected', value: Math.min(100, m.peersConnected), unit:'' });
    if (m.bytesReadPerSec != null) bars.push({ label:'Bytes Read/s', value: Math.min(100, m.bytesReadPerSec / 10000), unit:'' });
    if (m.bytesWrittenPerSec != null) bars.push({ label:'Bytes Written/s', value: Math.min(100, m.bytesWrittenPerSec / 10000), unit:'' });
    if (m.requestsPerSec != null) bars.push({ label:'Requests/s', value: Math.min(100, m.requestsPerSec * 2), unit:'' });
    if (m.bandwidth != null) bars.push({ label:'Bandwidth', value: m.bandwidth, unit:'%' });
    if (m.requestCount != null) bars.push({ label:'Requests', value: Math.min(100, m.requestCount / 10), unit:'' });

    if (!bars.length) {
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
        '<div class="onode-metric-bar-wrap"><div class="onode-metric-bar onode-metric-bar--' + cls + '" style="width:' + pct + '%"></div></div>' +
        '<div class="onode-metric-val">' + pct.toFixed(1) + (b.unit || '') + '</div>' +
        '</div>';
    }).join('');
  }

  // ── Logs ──────────────────────────────────────────────────────────────────────

  async function renderLogs() {
    if (!logsTabActive) return;
    var el = getById('onode-logs');
    if (!el) return;

    var local = await canReachLocal();
    if (local) {
      var client = window.oasisClient && window.oasisClient.oNODE;
      var sdkRes = client ? await client.getNodeLogs().catch(function () { return { isError: true }; }) : { isError: true };
      var data = sdkRes.isError ? null : sdkRes.result;
      var d = extractResult(data);
      el.textContent = !d ? 'No logs available.' : Array.isArray(d) ? d.join('\n') : String(d);
    } else {
      // Remote: request logs via CommandHolon
      var r = await sendCommandHolon('GetLogs', null, JSON.stringify({ lines: 100 }));
      if (!r) { el.textContent = 'Could not retrieve remote logs.'; return; }
      var result = await pollCommandResult(r.commandId, 10000);
      if (result && result.result) {
        try {
          var entries = JSON.parse(result.result);
          el.textContent = entries.map(function (e) {
            return '[' + (e.Timestamp || e.timestamp || '') + '] [' + (e.ServiceId || e.serviceId || '') + '] ' + (e.Message || e.message || '');
          }).join('\n');
        } catch (ex) { el.textContent = result.result; }
      } else {
        el.textContent = 'No log data returned.';
      }
    }
    el.scrollTop = el.scrollHeight;
  }

  function startLogsAutoRefresh() {
    logsTabActive = true;
    renderLogs();
    if (!logsInterval) logsInterval = setInterval(renderLogs, 5000);
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

  // ── Providers panel ───────────────────────────────────────────────────────────

  var _cachedProviders = null;

  function buildProvidersPanel(providers, isLocal) {
    var container = getById('onode-providers-grid');
    if (!container) return;
    _cachedProviders = providers;

    if (!providers || !providers.length) {
      container.innerHTML = '<div class="onode-empty"><p>No providers configured in OASISDNA.json.</p></div>';
      return;
    }

    var sorted = providers.slice().sort(function (a, b) {
      return (a.priority || a.Priority || 0) - (b.priority || b.Priority || 0);
    });

    container.innerHTML = sorted.map(function (p) {
      var type    = p.providerType  || p.ProviderType  || '';
      var enabled = p.isEnabled     || p.IsEnabled     || false;
      var prio    = p.priority      || p.Priority      || 0;
      var label   = type.replace(/OASIS$/i, '');
      var dot     = enabled ? '#00BFFF' : '#555566';
      var btnLabel = enabled ? 'Disable' : 'Enable';
      var btnCls   = enabled ? 'onode-svc-btn onode-svc-btn--danger' : 'onode-svc-btn';
      var encodedType = escapeHtml(type);

      return '<div class="onode-svc-row" data-provider="' + encodedType + '">' +
        '<div class="onode-svc-dot" style="background:' + dot + '"></div>' +
        '<div class="onode-svc-id">' + escapeHtml(label) + '</div>' +
        '<div class="onode-svc-status" style="color:' + dot + '">' + (enabled ? 'Enabled' : 'Disabled') + '</div>' +
        '<div class="onode-svc-port">' + prio + '</div>' +
        '<div class="onode-svc-actions">' +
          '<button class="' + btnCls + '" onclick="window._onodeProviderToggle(\'' + encodedType + '\',' + (enabled ? 'true' : 'false') + ')">' + btnLabel + '</button>' +
          (isLocal
            ? '<button class="onode-svc-btn" onclick="window._onodeProviderPrio(\'' + encodedType + '\',' + (prio - 1) + ')">▲</button>' +
              '<button class="onode-svc-btn" onclick="window._onodeProviderPrio(\'' + encodedType + '\',' + (prio + 1) + ')">▼</button>'
            : ''
          ) +
        '</div>' +
        '</div>';
    }).join('');
  }

  async function loadProvidersLocal() {
    var data = await apiFetch('/api/v1/onode/providers');
    buildProvidersPanel(data, true);
  }

  async function loadProvidersRemote() {
    var r = await sendCommandHolon('GetProviders', null);
    if (!r) return;
    var result = await pollCommandResult(r.commandId, 10000);
    if (result && result.result) {
      try { buildProvidersPanel(JSON.parse(result.result), false); }
      catch (ex) { /* ignore parse error */ }
    }
  }

  window._onodeProviderToggle = async function (providerType, currentlyEnabled) {
    var local = await canReachLocal();
    if (local) {
      var path = '/api/v1/onode/providers/' + encodeURIComponent(providerType) + (currentlyEnabled ? '/disable' : '/enable');
      try {
        await fetch(API_BASE + path, { method: 'PUT' });
        showStatus('success', providerType + ' ' + (currentlyEnabled ? 'disabled' : 'enabled') + '.');
      } catch (e) { showStatus('error', 'Failed to toggle provider.'); }
      setTimeout(loadProvidersLocal, 1500);
    } else {
      var cmd = currentlyEnabled ? 'DisableProvider' : 'EnableProvider';
      showStatus('loading', 'Sending ' + cmd + ' to ONODE…');
      var r = await sendCommandHolon(cmd, null, JSON.stringify({ providerType: providerType }));
      if (!r) { showStatus('error', 'Failed to send command.'); return; }
      var result = await pollCommandResult(r.commandId);
      showStatus(result && result.status === 'Done' ? 'success' : 'error',
        result && result.status === 'Done' ? (providerType + ' toggled.') : (result ? result.result : 'Timed out.'));
      if (result && result.status === 'Done') setTimeout(loadProvidersRemote, 1500);
    }
  };

  window._onodeProviderPrio = async function (providerType, newPriority) {
    var local = await canReachLocal();
    if (local) {
      try {
        await fetch(API_BASE + '/api/v1/onode/providers/' + encodeURIComponent(providerType) + '/priority', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: newPriority })
        });
      } catch (e) { /* ignore */ }
      setTimeout(loadProvidersLocal, 500);
    }
  };

  // ── Config / OASISDNA ─────────────────────────────────────────────────────────

  function renderPreformatted(id, data) {
    var el = getById(id);
    if (!el) return;
    var d = extractResult(data);
    el.textContent = d ? JSON.stringify(d, null, 2) : 'No data available.';
  }

  async function loadConfig() {
    var local = await canReachLocal();
    if (local) {
      var client = window.oasisClient && window.oasisClient.oNODE;
      if (client) client.getOASISDNA().then(function (r) { renderPreformatted('onode-oasisdna', r.isError ? null : r.result); }).catch(function () {});
    } else {
      // Remote: request config via CommandHolon
      var r = await sendCommandHolon('GetConfig', null);
      if (!r) return;
      var result = await pollCommandResult(r.commandId, 10000);
      if (result && result.result) {
        var el = getById('onode-oasisdna');
        if (el) el.textContent = result.result;
      }
    }
  }

  // ── Controls ──────────────────────────────────────────────────────────────────

  async function doControl(btnId, sdkMethod, label, confirmMsg) {
    var local = await canReachLocal();
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBtn(btnId, label + '…', true);

    if (local) {
      var client = window.oasisClient && window.oasisClient.oNODE;
      if (!client || !client[sdkMethod]) { showStatus('error', 'Action not available.'); setBtn(btnId, label, false); return; }
      var sdkRes = await client[sdkMethod]().catch(function () { return { isError: true }; });
      if (!sdkRes.isError) {
        showStatus('success', label + ' sent successfully.');
        setTimeout(function () { hideStatus(); loadAll(); }, 2500);
      } else {
        showStatus('error', label + ' failed.');
      }
    } else {
      // Remote via CommandHolon
      var cmdName = sdkMethod === 'startNode' ? 'Start' : sdkMethod === 'stopNode' ? 'Stop' : 'Restart';
      showStatus('loading', 'Sending ' + label + ' command to your ONODE…');
      var r = await sendCommandHolon(cmdName, null);
      if (!r) { showStatus('error', 'Failed to send command.'); setBtn(btnId, label, false); return; }
      showStatus('loading', 'Waiting for response (up to 15s)…');
      var result = await pollCommandResult(r.commandId);
      if (result && result.status === 'Done') {
        showStatus('success', label + ' completed remotely.');
        setTimeout(function () { hideStatus(); loadAll(); }, 2500);
      } else {
        showStatus('error', result ? result.result : 'Command timed out.');
      }
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
    if (tab === 'services') {
      // Services panel already populated by loadAll; rebuild on demand
      canReachLocal().then(function (local) {
        var existing = getById('onode-services-grid');
        if (existing && existing.children.length <= 1) loadAll();
      });
    }
    if (tab === 'peers') {
      canReachLocal().then(function (local) {
        if (local) {
          var pc = window.oasisClient && window.oasisClient.oNODE;
          if (pc) pc.getConnectedPeers().then(function (r) { renderPeers(r.isError ? null : r.result); }).catch(function () { renderPeers(null); });
        }
      });
    }
    if (tab === 'config') loadConfig();
    if (tab === 'oasisdna') initDNATab();
    if (tab === 'providers') {
      canReachLocal().then(function (local) {
        if (local) loadProvidersLocal();
        else loadProvidersRemote();
      });
    }
  }

  // ── OASIS DNA gate ────────────────────────────────────────────────────────────

  function isONODELinked() {
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
      gate.hidden = true;
      if (content) content.hidden = true;
      return;
    }
    if (notLinked) notLinked.hidden = true;
    gate.hidden = false;
    if (content) content.hidden = true;
    var pwInput = getById('onode-dna-password');
    var errEl   = getById('onode-dna-gate-error');
    if (pwInput) pwInput.value = '';
    if (errEl)   errEl.hidden  = true;
  }

  function bindDNAGate() {
    var unlockBtn = getById('onode-dna-unlock-btn');
    var lockBtn   = getById('onode-dna-lock-btn');

    if (unlockBtn) unlockBtn.addEventListener('click', async function () {
      var pwInput = getById('onode-dna-password');
      var errEl   = getById('onode-dna-gate-error');
      var pw = pwInput ? pwInput.value.trim() : '';
      if (!pw) { if (errEl) { errEl.textContent = 'Please enter your password.'; errEl.hidden = false; } return; }

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

      var gate    = getById('onode-dna-gate');
      var content = getById('onode-dna-content');
      if (gate)    gate.hidden    = true;
      if (content) content.hidden = false;
      if (errEl)   errEl.hidden   = true;
      loadConfig();
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

    // Start periodic sync refresh
    if (!pollInterval) pollInterval = setInterval(loadAll, 5000);
    return false;
  }

  function closeONODEModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('onode-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
    stopLogsAutoRefresh();
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    closeWebSocket();
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('onode-modal-block');
    if (!block || block.dataset.onodeBound === 'true') {
      window.openONODEModal  = openONODEModal;
      window.closeONODEModal = closeONODEModal;
      return;
    }

    var closeBtn = getById('onode-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeONODEModal(); });

    var refreshBtn = getById('onode-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAll);

    var tabBar = block.querySelector('.onode-tabs');
    if (tabBar) tabBar.addEventListener('click', function (e) {
      var tab = e.target.closest('.onode-tab');
      if (tab) switchTab(tab.dataset.tab);
    });

    var clearLogsBtn = getById('onode-clear-logs-btn');
    if (clearLogsBtn) clearLogsBtn.addEventListener('click', function () {
      var el = getById('onode-logs'); if (el) el.textContent = '';
    });

    var startBtn   = getById('onode-start-btn');
    var stopBtn    = getById('onode-stop-btn');
    var restartBtn = getById('onode-restart-btn');

    if (startBtn)   startBtn.addEventListener('click',   function () { doControl('onode-start-btn',   'startNode',   'Start',   null); });
    if (stopBtn)    stopBtn.addEventListener('click',    function () { doControl('onode-stop-btn',    'stopNode',    'Stop',    'Stop your ONODE? It will disconnect from the ONET.'); });
    if (restartBtn) restartBtn.addEventListener('click', function () { doControl('onode-restart-btn', 'restartNode', 'Restart', 'Restart your ONODE? It will briefly disconnect from the ONET.'); });

    // Remote control panel — all services
    var remoteStartAllBtn = getById('onode-remote-start-all');
    var remoteStopAllBtn  = getById('onode-remote-stop-all');
    if (remoteStartAllBtn) remoteStartAllBtn.addEventListener('click', remoteStartAll);
    if (remoteStopAllBtn)  remoteStopAllBtn.addEventListener('click',  remoteStopAll);

    // Sync label timer
    setInterval(updateSyncLabel, 1000);

    bindDNAGate();
    block.dataset.onodeBound = 'true';
    window.openONODEModal  = openONODEModal;
    window.closeONODEModal = closeONODEModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
