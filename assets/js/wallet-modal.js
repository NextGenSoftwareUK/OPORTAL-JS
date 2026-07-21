(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var isFetching = false;
  var walletList = [];

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

  function getToken(p) { return p && (p.jwtToken || p.token || ''); }
  function getAvatarId(p) { return p && (p.id || p.Id || p.avatarId || p.AvatarId || ''); }

  function extractList(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.wallets)) return data.wallets;
    return null;
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  function renderStatus(type, msg) {
    var el = getById('wallet-modal-status');
    if (!el) return;
    el.className = 'wallet-status wallet-status--' + type;
    el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : '');
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('wallet-modal-status');
    if (el) el.hidden = true;
  }

  // ── Card builders ────────────────────────────────────────────────────────────

  function truncateAddr(addr) {
    if (!addr || addr.length <= 16) return addr || '';
    return addr.slice(0, 8) + '…' + addr.slice(-6);
  }

  function chainIcon(chainName) {
    var name = String(chainName || '').toLowerCase();
    if (name.includes('ethereum') || name.includes('eth')) return '💎';
    if (name.includes('solana') || name.includes('sol')) return '◎';
    if (name.includes('polygon') || name.includes('matic')) return '🔷';
    if (name.includes('binance') || name.includes('bsc') || name.includes('bnb')) return '🟡';
    if (name.includes('avalanche') || name.includes('avax')) return '🔺';
    if (name.includes('arbitrum')) return '🔵';
    if (name.includes('optimism')) return '🔴';
    if (name.includes('eos')) return '⚫';
    if (name.includes('holochain') || name.includes('holo')) return '🟢';
    return '🔗';
  }

  function buildWalletCard(wallet, isDefault) {
    var address = wallet.address || wallet.Address || wallet.walletAddress || wallet.WalletAddress || '';
    var chain = escapeHtml(wallet.chain || wallet.Chain || wallet.providerType || wallet.ProviderType || 'Unknown');
    var balance = wallet.balance || wallet.Balance || '';
    var name = escapeHtml(wallet.name || wallet.Name || wallet.walletName || wallet.WalletName || '');
    var addrTrunc = escapeHtml(truncateAddr(address));
    var addrFull = escapeHtml(address);

    return '<div class="wallet-card' + (isDefault ? ' wallet-card--default' : '') + '">' +
      '<div class="wallet-card-header">' +
        '<span class="wallet-card-icon">' + chainIcon(chain) + '</span>' +
        '<div class="wallet-card-title">' +
          (name ? '<div class="wallet-card-name">' + name + '</div>' : '') +
          '<div class="wallet-card-chain">' + chain + '</div>' +
        '</div>' +
        (isDefault ? '<span class="wallet-card-badge">Default</span>' : '') +
      '</div>' +
      '<div class="wallet-card-address" title="' + addrFull + '">' + (addrTrunc || '—') + '</div>' +
      (balance !== '' ? '<div class="wallet-card-balance">Balance: ' + escapeHtml(String(balance)) + '</div>' : '') +
      (address ? '<button class="wallet-copy-btn" data-address="' + addrFull + '" title="Copy address">Copy Address</button>' : '') +
    '</div>';
  }

  function buildTokenCard(token) {
    var symbol = escapeHtml(token.symbol || token.Symbol || '?');
    var name = escapeHtml(token.name || token.Name || '');
    var balance = escapeHtml(String(token.balance || token.Balance || token.amount || token.Amount || '0'));
    var value = token.value || token.Value || token.usdValue || token.UsdValue || '';
    var icon = token.icon || token.Icon || token.logoUrl || token.LogoUrl || '';

    var iconHtml = icon
      ? '<img class="wallet-token-icon" src="' + escapeHtml(icon) + '" alt="' + symbol + '" onerror="this.outerHTML=\'🪙\'">'
      : '<span class="wallet-token-icon-fallback">🪙</span>';

    return '<div class="wallet-token-card">' +
      '<div class="wallet-token-icon-wrap">' + iconHtml + '</div>' +
      '<div class="wallet-token-body">' +
        '<div class="wallet-token-symbol">' + symbol + '</div>' +
        (name ? '<div class="wallet-token-name">' + name + '</div>' : '') +
        '<div class="wallet-token-balance">' + balance + ' ' + symbol + '</div>' +
        (value !== '' ? '<div class="wallet-token-value">$' + escapeHtml(String(value)) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function buildChainCard(chain) {
    var name = escapeHtml(chain.name || chain.Name || chain.chainName || chain.ChainName || String(chain));
    var icon = chainIcon(name);
    var supported = chain.supported !== false && chain.isSupported !== false;

    return '<div class="wallet-chain-card' + (supported ? '' : ' wallet-chain-card--disabled') + '">' +
      '<div class="wallet-chain-icon">' + icon + '</div>' +
      '<div class="wallet-chain-name">' + name + '</div>' +
      '<div class="wallet-chain-status">' + (supported ? 'Supported' : 'Unavailable') + '</div>' +
    '</div>';
  }

  // ── API calls (SDK: @oasisomniverse/web4-api) ────────────────────────────────

  /* OLD apiFetch helper:
  async function apiFetch(url, options) {
    try { var res = await fetch(url, options); if (!res.ok) return null; return await res.json(); }
    catch (e) { return null; }
  }
  */

  async function fetchWallets(profile) {
    var id = getAvatarId(profile);
    if (!id) return null;
    try {
      var sdkRes = await window.oasisClient.wallet.loadProviderWalletsForAvatarByIdAsync({ id: id, showOnlyDefault: false, decryptPrivateKeys: false });
      /* OLD fetch:
      var data = await apiFetch(API_BASE + '/api/Wallet/avatar/' + encodeURIComponent(id) + '/wallets', { headers: { 'Authorization': 'Bearer ' + getToken(profile) } });
      return extractList(data);
      */
      return sdkRes.isError ? null : extractList(sdkRes.result);
    } catch (e) { return null; }
  }

  async function fetchDefaultWallet(profile) {
    var id = getAvatarId(profile);
    if (!id) return null;
    try {
      var sdkRes = await window.oasisClient.wallet.getAvatarDefaultWalletByIdAsync({ id: id });
      /* OLD fetch:
      return await apiFetch(API_BASE + '/api/Wallet/avatar/' + encodeURIComponent(id) + '/default-wallet', { headers: { 'Authorization': 'Bearer ' + getToken(profile) } });
      */
      return sdkRes.isError ? null : (sdkRes.result || null);
    } catch (e) { return null; }
  }

  async function fetchPortfolioValue(profile) {
    var id = getAvatarId(profile);
    if (!id) return null;
    try {
      var sdkRes = await window.oasisClient.wallet.getPortfolioValueAsync({ avatarId: id });
      /* OLD fetch:
      return await apiFetch(API_BASE + '/api/Wallet/avatar/' + encodeURIComponent(id) + '/portfolio/value', { headers: { 'Authorization': 'Bearer ' + getToken(profile) } });
      */
      return sdkRes.isError ? null : (sdkRes.result != null ? sdkRes.result : null);
    } catch (e) { return null; }
  }

  async function fetchSupportedChains(token) {
    try {
      var sdkRes = await window.oasisClient.wallet.getSupportedChains();
      /* OLD fetch:
      return await apiFetch(API_BASE + '/api/Wallet/supported-chains', { headers: { 'Authorization': 'Bearer ' + token } });
      */
      return sdkRes.isError ? null : (sdkRes.result || null);
    } catch (e) { return null; }
  }

  async function fetchTokens(profile, walletId) {
    var id = getAvatarId(profile);
    if (!id || !walletId) return null;
    try {
      var sdkRes = await window.oasisClient.wallet.getWalletTokensAsync({ avatarId: id, walletId: walletId });
      /* OLD fetch:
      var data = await apiFetch(API_BASE + '/api/Wallet/avatar/' + encodeURIComponent(id) + '/wallet/' + encodeURIComponent(walletId) + '/tokens', { headers: { 'Authorization': 'Bearer ' + getToken(profile) } });
      return extractList(data);
      */
      return sdkRes.isError ? null : extractList(sdkRes.result);
    } catch (e) { return null; }
  }

  async function fetchAnalytics(profile, walletId) {
    var id = getAvatarId(profile);
    if (!id || !walletId) return null;
    try {
      var sdkRes = await window.oasisClient.wallet.getWalletAnalyticsAsync({ avatarId: id, walletId: walletId });
      /* OLD fetch:
      return await apiFetch(API_BASE + '/api/Wallet/avatar/' + encodeURIComponent(id) + '/wallet/' + encodeURIComponent(walletId) + '/analytics', { headers: { 'Authorization': 'Bearer ' + getToken(profile) } });
      */
      return sdkRes.isError ? null : (sdkRes.result || null);
    } catch (e) { return null; }
  }

  // ── Populate stat bar ────────────────────────────────────────────────────────

  function setText(id, val) {
    var el = getById(id);
    if (el) el.textContent = val;
  }

  function populateStats(wallets, portfolio, chains, defaultWallet) {
    setText('wallet-stat-wallets', wallets ? String(wallets.length) : '—');

    var portVal = '—';
    if (portfolio != null) {
      var v = portfolio.value || portfolio.Value || portfolio.total || portfolio.Total || portfolio.result || portfolio;
      if (typeof v === 'number' || (typeof v === 'string' && v !== '')) {
        portVal = '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
    setText('wallet-stat-portfolio', portVal);

    var chainsList = extractList(chains);
    setText('wallet-stat-chains', chainsList ? String(chainsList.length) : '—');

    var defLabel = '—';
    if (defaultWallet) {
      var addr = defaultWallet.address || defaultWallet.Address || defaultWallet.walletAddress || defaultWallet.WalletAddress || '';
      var dname = defaultWallet.name || defaultWallet.Name || '';
      defLabel = dname || (addr ? truncateAddr(addr) : '—');
    }
    setText('wallet-stat-default', defLabel);
  }

  // ── Populate from-wallet select ──────────────────────────────────────────────

  function populateFromWalletSelect(wallets) {
    var sel = getById('wallet-from-wallet');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select a wallet…</option>';
    if (!wallets || !wallets.length) return;
    wallets.forEach(function (w) {
      var addr = w.address || w.Address || w.walletAddress || w.WalletAddress || '';
      var name = w.name || w.Name || '';
      var label = name || (addr ? truncateAddr(addr) : 'Wallet');
      var opt = document.createElement('option');
      opt.value = addr;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  }

  // ── Load all ─────────────────────────────────────────────────────────────────

  async function loadAll() {
    if (isFetching) return;
    isFetching = true;
    renderStatus('loading', 'Loading wallet data…');

    var profile = readAvatar();
    var token = getToken(profile);

    var [wallets, defaultWallet, portfolio, chainsData] = await Promise.all([
      fetchWallets(profile),
      fetchDefaultWallet(profile),
      fetchPortfolioValue(profile),
      fetchSupportedChains(token),
    ]);

    walletList = wallets || [];
    hideStatus();
    isFetching = false;

    populateStats(wallets, portfolio, chainsData, defaultWallet);
    populateFromWalletSelect(wallets);

    // Render wallets grid
    var grid = getById('wallet-grid');
    var empty = getById('wallet-grid-empty');
    if (grid) {
      grid.querySelectorAll('.wallet-card').forEach(function (el) { el.parentNode.removeChild(el); });
      if (wallets && wallets.length) {
        if (empty) empty.hidden = true;
        var defAddr = defaultWallet && (defaultWallet.address || defaultWallet.Address || defaultWallet.walletAddress || defaultWallet.WalletAddress || '');
        grid.insertAdjacentHTML('beforeend', wallets.map(function (w) {
          var addr = w.address || w.Address || w.walletAddress || w.WalletAddress || '';
          return buildWalletCard(w, defAddr && addr === defAddr);
        }).join(''));
      } else {
        if (empty) empty.hidden = false;
      }
    }

    // Render portfolio tab
    var portSummary = getById('wallet-portfolio-value');
    if (portSummary && portfolio != null) {
      var v = portfolio.value || portfolio.Value || portfolio.total || portfolio.Total || portfolio.result || portfolio;
      var amountEl = portSummary.querySelector('.wallet-portfolio-amount');
      if (amountEl) {
        amountEl.textContent = (typeof v === 'number' || typeof v === 'string')
          ? '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '—';
      }
    }

    // Tokens — use first wallet
    if (wallets && wallets.length) {
      var firstWalletId = wallets[0].id || wallets[0].Id || wallets[0].walletId || wallets[0].WalletId || '';
      if (firstWalletId) {
        var tokens = await fetchTokens(profile, firstWalletId);
        var tokensGrid = getById('wallet-tokens-grid');
        if (tokensGrid) {
          if (tokens && tokens.length) {
            tokensGrid.innerHTML = tokens.map(buildTokenCard).join('');
          }
        }

        var analytics = await fetchAnalytics(profile, firstWalletId);
        var analyticsEl = getById('wallet-analytics');
        if (analyticsEl && analytics) {
          analyticsEl.innerHTML = '<div class="wallet-analytics-raw"><pre>' + escapeHtml(JSON.stringify(analytics, null, 2)) + '</pre></div>';
        }
      }
    }

    // Render chains grid
    var chainsList = extractList(chainsData);
    var chainsGrid = getById('wallet-chains-grid');
    if (chainsGrid) {
      if (chainsList && chainsList.length) {
        chainsGrid.innerHTML = chainsList.map(buildChainCard).join('');
      }
    }

    if (!wallets && !portfolio && !chainsData) {
      renderStatus('warn', 'Could not load wallet data — API may be unavailable or your session may have expired.');
    }
  }

  // ── Transfer ─────────────────────────────────────────────────────────────────

  async function doTransfer() {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { renderStatus('error', 'Not authenticated.'); return; }

    var fromAddr = (getById('wallet-from-wallet') || {}).value || '';
    var toAddr = (getById('wallet-to-address') || {}).value || '';
    var amount = parseFloat((getById('wallet-amount') || {}).value) || 0;
    var chain = (getById('wallet-chain') || {}).value || '';
    var memo = (getById('wallet-memo') || {}).value || '';

    if (!toAddr) { renderStatus('error', 'Please enter a recipient address.'); return; }
    if (!amount || amount <= 0) { renderStatus('error', 'Please enter a valid amount.'); return; }

    renderStatus('loading', 'Sending transfer…');
    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.wallet.transferBetweenWalletsAsync({ fromWalletAddress: fromAddr, toAddress: toAddr, amount: amount, chain: chain, memo: memo });
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/Wallet/transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ fromWalletAddress: fromAddr, toAddress: toAddr, amount: amount, chain: chain, memo: memo })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      */
      if (!sdkRes.isError) {
        renderStatus('success', 'Transfer sent successfully.');
        var form = getById('wallet-transfer-form');
        if (form) form.reset();
        setTimeout(hideStatus, 4000);
      } else {
        renderStatus('error', sdkRes.message || 'Transfer failed.');
      }
    } catch (e) {
      renderStatus('error', 'Transfer failed: ' + e.message);
    }
  }

  // ── Create wallet ────────────────────────────────────────────────────────────

  async function doCreateWallet() {
    var profile = readAvatar();
    var id = getAvatarId(profile);
    var token = getToken(profile);
    if (!id || !token) { renderStatus('error', 'Not authenticated.'); return; }

    renderStatus('loading', 'Creating wallet…');
    try {
      // avatarId goes into the URL; the remaining fields become the [FromBody] CreateWalletRequest.
      // Without extra fields the SDK sends no body at all, causing a 400 validation error.
      var sdkRes = await window.oasisClient.wallet.createWalletForAvatarByIdAsync({
        avatarId: id,
        generateKeyPair: true,
        isDefaultWallet: false
      });
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/Wallet/avatar/' + encodeURIComponent(id) + '/create-wallet', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({})
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      */
      if (!sdkRes.isError) {
        renderStatus('success', 'Wallet created!');
        setTimeout(function () { hideStatus(); loadAll(); }, 1500);
      } else {
        renderStatus('error', sdkRes.message || 'Could not create wallet.');
      }
    } catch (e) {
      renderStatus('error', 'Could not create wallet: ' + e.message);
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  function switchTab(tab) {
    var block = getById('wallet-modal-block');
    if (!block) return;
    block.querySelectorAll('.wallet-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    block.querySelectorAll('.wallet-tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'wallet-tab-' + tab;
    });
  }

  // ── Open / close ─────────────────────────────────────────────────────────────

  function openWalletModal() {
    var loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
      if (typeof window.showCheckAPIMessage === 'function') window.showCheckAPIMessage();
      return false;
    }

    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('wallet-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    switchTab('wallets');
    loadAll();
    return false;
  }

  function closeWalletModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('wallet-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('wallet-modal-block');
    if (!block || block.dataset.walletBound === 'true') {
      window.openWalletModal = openWalletModal;
      window.closeWalletModal = closeWalletModal;
      return;
    }

    var closeBtn = getById('wallet-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeWalletModal(); });

    var refreshBtn = getById('wallet-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { loadAll(); });

    var createBtn = getById('wallet-create-btn');
    if (createBtn) createBtn.addEventListener('click', function () { doCreateWallet(); });

    var transferForm = getById('wallet-transfer-form');
    if (transferForm) transferForm.addEventListener('submit', function (e) { e.preventDefault(); doTransfer(); });

    var transferBtn = getById('wallet-transfer-btn');
    if (transferBtn) transferBtn.addEventListener('click', function () { doTransfer(); });

    // Copy address buttons (delegated)
    var grid = getById('wallet-grid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest('.wallet-copy-btn');
        if (!btn) return;
        var addr = btn.dataset.address;
        if (addr && navigator.clipboard) {
          navigator.clipboard.writeText(addr).then(function () {
            btn.textContent = 'Copied!';
            setTimeout(function () { btn.textContent = 'Copy Address'; }, 2000);
          });
        }
      });
    }

    // Tabs
    var tabBar = block.querySelector('.wallet-tabs');
    if (tabBar) {
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.wallet-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    block.dataset.walletBound = 'true';
    window.openWalletModal = openWalletModal;
    window.closeWalletModal = closeWalletModal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.addEventListener('portal-components-ready', bind);
})();
