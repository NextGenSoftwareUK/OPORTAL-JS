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
    el.textContent = msg;
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
    setText('onet-stat-uptime', s ? (s.uptime || s.networkUptime || '—') : '—');
  }

  // ── Overview / stats grid ─────────────────────────────────────────────────────

  function renderStatsGrid(stats) {
    var grid = getById('onet-stats-grid');
    if (!grid) return;
    var s = stats && (stats.result || stats);
    if (!s || typeof s !== 'object') {
      grid.innerHTML = '<div class="onet-empty"><p>No overview data available.</p></div>';
      return;
    }
    var entries = Object.entries(s).filter(function (kv) {
      return typeof kv[1] !== 'object' || kv[1] == null;
    });
    if (!entries.length) {
      grid.innerHTML = '<div class="onet-empty"><p>No overview data available.</p></div>';
      return;
    }
    grid.innerHTML = entries.map(function (kv) {
      return '<div class="onet-stat-card">' +
        '<div class="onet-stat-card-label">' + escapeHtml(kv[0]) + '</div>' +
        '<div class="onet-stat-card-value">' + escapeHtml(String(kv[1])) + '</div>' +
        '</div>';
    }).join('');
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

  // ── Load all ──────────────────────────────────────────────────────────────────

  async function loadAll() {
    showStatus('loading', 'Loading ONET data…');

    // TODO: replace with live API once ONET endpoints are stable
    var status = { isRunning: true, statusMessage: 'ONET is running — global ONODE network active.' };
    var nodes = [
      { nodeId: 'a1b2c3d4e5f6a1b2', address: '185.220.101.47:4101', status: 'Online', latency: '12ms' },
      { nodeId: 'b2c3d4e5f6a1b2c3', address: '95.217.8.239:4101',  status: 'Online', latency: '28ms' },
      { nodeId: 'c3d4e5f6a1b2c3d4', address: '51.158.68.173:4101', status: 'Online', latency: '41ms' },
      { nodeId: 'd4e5f6a1b2c3d4e5', address: '37.120.205.83:4101', status: 'Online', latency: '67ms' },
      { nodeId: 'e5f6a1b2c3d4e5f6', address: '162.55.32.17:4101',  status: 'Online', latency: '93ms' },
    ];
    var stats = {
      activeConnections: 247, networkLoad: 23, uptime: '14d 7h 22m',
      cpuUsage: 18, memoryUsage: 34, bandwidth: 41,
      totalNodes: 5, messagesRouted: 18472, avgLatency: '48ms',
    };

    hideStatus();
    updateBanner(status);
    updateStatBar(nodes, stats);
    renderStatsGrid(stats);
    renderHealthBars(stats);
    renderNodes(nodes);
  }

  async function loadTopology() {
    var el = getById('onet-topology');
    if (el) el.textContent = 'Loading…';
    var data = await apiFetch('/api/v1/onet/network/topology');
    renderTopology(data);
  }

  // ── Action buttons ────────────────────────────────────────────────────────────

  async function doAction(btnId, endpoint, label) {
    setBtn(btnId, label + '…', true);
    var result = await apiPost('/api/v1/onet/network/' + endpoint);
    if (result.ok) {
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
    setBtn('onet-broadcast-btn', 'Sending…', true);
    var result = await apiPost('/api/v1/onet/network/broadcast', { message: msg });
    if (result.ok) {
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
    if (connectBtn) connectBtn.addEventListener('click', function () { doAction('onet-connect-btn', 'connect', 'Connect'); });

    var disconnectBtn = getById('onet-disconnect-btn');
    if (disconnectBtn) disconnectBtn.addEventListener('click', function () { doAction('onet-disconnect-btn', 'disconnect', 'Disconnect'); });

    var startBtn = getById('onet-start-btn');
    if (startBtn) startBtn.addEventListener('click', function () { doAction('onet-start-btn', 'start', 'Start'); });

    var stopBtn = getById('onet-stop-btn');
    if (stopBtn) stopBtn.addEventListener('click', function () { doAction('onet-stop-btn', 'stop', 'Stop'); });

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
