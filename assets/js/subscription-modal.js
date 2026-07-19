(function () {
  'use strict';

  function getById(id) { return document.getElementById(id); }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function showStatus(type, msg) { var el = getById('subscription-status'); if (!el) return; el.className = 'subscription-status subscription-status--' + type; el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : ''); el.hidden = false; }
  function hideStatus() { var el = getById('subscription-status'); if (el) el.hidden = true; }
  function showStatusBrief(type, msg) { showStatus(type, msg); setTimeout(hideStatus, 3500); }
  function setText(id, v) { var el = getById(id); if (el) el.textContent = v; }
  function fmtBytes(b) { if (!b) return '—'; var n = Number(b); if (isNaN(n)) return String(b); if (n < 1024) return n + ' B'; if (n < 1048576) return (n/1024).toFixed(1) + ' KB'; if (n < 1073741824) return (n/1048576).toFixed(1) + ' MB'; return (n/1073741824).toFixed(2) + ' GB'; }
  function fmtDate(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString(); } catch(e) { return ''; } }
  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    return [];
  }

  // Plan display metadata — used when the API doesn't return rich descriptions
  var PLAN_META = {
    trial:      { badge: 'Trial', desc: '14 days full access, no credit card required', icon: '🎁' },
    '14-day':   { badge: 'Trial', desc: '14 days full access, no credit card required', icon: '🎁' },
    free:       { badge: '',       desc: 'For exploration and testing',                  icon: '🌱' },
    bronze:     { badge: '',       desc: 'For developers getting started',               icon: '🥉' },
    silver:     { badge: 'Popular',desc: 'For individual developers and small projects', icon: '🥈' },
    gold:       { badge: '',       desc: 'For teams and production applications',        icon: '🥇' },
    enterprise: { badge: '',       desc: 'Custom limits, SLA, dedicated support',        icon: '🏢' },
  };

  function planMeta(name) {
    var key = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return PLAN_META[key] || PLAN_META[key.replace('day', '')] || { badge: '', desc: '', icon: '⭐' };
  }

  async function subscribe(planId, planName) {
    if (!window.oasisClient) { showStatusBrief('error', 'Not connected to OASIS API.'); return; }
    showStatus('info', 'Opening checkout for ' + planName + '…');
    try {
      var res = await window.oasisClient.subscription.createCheckoutSession({
        planId: planId,
        successUrl: window.location.origin + window.location.pathname + '?subscribed=1',
        cancelUrl:  window.location.origin + window.location.pathname,
      });
      var url = res && (res.url || res.sessionUrl || (res.result && (res.result.url || res.result.sessionUrl)));
      if (url) {
        window.location.href = url;
      } else {
        showStatusBrief('error', 'Could not start checkout — no redirect URL returned.');
      }
    } catch(e) {
      showStatusBrief('error', 'Checkout error: ' + (e && e.message || String(e)));
    }
  }

  async function loadPlans() {
    var list = getById('sub-plans-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading plans…</p></div>';
    if (!window.oasisClient) {
      if (list) list.innerHTML = '<div class="map-empty"><p>Connect your avatar to manage subscriptions.</p></div>';
      return;
    }
    try {
      var sdkRes = await window.oasisClient.subscription.getPlans();
      var plans = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      if (!list) return;
      if (!plans.length) {
        // Show static fallback plans if API returns nothing
        list.innerHTML = renderStaticPlans();
        bindPlanButtons(list);
        return;
      }
      list.innerHTML = plans.map(function(p) {
        var id      = p.id || p.Id || p.planId || '';
        var name    = p.name || p.Name || p.planName || 'Plan';
        var price   = p.price || p.Price || p.amount || '';
        var currency= p.currency || p.Currency || 'USD';
        var interval= p.interval || p.Interval || p.billingPeriod || 'month';
        var features= p.features || p.Features || [];
        var meta    = planMeta(name);
        var priceStr = price ? ('$' + price + '/' + interval) : 'Free';
        return '<div class="sub-plan-card">' +
          (meta.badge ? '<div class="sub-plan-badge">' + escHtml(meta.badge) + '</div>' : '') +
          '<div class="sub-plan-icon">' + meta.icon + '</div>' +
          '<div class="sub-plan-name">' + escHtml(name) + '</div>' +
          '<div class="sub-plan-desc">' + escHtml(meta.desc || p.description || '') + '</div>' +
          '<div class="sub-plan-price">' + escHtml(priceStr) + '</div>' +
          (Array.isArray(features) && features.length
            ? '<ul class="sub-plan-features">' + features.slice(0,6).map(function(f){ return '<li>' + escHtml(String(f)) + '</li>'; }).join('') + '</ul>'
            : '') +
          '<button class="sub-plan-btn" data-plan-id="' + escHtml(id) + '" data-plan-name="' + escHtml(name) + '">' +
            (name.toLowerCase().includes('enterprise') ? 'Contact Sales' : 'Subscribe') +
          '</button>' +
        '</div>';
      }).join('');
      bindPlanButtons(list);
    } catch(e) {
      if (list) {
        list.innerHTML = renderStaticPlans();
        bindPlanButtons(list);
      }
    }
  }

  function renderStaticPlans() {
    var plans = [
      { id: 'trial',      name: '14-Day Trial', price: 'Free',  desc: '14 days full access, no credit card required', badge: 'Trial',  features: ['All 250 MCP tools', 'Full API access', 'All operations', 'No credit card required'] },
      { id: 'free',       name: 'Free',         price: '$0/mo', desc: 'For exploration and testing',                  badge: '',       features: ['100 API calls/month', 'Read-only operations', 'Basic NFT tools', 'Community support'] },
      { id: 'bronze',     name: 'Bronze',        price: '$9/mo', desc: 'For developers getting started',              badge: '',       features: ['10,000 API calls/month', '1 GB storage', 'All read operations', 'Basic write operations'] },
      { id: 'silver',     name: 'Silver',        price: '$29/mo',desc: 'For individual developers',                   badge: 'Popular',features: ['100,000 API calls/month', '10 GB storage', 'All operations', 'NFT minting & transfers', 'Priority processing', 'Email support'] },
      { id: 'gold',       name: 'Gold',          price: '$99/mo',desc: 'For teams and production apps',               badge: '',       features: ['1,000,000 API calls/month', '100 GB storage', 'All features', 'Smart contract generation', 'A2A Protocol tools', 'Priority support'] },
      { id: 'enterprise', name: 'Enterprise',    price: 'Custom',desc: 'Custom limits, SLA, dedicated support',       badge: '',       features: ['Unlimited API calls', 'Unlimited storage', 'Custom integrations', 'SLA & SSO', 'Dedicated support', 'On-premise option'] },
    ];
    return plans.map(function(p) {
      var meta = planMeta(p.id);
      return '<div class="sub-plan-card">' +
        (p.badge ? '<div class="sub-plan-badge">' + escHtml(p.badge) + '</div>' : '') +
        '<div class="sub-plan-icon">' + meta.icon + '</div>' +
        '<div class="sub-plan-name">' + escHtml(p.name) + '</div>' +
        '<div class="sub-plan-desc">' + escHtml(p.desc) + '</div>' +
        '<div class="sub-plan-price">' + escHtml(p.price) + '</div>' +
        '<ul class="sub-plan-features">' + p.features.map(function(f){ return '<li>' + escHtml(f) + '</li>'; }).join('') + '</ul>' +
        '<button class="sub-plan-btn" data-plan-id="' + escHtml(p.id) + '" data-plan-name="' + escHtml(p.name) + '">' +
          (p.id === 'enterprise' ? 'Contact Sales' : 'Subscribe') +
        '</button>' +
      '</div>';
    }).join('');
  }

  function bindPlanButtons(container) {
    container.querySelectorAll('.sub-plan-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var planId   = btn.dataset.planId;
        var planName = btn.dataset.planName;
        if ((planName || '').toLowerCase().includes('enterprise')) {
          window.open('mailto:sales@oasisweb4.com?subject=Enterprise%20Plan%20Inquiry', '_blank');
        } else {
          subscribe(planId, planName);
        }
      });
    });
  }

  async function loadMySubscriptions() {
    var list = getById('sub-mysubs-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) {
      if (list) list.innerHTML = '<div class="map-empty"><p>Connect your avatar to see your subscriptions.</p></div>';
      return;
    }
    try {
      var sdkRes = await window.oasisClient.subscription.getMySubscriptions();
      var subs = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      if (subs.length) {
        var active = subs.find(function(s) { return s.status === 'active' || s.Status === 'active' || s.isActive || s.IsActive; });
        if (active) setText('sub-stat-plan', active.planName || active.PlanName || active.name || active.Name || '—');
      }
      if (!list) return;
      if (!subs.length) { list.innerHTML = '<div class="map-empty"><p>No active subscriptions. Select a plan above to get started.</p></div>'; return; }
      list.innerHTML = subs.map(function(s) {
        var name    = s.planName || s.PlanName || s.name || s.Name || 'Subscription';
        var status  = s.status   || s.Status   || 'active';
        var expires = fmtDate(s.expiresAt || s.ExpiresAt || s.endDate || '');
        return '<div class="modal-item-row">' +
          '<div class="modal-item-icon">📋</div>' +
          '<div class="modal-item-body">' +
            '<div class="modal-item-title">' + escHtml(name) + '</div>' +
            '<div class="modal-item-meta">Status: ' + escHtml(status) + (expires ? ' · Expires: ' + expires : '') + '</div>' +
          '</div>' +
          '<span class="modal-badge modal-badge--' + (status === 'active' ? 'green' : 'dim') + '">' + escHtml(status) + '</span>' +
        '</div>';
      }).join('');
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load subscriptions.</p></div>'; }
  }

  function loadMcpKey() {
    var keyEl   = getById('sub-mcp-key-value');
    var hintEl  = getById('sub-mcp-key-hint');
    var preEl   = getById('sub-mcp-config-pre');
    var copyBtn = getById('sub-mcp-copy-btn');

    var token = null;
    try {
      // Try SDK token store first
      if (window.oasisClient && window.oasisClient.http && window.oasisClient.http.tokenStore) {
        token = window.oasisClient.http.tokenStore.getToken();
      }
      // Fallback: check localStorage
      if (!token) {
        var session = localStorage.getItem('oasis_session') || localStorage.getItem('session');
        if (session) {
          var parsed = JSON.parse(session);
          token = parsed.jwtToken || parsed.token || parsed.jwt || null;
        }
      }
    } catch(e) {}

    if (token) {
      if (keyEl) keyEl.textContent = token;
      if (hintEl) hintEl.textContent = 'Copy this key into your IDE MCP config (see below). Keep it secret.';
      if (preEl) preEl.innerHTML = escHtml('{\n  "mcpServers": {\n    "oasis": {\n      "command": "oasis-mcp",\n      "env": {\n        "OASIS_API_URL": "https://api.web4.oasisomniverse.one",\n        "OASIS_MCP_LICENSE_KEY": "' + token + '"\n      }\n    }\n  }\n}');
      if (copyBtn) {
        copyBtn.onclick = function() {
          navigator.clipboard.writeText(token).then(function() {
            copyBtn.textContent = 'Copied!';
            setTimeout(function() { copyBtn.textContent = 'Copy'; }, 2000);
          }).catch(function() {
            var tmp = document.createElement('textarea');
            tmp.value = token;
            document.body.appendChild(tmp);
            tmp.select();
            document.execCommand('copy');
            document.body.removeChild(tmp);
            copyBtn.textContent = 'Copied!';
            setTimeout(function() { copyBtn.textContent = 'Copy'; }, 2000);
          });
        };
      }
    } else {
      if (keyEl) keyEl.textContent = '—';
      if (hintEl) hintEl.textContent = 'Sign in to your avatar to reveal your MCP license key.';
    }
  }

  async function loadUsage() {
    var panel = getById('sub-usage-panel');
    if (panel) panel.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) {
      if (panel) panel.innerHTML = '<div class="map-empty"><p>Connect your avatar to see usage.</p></div>';
      return;
    }
    try {
      var [usageRes, hdRes] = await Promise.all([
        window.oasisClient.subscription.getUsage().catch(function(){ return { isError: true }; }),
        window.oasisClient.subscription.getHyperDriveUsage().catch(function(){ return { isError: true }; }),
      ]);
      var usage = usageRes && !usageRes.isError ? (usageRes.result || usageRes) : null;
      var hd    = hdRes    && !hdRes.isError    ? (hdRes.result    || hdRes)    : null;
      var hdUsed  = hd && (hd.used   || hd.Used   || hd.usedBytes  || hd.storageUsed  || 0);
      var hdLimit = hd && (hd.limit  || hd.Limit  || hd.limitBytes || hd.storageLimit || 0);
      setText('sub-stat-hd-used',  fmtBytes(hdUsed));
      setText('sub-stat-hd-limit', fmtBytes(hdLimit));
      if (!panel) return;
      var rows = [];
      if (hd) {
        rows.push(['HyperDrive Used',  fmtBytes(hdUsed)]);
        rows.push(['HyperDrive Limit', fmtBytes(hdLimit)]);
        if (hdLimit > 0) { var pct = Math.round((hdUsed / hdLimit) * 100); rows.push(['Usage %', pct + '%']); }
      }
      if (usage) {
        Object.entries(usage).forEach(function(kv) {
          if (typeof kv[1] !== 'object' || kv[1] == null) rows.push([kv[0], String(kv[1])]);
        });
      }
      panel.innerHTML = rows.length ?
        '<div class="modal-kv-grid">' + rows.map(function(r) {
          return '<div class="modal-kv"><span class="modal-kv-label">' + escHtml(r[0]) + '</span><span class="modal-kv-value">' + escHtml(r[1]) + '</span></div>';
        }).join('') + '</div>' :
        '<div class="map-empty"><p>No usage data available.</p></div>';
    } catch(e) { if (panel) panel.innerHTML = '<div class="map-empty"><p>Could not load usage.</p></div>'; }
  }

  async function loadOrders() {
    var list = getById('sub-orders-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) {
      if (list) list.innerHTML = '<div class="map-empty"><p>Connect your avatar to see orders.</p></div>';
      return;
    }
    try {
      var sdkRes = await window.oasisClient.subscription.getMyOrders();
      var orders = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      if (!list) return;
      if (!orders.length) { list.innerHTML = '<div class="map-empty"><p>No orders found.</p></div>'; return; }
      list.innerHTML = orders.map(function(o) {
        var id     = o.id || o.Id || o.orderId || '';
        var name   = o.planName || o.PlanName || o.description || o.Description || 'Order';
        var amount = o.amount || o.Amount || o.total || '';
        var cur    = o.currency || o.Currency || 'USD';
        var date   = fmtDate(o.createdAt || o.CreatedAt || o.date || '');
        var status = o.status || o.Status || '';
        return '<div class="modal-item-row">' +
          '<div class="modal-item-icon">🧾</div>' +
          '<div class="modal-item-body">' +
            '<div class="modal-item-title">' + escHtml(name) + '</div>' +
            '<div class="modal-item-meta">' + (amount ? cur + ' ' + amount + ' · ' : '') + (date || '') + '</div>' +
          '</div>' +
          (status ? '<span class="modal-badge">' + escHtml(status) + '</span>' : '') +
        '</div>';
      }).join('');
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load orders.</p></div>'; }
  }

  function switchTab(tab) {
    var block = getById('subscription-modal-block');
    if (!block) return;
    block.querySelectorAll('.map-tab').forEach(function(t) { t.classList.toggle('is-active', t.dataset.tab === tab); });
    block.querySelectorAll('.map-tab-panel').forEach(function(p) { p.hidden = p.id !== 'sub-tab-' + tab; });
    if (tab === 'usage')  loadUsage();
    if (tab === 'orders') loadOrders();
    if (tab === 'mcp')    loadMcpKey();
    if (tab === 'mysubs') loadMySubscriptions();
  }

  function openSubscriptionModal(startTab) {
    var modal = document.querySelector('.js-modal');
    var block = getById('subscription-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    var tab = startTab || 'plans';
    switchTab(tab);
    loadPlans();
    loadMySubscriptions();
    return false;
  }

  function closeSubscriptionModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('subscription-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  // Check if returning from Stripe checkout
  function checkStripeReturn() {
    if (window.location.search.includes('subscribed=1')) {
      showStatusBrief('success', 'Subscription activated! Your plan is now live.');
      // Clean the query param from history
      var clean = window.location.pathname;
      history.replaceState({}, '', clean);
      // Switch straight to My Subscription tab
      setTimeout(function() { openSubscriptionModal('mysubs'); }, 500);
    }
  }

  function bind() {
    var block = getById('subscription-modal-block');
    if (!block || block.dataset.subBound === 'true') {
      window.openSubscriptionModal = openSubscriptionModal;
      window.closeSubscriptionModal = closeSubscriptionModal;
      return;
    }
    var closeBtn = getById('subscription-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e) { e.preventDefault(); closeSubscriptionModal(); });
    var tabBar = block.querySelector('.map-tabs');
    if (tabBar) tabBar.addEventListener('click', function(e) { var t = e.target.closest('.map-tab'); if (t) switchTab(t.dataset.tab); });
    block.dataset.subBound = 'true';
    window.openSubscriptionModal = openSubscriptionModal;
    window.closeSubscriptionModal = closeSubscriptionModal;
    checkStripeReturn();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); } else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
