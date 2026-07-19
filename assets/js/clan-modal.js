(function () {
  'use strict';

  function getById(id) { return document.getElementById(id); }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function showStatus(type, msg) { var el = getById('clan-status'); if (!el) return; el.className = 'clan-status clan-status--' + type; el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : ''); el.hidden = false; }
  function hideStatus() { var el = getById('clan-status'); if (el) el.hidden = true; }
  function showStatusBrief(type, msg) { showStatus(type, msg); setTimeout(hideStatus, 3500); }
  function setText(id, v) { var el = getById(id); if (el) el.textContent = v; }
  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    return [];
  }

  var _selectedClanId = null;

  async function loadClans() {
    var list = getById('clan-browse-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) return;
    try {
      var sdkRes = await window.oasisClient.clan.list();
      var clans = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      setText('clan-stat-total', clans.length || '0');
      if (!list) return;
      if (!clans.length) { list.innerHTML = '<div class="map-empty"><div class="map-empty-icon">🛡️</div><p>No clans found.</p></div>'; return; }
      list.innerHTML = clans.map(function(c) {
        var id      = c.id || c.Id || c.clanId || '';
        var name    = c.name || c.Name || 'Unnamed Clan';
        var desc    = c.description || c.Description || '';
        var members = c.memberCount || c.MemberCount || c.members || '';
        return '<div class="modal-item-row">' +
          '<div class="modal-item-icon">🛡️</div>' +
          '<div class="modal-item-body">' +
            '<div class="modal-item-title">' + escHtml(name) + '</div>' +
            (desc ? '<div class="modal-item-meta">' + escHtml(desc) + '</div>' : '') +
            (members ? '<div class="modal-item-meta">' + members + ' members</div>' : '') +
          '</div>' +
          (id ? '<div class="modal-item-actions"><button class="button button--ghost modal-btn-sm" data-clan-view="' + escHtml(id) + '">View</button></div>' : '') +
        '</div>';
      }).join('');
      list.querySelectorAll('[data-clan-view]').forEach(function(btn) {
        btn.addEventListener('click', function() { viewClan(btn.dataset.clanView); });
      });
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load clans.</p></div>'; }
  }

  async function viewClan(clanId) {
    _selectedClanId = clanId;
    switchTab('detail');
    var panel = getById('clan-detail-panel');
    if (panel) panel.innerHTML = '<div class="map-empty"><p>Loading clan…</p></div>';
    if (!window.oasisClient) return;
    try {
      var [clanRes, membersRes] = await Promise.all([
        window.oasisClient.clan.load({ 'clanId:guid': clanId }).catch(function(){ return { isError: true }; }),
        window.oasisClient.clan.getMembers({ 'clanId:guid': clanId }).catch(function(){ return { isError: true }; }),
      ]);
      var clan    = clanRes    && !clanRes.isError    ? (clanRes.result    || clanRes)    : null;
      var members = membersRes && !membersRes.isError ? extractList(membersRes.result) : [];
      var name = clan && (clan.name || clan.Name || 'Clan');
      var desc = clan && (clan.description || clan.Description || '');
      panel.innerHTML =
        '<h3 class="modal-section-title">' + escHtml(name || 'Clan') + '</h3>' +
        (desc ? '<p class="modal-section-lead">' + escHtml(desc) + '</p>' : '') +
        '<div class="modal-section-label">MEMBERS (' + members.length + ')</div>' +
        (members.length ? members.map(function(m) {
          var mname = m.username || m.UserName || m.name || m.Name || 'Unknown';
          var mid   = m.id || m.Id || m.avatarId || '';
          return '<div class="modal-item-row">' +
            '<div class="modal-item-icon">👤</div>' +
            '<div class="modal-item-body"><div class="modal-item-title">' + escHtml(mname) + '</div></div>' +
            (mid ? '<div class="modal-item-actions"><button class="button button--ghost modal-btn-sm modal-btn-danger" data-clan-remove="' + escHtml(mid) + '">Remove</button></div>' : '') +
          '</div>';
        }).join('') : '<div class="map-empty"><p>No members.</p></div>') +
        '<div class="modal-section-actions">' +
          '<button class="button button--ghost" id="clan-leave-btn">Leave Clan</button>' +
        '</div>';
      setText('clan-stat-mine', name || '—');
      panel.querySelectorAll('[data-clan-remove]').forEach(function(btn) {
        btn.addEventListener('click', function() { removeMember(clanId, btn.dataset.clanRemove, btn); });
      });
      var leaveBtn = getById('clan-leave-btn');
      if (leaveBtn) leaveBtn.addEventListener('click', function() { leaveClan(clanId); });
    } catch(e) { if (panel) panel.innerHTML = '<div class="map-empty"><p>Could not load clan details.</p></div>'; }
  }

  async function removeMember(clanId, avatarId, btn) {
    if (!window.oasisClient || !clanId || !avatarId) return;
    if (btn) btn.disabled = true;
    try {
      var sdkRes = await window.oasisClient.clan.removeAvatarFromClan({ 'clanId:guid': clanId, 'avatarId:guid': avatarId });
      if (sdkRes && !sdkRes.isError) { showStatusBrief('success', 'Member removed.'); viewClan(clanId); }
      else { showStatusBrief('error', (sdkRes && sdkRes.message) || 'Could not remove member.'); if (btn) btn.disabled = false; }
    } catch(e) { showStatusBrief('error', 'Error removing member.'); if (btn) btn.disabled = false; }
  }

  async function leaveClan(clanId) {
    try {
      var profile = JSON.parse(localStorage.getItem('avatar') || 'null');
      var avatarId = profile && (profile.id || profile.Id || profile.avatarId || '');
      if (!avatarId) { showStatusBrief('warn', 'Not logged in.'); return; }
      await removeMember(clanId, avatarId, null);
      _selectedClanId = null;
      setText('clan-stat-mine', '—');
      switchTab('browse');
    } catch(e) {}
  }

  async function createClan() {
    var nameEl = getById('clan-create-name');
    var descEl = getById('clan-create-desc');
    var btn    = getById('clan-create-btn');
    if (!nameEl || !nameEl.value.trim()) { showStatusBrief('warn', 'Please enter a clan name.'); return; }
    if (!window.oasisClient) { showStatusBrief('error', 'SDK not ready.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
    try {
      var sdkRes = await window.oasisClient.clan.create({ name: nameEl.value.trim(), description: descEl ? descEl.value.trim() : '' });
      if (sdkRes && !sdkRes.isError) {
        showStatusBrief('success', 'Clan created!');
        nameEl.value = ''; if (descEl) descEl.value = '';
        switchTab('browse'); loadClans();
      } else { showStatusBrief('error', (sdkRes && sdkRes.message) || 'Could not create clan.'); }
    } catch(e) { showStatusBrief('error', 'Error creating clan.'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Create Clan'; }
  }

  function switchTab(tab) {
    var block = getById('clan-modal-block');
    if (!block) return;
    block.querySelectorAll('.map-tab').forEach(function(t) { t.classList.toggle('is-active', t.dataset.tab === tab); });
    block.querySelectorAll('.map-tab-panel').forEach(function(p) { p.hidden = p.id !== 'clan-tab-' + tab; });
  }

  function openClanModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('clan-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('browse'); loadClans();
    return false;
  }

  function closeClanModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('clan-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = getById('clan-modal-block');
    if (!block || block.dataset.clanBound === 'true') { window.openClanModal = openClanModal; window.closeClanModal = closeClanModal; return; }
    var closeBtn = getById('clan-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e) { e.preventDefault(); closeClanModal(); });
    var tabBar = block.querySelector('.map-tabs');
    if (tabBar) tabBar.addEventListener('click', function(e) { var t = e.target.closest('.map-tab'); if (t) { switchTab(t.dataset.tab); if (t.dataset.tab === 'browse') loadClans(); } });
    var refreshBtn = getById('clan-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadClans);
    var createBtn = getById('clan-create-btn');
    if (createBtn) createBtn.addEventListener('click', createClan);
    block.dataset.clanBound = 'true';
    window.openClanModal = openClanModal; window.closeClanModal = closeClanModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); } else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
