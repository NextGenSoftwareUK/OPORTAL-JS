(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var currentProvider = 'Solana';
  var currentTab = 'standard';
  var isFetching = false;
  var loadedNfts = [];

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
    // Top-of-modal status bar
    var el = getById('nft-modal-status');
    if (el) {
      el.className = 'nft-status nft-status--' + type;
      el.textContent = msg;
      el.hidden = false;
    }
    // In-form status (visible when scrolled to the form)
    var panel = getById('nft-action-panel');
    if (panel && !panel.hidden) {
      var activeForm = panel.querySelector('.nft-form-panel:not([hidden])');
      if (activeForm) {
        var formStatus = activeForm.querySelector('.nft-form-status');
        if (formStatus) {
          formStatus.className = 'nft-form-status nft-status nft-status--' + type;
          formStatus.textContent = msg;
          formStatus.hidden = false;
        }
      }
    }
  }

  function hideStatus() {
    var el = getById('nft-modal-status');
    if (el) el.hidden = true;
    document.querySelectorAll('.nft-form-status').forEach(function (s) { s.hidden = true; });
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
    if (!avatarId) return null;
    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.nft.loadAllWeb4NFTsForAvatarAsync({ avatarId: avatarId });
      /* OLD fetch:
      var url = API_BASE + '/api/Nft/load-all-nfts-for-avatar/' + encodeURIComponent(avatarId) + '/' + encodeURIComponent(currentProvider);
      var res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken(profile) } });
      if (!res.ok) return null; var data = await res.json(); return extractList(data);
      */
      return sdkRes.isError ? null : extractList(sdkRes.result);
    } catch (e) { return null; }
  }

  async function fetchGeoNfts(profile) {
    var avatarId = getAvatarId(profile);
    if (!avatarId) return null;
    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.nft.loadAllWeb4GeoNFTsForAvatarAsync({ avatarId: avatarId });
      /* OLD fetch:
      var url = API_BASE + '/api/Nft/load-all-geo-nfts-for-avatar/' + encodeURIComponent(avatarId) + '/' + encodeURIComponent(currentProvider);
      var res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken(profile) } });
      if (!res.ok) return null; var data = await res.json(); return extractList(data);
      */
      return sdkRes.isError ? null : extractList(sdkRes.result);
    } catch (e) { return null; }
  }

  async function fetchOlandPrice(token) {
    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.oLand.getOlandPrice();
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/OLand/get-oland-price', { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) return null; var data = await res.json();
      return data && (data.price || data.Price || data.result || data.data || data);
      */
      if (sdkRes.isError) return null;
      var d = sdkRes.result;
      return d && (d.price || d.Price || d) != null ? (d.price || d.Price || d) : null;
    } catch (e) { return null; }
  }

  async function fetchOland(token) {
    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.oLand.loadAllOlands();
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/OLand/load-all-olands', { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) return null; var data = await res.json(); return extractList(data);
      */
      return sdkRes.isError ? null : extractList(sdkRes.result);
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
    if (token && window.oasisClient) window.oasisClient.setToken(token);
    var hadError = false;

    async function safeFetch(fn) {
      try { return await fn(); } catch (e) { hadError = true; return null; }
    }

    var [nfts, geoNfts, olandList, olandPrice] = await Promise.all([
      safeFetch(function () { return fetchNfts(profile); }),
      safeFetch(function () { return fetchGeoNfts(profile); }),
      safeFetch(function () { return fetchOland(token); }),
      safeFetch(function () { return fetchOlandPrice(token); }),
    ]);

    hideStatus();
    isFetching = false;

    // Store for use in Place Geo-NFT form
    loadedNfts = nfts || [];

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

    if (hadError && !nfts && !geoNfts && !olandList) {
      showStatus('warn', 'Could not load NFT data — API may be unavailable or your session may have expired.');
    }
  }

  // ── Action panel ─────────────────────────────────────────────────────────────

  function showActionPanel(panelId) {
    var panel = getById('nft-action-panel');
    if (!panel) return;
    panel.querySelectorAll('.nft-form-panel').forEach(function (p) { p.hidden = true; });
    var target = getById(panelId);
    if (target) target.hidden = false;
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeActionPanel() {
    var panel = getById('nft-action-panel');
    if (panel) {
      panel.hidden = true;
      panel.querySelectorAll('.nft-form-panel').forEach(function (p) { p.hidden = true; });
    }
    hideStatus();
  }

  function populateNftSelect() {
    var select = getById('nft-place-nft-select');
    if (!select) return;
    var current = select.value;
    while (select.options.length > 1) select.remove(1);
    loadedNfts.forEach(function (nft) {
      var id = nft.id || nft.Id || nft.nftId || nft.NftId || '';
      if (!id) return;
      var label = nft.name || nft.Name || nft.title || nft.Title || id.slice(0, 12);
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      select.appendChild(opt);
    });
    if (current) select.value = current;
    if (!loadedNfts.length) {
      var opt = document.createElement('option');
      opt.disabled = true;
      opt.textContent = 'No NFTs loaded — refresh the wallet first';
      select.appendChild(opt);
    }
  }

  // ── API: Mint NFT ────────────────────────────────────────────────────────────

  async function apiMintNft(profile) {
    var titleEl = getById('nft-mint-title');
    var title = titleEl ? titleEl.value.trim() : '';
    if (!title) { showStatus('error', 'Title is required to mint an NFT.'); return; }

    var token = getToken(profile);
    if (!token) { showStatus('error', 'You must be logged in to mint an NFT.'); return; }

    var body = {
      title: title,
      description: (getById('nft-mint-desc') || {}).value || '',
      imageUrl: (getById('nft-mint-image-url') || {}).value || '',
      price: parseFloat((getById('nft-mint-price') || {}).value) || 0,
      symbol: (getById('nft-mint-symbol') || {}).value || '',
      numberToMint: parseInt((getById('nft-mint-quantity') || {}).value) || 1,
      memoText: (getById('nft-mint-memo') || {}).value || '',
      storeNFTMetaDataOnChain: false,
      waitTillNFTMinted: false
    };

    var btn = getById('nft-mint-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Minting…'; }
    showStatus('loading', 'Minting NFT…');

    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.nft.mintNftAsync(body);
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/Nft/mint-nft', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(body)
      });
      */
      if (!sdkRes.isError) {
        showStatus('success', 'NFT minted successfully!');
        closeActionPanel();
        loadAll(profile);
      } else {
        showStatus('error', 'Mint failed: ' + (sdkRes.message || 'Unknown error'));
      }
    } catch (e) {
      showStatus('error', 'Network error — could not reach the API.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Mint NFT'; }
    }
  }

  // ── API: Send NFT ────────────────────────────────────────────────────────────

  async function apiSendNft(profile) {
    var fromAddr = ((getById('nft-send-from') || {}).value || '').trim();
    var toAddr = ((getById('nft-send-to') || {}).value || '').trim();
    if (!fromAddr || !toAddr) {
      showStatus('error', 'From and To wallet addresses are required.');
      return;
    }

    var token = getToken(profile);
    if (!token) { showStatus('error', 'You must be logged in to send an NFT.'); return; }

    var body = {
      fromWalletAddress: fromAddr,
      toWalletAddress: toAddr,
      fromProvider: currentProvider,
      toProvider: currentProvider,
      amount: parseFloat((getById('nft-send-amount') || {}).value) || 0,
      memoText: (getById('nft-send-memo') || {}).value || '',
      waitTillNFTSent: false
    };

    var btn = getById('nft-send-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    showStatus('loading', 'Sending NFT…');

    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.nft.sendNFTAsync(body);
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/Nft/send-nft', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(body)
      });
      */
      if (!sdkRes.isError) {
        showStatus('success', 'NFT sent successfully!');
        closeActionPanel();
        loadAll(profile);
      } else {
        showStatus('error', 'Send failed: ' + (sdkRes.message || 'Unknown error'));
      }
    } catch (e) {
      showStatus('error', 'Network error — could not reach the API.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send NFT'; }
    }
  }

  // ── API: Place Geo-NFT ───────────────────────────────────────────────────────

  async function apiPlaceGeoNft(profile) {
    var nftId = ((getById('nft-place-nft-select') || {}).value || '').trim();
    var lat = parseFloat((getById('nft-place-lat') || {}).value);
    var lng = parseFloat((getById('nft-place-lng') || {}).value);

    if (!nftId) { showStatus('error', 'Please select an NFT to place.'); return; }
    if (isNaN(lat) || isNaN(lng)) { showStatus('error', 'Valid latitude and longitude are required.'); return; }

    var token = getToken(profile);
    if (!token) { showStatus('error', 'You must be logged in to place a Geo-NFT.'); return; }

    var body = {
      originalOASISNFTId: nftId,
      originalOASISNFTOffChainProvider: currentProvider,
      lat: lat,
      long: lng,
      allowOtherPlayersToAlsoCollect: !!((getById('nft-place-allow-collect') || {}).checked),
      permSpawn: !!((getById('nft-place-perm-spawn') || {}).checked),
      globalSpawnQuantity: parseInt((getById('nft-place-global-qty') || {}).value) || 1,
      playerSpawnQuantity: parseInt((getById('nft-place-player-qty') || {}).value) || 1,
      respawnDurationInSeconds: 0
    };

    var btn = getById('nft-place-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Placing…'; }
    showStatus('loading', 'Placing Geo-NFT on the map…');

    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.nft.placeGeoNFTAsync(body);
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/Nft/place-geo-nft', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(body)
      });
      */
      if (!sdkRes.isError) {
        showStatus('success', 'Geo-NFT placed on the map successfully!');
        closeActionPanel();
        loadAll(profile);
      } else {
        showStatus('error', 'Place failed: ' + (sdkRes.message || 'Unknown error'));
      }
    } catch (e) {
      showStatus('error', 'Network error — could not reach the API.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Place Geo-NFT'; }
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

    closeActionPanel();
    switchTab('standard');

    var profile = readAvatar();
    loadAll(profile);
    return false;
  }

  function closeNftModal() {
    closeActionPanel();
    var modal = document.querySelector('.js-modal');
    var nftBlock = getById('nft-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (nftBlock) nftBlock.classList.remove('is-selected');
  }

  // ── Bind ─────────────────────────────────────────────────────────────────────

  function exposeGlobals() {
    window.openNftModal = openNftModal;
    window.closeNftModal = closeNftModal;
    window.nftShowMintForm = function () { closeActionPanel(); showActionPanel('nft-form-mint'); };
    window.nftShowSendForm = function () { closeActionPanel(); showActionPanel('nft-form-send'); };
    window.nftShowPlaceForm = function () { populateNftSelect(); closeActionPanel(); showActionPanel('nft-form-place'); };
    window.nftCloseActionPanel = closeActionPanel;
    window.nftSubmitMint = function () { apiMintNft(readAvatar()); };
    window.nftSubmitSend = function () { apiSendNft(readAvatar()); };
    window.nftSubmitPlace = function () { apiPlaceGeoNft(readAvatar()); };
  }

  function bind() {
    var nftBlock = getById('nft-modal-block');
    if (!nftBlock || nftBlock.dataset.nftBound === 'true') {
      exposeGlobals();
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

    // Provider dropdown
    var providerSelect = getById('nft-provider-select');
    if (providerSelect) {
      providerSelect.addEventListener('change', function () {
        currentProvider = providerSelect.value;
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
    exposeGlobals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.addEventListener('portal-components-ready', bind);
})();
