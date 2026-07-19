(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var currentTab = 'overview';

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
    var el = getById('onet-modal-status');
    if (!el) return;
    el.className = 'onet-status onet-status--' + type;
    el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : '');
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('onet-modal-status');
    if (el) el.hidden = true;
  }

  function setBtn(id, text, disabled) {
    var b = getById(id);
    if (!b) return;
    b.textContent = text;
    b.disabled = !!disabled;
  }

  // ── API helpers ───────────────────────────────────────────────────────────────

  async function apiFetch(path, opts) {
    try {
      var res = await fetch(API_BASE + path, opts || {});
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function apiPost(path, body) {
    try {
      var res = await fetch(API_BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
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

  function updateBanner(status) {
    var running = status && (status.isRunning || (status.result && status.result.isRunning));
    var banner = getById('onet-status-banner');
    var dot = getById('onet-status-dot');
    var label = getById('onet-status-label');
    var desc = getById('onet-status-desc');
    if (!banner) return;

    var cls = running ? 'online' : 'offline';
    banner.className = 'hd-mode-banner hd-mode-banner--' + cls;
    if (dot) dot.className = 'hd-mode-dot hd-mode-dot--' + cls;
    if (label) label.textContent = running ? 'ONLINE' : 'OFFLINE';
    if (desc) {
      var s = status && (status.result || status);
      desc.textContent = running
        ? 'ONET is running — global ONODE network active.'
        : (s && s.statusMessage) ? s.statusMessage : 'ONET is not running or unreachable.';
    }
  }

  // ── Stats bar ─────────────────────────────────────────────────────────────────

  function updateStatBar(nodes, stats) {
    var nodeCount = nodes ? (Array.isArray(nodes) ? nodes.length : (nodes.count || nodes.totalNodes || '—')) : '—';
    var s = stats && (stats.result || stats);
    setText('onet-stat-nodes', nodeCount);
    setText('onet-stat-connections', s ? (s.activeConnections || s.connections || '—') : '—');
    setText('onet-stat-load', s ? (s.networkLoad != null ? s.networkLoad + '%' : (s.load != null ? s.load + '%' : '—')) : '—');
    setText('onet-stat-uptime', fmtVal(s ? (s.uptime != null ? s.uptime : (s.networkUptime != null ? s.networkUptime : null)) : null));
  }

  // ── Formatting helpers ────────────────────────────────────────────────────────

  var KEY_LABELS = {
    totalNodes: 'Total Nodes', nodeCount: 'Total Nodes', totalNodeCount: 'Total Nodes',
    networkRunning: 'Network Running', isRunning: 'Running', running: 'Running',
    activeConnections: 'Active Connections', connections: 'Connections',
    networkLoad: 'Network Load', load: 'Network Load',
    uptime: 'Uptime', networkUptime: 'Network Uptime',
    lastActivity: 'Last Activity', lastActiveTime: 'Last Active',
    bandwidth: 'Bandwidth', cpuUsage: 'CPU Usage', memoryUsage: 'Memory Usage',
    version: 'Version', protocolVersion: 'Protocol Version',
    statusMessage: 'Status', status: 'Status',
    peersConnected: 'Peers Connected', activePeers: 'Active Peers',
    packetsSent: 'Packets Sent', packetsReceived: 'Packets Received',
    totalKarmaAwarded: 'Karma Awarded',
  };

  function fmtKey(k) {
    var lower = k.charAt(0).toLowerCase() + k.slice(1);
    if (KEY_LABELS[lower]) return KEY_LABELS[lower];
    if (KEY_LABELS[k]) return KEY_LABELS[k];
    // camelCase / PascalCase → spaced title case
    return k
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, function (c) { return c.toUpperCase(); })
      .trim();
  }

  function fmtVal(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    var str = String(v);
    // Negative timespan (e.g. -00:00:00.0000022) → treat as zero / not started
    if (/^-\d\d:\d\d:\d\d/.test(str)) return '—';
    // ISO date string
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
      try {
        var d = new Date(str);
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      } catch (e) { return str; }
    }
    // Plain zero timespan → 0s
    if (/^00:00:00/.test(str)) return '0s';
    // Timespan like HH:MM:SS → format nicely
    if (/^\d+:\d{2}:\d{2}/.test(str)) return str.split('.')[0];
    return str;
  }

  // ── Overview / stats grid ─────────────────────────────────────────────────────

  var HIDE_KEYS = new Set(['$id','$type','id','Id']);

  function renderStatsGrid(stats) {
    var grid = getById('onet-stats-grid');
    if (!grid) return;
    var s = stats && (stats.result || stats);
    if (!s || typeof s !== 'object') {
      grid.innerHTML = '<div class="onet-empty"><p>No overview data available.</p></div>';
      return;
    }
    var entries = Object.entries(s).filter(function (kv) {
      return !HIDE_KEYS.has(kv[0]) && (typeof kv[1] !== 'object' || kv[1] == null);
    });
    if (!entries.length) {
      grid.innerHTML = '<div class="onet-empty"><p>No overview data available.</p></div>';
      return;
    }
    grid.innerHTML = entries.map(function (kv) {
      var val = fmtVal(kv[1]);
      return '<div class="onet-stat-card">' +
        '<div class="onet-stat-card-label">' + escapeHtml(fmtKey(kv[0])) + '</div>' +
        '<div class="onet-stat-card-value' + (val === '—' ? ' onet-stat-card-value--dim' : '') + '">' + escapeHtml(val) + '</div>' +
        '</div>';
    }).join('') +
    '<div class="onet-coming-soon-note">&#128680; Full network management — start/stop nodes, topology control, and live metrics — is coming soon as the ONET expands.</div>';
  }

  // ── Health bars ───────────────────────────────────────────────────────────────

  function renderHealthBars(stats) {
    var el = getById('onet-health-bars');
    if (!el) return;
    var s = stats && (stats.result || stats);
    var metrics = [];
    if (s) {
      if (s.cpuUsage != null) metrics.push({ label: 'CPU', value: s.cpuUsage });
      if (s.memoryUsage != null) metrics.push({ label: 'Memory', value: s.memoryUsage });
      if (s.bandwidth != null) metrics.push({ label: 'Bandwidth', value: s.bandwidth });
      if (s.networkLoad != null) metrics.push({ label: 'Network Load', value: s.networkLoad });
    }
    if (!metrics.length) {
      el.innerHTML = '<div class="onet-empty"><p>No health metrics available.</p></div>';
      return;
    }
    el.innerHTML = metrics.map(function (m) {
      var pct = Math.min(100, Math.max(0, parseFloat(m.value) || 0));
      var cls = pct < 50 ? 'good' : pct < 80 ? 'warn' : 'crit';
      return '<div class="onet-health-row">' +
        '<div class="onet-health-label">' + escapeHtml(m.label) + '</div>' +
        '<div class="onet-health-bar-wrap">' +
          '<div class="onet-health-bar onet-health-bar--' + cls + '" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="onet-health-pct">' + pct.toFixed(1) + '%</div>' +
        '</div>';
    }).join('');
  }

  // ── Nodes ─────────────────────────────────────────────────────────────────────

  function buildNodeRow(node) {
    var id = node.nodeId || node.NodeId || node.id || node.Id || '';
    var shortId = id.length > 16 ? id.slice(0, 8) + '…' + id.slice(-4) : id;
    var addr = node.address || node.Address || node.endpoint || node.Endpoint || '—';
    var status = node.status || node.Status || node.isRunning || '';
    var running = (status === true || String(status).toLowerCase() === 'running' || String(status).toLowerCase() === 'online');
    var peers = node.peers || node.Peers || node.peerCount || node.PeerCount || '—';
    var uptime = node.uptime || node.Uptime || '—';

    return '<div class="onet-node-row">' +
      '<div class="onet-node-id" title="' + escapeHtml(id) + '">' + escapeHtml(shortId || '—') + '</div>' +
      '<div class="onet-node-addr">' + escapeHtml(String(addr)) + '</div>' +
      '<div class="onet-node-status">' +
        '<span class="onet-dot onet-dot--' + (running ? 'green' : 'amber') + '"></span>' +
        escapeHtml(String(status || (running ? 'Online' : 'Offline'))) +
      '</div>' +
      '<div class="onet-node-peers">Peers: ' + escapeHtml(String(peers)) + '</div>' +
      '<div class="onet-node-uptime">' + escapeHtml(String(uptime)) + '</div>' +
      '</div>';
  }

  function renderNodes(nodes) {
    var list = getById('onet-nodes-list');
    if (!list) return;
    var arr = Array.isArray(nodes) ? nodes : (nodes && nodes.result ? nodes.result : null);
    if (!arr || !arr.length) {
      list.innerHTML = '<div class="onet-empty"><div class="onet-empty-icon">🌐</div><p>No nodes found on the network.</p></div>';
      return;
    }
    list.innerHTML = arr.map(buildNodeRow).join('');
  }

  // ── Topology ──────────────────────────────────────────────────────────────────

  function renderTopology(data) {
    var el = getById('onet-topology');
    if (!el) return;
    var d = extractResult(data);
    if (!d) { el.textContent = 'No topology data available.'; return; }
    if (Array.isArray(d)) {
      el.textContent = d.map(function (conn, i) {
        var from = conn.from || conn.From || conn.source || conn.Source || 'Node' + i;
        var to = conn.to || conn.To || conn.target || conn.Target || '?';
        return escapeHtml(from) + ' ──► ' + escapeHtml(to);
      }).join('\n');
    } else {
      el.textContent = JSON.stringify(d, null, 2);
    }
  }

  // ── OASISDNA ──────────────────────────────────────────────────────────────────

  function renderOASISDNA(data) {
    var el = getById('onet-oasisdna');
    if (!el) return;
    var d = extractResult(data);
    el.textContent = d ? JSON.stringify(d, null, 2) : 'No OASIS DNA data available.';
  }

  // ── Active ONODEs (Holon bridge) ─────────────────────────────────────────────

  async function loadActiveONODEs() {
    var API_BASE = window.apiUrl || window.API_BASE;
    var container = getById('onet-active-onodes');
    if (!container) return;

    container.innerHTML = '<div class="onet-empty"><p>Loading active ONODEs…</p></div>';

    try {
      var res = await fetch(API_BASE + '/api/v1/onode/active-nodes', { signal: AbortSignal.timeout(5000) });
      if (!res.ok) { container.innerHTML = '<div class="onet-empty"><p>No active ONODE data.</p></div>'; return; }
      var nodes = await res.json();
      if (!nodes || !nodes.length) {
        container.innerHTML = '<div class="onet-empty"><div class="onet-empty-icon">📡</div><p>No ONODEs have synced recently. ONODEs push state every 5s when running.</p></div>';
        return;
      }

      container.innerHTML = nodes.map(function (n) {
        var nodeId   = (n.nodeId   || '').slice(0, 8) + '…';
        var avatarId = (n.avatarId || '').slice(0, 8) + '…';
        var running  = n.runningCount || 0;
        var total    = n.totalCount   || 0;
        var age      = n.secondsAgo   || 0;
        var fresh    = age < 15;
        var dot      = fresh ? '#00BFFF' : age < 60 ? '#FFA500' : '#FF4444';
        var peers    = n.metrics ? (n.metrics.peersConnected || 0) : 0;
        var bytesIn  = n.metrics ? formatBytesOnet(n.metrics.bytesReadPerSec  || 0) : '0 B/s';
        var bytesOut = n.metrics ? formatBytesOnet(n.metrics.bytesWrittenPerSec || 0) : '0 B/s';

        return '<div class="onet-onode-card">' +
          '<div class="onet-onode-card-header">' +
            '<span class="onet-onode-dot" style="background:' + dot + '"></span>' +
            '<span class="onet-onode-id" title="' + escapeHtml(n.nodeId || '') + '">' + escapeHtml(nodeId) + '</span>' +
            '<span class="onet-onode-age">' + (age < 5 ? 'Just now' : age + 's ago') + '</span>' +
          '</div>' +
          '<div class="onet-onode-stats">' +
            '<span>' + running + '/' + total + ' services running</span>' +
            '<span>Peers: ' + peers + '</span>' +
            '<span>↓ ' + bytesIn + '</span>' +
            '<span>↑ ' + bytesOut + '</span>' +
          '</div>' +
          '<div class="onet-onode-avatar">Avatar: ' + escapeHtml(avatarId) + '</div>' +
          '</div>';
      }).join('');
    } catch (e) {
      container.innerHTML = '<div class="onet-empty"><p>Could not reach OASIS API.</p></div>';
    }
  }

  function formatBytesOnet(b) {
    if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB/s';
    if (b >= 1e3) return (b / 1e3).toFixed(1) + ' KB/s';
    return b + ' B/s';
  }

  // ── Load all ──────────────────────────────────────────────────────────────────

  async function loadAll() {
    showStatus('loading', 'Loading ONET data…');
    var client = window.oasisClient && window.oasisClient.oNET;
    if (!client) { showStatus('warn', 'ONET SDK not available.'); return; }

    var [statusRes, nodesRes, statsRes] = await Promise.all([
      client.getNetworkStatus().catch(function () { return { isError: true }; }),
      client.getConnectedNodes().catch(function () { return { isError: true }; }),
      client.getNetworkStats().catch(function () { return { isError: true }; }),
    ]);

    var status = statusRes.isError ? null : (statusRes.result || statusRes);
    var nodes  = nodesRes.isError  ? null : nodesRes.result;
    var stats  = statsRes.isError  ? null : (statsRes.result || statsRes);

    hideStatus();
    updateBanner(status || {});
    updateStatBar(nodes, stats);
    renderStatsGrid(stats);
    renderHealthBars(stats);
    renderNodes(nodes);
  }

  async function loadTopology() {
    var el = getById('onet-topology');
    if (el) el.textContent = 'Loading…';
    var client = window.oasisClient && window.oasisClient.oNET;
    if (!client) { renderTopology(null); return; }
    var sdkRes = await client.getNetworkTopology().catch(function () { return { isError: true }; });
    renderTopology(sdkRes.isError ? null : sdkRes.result);
  }

  // ── Action buttons ────────────────────────────────────────────────────────────

  async function doAction(btnId, method, label) {
    var client = window.oasisClient && window.oasisClient.oNET;
    if (!client || !client[method]) { showStatus('error', 'Action not available.'); return; }
    setBtn(btnId, label + '…', true);
    var sdkRes = await client[method]().catch(function () { return { isError: true }; });
    if (!sdkRes.isError) {
      showStatus('success', label + ' successful.');
      setTimeout(function () { hideStatus(); loadAll(); }, 2000);
    } else {
      showStatus('error', label + ' failed. Please try again.');
    }
    setBtn(btnId, label, false);
  }

  async function doBroadcast() {
    var textarea = getById('onet-broadcast-msg');
    var msg = textarea ? textarea.value.trim() : '';
    if (!msg) { showStatus('warn', 'Please enter a message to broadcast.'); return; }
    var client = window.oasisClient && window.oasisClient.oNET;
    if (!client) { showStatus('error', 'ONET SDK not available.'); return; }
    setBtn('onet-broadcast-btn', 'Sending…', true);
    var sdkRes = await client.broadcastMessage({ message: msg }).catch(function () { return { isError: true }; });
    if (!sdkRes.isError) {
      showStatus('success', 'Message broadcast to ONET.');
      if (textarea) textarea.value = '';
      setTimeout(hideStatus, 3000);
    } else {
      showStatus('error', 'Broadcast failed. Please try again.');
    }
    setBtn('onet-broadcast-btn', 'Broadcast', false);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  function switchTab(tab) {
    var block = getById('onet-modal-block');
    if (!block) return;
    currentTab = tab;
    block.querySelectorAll('.onet-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    block.querySelectorAll('.onet-tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'onet-tab-' + tab;
    });
    if (tab === 'topology') loadTopology();
    if (tab === 'nodes') loadActiveONODEs();
  }

  // ── Open / close ──────────────────────────────────────────────────────────────

  function openONETModal() {
    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('onet-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    switchTab('overview');
    loadAll();
    return false;
  }

  function closeONETModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('onet-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('onet-modal-block');
    if (!block || block.dataset.onetBound === 'true') {
      window.openONETModal = openONETModal;
      window.closeONETModal = closeONETModal;
      return;
    }

    var closeBtn = getById('onet-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeONETModal(); });

    var refreshBtn = getById('onet-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAll);

    var tabBar = block.querySelector('.onet-tabs');
    if (tabBar) {
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.onet-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    var connectBtn = getById('onet-connect-btn');
    if (connectBtn) connectBtn.addEventListener('click', function () { doAction('onet-connect-btn', 'connectToNode', 'Connect'); });

    var disconnectBtn = getById('onet-disconnect-btn');
    if (disconnectBtn) disconnectBtn.addEventListener('click', function () { doAction('onet-disconnect-btn', 'disconnectFromNode', 'Disconnect'); });

    var startBtn = getById('onet-start-btn');
    if (startBtn) startBtn.addEventListener('click', function () { doAction('onet-start-btn', 'startNetwork', 'Start'); });

    var stopBtn = getById('onet-stop-btn');
    if (stopBtn) stopBtn.addEventListener('click', function () { doAction('onet-stop-btn', 'stopNetwork', 'Stop'); });

    var broadcastBtn = getById('onet-broadcast-btn');
    if (broadcastBtn) broadcastBtn.addEventListener('click', doBroadcast);

    block.dataset.onetBound = 'true';
    window.openONETModal = openONETModal;
    window.closeONETModal = closeONETModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
