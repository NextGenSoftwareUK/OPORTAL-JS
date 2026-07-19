(function () {
  var API_BASE = window.apiUrl || window.API_BASE;

  function getById(id) { return document.getElementById(id); }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setText(id, val) {
    var el = getById(id); if (el) el.textContent = val;
  }

  function readAvatar() {
    try { var r = localStorage.getItem('avatar'); return (r && r !== 'undefined') ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }

  function getToken(p) { return p && (p.jwtToken || p.token || ''); }

  function showStatus(type, msg) {
    var el = getById('map-modal-status');
    if (!el) return;
    el.className = 'map-status map-status--' + type;
    el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : '');
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('map-modal-status');
    if (el) el.hidden = true;
  }

  function showStatusBrief(type, msg) {
    showStatus(type, msg);
    setTimeout(hideStatus, 3000);
  }

  // ── API helpers (SDK: @oasisomniverse/web4-api) ───────────────────────────────

  /* OLD helpers:
  async function apiFetch(path) { try { var res = await fetch(API_BASE + path); if (!res.ok) return null; return await res.json(); } catch (e) { return null; } }
  async function apiPost(path) { ... }
  */

  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.locations)) return data.locations;
    return [];
  }

  // ── Location card ─────────────────────────────────────────────────────────────

  function locationIcon(type) {
    var t = String(type || '').toLowerCase();
    if (t.includes('build') || t.includes('struct')) return '🏛️';
    if (t.includes('nature') || t.includes('park') || t.includes('forest')) return '🌳';
    if (t.includes('quest') || t.includes('mission')) return '⭐';
    return '📍';
  }

  function buildLocationCard(loc) {
    var name = loc.name || loc.Name || loc.title || loc.Title || 'Unknown Location';
    var desc = loc.description || loc.Description || '';
    var type = loc.type || loc.Type || loc.locationType || '';
    var dist = loc.distance || loc.Distance || loc.distanceMetres || null;
    var id = loc.id || loc.Id || loc.locationId || loc.LocationId || '';
    var icon = locationIcon(type);
    var distStr = dist != null ? '<div class="map-loc-dist">' + escapeHtml(String(dist)) + (typeof dist === 'number' ? 'm' : '') + '</div>' : '';

    return '<div class="map-loc-card">' +
      '<div class="map-loc-icon">' + icon + '</div>' +
      '<div class="map-loc-info">' +
        '<div class="map-loc-name">' + escapeHtml(name) + '</div>' +
        (desc ? '<div class="map-loc-desc">' + escapeHtml(desc) + '</div>' : '') +
        distStr +
      '</div>' +
      (id ? '<button class="button button--ghost map-visit-btn" data-id="' + escapeHtml(String(id)) + '" style="font-size:0.8rem;padding:4px 12px;">Visit</button>' : '') +
      '</div>';
  }

  // ── Nearby ────────────────────────────────────────────────────────────────────

  async function loadNearby() {
    var grid = getById('map-nearby-grid');
    if (grid) grid.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    // SDK: @oasisomniverse/web4-api
    var sdkRes = await window.oasisClient.map.getNearbyLocations().catch(function () { return { isError: true }; });
    /* OLD fetch: var data = await apiFetch('/api/map/nearby'); */
    var locs = sdkRes.isError ? [] : extractList(sdkRes.result);
    setText('map-stat-nearby', locs.length || '0');
    if (!grid) return;
    if (!locs.length) {
      grid.innerHTML = '<div class="map-empty"><div class="map-empty-icon">📍</div><p>No nearby locations found.</p></div>';
      return;
    }
    grid.innerHTML = locs.map(buildLocationCard).join('');
    bindVisitButtons(grid);
  }

  function bindVisitButtons(container) {
    container.querySelectorAll('.map-visit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { visitLocation(btn.dataset.id); });
    });
  }

  // ── Visit ─────────────────────────────────────────────────────────────────────

  async function visitLocation(id) {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatusBrief('warn', 'Please log in to record a visit.'); return; }
    // SDK: @oasisomniverse/web4-api
    var sdkRes = await window.oasisClient.map.visitLocation({ locationId: id }).catch(function () { return { isError: true }; });
    /* OLD fetch: var result = await apiPost('/api/map/visit/' + encodeURIComponent(id)); */
    if (!sdkRes.isError) {
      showStatusBrief('success', 'Visit recorded!');
      loadHistory();
    } else {
      showStatusBrief('error', 'Could not record visit.');
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  async function doSearch(query) {
    if (!query) return;
    var results = getById('map-search-results');
    if (results) results.innerHTML = '<div class="map-empty"><p>Searching…</p></div>';
    // SDK: @oasisomniverse/web4-api (POST)
    var sdkRes = await window.oasisClient.map.search({ query: query }).catch(function () { return { isError: true }; });
    /* OLD fetch: var data = await apiFetch('/api/map/search-locations?query=' + encodeURIComponent(query)); */
    var locs = sdkRes.isError ? [] : extractList(sdkRes.result);
    if (!results) return;
    if (!locs.length) {
      results.innerHTML = '<div class="map-empty"><p>No results for "' + escapeHtml(query) + '".</p></div>';
      return;
    }
    results.innerHTML = locs.map(buildLocationCard).join('');
    bindVisitButtons(results);
  }

  // ── Visit history ─────────────────────────────────────────────────────────────

  function buildHistoryRow(visit) {
    var name = visit.locationName || visit.name || visit.Name || visit.title || 'Unknown Location';
    var date = visit.visitedAt || visit.VisitedAt || visit.date || visit.Date || visit.createdDate || '';
    var type = visit.type || visit.locationType || '';
    var icon = locationIcon(type);
    var dateStr = '';
    if (date) {
      try { dateStr = new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
      catch (e) { dateStr = escapeHtml(String(date)); }
    }
    return '<div class="map-history-row">' +
      '<div class="map-history-icon">' + icon + '</div>' +
      '<div class="map-history-info">' +
        '<div class="map-history-name">' + escapeHtml(name) + '</div>' +
        (dateStr ? '<div class="map-history-date">' + dateStr + '</div>' : '') +
      '</div>' +
      '</div>';
  }

  async function loadHistory() {
    var list = getById('map-history-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    // SDK: @oasisomniverse/web4-api
    var sdkRes = await window.oasisClient.map.getVisitHistory().catch(function () { return { isError: true }; });
    /* OLD fetch: var data = await apiFetch('/api/map/visit-history'); */
    var visits = sdkRes.isError ? [] : extractList(sdkRes.result);
    setText('map-stat-visits', visits.length || '0');
    if (!list) return;
    if (!visits.length) {
      list.innerHTML = '<div class="map-empty"><div class="map-empty-icon">🗺️</div><p>No visit history yet.</p></div>';
      return;
    }
    list.innerHTML = visits.map(buildHistoryRow).join('');
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  async function loadStats() {
    var grid = getById('map-stats-grid');
    // SDK: @oasisomniverse/web4-api
    var sdkRes = await window.oasisClient.map.getMapStats().catch(function () { return { isError: true }; });
    /* OLD fetch: var data = await apiFetch('/api/map/stats'); */
    var data = sdkRes.isError ? null : sdkRes.result;
    var s = data && (data.result || data);
    if (s && typeof s === 'object') {
      var holons = s.holonsOnMap || s.HolonsOnMap || s.totalHolons || null;
      if (holons != null) setText('map-stat-holons', holons);
    }
    if (!grid) return;
    if (!s || typeof s !== 'object') {
      grid.innerHTML = '<div class="map-empty"><p>No stats available.</p></div>';
      return;
    }
    var entries = Object.entries(s).filter(function (kv) {
      return typeof kv[1] !== 'object' || kv[1] == null;
    });
    grid.innerHTML = entries.map(function (kv) {
      return '<div class="map-stat-card">' +
        '<div class="map-stat-card-label">' + escapeHtml(kv[0]) + '</div>' +
        '<div class="map-stat-card-value">' + escapeHtml(String(kv[1])) + '</div>' +
        '</div>';
    }).join('') || '<div class="map-empty"><p>No stats available.</p></div>';
  }

  // ── Map controls ──────────────────────────────────────────────────────────────

  async function mapControl(sdkCall) {
    // SDK call passed as a promise
    try {
      var sdkRes = await sdkCall;
      /* OLD: var result = await apiFetch('/api/map/' + endpoint); */
      if (!sdkRes.isError) { showStatusBrief('success', 'Map control applied.'); }
      else { showStatusBrief('error', 'Map control failed.'); }
    } catch (e) { showStatusBrief('error', 'Map control failed.'); }
  }

  function getZoomVal() { var el = getById('map-zoom-value'); return el ? (parseInt(el.value, 10) || 1) : 1; }
  function getPanVal() { var el = getById('map-pan-value'); return el ? (parseInt(el.value, 10) || 10) : 10; }

  // ── Load all ──────────────────────────────────────────────────────────────────

  async function loadAll() {
    await Promise.all([loadNearby(), loadHistory(), loadStats()]);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  function switchTab(tab) {
    var block = getById('map-modal-block');
    if (!block) return;
    block.querySelectorAll('.map-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    block.querySelectorAll('.map-tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'map-tab-' + tab;
    });
    if (tab === 'stats') loadStats();
  }

  // ── Open / close ──────────────────────────────────────────────────────────────

  function openMapModal() {
    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('map-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    switchTab('nearby');
    loadAll();
    return false;
  }

  function closeMapModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('map-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('map-modal-block');
    if (!block || block.dataset.mapBound === 'true') {
      window.openMapModal = openMapModal;
      window.closeMapModal = closeMapModal;
      return;
    }

    var closeBtn = getById('map-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeMapModal(); });

    var refreshBtn = getById('map-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadNearby);

    var tabBar = block.querySelector('.map-tabs');
    if (tabBar) {
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.map-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    var searchBtn = getById('map-search-btn');
    if (searchBtn) searchBtn.addEventListener('click', function () {
      var inp = getById('map-search-input');
      if (inp) doSearch(inp.value.trim());
    });

    var searchInput = getById('map-search-input');
    if (searchInput) searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch(searchInput.value.trim());
    });

    // Zoom controls — SDK: @oasisomniverse/web4-api
    var zoomIn = getById('map-zoom-in-btn');
    if (zoomIn) zoomIn.addEventListener('click', function () { mapControl(window.oasisClient.map.zoomMapIn({ value: getZoomVal() })); });

    var zoomOut = getById('map-zoom-out-btn');
    if (zoomOut) zoomOut.addEventListener('click', function () { mapControl(window.oasisClient.map.zoomMapOut({ value: getZoomVal() })); });

    // Pan controls (SDK uses pamMapUp/Down/Left/Right)
    var panUp = getById('map-pan-up-btn');
    if (panUp) panUp.addEventListener('click', function () { mapControl(window.oasisClient.map.pamMapUp({ value: getPanVal() })); });

    var panDown = getById('map-pan-down-btn');
    if (panDown) panDown.addEventListener('click', function () { mapControl(window.oasisClient.map.pamMapDown({ value: getPanVal() })); });

    var panLeft = getById('map-pan-left-btn');
    if (panLeft) panLeft.addEventListener('click', function () { mapControl(window.oasisClient.map.pamMapLeft({ value: getPanVal() })); });

    var panRight = getById('map-pan-right-btn');
    if (panRight) panRight.addEventListener('click', function () { mapControl(window.oasisClient.map.pamMapRight({ value: getPanVal() })); });

    // Select holon
    var selectHolonBtn = getById('map-select-holon-btn');
    if (selectHolonBtn) selectHolonBtn.addEventListener('click', function () {
      var inp = getById('map-select-holon');
      if (inp && inp.value.trim()) mapControl(window.oasisClient.map.selectHolonOnMap({ holon: inp.value.trim() }));
    });

    // Zoom to holon
    var zoomHolonBtn = getById('map-zoom-holon-btn');
    if (zoomHolonBtn) zoomHolonBtn.addEventListener('click', function () {
      var inp = getById('map-zoom-holon');
      if (inp && inp.value.trim()) mapControl(window.oasisClient.map.zoomToHolonOnMap({ holon: inp.value.trim() }));
    });

    // Highlight building
    var highlightBtn = getById('map-highlight-building-btn');
    if (highlightBtn) highlightBtn.addEventListener('click', function () {
      var inp = getById('map-highlight-building');
      if (inp && inp.value.trim()) mapControl(window.oasisClient.map.highlightBuildingOnMap({ building: inp.value.trim() }));
    });

    block.dataset.mapBound = 'true';
    window.openMapModal = openMapModal;
    window.closeMapModal = closeMapModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
