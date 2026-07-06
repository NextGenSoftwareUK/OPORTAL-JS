(function () {
  'use strict';

  var API_BASE = window.web5ApiUrl || window.apiUrl || '';

  function getProfile() { try { return JSON.parse(localStorage.getItem('avatar') || 'null'); } catch (e) { return null; } }
  function getToken(p) { return p && (p.jwtToken || p.JwtToken || p.token || p.Token || ''); }
  function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmtDate(d) { try { return d ? new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : ''; } catch(e){return '';} }

  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    var r = data.result || data.Result || data.data || data.Data;
    if (Array.isArray(r)) return r;
    var r2 = r && (r.result || r.Result);
    if (Array.isArray(r2)) return r2;
    return [];
  }

  var STATUS_COLOURS = { active:'#48dc82', completed:'#00e5ff', failed:'#ff7070', inactive:'#ffb43c' };
  function statusColour(s) { return STATUS_COLOURS[(s||'').toLowerCase()] || '#a8bfd8'; }

  function renderMission(m) {
    var name = escHtml(m.name || m.Name || m.title || m.Title || 'Unnamed Mission');
    var desc = escHtml(m.description || m.Description || '');
    var status = m.status || m.Status || m.missionStatus || m.MissionStatus || '';
    var type = escHtml(m.missionType || m.MissionType || m.type || m.Type || '');
    var xp = m.xpReward || m.XPReward || m.rewardXP || m.RewardXP || '';
    var karma = m.karmaReward || m.KarmaReward || '';
    var quests = m.quests || m.Quests || [];
    var startDate = m.startDate || m.StartDate || m.createdDate || m.CreatedDate || '';
    return '<div class="mission-card">' +
      '<div class="mission-card-header">' +
        '<div class="mission-card-name">' + name + '</div>' +
        (status ? '<span class="mission-status-badge" style="color:' + statusColour(status) + '">' + escHtml(status) + '</span>' : '') +
      '</div>' +
      (desc ? '<div class="mission-card-desc">' + desc + '</div>' : '') +
      (quests.length ? '<div class="mission-quests-count">&#127918; ' + quests.length + ' quest' + (quests.length !== 1 ? 's' : '') + '</div>' : '') +
      '<div class="mission-card-footer">' +
        (type ? '<span class="mission-tag">' + type + '</span>' : '') +
        (xp ? '<span class="mission-reward">+' + xp + ' XP</span>' : '') +
        (karma ? '<span class="mission-reward mission-reward--karma">+' + karma + ' Karma</span>' : '') +
        (startDate ? '<span class="mission-date">' + fmtDate(startDate) + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  async function loadAllMissions() {
    var p = getProfile(); var token = getToken(p);
    var el = document.getElementById('missions-all-list');
    if (!el) return;
    el.innerHTML = '<div class="missions-loading">Loading missions…</div>';
    try {
      var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      var res = await fetch(API_BASE + '/api/Missions', { headers: headers });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      el.innerHTML = list.length ? list.map(renderMission).join('') : '<div class="missions-empty"><div class="missions-empty-icon">&#9876;</div><p>No missions available yet.<br>Complete quests to unlock missions.</p></div>';
    } catch (e) {
      el.innerHTML = '<div class="missions-empty"><p>Could not load missions.</p></div>';
    }
  }

  async function searchMissions() {
    var q = (document.getElementById('missions-search-input') || {}).value || '';
    var el = document.getElementById('missions-search-results');
    if (!el || !q.trim()) return;
    var p = getProfile(); var token = getToken(p);
    el.innerHTML = '<div class="missions-loading">Searching…</div>';
    try {
      var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      var res = await fetch(API_BASE + '/api/Missions/search?query=' + encodeURIComponent(q), { headers: headers });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      el.innerHTML = list.length ? list.map(renderMission).join('') : '<div class="missions-empty"><p>No missions found for "' + escHtml(q) + '".</p></div>';
    } catch (e) {
      el.innerHTML = '<div class="missions-empty"><p>Search failed.</p></div>';
    }
  }

  function switchTab(tab) {
    document.querySelectorAll('.missions-tab').forEach(function(b){ b.classList.toggle('is-active', b.dataset.tab === tab); });
    document.querySelectorAll('.missions-tab-panel').forEach(function(p){ p.hidden = p.id !== 'missions-tab-' + tab; });
    if (tab === 'all') loadAllMissions();
  }

  function openMissionsModal() {
    var modal = document.querySelector('.js-modal');
    var block = document.getElementById('missions-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b){ b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('all');
    return false;
  }

  function closeMissionsModal() {
    var modal = document.querySelector('.js-modal');
    var block = document.getElementById('missions-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = document.getElementById('missions-modal-block');
    if (!block || block.dataset.missionsBound === 'true') { window.openMissionsModal = openMissionsModal; window.closeMissionsModal = closeMissionsModal; return; }

    var closeBtn = document.getElementById('missions-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e){ e.preventDefault(); closeMissionsModal(); });

    document.querySelectorAll('.missions-tab').forEach(function(btn) {
      btn.addEventListener('click', function(){ switchTab(btn.dataset.tab); });
    });

    var searchBtn = document.getElementById('missions-search-btn');
    if (searchBtn) searchBtn.addEventListener('click', searchMissions);
    var searchInput = document.getElementById('missions-search-input');
    if (searchInput) searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') searchMissions(); });

    block.dataset.missionsBound = 'true';
    window.openMissionsModal = openMissionsModal;
    window.closeMissionsModal = closeMissionsModal;
  }

  window.addEventListener('portal-components-ready', bind);
  if (document.readyState !== 'loading') bind();
  else document.addEventListener('DOMContentLoaded', bind);
})();
