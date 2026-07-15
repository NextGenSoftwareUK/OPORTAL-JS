(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var currentProvider = 'Solana';
  var currentTab = 'standard';
  var isFetching = false;
  var loadedNfts = [];
  var groupByCollection = false;
  var activeDetailNft = null;

  function getById(id) { return document.getElementById(id); }

  // Expose globals immediately so the router can call openNftModal() even if
  // portal-components-ready fires before bind() runs (race condition on refresh).
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
    return profile && (profile.avatarId || profile.AvatarId || profile.id || profile.Id || '');
  }

  function shortAddr(str, len) {
    len = len || 8;
    if (!str || str.length <= len * 2 + 3) return str || '';
    return str.slice(0, len) + '…' + str.slice(-len);
  }

  function formatDate(val) {
    if (!val) return '';
    try {
      var d = new Date(val);
      if (isNaN(d.getTime()) || d.getFullYear() < 2000) return '';
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return String(val); }
  }

  function solanaExplorerUrl(type, value) {
    if (!value) return '';
    var base = 'https://explorer.solana.com/';
    if (type === 'tx') return base + 'tx/' + encodeURIComponent(value);
    return base + 'address/' + encodeURIComponent(value);
  }

  function copyToClipboard(text, btn) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = orig; }, 1500);
    }).catch(function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = orig; }, 1500);
    });
  }

  // ── Status ──────────────────────────────────────────────────────────────────

  function showStatus(type, msg) {
    var el = getById('nft-modal-status');
    if (el) {
      el.className = 'nft-status nft-status--' + type;
      el.textContent = msg;
      el.hidden = false;
    }
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
    var detailStatus = getById('nft-detail-send-status');
    if (detailStatus && getById('nft-detail-panel') && !getById('nft-detail-panel').hidden) {
      detailStatus.className = 'nft-form-status nft-status nft-status--' + type;
      detailStatus.textContent = msg;
      detailStatus.hidden = false;
    }
  }

  function hideStatus() {
    var el = getById('nft-modal-status');
    if (el) el.hidden = true;
    document.querySelectorAll('.nft-form-status').forEach(function (s) { s.hidden = true; });
  }

  // ── Card builders ────────────────────────────────────────────────────────────

  function getNftImage(nft) {
    return nft.image || nft.Image || nft.imageUrl || nft.ImageUrl || nft.thumbnailUrl || nft.ThumbnailUrl || '';
  }

  function getNftTitle(nft) {
    return nft.name || nft.Name || nft.title || nft.Title || 'Unnamed NFT';
  }

  function buildNftCard(nft, index) {
    var name = escapeHtml(getNftTitle(nft));
    var desc = escapeHtml(nft.description || nft.Description || '');
    var image = getNftImage(nft);
    var provider = escapeHtml(
      (nft.onChainProvider && (nft.onChainProvider.name || nft.onChainProvider.value)) ||
      nft.providerType || nft.ProviderType || currentProvider
    );
    var forSale = nft.isForSale || nft.IsForSale;

    var imgHtml = image
      ? '<img class="nft-card-img" src="' + escapeHtml(image) + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="nft-card-img nft-card-img--placeholder">🎴</div>';

    var saleTag = forSale ? '<span class="nft-card-sale-tag">For Sale</span>' : '';

    return '<div class="nft-card nft-card--clickable" data-nft-index="' + index + '" role="button" tabindex="0" aria-label="View details for ' + name + '">' +
      '<div class="nft-card-img-wrap">' + imgHtml + saleTag + '</div>' +
      '<div class="nft-card-body">' +
        '<div class="nft-card-name">' + name + '</div>' +
        (desc ? '<div class="nft-card-desc">' + desc + '</div>' : '') +
        '<div class="nft-card-badge">' + provider + '</div>' +
      '</div>' +
    '</div>';
  }

  function buildCollectionCard(key, nfts) {
    var sample = nfts[0];
    var image = getNftImage(sample);
    var name = escapeHtml(sample.collectionName || sample.CollectionName || getNftTitle(sample));
    var count = nfts.length;
    var keyEsc = escapeHtml(key);

    var imgHtml = image
      ? '<img class="nft-card-img" src="' + escapeHtml(image) + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="nft-card-img nft-card-img--placeholder">🗂️</div>';

    return '<div class="nft-card nft-card--collection nft-card--clickable" data-collection-key="' + keyEsc + '" role="button" tabindex="0" aria-label="Expand collection ' + name + '">' +
      '<div class="nft-card-img-wrap">' + imgHtml + '<span class="nft-card-count-badge">' + count + '</span></div>' +
      '<div class="nft-card-body">' +
        '<div class="nft-card-name">' + name + '</div>' +
        '<div class="nft-card-desc">' + count + ' NFT' + (count !== 1 ? 's' : '') + '</div>' +
        '<div class="nft-card-badge">Collection</div>' +
      '</div>' +
    '</div>';
  }

  function buildCollectionExpanded(key, nfts, baseIndex) {
    var keyEsc = escapeHtml(key);
    var cards = nfts.map(function (nft, i) { return buildNftCard(nft, baseIndex + i); }).join('');
    return '<div class="nft-collection-expanded" data-collection-expanded="' + keyEsc + '">' +
      '<div class="nft-collection-expanded-header">' +
        '<button class="nft-collection-collapse-btn" data-collection-key="' + keyEsc + '">&#8592; Back to Collections</button>' +
      '</div>' +
      '<div class="nft-grid nft-grid--inner">' + cards + '</div>' +
    '</div>';
  }

  function buildGeoNftCard(nft) {
    var name = escapeHtml(nft.name || nft.Name || nft.title || nft.Title || 'Unnamed Geo-NFT');
    var desc = escapeHtml(nft.description || nft.Description || '');
    var lat = nft.lat || nft.Lat || nft.latitude || nft.Latitude || '';
    var lng = nft.lng || nft.Lng || nft.longitude || nft.Longitude || '';
    var image = getNftImage(nft);

    var imgHtml = image
      ? '<img class="nft-card-img" src="' + escapeHtml(image) + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="nft-card-img nft-card-img--placeholder">🗺️</div>';

    var coords = (lat && lng)
      ? '<div class="nft-card-coords">📍 ' + escapeHtml(String(lat)) + ', ' + escapeHtml(String(lng)) + '</div>'
      : '';

    return '<div class="nft-card">' +
      '<div class="nft-card-img-wrap">' + imgHtml + '</div>' +
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
      '<div class="nft-card-img-wrap"><div class="nft-card-img nft-card-img--placeholder">🌍</div></div>' +
      '<div class="nft-card-body">' +
        '<div class="nft-card-name">' + name + '</div>' +
        (size ? '<div class="nft-card-desc">Size: ' + escapeHtml(String(size)) + '</div>' : '') +
        coords +
        '<div class="nft-card-badge nft-card-badge--oland">OLAND</div>' +
      '</div>' +
    '</div>';
  }

  // ── Detail panel ─────────────────────────────────────────────────────────────

  function makeRow(label, value, opts) {
    if (!value && value !== 0) return '';
    opts = opts || {};
    var valHtml;
    if (opts.link) {
      valHtml = '<a class="nft-detail-link" href="' + escapeHtml(opts.link) + '" target="_blank" rel="noopener">' +
        escapeHtml(value) + ' <span class="nft-detail-ext-icon">↗</span></a>';
    } else if (opts.mono) {
      valHtml = '<span class="nft-detail-mono" title="' + escapeHtml(String(value)) + '">' + escapeHtml(shortAddr(String(value), 10)) + '</span>';
      if (opts.copyable) {
        valHtml += '<button class="nft-copy-btn" data-copy="' + escapeHtml(String(value)) + '">Copy</button>';
      }
    } else {
      valHtml = '<span>' + escapeHtml(String(value)) + '</span>';
    }
    return '<div class="nft-detail-row">' +
      '<span class="nft-detail-row-label">' + escapeHtml(label) + '</span>' +
      '<span class="nft-detail-row-value">' + valHtml + '</span>' +
    '</div>';
  }

  function showNftDetail(nft) {
    activeDetailNft = nft;

    var panel = getById('nft-detail-panel');
    var tabPanels = document.querySelectorAll('#nft-modal-block .nft-tab-panel');
    if (!panel) return;

    tabPanels.forEach(function (p) { p.hidden = true; });

    var imgEl = getById('nft-detail-img');
    var imgPh = getById('nft-detail-img-placeholder');
    var image = getNftImage(nft);
    if (image && imgEl) {
      imgEl.src = image;
      imgEl.alt = getNftTitle(nft);
      imgEl.hidden = false;
      if (imgPh) imgPh.hidden = true;
    } else {
      if (imgEl) imgEl.hidden = true;
      if (imgPh) imgPh.hidden = false;
    }

    var titleEl = getById('nft-detail-title');
    if (titleEl) titleEl.textContent = getNftTitle(nft);

    var descEl = getById('nft-detail-desc');
    if (descEl) {
      descEl.textContent = nft.description || nft.Description || '';
      descEl.hidden = !descEl.textContent;
    }

    // Badges
    var badgesEl = getById('nft-detail-badges');
    if (badgesEl) {
      var badges = [];
      if (nft.isForSale || nft.IsForSale) badges.push('<span class="nft-detail-badge nft-detail-badge--sale">For Sale</span>');
      if (nft.nftStandardType && nft.nftStandardType.name) badges.push('<span class="nft-detail-badge">' + escapeHtml(nft.nftStandardType.name) + '</span>');
      if (nft.price) badges.push('<span class="nft-detail-badge nft-detail-badge--price">' + escapeHtml(String(nft.price)) + ' SOL</span>');
      badgesEl.innerHTML = badges.join('');
    }

    // Build detail rows
    var rows = '';
    var w3 = (nft.web3NFTs && nft.web3NFTs[0]) || {};
    var mintHash = w3.mintTransactionHash || nft.mintTransactionHash || nft.MintTransactionHash || '';
    var sendHash = w3.sendNFTTransactionHash || nft.sendNFTTransactionHash || '';
    var tokenAddr = w3.nftTokenAddress || nft.nftTokenAddress || nft.NftTokenAddress || nft.mintAddress || '';
    var collKey = nft.collectionPublicKey || nft.CollectionPublicKey || '';
    var walletAddr = nft.sendToAddressAfterMinting || nft.SendToAddressAfterMinting || '';

    if (mintHash) {
      rows += '<div class="nft-detail-row">' +
        '<span class="nft-detail-row-label">Mint Tx</span>' +
        '<span class="nft-detail-row-value">' +
          '<a class="nft-detail-link nft-detail-link--hash" href="' + escapeHtml(solanaExplorerUrl('tx', mintHash)) + '" target="_blank" rel="noopener">' +
            escapeHtml(mintHash) + ' <span class="nft-detail-ext-icon">↗</span></a>' +
          '<button class="nft-copy-btn" data-copy="' + escapeHtml(mintHash) + '">Copy</button>' +
        '</span>' +
      '</div>';
    }
    if (sendHash) {
      rows += '<div class="nft-detail-row">' +
        '<span class="nft-detail-row-label">Send Tx</span>' +
        '<span class="nft-detail-row-value">' +
          '<a class="nft-detail-link nft-detail-link--hash" href="' + escapeHtml(solanaExplorerUrl('tx', sendHash)) + '" target="_blank" rel="noopener">' +
            escapeHtml(sendHash) + ' <span class="nft-detail-ext-icon">↗</span></a>' +
          '<button class="nft-copy-btn" data-copy="' + escapeHtml(sendHash) + '">Copy</button>' +
        '</span>' +
      '</div>';
    }
    if (tokenAddr) {
      rows += '<div class="nft-detail-row">' +
        '<span class="nft-detail-row-label">Token Address</span>' +
        '<span class="nft-detail-row-value">' +
          '<a class="nft-detail-link nft-detail-link--hash" href="' + escapeHtml(solanaExplorerUrl('address', tokenAddr)) + '" target="_blank" rel="noopener">' +
            escapeHtml(tokenAddr) + ' <span class="nft-detail-ext-icon">↗</span></a>' +
          '<button class="nft-copy-btn" data-copy="' + escapeHtml(tokenAddr) + '">Copy</button>' +
        '</span>' +
      '</div>';
    }
    if (collKey) {
      rows += '<div class="nft-detail-row">' +
        '<span class="nft-detail-row-label">Collection</span>' +
        '<span class="nft-detail-row-value">' +
          '<a class="nft-detail-link nft-detail-link--hash" href="' + escapeHtml(solanaExplorerUrl('address', collKey)) + '" target="_blank" rel="noopener">' +
            escapeHtml(collKey) + ' <span class="nft-detail-ext-icon">↗</span></a>' +
          '<button class="nft-copy-btn" data-copy="' + escapeHtml(collKey) + '">Copy</button>' +
        '</span>' +
      '</div>';
    }
    if (walletAddr) {
      rows += '<div class="nft-detail-row">' +
        '<span class="nft-detail-row-label">Owner Wallet</span>' +
        '<span class="nft-detail-row-value">' +
          '<a class="nft-detail-link nft-detail-link--hash" href="' + escapeHtml(solanaExplorerUrl('address', walletAddr)) + '" target="_blank" rel="noopener">' +
            escapeHtml(walletAddr) + ' <span class="nft-detail-ext-icon">↗</span></a>' +
          '<button class="nft-copy-btn" data-copy="' + escapeHtml(walletAddr) + '">Copy</button>' +
        '</span>' +
      '</div>';
    }

    rows += makeRow('Symbol', nft.symbol || nft.Symbol);
    rows += makeRow('Standard', nft.nftStandardType && nft.nftStandardType.name);
    rows += makeRow('Off-Chain Provider', nft.offChainProvider && nft.offChainProvider.name);
    rows += makeRow('On-Chain Provider', nft.onChainProvider && nft.onChainProvider.name);
    rows += makeRow('Royalty', nft.royaltyPercentage != null ? (nft.royaltyPercentage + '%') : '');
    var listingPrice = nft.price || nft.Price;
    var lastSalePrice = nft.lastSalePrice || nft.LastSalePrice || nft.lastSaleAmount || nft.LastSaleAmount;
    if (listingPrice) rows += makeRow('Listing Price', listingPrice + ' SOL');
    if (lastSalePrice) rows += makeRow('Last Sale Price', lastSalePrice + ' SOL');
    var lastSaleTax = nft.lastSaleTax || nft.LastSaleTax;
    var lastSaleDiscount = nft.lastSaleDiscount || nft.LastSaleDiscount;
    if (lastSaleTax) rows += makeRow('Last Sale Tax', lastSaleTax + ' SOL');
    if (lastSaleDiscount) rows += makeRow('Last Sale Discount', lastSaleDiscount + ' SOL');
    var lastSaleDate = nft.lastSaleDate || nft.LastSaleDate;
    if (lastSaleDate && lastSaleDate !== '0001-01-01T00:00:00') rows += makeRow('Last Sale Date', formatDate(lastSaleDate));
    var lastSaleTxHash = nft.lastSaleTransactionHash || nft.LastSaleTransactionHash;
    if (lastSaleTxHash) {
      rows += '<div class="nft-detail-row">' +
        '<span class="nft-detail-row-label">Last Sale Tx</span>' +
        '<span class="nft-detail-row-value">' +
          '<a class="nft-detail-link nft-detail-link--hash" href="' + escapeHtml(solanaExplorerUrl('tx', lastSaleTxHash)) + '" target="_blank" rel="noopener">' +
            escapeHtml(lastSaleTxHash) + ' <span class="nft-detail-ext-icon">↗</span></a>' +
          '<button class="nft-copy-btn" data-copy="' + escapeHtml(lastSaleTxHash) + '">Copy</button>' +
        '</span>' +
      '</div>';
    }
    var totalSales = nft.totalNumberOfSales || nft.TotalNumberOfSales;
    if (totalSales) rows += makeRow('Total Sales', totalSales);
    rows += makeRow('Minted', nft.mintedOn && formatDate(nft.mintedOn));
    rows += makeRow('Modified', nft.modifiedOn && formatDate(nft.modifiedOn));

    // Extra MetaData fields
    var meta = nft.metaData || nft.MetaData;
    if (meta && typeof meta === 'object') {
      Object.keys(meta).forEach(function (k) {
        var v = meta[k];
        if (v == null || v === '') return;
        var label = k.replace(/([A-Z])/g, ' $1').trim();
        label = label.charAt(0).toUpperCase() + label.slice(1);
        rows += makeRow(label, String(v).toUpperCase());
      });
    }

    var jsonUrl = nft.jsonMetaDataURL || nft.JsonMetaDataURL || nft.metaDataUrl || '';
    if (jsonUrl) {
      rows += '<div class="nft-detail-row">' +
        '<span class="nft-detail-row-label">Metadata JSON</span>' +
        '<span class="nft-detail-row-value"><a class="nft-detail-link" href="' + escapeHtml(jsonUrl) + '" target="_blank" rel="noopener">View JSON ↗</a></span>' +
      '</div>';
    }

    var rowsEl = getById('nft-detail-rows');
    if (rowsEl) rowsEl.innerHTML = rows;

    // Pre-fill send form with owner wallet
    var sendFrom = getById('nft-detail-send-from');
    if (sendFrom && walletAddr) sendFrom.value = walletAddr;

    // Hide inline send panel
    var sendPanel = getById('nft-detail-send-panel');
    if (sendPanel) sendPanel.hidden = true;

    panel.hidden = false;
    panel.scrollTop = 0;

    // Bind copy buttons inside the panel
    rowsEl && rowsEl.querySelectorAll('.nft-copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { copyToClipboard(btn.dataset.copy, btn); });
    });
  }

  function hideNftDetail() {
    var panel = getById('nft-detail-panel');
    if (panel) panel.hidden = true;
    activeDetailNft = null;

    // Restore current tab
    var tabPanels = document.querySelectorAll('#nft-modal-block .nft-tab-panel');
    tabPanels.forEach(function (p) {
      p.hidden = p.id !== 'nft-tab-' + currentTab;
    });
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderGrid(gridId, emptyId, nfts, buildCard) {
    var grid = getById(gridId);
    var empty = getById(emptyId);
    if (!grid) return;

    // Remove existing cards and expanded collections
    grid.querySelectorAll('.nft-card, .nft-collection-expanded').forEach(function (el) {
      el.parentNode.removeChild(el);
    });

    if (!nfts || !nfts.length) {
      if (empty) { empty.hidden = false; empty.style.display = ''; }
      return;
    }

    if (empty) { empty.hidden = true; empty.style.display = 'none'; }

    if (gridId === 'nft-grid' && groupByCollection) {
      renderGrouped(grid, nfts);
    } else {
      grid.insertAdjacentHTML('beforeend', nfts.map(function (nft, i) { return buildCard(nft, i); }).join(''));
    }
  }

  function renderGrouped(grid, nfts) {
    var grouped = {};
    var ungrouped = [];
    nfts.forEach(function (nft, i) {
      var key = nft.collectionPublicKey || nft.CollectionPublicKey || '';
      if (key) {
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ nft: nft, index: i });
      } else {
        ungrouped.push({ nft: nft, index: i });
      }
    });

    Object.keys(grouped).forEach(function (key) {
      var items = grouped[key];
      if (items.length === 1) {
        grid.insertAdjacentHTML('beforeend', buildNftCard(items[0].nft, items[0].index));
      } else {
        grid.insertAdjacentHTML('beforeend', buildCollectionCard(key, items.map(function (x) { return x.nft; })));
      }
    });

    ungrouped.forEach(function (item) {
      grid.insertAdjacentHTML('beforeend', buildNftCard(item.nft, item.index));
    });
  }

  // ── API calls ────────────────────────────────────────────────────────────────

  async function fetchNfts(profile) {
    var avatarId = getAvatarId(profile);
    if (!avatarId) return null;
    try {
      var sdkRes = await window.oasisClient.nft.loadAllWeb4NFTsForAvatarAsync({ avatarId: avatarId });
      return sdkRes.isError ? null : extractList(sdkRes.result);
    } catch (e) { return null; }
  }

  async function fetchGeoNfts(profile) {
    var avatarId = getAvatarId(profile);
    if (!avatarId) return null;
    try {
      var sdkRes = await window.oasisClient.nft.loadAllWeb4GeoNFTsForAvatarAsync({ avatarId: avatarId });
      return sdkRes.isError ? null : extractList(sdkRes.result);
    } catch (e) { return null; }
  }

  async function fetchOlandPrice(token) {
    try {
      var sdkRes = await window.oasisClient.oLand.getOlandPrice();
      if (sdkRes.isError) return null;
      var d = sdkRes.result;
      return d && (d.price || d.Price || d) != null ? (d.price || d.Price || d) : null;
    } catch (e) { return null; }
  }

  async function fetchOland(token) {
    try {
      var sdkRes = await window.oasisClient.oLand.loadAllOlands();
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

    var results = await Promise.all([
      safeFetch(function () { return fetchNfts(profile); }),
      safeFetch(function () { return fetchGeoNfts(profile); }),
      safeFetch(function () { return fetchOland(token); }),
      safeFetch(function () { return fetchOlandPrice(token); }),
    ]);

    var nfts = results[0], geoNfts = results[1], olandList = results[2], olandPrice = results[3];

    hideStatus();
    isFetching = false;

    loadedNfts = nfts || [];

    renderGrid('nft-grid', 'nft-empty-standard', nfts, buildNftCard);
    renderGrid('nft-geo-grid', 'nft-empty-geo', geoNfts, buildGeoNftCard);
    renderGrid('nft-oland-grid', 'nft-empty-oland', olandList, buildOlandCard);

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

    var nftStandardType = currentProvider === 'SolanaOASIS' ? 'SPL' : 'ERC1155';
    var priceEl = getById('nft-mint-price');
    var price = priceEl ? parseFloat(priceEl.value) : 0;
    if (isNaN(price) || price < 0) price = 0;
    var body = {
      title: title,
      description: (getById('nft-mint-desc') || {}).value || '',
      imageUrl: (getById('nft-mint-image-url') || {}).value || '',
      price: price,
      symbol: (getById('nft-mint-symbol') || {}).value || '',
      numberToMint: parseInt((getById('nft-mint-quantity') || {}).value) || 1,
      memoText: (getById('nft-mint-memo') || {}).value || '',
      storeNFTMetaDataOnChain: false,
      onChainProvider: currentProvider,
      offChainProvider: 'MongoDBOASIS',
      nftStandardType: nftStandardType,
      nftOffChainMetaType: 'OASIS',
      waitTillNFTMinted: true,
      waitForNFTToMintInSeconds: 180,
      attemptToMintEveryXSeconds: 1
    };

    var btn = getById('nft-mint-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Minting…'; }
    showStatus('loading', 'Minting NFT…');

    try {
      var sdkRes = await window.oasisClient.nft.mintNftAsync(body);
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

  // ── API: Send NFT (footer form) ──────────────────────────────────────────────

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
      var sdkRes = await window.oasisClient.nft.sendNFTAsync(body);
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

  // ── API: Send NFT (detail panel inline form) ─────────────────────────────────

  async function apiSendNftFromDetail(profile) {
    if (!activeDetailNft) return;
    var fromAddr = ((getById('nft-detail-send-from') || {}).value || '').trim();
    var byAvatar = getById('nft-detail-send-by-avatar-btn') && getById('nft-detail-send-by-avatar-btn').classList.contains('nft-send-toggle-btn--active');
    var toAddr = byAvatar ? '' : ((getById('nft-detail-send-to') || {}).value || '').trim();
    var toUsername = byAvatar ? ((getById('nft-detail-send-avatar-username') || {}).value || '').trim() : '';

    var status = getById('nft-detail-send-status');
    if (!fromAddr || (!toAddr && !toUsername)) {
      if (status) { status.className = 'nft-form-status nft-status nft-status--error'; status.textContent = byAvatar ? 'From wallet address and avatar username are required.' : 'From and To wallet addresses are required.'; status.hidden = false; }
      return;
    }

    var token = getToken(profile);
    if (!token) { return; }

    var body = {
      fromWalletAddress: fromAddr,
      fromProvider: currentProvider,
      toProvider: currentProvider,
      amount: parseFloat((getById('nft-detail-send-amount') || {}).value) || 0,
      memoText: (getById('nft-detail-send-memo') || {}).value || '',
      waitTillNFTSent: false
    };
    if (toUsername) {
      body.sendToAvatarUsername = toUsername;
    } else {
      body.toWalletAddress = toAddr;
    }

    var btn = getById('nft-detail-send-submit-btn');
    var status = getById('nft-detail-send-status');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    if (status) { status.className = 'nft-form-status nft-status nft-status--loading'; status.textContent = 'Sending NFT…'; status.hidden = false; }

    try {
      var sdkRes = await window.oasisClient.nft.sendNFTAsync(body);
      if (!sdkRes.isError) {
        if (status) { status.className = 'nft-form-status nft-status nft-status--success'; status.textContent = 'NFT sent successfully!'; }
        setTimeout(function () { hideNftDetail(); loadAll(readAvatar()); }, 1500);
      } else {
        if (status) { status.className = 'nft-form-status nft-status nft-status--error'; status.textContent = 'Send failed: ' + (sdkRes.message || 'Unknown error'); }
      }
    } catch (e) {
      if (status) { status.className = 'nft-form-status nft-status nft-status--error'; status.textContent = 'Network error — could not reach the API.'; }
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
      var sdkRes = await window.oasisClient.nft.placeGeoNFTAsync(body);
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
    // Hide detail panel when switching tabs
    var detailPanel = getById('nft-detail-panel');
    if (detailPanel) detailPanel.hidden = true;
    activeDetailNft = null;
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
    hideNftDetail();
    switchTab('standard');

    var profile = readAvatar();
    loadAll(profile);
    return false;
  }

  function closeNftModal() {
    closeActionPanel();
    hideNftDetail();
    var modal = document.querySelector('.js-modal');
    var nftBlock = getById('nft-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (nftBlock) nftBlock.classList.remove('is-selected');
  }

  // ── Grid click delegation ────────────────────────────────────────────────────

  function onGridClick(e) {
    // Collection collapse
    var collapseBtn = e.target.closest('.nft-collection-collapse-btn');
    if (collapseBtn) {
      var key = collapseBtn.dataset.collectionKey;
      var expanded = document.querySelector('.nft-collection-expanded[data-collection-expanded="' + key + '"]');
      if (expanded) expanded.parentNode.removeChild(expanded);
      var collCard = document.querySelector('.nft-card--collection[data-collection-key="' + key + '"]');
      if (collCard) collCard.classList.remove('is-expanded');
      return;
    }

    // Collection card expand
    var collCard = e.target.closest('.nft-card--collection');
    if (collCard) {
      var key = collCard.dataset.collectionKey;
      var alreadyExpanded = document.querySelector('.nft-collection-expanded[data-collection-expanded="' + key + '"]');
      if (alreadyExpanded) {
        alreadyExpanded.parentNode.removeChild(alreadyExpanded);
        collCard.classList.remove('is-expanded');
        return;
      }

      // Find nfts for this collection key
      var collNfts = loadedNfts.filter(function (n) {
        return (n.collectionPublicKey || n.CollectionPublicKey || '') === key;
      });
      var baseIndex = loadedNfts.indexOf(collNfts[0]);
      var html = buildCollectionExpanded(key, collNfts, baseIndex < 0 ? 0 : baseIndex);
      collCard.insertAdjacentHTML('afterend', html);
      collCard.classList.add('is-expanded');
      return;
    }

    // Individual NFT card click
    var card = e.target.closest('.nft-card--clickable:not(.nft-card--collection)');
    if (card) {
      var idx = parseInt(card.dataset.nftIndex, 10);
      var nft = loadedNfts[idx];
      if (nft) showNftDetail(nft);
    }
  }

  // ── Bind ─────────────────────────────────────────────────────────────────────

  function bind() {
    var nftBlock = getById('nft-modal-block');
    if (!nftBlock || nftBlock.dataset.nftBound === 'true') {
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
        loadAll(readAvatar());
      });
    }

    var providerSelect = getById('nft-provider-select');
    if (providerSelect) {
      providerSelect.addEventListener('change', function () {
        currentProvider = providerSelect.value;
        loadAll(readAvatar());
      });
    }

    var groupCheck = getById('nft-group-by-collection');
    if (groupCheck) {
      groupCheck.addEventListener('change', function () {
        groupByCollection = groupCheck.checked;
        // Re-render current nfts without refetching
        renderGrid('nft-grid', 'nft-empty-standard', loadedNfts.length ? loadedNfts : null, buildNftCard);
      });
    }

    var tabContainer = nftBlock.querySelector('.nft-tabs');
    if (tabContainer) {
      tabContainer.addEventListener('click', function (e) {
        var tab = e.target.closest('.nft-tab');
        if (!tab) return;
        switchTab(tab.dataset.tab);
      });
    }

    // Grid click delegation (standard NFT tab)
    var nftTabPanel = getById('nft-tab-standard');
    if (nftTabPanel) {
      nftTabPanel.addEventListener('click', onGridClick);
    }

    // Detail panel: back button
    var backBtn = getById('nft-detail-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () { hideNftDetail(); });
    }

    // Detail panel: send button toggle + auto-scroll
    var detailSendBtn = getById('nft-detail-send-btn');
    if (detailSendBtn) {
      detailSendBtn.addEventListener('click', function () {
        var panel = getById('nft-detail-send-panel');
        if (!panel) return;
        panel.hidden = !panel.hidden;
        if (!panel.hidden) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    var detailSendClose = getById('nft-detail-send-close-btn');
    if (detailSendClose) {
      detailSendClose.addEventListener('click', function () {
        var panel = getById('nft-detail-send-panel');
        if (panel) panel.hidden = true;
      });
    }

    var detailSendCancel = getById('nft-detail-send-cancel-btn');
    if (detailSendCancel) {
      detailSendCancel.addEventListener('click', function () {
        var panel = getById('nft-detail-send-panel');
        if (panel) panel.hidden = true;
      });
    }

    // Send-to toggle: wallet address vs avatar username
    var byWalletBtn = getById('nft-detail-send-by-wallet-btn');
    var byAvatarBtn = getById('nft-detail-send-by-avatar-btn');
    if (byWalletBtn && byAvatarBtn) {
      byWalletBtn.addEventListener('click', function () {
        byWalletBtn.classList.add('nft-send-toggle-btn--active');
        byAvatarBtn.classList.remove('nft-send-toggle-btn--active');
        var wf = getById('nft-detail-send-to-wallet-field');
        var af = getById('nft-detail-send-to-avatar-field');
        if (wf) wf.hidden = false;
        if (af) af.hidden = true;
      });
      byAvatarBtn.addEventListener('click', function () {
        byAvatarBtn.classList.add('nft-send-toggle-btn--active');
        byWalletBtn.classList.remove('nft-send-toggle-btn--active');
        var wf = getById('nft-detail-send-to-wallet-field');
        var af = getById('nft-detail-send-to-avatar-field');
        if (wf) wf.hidden = true;
        if (af) af.hidden = false;
      });
    }

    var detailSendSubmit = getById('nft-detail-send-submit-btn');
    if (detailSendSubmit) {
      detailSendSubmit.addEventListener('click', function () {
        apiSendNftFromDetail(readAvatar());
      });
    }

    nftBlock.dataset.nftBound = 'true';

    // If the router already opened the NFT modal before bind() ran (race on
    // refresh), the block will already be visible — load NFTs now.
    if (nftBlock.classList.contains('is-selected')) {
      loadAll(readAvatar());
    }
  }

  // Expose globals immediately so the router can call openNftModal() regardless
  // of whether bind() has run yet.
  exposeGlobals();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.addEventListener('portal-components-ready', bind);
})();
