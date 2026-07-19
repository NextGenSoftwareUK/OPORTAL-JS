(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var isFetching = false;
  var lastQuery = '';

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
    var el = getById('search-modal-status');
    if (!el) return;
    el.className = 'search-status search-status--' + type;
    el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : '');
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('search-modal-status');
    if (el) el.hidden = true;
  }

  // ── Card builder ─────────────────────────────────────────────────────────────

  function buildAvatarCard(a) {
    var username = escapeHtml(a.username || a.userName || a.UserName || '');
    var displayName = escapeHtml(
      [a.title || a.Title, a.firstName || a.FirstName, a.lastName || a.LastName]
        .filter(Boolean).join(' ').trim() || username || 'Unknown'
    );
    var email = escapeHtml(a.email || a.Email || '');
    var avatarType = escapeHtml(a.avatarType || a.AvatarType || a.avatarTypeName || 'User');
    if (/^\d+$/.test(avatarType)) avatarType = 'User';
    var karma = a.karma || a.Karma || a.karmaPoints || '';
    var level = a.level || a.Level || a.rank || '';

    return '<div class="search-avatar-card">' +
      '<div class="search-avatar-card-avatar">👤</div>' +
      '<div class="search-avatar-card-body">' +
        '<div class="search-avatar-card-name">' + displayName + '</div>' +
        (username && username !== displayName ? '<div class="search-avatar-card-username">@' + username + '</div>' : '') +
        (email ? '<div class="search-avatar-card-email">' + email + '</div>' : '') +
        '<div class="search-avatar-card-meta">' +
          '<span class="search-avatar-badge">' + avatarType + '</span>' +
          (level ? '<span class="search-avatar-badge search-avatar-badge--level">Lv ' + escapeHtml(String(level)) + '</span>' : '') +
          (karma ? '<span class="search-avatar-badge search-avatar-badge--karma">Karma: ' + escapeHtml(String(karma)) + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function extractList(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.avatars)) return data.avatars;
    if (Array.isArray(data.items)) return data.items;
    return null;
  }

  // ── API calls ─────────────────────────────────────────────────────────────────

  async function doSearch(query, searchAllProviders) {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatus('error', 'You must be signed in to search avatars.'); return; }

    isFetching = true;
    showStatus('loading', 'Searching…');

    var btn = getById('search-avatar-btn');
    if (btn) btn.disabled = true;

    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.avatar.searchAvatar({ SearchQuery: query, SearchAllProviders: !!searchAllProviders });
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/Avatar/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ SearchQuery: query, SearchAllProviders: !!searchAllProviders })
      });
      var data = {}; try { data = await res.json(); } catch (e) {}
      if (!res.ok) { showStatus('error', (data && (data.message || data.error)) || 'Search failed.'); renderResults(null, query); return; }
      */
      if (sdkRes.isError) {
        showStatus('error', sdkRes.message || 'Search failed. Please try again.');
        renderResults(null, query);
        return;
      }
      hideStatus();
      var list = extractList(sdkRes.result);
      renderResults(list, query);
    } catch (e) {
      showStatus('error', 'Network error — could not reach the API.');
      renderResults(null, query);
    } finally {
      isFetching = false;
      if (btn) btn.disabled = false;
    }
  }

  async function loadAll() {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) return;

    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.avatar.getAll();
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/Avatar/get-all-avatars', { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) return;
      var data = await res.json();
      var list = extractList(data);
      renderBrowse(list);
      */
      if (!sdkRes.isError) renderBrowse(extractList(sdkRes.result));
    } catch (e) {}
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  function renderResults(list, query) {
    var wrap = getById('search-results-wrap');
    var browseWrap = getById('search-browse-wrap');
    var grid = getById('search-results-grid');
    var countEl = getById('search-results-count');

    if (!wrap || !grid) return;

    if (!list) {
      wrap.hidden = true;
      if (browseWrap) browseWrap.hidden = false;
      return;
    }

    if (browseWrap) browseWrap.hidden = true;
    wrap.hidden = false;

    if (countEl) {
      countEl.textContent = list.length
        ? list.length + ' result' + (list.length !== 1 ? 's' : '') + ' for "' + escapeHtml(query) + '"'
        : 'No results for "' + escapeHtml(query) + '"';
    }

    if (!list.length) {
      grid.innerHTML = '<div class="search-empty"><div class="search-empty-icon">🔍</div><p>No avatars found matching your search.<br>Try a different name or username.</p></div>';
      return;
    }

    grid.innerHTML = list.map(buildAvatarCard).join('');
  }

  function renderBrowse(list) {
    var grid = getById('search-browse-grid');
    if (!grid) return;
    if (!list || !list.length) return;
    grid.innerHTML = list.map(buildAvatarCard).join('');
  }

  // ── Open / close ─────────────────────────────────────────────────────────────

  function openSearchModal() {
    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('search-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    var input = getById('search-avatar-input');
    if (input) { input.value = ''; setTimeout(function () { input.focus(); }, 80); }

    hideStatus();
    var resultsWrap = getById('search-results-wrap');
    if (resultsWrap) resultsWrap.hidden = true;
    var browseWrap = getById('search-browse-wrap');
    if (browseWrap) browseWrap.hidden = false;

    loadAll();
    return false;
  }

  function closeSearchModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('search-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('search-modal-block');
    if (!block || block.dataset.searchBound === 'true') {
      window.openSearchModal = openSearchModal;
      window.closeSearchModal = closeSearchModal;
      return;
    }

    var closeBtn = getById('search-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeSearchModal(); });

    var form = getById('search-avatar-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (isFetching) return;
        var input = getById('search-avatar-input');
        var allProviders = getById('search-all-providers');
        var query = input ? input.value.trim() : '';
        if (!query) return;
        lastQuery = query;
        doSearch(query, allProviders ? allProviders.checked : true);
      });
    }

    block.dataset.searchBound = 'true';
    window.openSearchModal = openSearchModal;
    window.closeSearchModal = closeSearchModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
