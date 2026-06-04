(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var currentProvider = 'Solana';
  var currentTab = 'standard';
  var isFetching = false;

  function getById(id) { return document.getElementById(id); }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function readAvatar() {
    try {
      var raw = localStorage.getItem('avatar');
      return (raw && raw !== 'undefined') ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function getToken(profile) {
    return profile && (profile.jwtToken || profile.token || '');
  }

  function getAvatarId(profile) {
    return profile && (profile.id || profile.Id || profile.avatarId || profile.AvatarId || '');
  }

  // ── Status ──────────────────────────────────────────────────────────────────

  function showStatus(type, msg) {
    var el = getById('nft-modal-status');
    if (!el) return;
    el.className = 'nft-status nft-status--' + type;
    el.textContent = msg;
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('nft-modal-status');
    if (el) el.hidden = true;
  }

  // ── Card builders ────────────────────────────────────────────────────────────

  function buildNftCard(nft) {
    var name = escapeHtml(nft.name || nft.Name || nft.title || nft.Title || 'Unnamed NFT');
    var desc = escapeHtml(nft.description || nft.Description || '');
    var image = nft.image || nft.Image || nft.imageUrl || nft.ImageUrl || '';
    var hash = escapeHtml(nft.hash || nft.Hash || nft.mintAddress || nft.MintAddress || '');
    var provider = escapeHtml(nft.providerType || nft.ProviderType || currentProvider);

    var imgHtml = image
      ? '<img class="nft-card-img" src="' + escapeHtml(image) + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="nft-card-img nft-card-img--placeholder">🎴</div>';

    return '<div class="nft-card">' +
      imgHtml +
      '<div class="nft-card-body">' +
        '<div class="nft-card-name">' + name + '</div>' +
        (desc ? '<div class="nft-card-desc">' + desc + '</div>' : '') +
        (hash ? '<div class="nft-card-hash" title="' + hash + '">' + hash + '</div>' : '') +
        '<div class="nft-card-badge">' + provider + '</div>' +
      '</div>' +
    '</div>';
  }

  function buildGeoNftCard(nft) {
    var name = escapeHtml(nft.name || nft.Name || nft.title || nft.Title || 'Unnamed Geo-NFT');
    var desc = escapeHtml(nft.description || nft.Description || '');
    var lat = nft.lat || nft.Lat || nft.latitude || nft.Latitude || '';
    var lng = nft.lng || nft.Lng || nft.longitude || nft.Longitude || '';
    var image = nft.image || nft.Image || nft.imageUrl || nft.ImageUrl || '';

    var imgHtml = image
      ? '<img class="nft-card-img" src="' + escapeHtml(image) + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="nft-card-img nft-card-img--placeholder">🗺️</div>';

    var coords = (lat && lng)
      ? '<div class="nft-card-coords">📍 ' + escapeHtml(String(lat)) + ', ' + escapeHtml(String(lng)) + '</div>'
      : '';

    return '<div class="nft-card">' +
      imgHtml +
      '<div class="nft-card-body">' +
        '<div class="nft-card-name">' + name + '</div>' +
        (desc ? '<div class="nft-card-desc">' + desc + '</div>' : '') +
        coords +
        '<div class="nft-card-badge nft-card-badge--geo">Geo-NFT</div>' +
      '</div>' +
    '</div>';
  }

  function buildOlandCard(oland) {
    var id = escapeHtml(oland.id || oland.Id || oland.olandId || oland.OLandId || '');
    var name = escapeHtml(oland.name || oland.Name || ('OLAND #' + (id.slice(0, 6) || '?')));
    var lat = oland.lat || oland.Lat || oland.latitude || oland.Latitude || '';
    var lng = oland.lng || oland.Lng || oland.longitude || oland.Longitude || '';
    var size = oland.size || oland.Size || '';

    var coords = (lat && lng)
      ? '<div class="nft-card-coords">📍 ' + escapeHtml(String(lat)) + ', ' + escapeHtml(String(lng)) + '</div>'
      : '';

    return '<div class="nft-card">' +
      '<div class="nft-card-img nft-card-img--placeholder">🌍</div>' +
      '<div class="nft-card-body">' +
        '<div class="nft-card-name">' + name + '</div>' +
        (size ? '<div class="nft-card-desc">Size: ' + escapeHtml(String(size)) + '</div>' : '') +
        coords +
        '<div class="nft-card-badge nft-card-badge--oland">OLAND</div>' +
      '</div>' +
    '</div>';
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderGrid(gridId, emptyId, cards) {
    var grid = getById(gridId);
    var empty = getById(emptyId);
    if (!grid) return;

    var existing = grid.querySelectorAll('.nft-card');
    existing.forEach(function (el) { el.parentNode.removeChild(el); });

    if (!cards || !cards.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    grid.insertAdjacentHTML('beforeend', cards.join(''));
  }

  // ── API calls ────────────────────────────────────────────────────────────────

  async function fetchNfts(profile) {
    var avatarId = getAvatarId(profile);
    var token = getToken(profile);
    if (!avatarId || !token) return null;

    var url = API_BASE + '/api/Nft/load-all-nfts-for_avatar/' + encodeURIComponent(avatarId) + '/' + encodeURIComponent(currentProvider);
    try {
      var res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      var data = await res.json();
      return extractList(data);
    } catch (e) { return null; }
  }

  async function fetchGeoNfts(profile) {
    var avatarId = getAvatarId(profile);
    var token = getToken(profile);
    if (!avatarId || !token) return null;

    var url = API_BASE + '/api/Nft/load-all-geo-nfts-for-avatar/' + encodeURIComponent(avatarId) + '/' + encodeURIComponent(currentProvider);
    try {
      var res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      var data = await res.json();
      return extractList(data);
    } catch (e) { return null; }
  }

  async function fetchOlandPrice(token) {
    try {
      var res = await fetch(API_BASE + '/api/OLand/get-oland-price', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      var data = await res.json();
      return data && (data.price || data.Price || data.result || data.data || data);
    } catch (e) { return null; }
  }

  async function fetchOland(token) {
    try {
      var res = await fetch(API_BASE + '/api/OLand/load-all-olands', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return null;
      var data = await res.json();
      return extractList(data);
    } catch (e) { return null; }
  }

  function extractList(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.nfts)) return data.nfts;
    if (Array.isArray(data.items)) return data.items;
    return null;
  }

  // ── Load all data ────────────────────────────────────────────────────────────

  async function loadAll(profile) {
    if (isFetching) return;
    isFetching = true;
    showStatus('loading', 'Loading your NFTs from ' + currentProvider + '…');

    var token = getToken(profile);

    var [nfts, geoNfts, olandList, olandPrice] = await Promise.all([
      fetchNfts(profile),
      fetchGeoNfts(profile),
      fetchOland(token),
      fetchOlandPrice(token),
    ]);

    hideStatus();
    isFetching = false;

    // Standard NFTs
    var nftCards = nfts && nfts.length ? nfts.map(buildNftCard) : [];
    renderGrid('nft-grid', 'nft-empty-standard', nftCards);

    // Geo-NFTs
    var geoCards = geoNfts && geoNfts.length ? geoNfts.map(buildGeoNftCard) : [];
    renderGrid('nft-geo-grid', 'nft-empty-geo', geoCards);

    // OLAND
    var olandCards = olandList && olandList.length ? olandList.map(buildOlandCard) : [];
    renderGrid('nft-oland-grid', 'nft-empty-oland', olandCards);

    // OLAND price
    var priceEl = getById('nft-oland-price');
    var priceVal = getById('nft-oland-price-value');
    if (olandPrice != null && priceEl && priceVal) {
      priceVal.textContent = typeof olandPrice === 'object' ? JSON.stringify(olandPrice) : String(olandPrice);
      priceEl.hidden = false;
    }

    if (!nfts && !geoNfts && !olandList) {
      showStatus('warn', 'Could not load NFT data — API may be unavailable or your session may have expired.');
    }
  }

  // ── Tab switching ────────────────────────────────────────────────────────────

  function switchTab(tab) {
    currentTab = tab;
    var tabs = document.querySelectorAll('#nft-modal-block .nft-tab');
    var panels = document.querySelectorAll('#nft-modal-block .nft-tab-panel');
    tabs.forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    panels.forEach(function (p) {
      p.hidden = p.id !== 'nft-tab-' + tab;
    });
  }

  // ── Open / close ─────────────────────────────────────────────────────────────

  function openNftModal() {
    var loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
      if (typeof window.showCheckAPIMessage === 'function') window.showCheckAPIMessage();
      return false;
    }

    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var nftBlock = getById('nft-modal-block');
    if (!modal || !nftBlock) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    nftBlock.classList.add('is-selected');

    switchTab('standard');

    var profile = readAvatar();
    loadAll(profile);
    return false;
  }

  function closeNftModal() {
    var modal = document.querySelector('.js-modal');
    var nftBlock = getById('nft-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (nftBlock) nftBlock.classList.remove('is-selected');
  }

  // ── Bind ─────────────────────────────────────────────────────────────────────

  function bind() {
    var nftBlock = getById('nft-modal-block');
    if (!nftBlock || nftBlock.dataset.nftBound === 'true') {
      window.openNftModal = openNftModal;
      window.closeNftModal = closeNftModal;
      return;
    }

    var closeBtn = getById('nft-modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeNftModal();
      });
    }

    var refreshBtn = getById('nft-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        var profile = readAvatar();
        loadAll(profile);
      });
    }

    // Provider pills
    var pillsContainer = getById('nft-provider-pills');
    if (pillsContainer) {
      pillsContainer.addEventListener('click', function (e) {
        var pill = e.target.closest('.nft-provider-pill');
        if (!pill) return;
        pillsContainer.querySelectorAll('.nft-provider-pill').forEach(function (p) {
          p.classList.remove('is-active');
        });
        pill.classList.add('is-active');
        currentProvider = pill.dataset.provider;
        var profile = readAvatar();
        loadAll(profile);
      });
    }

    // Tabs
    var tabContainer = nftBlock.querySelector('.nft-tabs');
    if (tabContainer) {
      tabContainer.addEventListener('click', function (e) {
        var tab = e.target.closest('.nft-tab');
        if (!tab) return;
        switchTab(tab.dataset.tab);
      });
    }

    nftBlock.dataset.nftBound = 'true';
    window.openNftModal = openNftModal;
    window.closeNftModal = closeNftModal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.addEventListener('portal-components-ready', bind);
})();
