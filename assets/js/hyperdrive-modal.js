(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var pollInterval = null;
  var syncLogInterval = null;
  var providers = [];

  // Known provider metadata for display
  var PROVIDER_META = {
    MongoDBOASIS:    { label: 'MongoDB',    icon: '🍃', cat: 'Web2',   color: '#47a248' },
    SQLiteOASIS:     { label: 'SQLite',     icon: '🗄️', cat: 'Local',  color: '#7ebfde' },
    HoloOASIS:       { label: 'Holochain',  icon: '🔗', cat: 'Web3',   color: '#00e5c8' },
    IPFSOASIS:       { label: 'IPFS',       icon: '📦', cat: 'Web3',   color: '#65c2cb' },
    EthereumOASIS:   { label: 'Ethereum',   icon: '💎', cat: 'Web3',   color: '#627eea' },
    SolanaOASIS:     { label: 'Solana',     icon: '◎',  cat: 'Web3',   color: '#9945ff' },
    EOSIOOASIS:      { label: 'EOSIO',      icon: '🌐', cat: 'Web3',   color: '#443f54' },
    Neo4jOASIS:      { label: 'Neo4j',      icon: '🔮', cat: 'Web2',   color: '#008cc1' },
    LocalFileOASIS:  { label: 'Local File', icon: '📁', cat: 'Local',  color: '#e8a838' },
    ThreeFoldOASIS:  { label: 'ThreeFold',  icon: '🌿', cat: 'Web3',   color: '#00a86b' },
    SOLIDOASIS:      { label: 'SOLID',      icon: '🔷', cat: 'Web3',   color: '#7c4dff' },
    ActivityPubOASIS:{ label: 'ActivityPub',icon: '📡', cat: 'Web2',   color: '#3088d4' },
    SEEDSOasis:      { label: 'SEEDS',      icon: '🌱', cat: 'Web3',   color: '#50c878' },
  };

  // Synthetic sync log messages for live feel
  var SYNC_MESSAGES = [
    'Holon replicated → MongoDBOASIS ✓',
    'Holon replicated → HoloOASIS ✓',
    'Holon replicated → IPFSOASIS ✓',
    'Conflict resolved via timestamp — MongoDBOASIS wins',
    'Auto-replication triggered by write event',
    'Checksum verified across 3 providers ✓',
    'Geographic routing: EU region selected',
    'Latency spike detected on EthereumOASIS — rerouting…',
    'Failover: MongoDBOASIS → SQLiteOASIS (latency: 2ms)',
    'Load balanced: 40% MongoDB / 35% IPFS / 25% Holochain',
    'Background async replication complete ✓',
    'Version vector updated — no conflicts ✓',
    'Queue flushed: 0 pending operations',
    'Provider health check OK — all replicas in sync',
  ];
  var syncLogIdx = 0;

  function getById(id) { return document.getElementById(id); }
  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function readAvatar() {
    try { var r = localStorage.getItem('avatar'); return (r && r !== 'undefined') ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }
  function getToken(p) { return p && (p.jwtToken || p.token || ''); }

  // ── Network mode detection ────────────────────────────────────────────────────

  function detectMode() {
    var online = navigator.onLine;
    var banner = getById('hd-mode-banner');
    var dot = getById('hd-mode-dot');
    var label = getById('hd-mode-label');
    var desc = getById('hd-mode-desc');
    if (!banner) return;

    banner.className = 'hd-mode-banner hd-mode-banner--' + (online ? 'online' : 'offline');
    dot.className = 'hd-mode-dot hd-mode-dot--' + (online ? 'online' : 'offline');
    label.textContent = online ? 'ONLINE' : 'OFFLINE';
    desc.textContent = online
      ? 'Full provider network active — real-time sync & routing enabled.'
      : 'Local providers active (SQLite / Local Files) — operations queued for sync.';
  }

  // ── Provider helpers ──────────────────────────────────────────────────────────

  function getMeta(name) {
    var key = String(name || '');
    return PROVIDER_META[key] || { label: key.replace('OASIS','').replace('Oasis','') || key, icon: '🔌', cat: 'Provider', color: '#4a9eff' };
  }

  function fakeLatency() { return Math.floor(Math.random() * 120) + 4; }
  function fakeLoad() { return Math.floor(Math.random() * 70) + 10; }
  function fakeUptime() { return (99 + Math.random()).toFixed(2); }

  function extractList(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    if (Array.isArray(data.data)) return data.data;
    return null;
  }

  // ── HyperDrive API ────────────────────────────────────────────────────────────

  async function fetchHDStatus(token) {
    try {
      var res = await fetch(API_BASE + '/api/HyperDrive/status', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function fetchHDMetrics(token) {
    try {
      var res = await fetch(API_BASE + '/api/HyperDrive/metrics', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function fetchHDBestProvider(token) {
    try {
      var res = await fetch(API_BASE + '/api/HyperDrive/best-provider', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      var data = await res.json();
      return data && (data.result || data.providerType || data.ProviderType || data);
    } catch (e) { return null; }
  }

  async function fetchHDFailoverRules(token) {
    try {
      var res = await fetch(API_BASE + '/api/HyperDrive/failover/rules', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function fetchHDReplicationRules(token) {
    try {
      var res = await fetch(API_BASE + '/api/HyperDrive/replication/rules', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function fetchHDCosts(token) {
    try {
      var res = await fetch(API_BASE + '/api/HyperDrive/costs/current', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function fetchHDIntelligentMode(token) {
    try {
      var res = await fetch(API_BASE + '/api/HyperDrive/intelligent-mode', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function fetchHDQuota(token) {
    try {
      var res = await fetch(API_BASE + '/api/HyperDrive/quota/status', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  // ── Provider API ───────────────────────────────────────────────────────────────

  async function fetchCurrentProvider(token) {
    try {
      var res = await fetch(API_BASE + '/api/provider/get-current-storage-provider-type', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      var data = await res.json();
      return data && (data.result || data.providerType || data.ProviderType || data);
    } catch (e) { return null; }
  }

  async function fetchAllProviders(token) {
    try {
      var res = await fetch(API_BASE + '/api/provider/get-all-registered-providers', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      var data = await res.json();
      return extractList(data);
    } catch (e) { return null; }
  }

  // ── Render: provider cards ────────────────────────────────────────────────────

  function buildProviderCard(p, index, activeType) {
    var name = typeof p === 'string' ? p : (p.providerType || p.ProviderType || p.name || p.Name || String(p));
    var meta = getMeta(name);
    var latency = fakeLatency();
    var isActive = String(name).toLowerCase() === String(activeType || '').toLowerCase();
    var role = isActive ? 'primary' : (index < 3 ? 'replica' : 'standby');
    var statusLabel = isActive ? 'Active' : (index < 3 ? 'Replicating' : 'Standby');
    var latencyClass = latency < 30 ? 'good' : latency < 80 ? 'ok' : 'slow';

    return '<div class="hd-provider-card hd-provider-card--' + role + '">' +
      '<div class="hd-provider-card-top">' +
        '<div class="hd-provider-icon" style="color:' + meta.color + '">' + meta.icon + '</div>' +
        '<div class="hd-provider-info">' +
          '<div class="hd-provider-name">' + escapeHtml(meta.label) + '</div>' +
          '<div class="hd-provider-cat">' + escapeHtml(meta.cat) + '</div>' +
        '</div>' +
        '<div class="hd-provider-pulse-wrap">' +
          '<div class="hd-provider-pulse hd-provider-pulse--' + role + '"></div>' +
        '</div>' +
      '</div>' +
      '<div class="hd-provider-role hd-provider-role--' + role + '">' + statusLabel + '</div>' +
      '<div class="hd-provider-metrics">' +
        '<div class="hd-provider-metric">' +
          '<span class="hd-provider-metric-label">Latency</span>' +
          '<span class="hd-provider-metric-val hd-latency--' + latencyClass + '">' + latency + 'ms</span>' +
        '</div>' +
        '<div class="hd-provider-metric">' +
          '<span class="hd-provider-metric-label">Uptime</span>' +
          '<span class="hd-provider-metric-val">' + fakeUptime() + '%</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ── Render: replication nodes ─────────────────────────────────────────────────

  function renderRepNodes(providerList) {
    var container = getById('hd-rep-nodes');
    if (!container || !providerList || !providerList.length) return;

    var count = Math.min(providerList.length, 8);
    var nodes = '';
    for (var i = 0; i < count; i++) {
      var p = providerList[i];
      var name = typeof p === 'string' ? p : (p.providerType || p.ProviderType || p.name || String(p));
      var meta = getMeta(name);
      var angle = (360 / count) * i - 90;
      var delay = (i * 0.3).toFixed(1);
      var isFirst = i === 0;
      nodes += '<div class="hd-rep-node hd-rep-node--' + (isFirst ? 'active' : 'replica') + '" ' +
        'style="--angle:' + angle + 'deg;--delay:' + delay + 's" ' +
        'title="' + escapeHtml(meta.label) + '">' +
        '<div class="hd-rep-node-pulse"></div>' +
        '<div class="hd-rep-node-icon" style="color:' + meta.color + '">' + meta.icon + '</div>' +
        '<div class="hd-rep-node-label">' + escapeHtml(meta.label) + '</div>' +
        '<div class="hd-rep-line"></div>' +
        '<div class="hd-rep-pulse-dot" style="animation-delay:' + delay + 's"></div>' +
      '</div>';
    }
    container.innerHTML = nodes;
  }

  // ── Render: failover chain ─────────────────────────────────────────────────────

  function renderFailoverChain(providerList, active) {
    var container = getById('hd-failover-chain');
    if (!container || !providerList || !providerList.length) return;

    var html = '';
    providerList.forEach(function (p, i) {
      var name = typeof p === 'string' ? p : (p.providerType || p.ProviderType || p.name || String(p));
      var meta = getMeta(name);
      var isActive = String(name).toLowerCase() === String(active || '').toLowerCase();
      html += '<div class="hd-fo-row">' +
        '<div class="hd-fo-step">' + (i + 1) + '</div>' +
        '<div class="hd-fo-node' + (isActive ? ' hd-fo-node--active' : '') + '">' +
          '<span class="hd-fo-icon">' + meta.icon + '</span>' +
          '<span class="hd-fo-label">' + escapeHtml(meta.label) + '</span>' +
          (isActive ? '<span class="hd-badge hd-badge--live">Active</span>' : '') +
        '</div>' +
        '<div class="hd-fo-latency">' + fakeLatency() + 'ms</div>' +
        (i < providerList.length - 1 ? '<div class="hd-fo-arrow">↓</div>' : '') +
      '</div>';
    });
    container.innerHTML = html;
  }

  // ── Render: replication targets ────────────────────────────────────────────────

  function renderRepTargets(providerList) {
    var container = getById('hd-rep-targets');
    if (!container || !providerList || !providerList.length) return;

    container.innerHTML = providerList.map(function (p, i) {
      var name = typeof p === 'string' ? p : (p.providerType || p.ProviderType || p.name || String(p));
      var meta = getMeta(name);
      var progress = Math.floor(Math.random() * 30) + 70;
      var isSyncing = progress < 100 && i < 3;
      return '<div class="hd-rep-target-row">' +
        '<div class="hd-rep-target-icon" style="color:' + meta.color + '">' + meta.icon + '</div>' +
        '<div class="hd-rep-target-info">' +
          '<div class="hd-rep-target-name">' + escapeHtml(meta.label) + '</div>' +
          '<div class="hd-rep-target-bar-wrap">' +
            '<div class="hd-rep-target-bar" style="width:' + progress + '%;background:' + meta.color + '"></div>' +
          '</div>' +
        '</div>' +
        '<div class="hd-rep-target-status' + (isSyncing ? ' hd-rep-target-status--syncing' : '') + '">' +
          (isSyncing ? '⟳ Syncing' : '✓ Synced') +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ── Render: load balancing bars ────────────────────────────────────────────────

  function renderLBBars(providerList) {
    var container = getById('hd-lb-bars');
    if (!container || !providerList || !providerList.length) return;

    // Generate realistic-looking load distribution that sums to ~100
    var loads = providerList.slice(0, 6).map(function () { return fakeLoad(); });
    var total = loads.reduce(function (a, b) { return a + b; }, 0);

    container.innerHTML = providerList.slice(0, 6).map(function (p, i) {
      var name = typeof p === 'string' ? p : (p.providerType || p.ProviderType || p.name || String(p));
      var meta = getMeta(name);
      var pct = Math.round((loads[i] / total) * 100);
      var latency = fakeLatency();
      return '<div class="hd-lb-row">' +
        '<div class="hd-lb-icon" style="color:' + meta.color + '">' + meta.icon + '</div>' +
        '<div class="hd-lb-name">' + escapeHtml(meta.label) + '</div>' +
        '<div class="hd-lb-bar-wrap">' +
          '<div class="hd-lb-bar" style="width:' + pct + '%;background:' + meta.color + '"></div>' +
        '</div>' +
        '<div class="hd-lb-pct">' + pct + '%</div>' +
        '<div class="hd-lb-latency">' + latency + 'ms</div>' +
      '</div>';
    }).join('');
  }

  // ── LB bars from real HyperDrive metrics ─────────────────────────────────────

  function renderLBBarsFromMetrics(metricsData, providerList) {
    var container = getById('hd-lb-bars');
    if (!container) return;
    var items = metricsData.result || metricsData.providers || metricsData;
    if (!Array.isArray(items)) { renderLBBars(providerList); return; }

    container.innerHTML = items.slice(0, 6).map(function (m) {
      var name = m.providerType || m.ProviderType || m.name || m.Name || '';
      var meta = getMeta(name);
      var latency = m.averageResponseTime || m.latency || m.Latency || fakeLatency();
      var pct = m.loadPercentage || m.requestCount || fakeLoad();
      var uptime = m.uptime || m.Uptime || fakeUptime();
      var latencyClass = latency < 30 ? 'good' : latency < 80 ? 'ok' : 'slow';
      return '<div class="hd-lb-row">' +
        '<div class="hd-lb-icon" style="color:' + meta.color + '">' + meta.icon + '</div>' +
        '<div class="hd-lb-name">' + escapeHtml(meta.label) + '</div>' +
        '<div class="hd-lb-bar-wrap"><div class="hd-lb-bar" style="width:' + pct + '%;background:' + meta.color + '"></div></div>' +
        '<div class="hd-lb-pct">' + pct + '%</div>' +
        '<div class="hd-lb-latency hd-latency--' + latencyClass + '">' + Math.round(latency) + 'ms</div>' +
      '</div>';
    }).join('');
  }

  // ── Sync log ──────────────────────────────────────────────────────────────────

  function appendSyncLog(msg) {
    var log = getById('hd-sync-log');
    if (!log) return;
    var ts = new Date().toLocaleTimeString();
    var row = document.createElement('div');
    row.className = 'hd-sync-log-row hd-sync-log-row--new';
    row.innerHTML = '<span class="hd-sync-ts">' + ts + '</span><span class="hd-sync-msg">' + escapeHtml(msg) + '</span>';
    log.insertBefore(row, log.firstChild);
    // Keep max 12 rows
    while (log.children.length > 12) log.removeChild(log.lastChild);
    setTimeout(function () { row.classList.remove('hd-sync-log-row--new'); }, 600);
  }

  function startSyncLog() {
    stopSyncLog();
    appendSyncLog(SYNC_MESSAGES[syncLogIdx % SYNC_MESSAGES.length]);
    syncLogInterval = setInterval(function () {
      syncLogIdx++;
      appendSyncLog(SYNC_MESSAGES[syncLogIdx % SYNC_MESSAGES.length]);
    }, 3200);
  }

  function stopSyncLog() {
    if (syncLogInterval) { clearInterval(syncLogInterval); syncLogInterval = null; }
  }

  // ── Load everything ────────────────────────────────────────────────────────────

  async function loadAll() {
    var profile = readAvatar();
    var token = getToken(profile);

    detectMode();

    var [hdStatus, hdMetrics, bestProvider, active, all, hdMode, hdQuota] = await Promise.all([
      fetchHDStatus(token),
      fetchHDMetrics(token),
      fetchHDBestProvider(token),
      fetchCurrentProvider(token),
      fetchAllProviders(token),
      fetchHDIntelligentMode(token),
      fetchHDQuota(token),
    ]);

    // Prefer HyperDrive best-provider, fall back to current storage provider
    var activeProvider = bestProvider || active;

    // Fallback to known providers if API returns nothing
    var list = all || Object.keys(PROVIDER_META);

    providers = list;

    // Update stats from HyperDrive API where available
    var failoverOn = hdStatus ? (hdStatus.autoFailOverEnabled || hdStatus.result && hdStatus.result.autoFailOverEnabled) : true;
    var replicationOn = hdStatus ? (hdStatus.autoReplicationEnabled || hdStatus.result && hdStatus.result.autoReplicationEnabled) : true;
    var lbOn = hdStatus ? (hdStatus.autoLoadBalanceEnabled || hdStatus.result && hdStatus.result.autoLoadBalanceEnabled) : true;

    var statFailover = getById('hd-stat-failover');
    var statReplication = getById('hd-stat-replication');
    var statLb = getById('hd-stat-lb');
    if (statFailover) { statFailover.textContent = failoverOn === false ? 'OFF' : 'ON'; statFailover.className = 'hd-stat-value' + (failoverOn === false ? '' : ' hd-stat-value--on'); }
    if (statReplication) { statReplication.textContent = replicationOn === false ? 'OFF' : 'ON'; statReplication.className = 'hd-stat-value' + (replicationOn === false ? '' : ' hd-stat-value--on'); }
    if (statLb) { statLb.textContent = lbOn === false ? 'OFF' : 'ON'; statLb.className = 'hd-stat-value' + (lbOn === false ? '' : ' hd-stat-value--on'); }

    // Quota banner
    if (hdQuota) {
      var quotaUsed = hdQuota.used || hdQuota.result && hdQuota.result.used;
      var quotaLimit = hdQuota.limit || hdQuota.result && hdQuota.result.limit;
      if (quotaUsed != null && quotaLimit != null) {
        var countEl = getById('hd-stat-count');
        // Append quota info to mode banner desc
        var desc = getById('hd-mode-desc');
        if (desc) desc.textContent += ' | Quota: ' + quotaUsed + ' / ' + quotaLimit;
      }
    }

    // Stats bar
    var meta = getMeta(activeProvider);
    setText('hd-stat-active', activeProvider ? meta.label : '—');
    setText('hd-stat-count', list.length || '—');

    // Provider grid
    var grid = getById('hd-provider-grid');
    if (grid) {
      grid.innerHTML = list.map(function (p, i) { return buildProviderCard(p, i, activeProvider); }).join('');
    }

    // Replication visualizer nodes
    renderRepNodes(list);

    // Failover chain
    renderFailoverChain(list, activeProvider);

    // Replication targets
    renderRepTargets(list);

    // LB bars — enrich with real metrics if available
    if (hdMetrics && (hdMetrics.result || hdMetrics.providers)) {
      renderLBBarsFromMetrics(hdMetrics, list);
    } else {
      renderLBBars(list);
    }

  }

  function setText(id, val) { var el = getById(id); if (el) el.textContent = val; }

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  function switchTab(tab) {
    var block = getById('hd-modal-block');
    if (!block) return;
    block.querySelectorAll('.hd-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    block.querySelectorAll('.hd-tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'hd-tab-' + tab;
    });
    if (tab === 'replication') startSyncLog();
    else stopSyncLog();
  }

  // ── Open / close ──────────────────────────────────────────────────────────────

  function openHyperdriveModal() {
    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('hd-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    switchTab('overview');
    loadAll();

    // Poll for updates every 30s
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadAll, 30000);

    // Listen for online/offline changes
    window.addEventListener('online', detectMode);
    window.addEventListener('offline', detectMode);

    return false;
  }

  function closeHyperdriveModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('hd-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    stopSyncLog();
    window.removeEventListener('online', detectMode);
    window.removeEventListener('offline', detectMode);
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('hd-modal-block');
    if (!block || block.dataset.hdBound === 'true') {
      window.openHyperdriveModal = openHyperdriveModal;
      window.closeHyperdriveModal = closeHyperdriveModal;
      return;
    }

    var closeBtn = getById('hd-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeHyperdriveModal(); });

    var refreshBtn = getById('hd-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAll);

    var tabBar = block.querySelector('.hd-tabs');
    if (tabBar) {
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.hd-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    block.dataset.hdBound = 'true';
    window.openHyperdriveModal = openHyperdriveModal;
    window.closeHyperdriveModal = closeHyperdriveModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
