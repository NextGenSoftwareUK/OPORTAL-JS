(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var currentProvider = 'all';
  var isFetching = false;

  function getById(id) { return document.getElementById(id); }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function readAvatar() {
    try { var r = localStorage.getItem('avatar'); return (r && r !== 'undefined') ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }

  function getToken(p) { return p && (p.jwtToken || p.token || ''); }

  // ── Status ───────────────────────────────────────────────────────────────────

  function showStatus(type, msg) {
    var el = getById('data-modal-status');
    if (!el) return;
    el.className = 'data-status data-status--' + type;
    el.textContent = msg;
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('data-modal-status');
    if (el) el.hidden = true;
  }

  // ── Holon card ────────────────────────────────────────────────────────────────

  function buildHolonCard(h, showDelete) {
    var id = escapeHtml(h.id || h.Id || h.holonId || h.HolonId || '');
    var name = escapeHtml(h.name || h.Name || h.title || h.Title || 'Unnamed Holon');
    var desc = escapeHtml(h.description || h.Description || '');
    var type = escapeHtml(h.holonType || h.HolonType || h.type || h.Type || '');
    var provider = escapeHtml(h.providerType || h.ProviderType || h.provider || h.Provider || '');
    var created = h.createdDate || h.CreatedDate || h.date || h.Date || '';
    var dateStr = '';
    if (created) {
      try { dateStr = new Date(created).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
      catch (e) { dateStr = escapeHtml(String(created)); }
    }

    var deleteBtn = showDelete && id
      ? '<button class="data-card-delete" onclick="window._dataDeleteHolon(\'' + id + '\')" title="Delete">&#x2715;</button>'
      : '';

    return '<div class="data-holon-card">' +
      '<div class="data-holon-card-header">' +
        '<div class="data-holon-card-name">' + name + '</div>' +
        deleteBtn +
      '</div>' +
      (desc ? '<div class="data-holon-card-desc">' + desc + '</div>' : '') +
      '<div class="data-holon-card-meta">' +
        (type ? '<span class="data-holon-badge">' + type + '</span>' : '') +
        (provider ? '<span class="data-holon-badge data-holon-badge--provider">' + provider + '</span>' : '') +
        (dateStr ? '<span class="data-holon-date">' + dateStr + '</span>' : '') +
      '</div>' +
      (id ? '<div class="data-holon-id" title="' + id + '">' + id + '</div>' : '') +
    '</div>';
  }

  function extractList(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.holons)) return data.holons;
    if (Array.isArray(data.items)) return data.items;
    // Single holon returned
    if (data.id || data.Id || data.name || data.Name) return [data];
    return null;
  }

  // ── Browse ────────────────────────────────────────────────────────────────────

  async function loadAllHolons() {
    if (isFetching) return;
    isFetching = true;
    showStatus('loading', 'Loading holons…');

    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatus('error', 'Please sign in to load holons.'); isFetching = false; return; }

    try {
      // SDK: @oasisomniverse/web4-api
      var body = currentProvider === 'all' ? {} : { providerType: currentProvider };
      var sdkRes = await window.oasisClient.data.loadAllHolons(body);
      /* OLD fetch:
      var path = currentProvider === 'all' ? '/api/data/load-all-holons/all'
        : '/api/data/load-all-holons/all/true/true/0/true/0/' + encodeURIComponent(currentProvider) + '/false';
      var res = await fetch(API_BASE + path, { headers: { 'Authorization': 'Bearer ' + token } });
      var data = res.ok ? await res.json() : null;
      */
      hideStatus();
      var list = sdkRes.isError ? null : extractList(sdkRes.result);
      _cachedBrowseList = list || [];
      renderBrowseGrid(list);
      if (!list) showStatus('warn', 'No holons returned from the API.');
    } catch (e) {
      hideStatus();
      showStatus('error', 'Network error loading holons.');
    } finally {
      isFetching = false;
    }
  }

  function renderBrowseGrid(list) {
    var grid = getById('data-browse-grid');
    var empty = getById('data-browse-empty');
    if (!grid) return;

    var existing = grid.querySelectorAll('.data-holon-card');
    existing.forEach(function (el) { el.parentNode.removeChild(el); });

    if (!list || !list.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    grid.insertAdjacentHTML('beforeend', list.map(function (h) { return buildHolonCard(h, true); }).join(''));
  }

  // ── Load by ID ────────────────────────────────────────────────────────────────

  async function loadHolonById(id, provider) {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatus('error', 'Please sign in first.'); return; }

    showStatus('loading', 'Loading holon…');
    var btn = getById('data-load-btn');
    if (btn) btn.disabled = true;

    try {
      // SDK: @oasisomniverse/web4-api
      var body = provider ? { id: id, providerType: provider } : { id: id };
      var sdkRes = await window.oasisClient.data.loadHolon(body);
      /* OLD fetch:
      var path = provider ? '/api/data/load-holon/' + encodeURIComponent(id) + '/true/true/0/true/0/' + encodeURIComponent(provider) + '/false' : '/api/data/load-holon/' + encodeURIComponent(id);
      var res = await fetch(API_BASE + path, { headers: { 'Authorization': 'Bearer ' + token } });
      var data = res.ok ? await res.json() : null;
      */
      hideStatus();
      var list = sdkRes.isError ? null : extractList(sdkRes.result);
      var resultEl = getById('data-load-result');
      if (resultEl) {
        if (list && list.length) {
          resultEl.innerHTML = list.map(function (h) { return buildHolonCard(h, false); }).join('');
        } else {
          resultEl.innerHTML = '<div class="data-empty"><div class="data-empty-icon">🔍</div><p>No holon found with that ID.</p></div>';
        }
      }
      // Only show red error for genuine API failures, not "not found"
      if (sdkRes.isError && list === null) {
        var msg = sdkRes.message || '';
        var isNotFound = /not found|no holon|404/i.test(msg);
        if (!isNotFound) showStatus('error', msg || 'Load failed.');
      }
    } catch (e) {
      showStatus('error', 'Network error loading holon.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function saveHolon(name, desc, type, provider, offchain) {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatus('error', 'Please sign in first.'); return; }

    if (offchain) {
      showStatus('info', 'Off-chain holon storage is coming soon — this feature is not yet live.');
      return;
    }

    // API expects { holon: { ... }, onChainProvider: "..." }
    var payload = {
      holon: { name: name, description: desc, holonType: Number(type) },
      saveChildren: true
    };
    if (provider) payload.onChainProvider = provider;

    showStatus('loading', 'Saving holon…');
    var btn = getById('data-save-btn');
    if (btn) btn.disabled = true;

    try {
      var sdkRes = await window.oasisClient.data.saveHolon(payload);
      if (!sdkRes.isError) {
        showStatus('success', sdkRes.message || 'Holon saved successfully.');
        setTimeout(hideStatus, 3500);
        loadAllHolons();
      } else {
        showStatus('error', sdkRes.message || 'Save failed.');
      }
    } catch (e) {
      showStatus('error', 'Network error saving holon.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  var _cachedBrowseList = null;

  async function searchHolons(query, inName, inDesc, inMeta, metaKey, metaVal) {
    var resultsEl = getById('data-search-results');
    if (!resultsEl) return;
    if (!query && !metaKey) { resultsEl.innerHTML = '<div class="data-empty"><div class="data-empty-icon">🔍</div><p>Enter a search term above.</p></div>'; return; }

    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatus('error', 'Please sign in first.'); return; }

    resultsEl.innerHTML = '<div class="data-empty"><div class="data-empty-icon" style="animation:spin 1s linear infinite">⌛</div><p>Searching…</p></div>';
    var btn = getById('data-search-btn');
    if (btn) btn.disabled = true;

    try {
      // Build SearchParams compatible with the OASIS search API
      var searchParams = {
        searchOnlyForCurrentAvatar: true,
        recursive: true,
        searchGroups: [{
          searchHolons: true,
          searchAvatars: false,
          holonSearchParams: {
            searchAllFields: !inName && !inDesc && !inMeta,
            name: inName,
            description: inDesc,
            metaData: inMeta,
            metaDataKey: metaKey || null
          }
        }]
      };
      if (metaKey && metaVal) {
        searchParams.filterByMetaData = {};
        searchParams.filterByMetaData[metaKey] = metaVal;
      }

      var sdkRes = await window.oasisClient.search.get(searchParams);
      var list = null;
      if (!sdkRes.isError) {
        var r = sdkRes.result || sdkRes;
        list = extractList(r.holons || r.results || r.holonResults || r) || extractList(sdkRes.result);
      }

      if (list && list.length) {
        renderSearchResults(list, query);
      } else {
        // Fall back to client-side filter on browse data
        renderSearchResults(clientSideSearch(query, inName, inDesc, inMeta, metaKey, metaVal), query);
      }
    } catch (e) {
      renderSearchResults(clientSideSearch(query, inName, inDesc, inMeta, metaKey, metaVal), query);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function clientSideSearch(query, inName, inDesc, inMeta, metaKey, metaVal) {
    var list = _cachedBrowseList;
    if (!list || !list.length) return [];
    var q = query ? query.toLowerCase() : '';
    return list.filter(function (h) {
      if (q) {
        var matched = false;
        if (inName && (h.name || h.Name || '').toLowerCase().includes(q)) matched = true;
        if (inDesc && (h.description || h.Description || '').toLowerCase().includes(q)) matched = true;
        if (inMeta) {
          var meta = h.metaData || h.MetaData || h.metadata || {};
          var metaStr = JSON.stringify(meta).toLowerCase();
          if (metaStr.includes(q)) matched = true;
        }
        if (!matched) return false;
      }
      if (metaKey) {
        var meta2 = h.metaData || h.MetaData || h.metadata || {};
        var val = meta2[metaKey] || meta2[metaKey.toLowerCase()];
        if (val === undefined) return false;
        if (metaVal && String(val).toLowerCase() !== metaVal.toLowerCase()) return false;
      }
      return true;
    });
  }

  function renderSearchResults(list, query) {
    var el = getById('data-search-results');
    if (!el) return;
    if (!list || !list.length) {
      el.innerHTML = '<div class="data-empty"><div class="data-empty-icon">🔍</div><p>No holons found' + (query ? ' matching <em>' + escapeHtml(query) + '</em>' : '') + '.</p></div>';
      return;
    }
    el.innerHTML = '<div class="data-search-count">' + list.length + ' result' + (list.length === 1 ? '' : 's') + '</div>' +
      list.map(function (h) { return buildHolonCard(h, false); }).join('');
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  window._dataDeleteHolon = async function (id) {
    if (!confirm('Delete this holon? This cannot be undone.')) return;
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) return;

    showStatus('loading', 'Deleting holon…');
    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.data.deleteHolon({ id: id });
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/data/delete-holon/' + encodeURIComponent(id), {
        method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
      });
      */
      if (!sdkRes.isError) {
        showStatus('success', 'Holon deleted.');
        setTimeout(function () { hideStatus(); loadAllHolons(); }, 1500);
      } else {
        showStatus('error', sdkRes.message || 'Delete failed.');
      }
    } catch (e) {
      showStatus('error', 'Network error deleting holon.');
    }
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  function switchTab(tab) {
    var block = getById('data-modal-block');
    if (!block) return;
    block.querySelectorAll('.data-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    block.querySelectorAll('.data-tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'data-tab-' + tab;
    });
  }

  // ── Open / close ─────────────────────────────────────────────────────────────

  function openDataModal() {
    var loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) { if (typeof window.showCheckAPIMessage === 'function') window.showCheckAPIMessage(); return false; }

    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('data-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    switchTab('browse');
    loadAllHolons();
    return false;
  }

  function closeDataModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('data-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('data-modal-block');
    if (!block || block.dataset.dataBound === 'true') {
      window.openDataModal = openDataModal;
      window.closeDataModal = closeDataModal;
      return;
    }

    var closeBtn = getById('data-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeDataModal(); });

    // Tabs
    var tabBar = block.querySelector('.data-tabs');
    if (tabBar) {
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.data-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    // Provider pills
    var pills = getById('data-provider-pills');
    if (pills) {
      pills.addEventListener('click', function (e) {
        var pill = e.target.closest('.data-provider-pill');
        if (!pill) return;
        pills.querySelectorAll('.data-provider-pill').forEach(function (p) { p.classList.remove('is-active'); });
        pill.classList.add('is-active');
        currentProvider = pill.dataset.provider;
        loadAllHolons();
      });
    }

    // Refresh
    var refreshBtn = getById('data-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAllHolons);

    // Load by ID form
    var loadForm = getById('data-load-form');
    if (loadForm) {
      loadForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var id = (getById('data-load-id') || {}).value.trim();
        var provider = ((getById('data-load-provider') || {}).value || '').trim();
        if (!id) return;
        loadHolonById(id, provider);
      });
    }

    // Save holon form
    var saveForm = getById('data-save-form');
    if (saveForm) {
      saveForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (getById('data-save-name') || {}).value.trim();
        var desc = (getById('data-save-desc') || {}).value.trim();
        var type = (getById('data-save-type') || {}).value || '0';
        var provider = (getById('data-save-provider') || {}).value || '';
        var offchain = !!(getById('data-save-offchain') || {}).checked;
        if (!name) { showStatus('error', 'Please enter a holon name.'); return; }
        saveHolon(name, desc, type, provider, offchain);
      });
    }

    // Off-chain form
    var offchainForm = getById('data-offchain-form');
    if (offchainForm) {
      offchainForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (getById('data-offchain-name') || {}).value.trim();
        var desc = (getById('data-offchain-desc') || {}).value.trim();
        var provider = (getById('data-offchain-provider') || {}).value || '';
        if (!name) { showStatus('error', 'Please enter a holon name.'); return; }
        saveHolon(name, desc, '0', provider, true);
      });
    }

    // Search form
    var searchForm = getById('data-search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var query = (getById('data-search-query') || {}).value.trim();
        var inName = !!(getById('data-search-in-name') || {}).checked;
        var inDesc = !!(getById('data-search-in-desc') || {}).checked;
        var inMeta = !!(getById('data-search-in-meta') || {}).checked;
        var metaKey = ((getById('data-search-meta-key') || {}).value || '').trim();
        var metaVal = ((getById('data-search-meta-val') || {}).value || '').trim();
        searchHolons(query, inName, inDesc, inMeta, metaKey, metaVal);
      });
      var metaChk = getById('data-search-in-meta');
      if (metaChk) {
        metaChk.addEventListener('change', function () {
          var show = metaChk.checked;
          var r1 = getById('data-search-meta-row');
          var r2 = getById('data-search-meta-val-row');
          if (r1) r1.style.display = show ? '' : 'none';
          if (r2) r2.style.display = show ? '' : 'none';
        });
      }
    }

    block.dataset.dataBound = 'true';
    window.openDataModal = openDataModal;
    window.closeDataModal = closeDataModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
