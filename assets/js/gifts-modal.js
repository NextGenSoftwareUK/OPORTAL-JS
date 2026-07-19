(function () {
  'use strict';

  function getById(id) { return document.getElementById(id); }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function showStatus(type, msg) { var el = getById('gifts-status'); if (!el) return; el.className = 'gifts-status gifts-status--' + type; el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : ''); el.hidden = false; }
  function hideStatus() { var el = getById('gifts-status'); if (el) el.hidden = true; }
  function showStatusBrief(type, msg) { showStatus(type, msg); setTimeout(hideStatus, 3500); }
  function setText(id, v) { var el = getById(id); if (el) el.textContent = v; }
  function fmtDate(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString(); } catch(e) { return ''; } }
  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    return [];
  }

  function buildGiftRow(g, isPending) {
    var id      = g.id || g.Id || g.giftId || '';
    var from    = g.fromAvatarName || g.fromUsername || g.senderName || 'Unknown';
    var to      = g.toAvatarName   || g.toUsername   || g.recipientName || '';
    var msg     = g.message || g.Message || g.note || '';
    var date    = fmtDate(g.sentDate || g.SentDate || g.createdDate || g.date || '');
    var opened  = g.isOpened || g.IsOpened || g.opened || false;
    return '<div class="modal-item-row">' +
      '<div class="modal-item-icon">🎁</div>' +
      '<div class="modal-item-body">' +
        '<div class="modal-item-title">From: ' + escHtml(from) + (to ? ' → ' + escHtml(to) : '') + '</div>' +
        (msg  ? '<div class="modal-item-meta">' + escHtml(msg) + '</div>' : '') +
        (date ? '<div class="modal-item-meta">' + escHtml(date) + '</div>' : '') +
      '</div>' +
      '<div class="modal-item-actions">' +
        (isPending && !opened && id ? '<button class="button button--primary modal-btn-sm" data-gift-open="' + escHtml(id) + '">Open</button>' : '') +
        (isPending && !opened && id ? '<button class="button button--ghost modal-btn-sm" data-gift-receive="' + escHtml(id) + '">Receive</button>' : '') +
        (!isPending && opened ? '<span class="modal-badge modal-badge--dim">Opened</span>' : '') +
      '</div>' +
    '</div>';
  }

  async function loadMyGifts() {
    var list = getById('gifts-inbox-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) return;
    try {
      var [giftsRes, statsRes] = await Promise.all([
        window.oasisClient.gifts.getMyGifts().catch(function(){ return { isError: true }; }),
        window.oasisClient.gifts.getGiftStats().catch(function(){ return { isError: true }; }),
      ]);
      var gifts = extractList(giftsRes && !giftsRes.isError ? giftsRes.result : null);
      var stats = statsRes && !statsRes.isError ? (statsRes.result || statsRes) : null;
      var pending = gifts.filter(function(g) { return !(g.isOpened || g.IsOpened || g.opened); });
      setText('gifts-stat-pending', pending.length || '0');
      if (stats) {
        setText('gifts-stat-sent',     stats.totalSent     || stats.TotalSent     || '—');
        setText('gifts-stat-received', stats.totalReceived || stats.TotalReceived || '—');
      }
      if (!list) return;
      if (!gifts.length) { list.innerHTML = '<div class="map-empty"><div class="map-empty-icon">🎁</div><p>No gifts yet.</p></div>'; return; }
      list.innerHTML = gifts.map(function(g) { return buildGiftRow(g, true); }).join('');
      bindGiftActions(list);
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load gifts.</p></div>'; }
  }

  function bindGiftActions(container) {
    container.querySelectorAll('[data-gift-open]').forEach(function(btn) {
      btn.addEventListener('click', function() { openGift(btn.dataset.giftOpen, btn); });
    });
    container.querySelectorAll('[data-gift-receive]').forEach(function(btn) {
      btn.addEventListener('click', function() { receiveGift(btn.dataset.giftReceive, btn); });
    });
  }

  async function openGift(giftId, btn) {
    if (!window.oasisClient) return;
    if (btn) btn.disabled = true;
    try {
      var sdkRes = await window.oasisClient.gifts.openGift({ giftId: giftId });
      if (sdkRes && !sdkRes.isError) { showStatusBrief('success', '🎁 Gift opened!'); loadMyGifts(); }
      else { showStatusBrief('error', (sdkRes && sdkRes.message) || 'Could not open gift.'); if (btn) btn.disabled = false; }
    } catch(e) { showStatusBrief('error', 'Error opening gift.'); if (btn) btn.disabled = false; }
  }

  async function receiveGift(giftId, btn) {
    if (!window.oasisClient) return;
    if (btn) btn.disabled = true;
    try {
      var sdkRes = await window.oasisClient.gifts.receiveGift({ giftId: giftId });
      if (sdkRes && !sdkRes.isError) { showStatusBrief('success', 'Gift received!'); loadMyGifts(); }
      else { showStatusBrief('error', (sdkRes && sdkRes.message) || 'Could not receive gift.'); if (btn) btn.disabled = false; }
    } catch(e) { showStatusBrief('error', 'Error receiving gift.'); if (btn) btn.disabled = false; }
  }

  async function sendGift() {
    var toEl   = getById('gifts-to-id');
    var msgEl  = getById('gifts-message');
    var itemEl = getById('gifts-item-id');
    var btn    = getById('gifts-send-btn');
    if (!toEl || !toEl.value.trim()) { showStatusBrief('warn', 'Please enter a recipient avatar ID.'); return; }
    if (!window.oasisClient) { showStatusBrief('error', 'SDK not ready.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      var payload = { message: msgEl ? msgEl.value.trim() : '' };
      if (itemEl && itemEl.value.trim()) payload.itemId = itemEl.value.trim();
      var sdkRes = await window.oasisClient.gifts.sendGift(Object.assign({ toAvatarId: toEl.value.trim() }, payload));
      if (sdkRes && !sdkRes.isError) {
        showStatusBrief('success', 'Gift sent!');
        toEl.value = ''; if (msgEl) msgEl.value = ''; if (itemEl) itemEl.value = '';
      } else { showStatusBrief('error', (sdkRes && sdkRes.message) || 'Could not send gift.'); }
    } catch(e) { showStatusBrief('error', 'Error sending gift.'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Send Gift'; }
  }

  async function loadHistory() {
    var list = getById('gifts-history-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) return;
    try {
      var sdkRes = await window.oasisClient.gifts.getGiftHistory();
      var history = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      if (!list) return;
      if (!history.length) { list.innerHTML = '<div class="map-empty"><p>No gift history.</p></div>'; return; }
      list.innerHTML = history.map(function(g) { return buildGiftRow(g, false); }).join('');
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load history.</p></div>'; }
  }

  function switchTab(tab) {
    var block = getById('gifts-modal-block');
    if (!block) return;
    block.querySelectorAll('.map-tab').forEach(function(t) { t.classList.toggle('is-active', t.dataset.tab === tab); });
    block.querySelectorAll('.map-tab-panel').forEach(function(p) { p.hidden = p.id !== 'gifts-tab-' + tab; });
    if (tab === 'history') loadHistory();
  }

  function openGiftsModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('gifts-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('inbox'); loadMyGifts();
    return false;
  }

  function closeGiftsModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('gifts-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = getById('gifts-modal-block');
    if (!block || block.dataset.giftsBound === 'true') { window.openGiftsModal = openGiftsModal; window.closeGiftsModal = closeGiftsModal; return; }
    var closeBtn = getById('gifts-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e) { e.preventDefault(); closeGiftsModal(); });
    var tabBar = block.querySelector('.map-tabs');
    if (tabBar) tabBar.addEventListener('click', function(e) { var t = e.target.closest('.map-tab'); if (t) switchTab(t.dataset.tab); });
    var refreshBtn = getById('gifts-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadMyGifts);
    var sendBtn = getById('gifts-send-btn');
    if (sendBtn) sendBtn.addEventListener('click', sendGift);
    block.dataset.giftsBound = 'true';
    window.openGiftsModal = openGiftsModal; window.closeGiftsModal = closeGiftsModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); } else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
