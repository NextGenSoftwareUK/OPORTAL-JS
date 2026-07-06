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

  function renderQuest(q) {
    var name = escHtml(q.name || q.Name || q.title || q.Title || 'Unnamed Quest');
    var desc = escHtml(q.description || q.Description || '');
    var status = q.status || q.Status || q.questStatus || q.QuestStatus || '';
    var type = escHtml(q.questType || q.QuestType || q.type || q.Type || '');
    var xp = q.xpReward || q.XPReward || q.rewardXP || q.RewardXP || '';
    var karma = q.karmaReward || q.KarmaReward || '';
    var objectives = q.objectives || q.Objectives || [];
    var dueDate = q.completionDate || q.CompletionDate || q.dueDate || q.DueDate || '';
    return '<div class="quest-card">' +
      '<div class="quest-card-header">' +
        '<div class="quest-card-name">' + name + '</div>' +
        (status ? '<span class="quest-status-badge" style="color:' + statusColour(status) + '">' + escHtml(status) + '</span>' : '') +
      '</div>' +
      (desc ? '<div class="quest-card-desc">' + desc + '</div>' : '') +
      (objectives.length ? '<div class="quest-objectives"><span class="quest-obj-label">Objectives:</span> ' + objectives.length + ' task' + (objectives.length !== 1 ? 's' : '') + '</div>' : '') +
      '<div class="quest-card-footer">' +
        (type ? '<span class="quest-tag">' + type + '</span>' : '') +
        (xp ? '<span class="quest-reward">+' + xp + ' XP</span>' : '') +
        (karma ? '<span class="quest-reward quest-reward--karma">+' + karma + ' Karma</span>' : '') +
        (dueDate ? '<span class="quest-date">' + fmtDate(dueDate) + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  async function loadMyQuests() {
    var p = getProfile(); var token = getToken(p);
    var el = document.getElementById('quests-my-list');
    if (!el) return;
    if (!token) { el.innerHTML = '<div class="quests-empty"><p>Please log in to view your quests.</p></div>'; return; }
    el.innerHTML = '<div class="quests-loading">Loading your quests…</div>';
    try {
      var res = await fetch(API_BASE + '/api/Quests/all-for-avatar', { headers: { 'Authorization': 'Bearer ' + token } });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      el.innerHTML = list.length ? list.map(renderQuest).join('') : '<div class="quests-empty"><div class="quests-empty-icon">&#127918;</div><p>No quests found.<br>Explore the OASIS to discover quests.</p></div>';
    } catch (e) {
      el.innerHTML = '<div class="quests-empty"><p>Could not load quests.</p></div>';
    }
  }

  async function loadAllQuests() {
    var p = getProfile(); var token = getToken(p);
    var el = document.getElementById('quests-all-list');
    if (!el) return;
    el.innerHTML = '<div class="quests-loading">Loading quests…</div>';
    try {
      var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      var res = await fetch(API_BASE + '/api/Quests', { headers: headers });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      el.innerHTML = list.length ? list.map(renderQuest).join('') : '<div class="quests-empty"><div class="quests-empty-icon">&#127918;</div><p>No quests available yet.</p></div>';
    } catch (e) {
      el.innerHTML = '<div class="quests-empty"><p>Could not load quests.</p></div>';
    }
  }

  async function searchQuests() {
    var q = (document.getElementById('quests-search-input') || {}).value || '';
    var el = document.getElementById('quests-search-results');
    if (!el || !q.trim()) return;
    var p = getProfile(); var token = getToken(p);
    el.innerHTML = '<div class="quests-loading">Searching…</div>';
    try {
      var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      var res = await fetch(API_BASE + '/api/Quests/search?query=' + encodeURIComponent(q), { headers: headers });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      el.innerHTML = list.length ? list.map(renderQuest).join('') : '<div class="quests-empty"><p>No quests found for "' + escHtml(q) + '".</p></div>';
    } catch (e) {
      el.innerHTML = '<div class="quests-empty"><p>Search failed.</p></div>';
    }
  }

  function switchTab(tab) {
    document.querySelectorAll('.quests-tab').forEach(function(b){ b.classList.toggle('is-active', b.dataset.tab === tab); });
    document.querySelectorAll('.quests-tab-panel').forEach(function(p){ p.hidden = p.id !== 'quests-tab-' + tab; });
    if (tab === 'my') loadMyQuests();
    if (tab === 'all') loadAllQuests();
  }

  function openQuestsModal() {
    var modal = document.querySelector('.js-modal');
    var block = document.getElementById('quests-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b){ b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('my');
    return false;
  }

  function closeQuestsModal() {
    var modal = document.querySelector('.js-modal');
    var block = document.getElementById('quests-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = document.getElementById('quests-modal-block');
    if (!block || block.dataset.questsBound === 'true') { window.openQuestsModal = openQuestsModal; window.closeQuestsModal = closeQuestsModal; return; }

    var closeBtn = document.getElementById('quests-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e){ e.preventDefault(); closeQuestsModal(); });

    document.querySelectorAll('.quests-tab').forEach(function(btn) {
      btn.addEventListener('click', function(){ switchTab(btn.dataset.tab); });
    });

    var searchBtn = document.getElementById('quests-search-btn');
    if (searchBtn) searchBtn.addEventListener('click', searchQuests);
    var searchInput = document.getElementById('quests-search-input');
    if (searchInput) searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') searchQuests(); });

    block.dataset.questsBound = 'true';
    window.openQuestsModal = openQuestsModal;
    window.closeQuestsModal = closeQuestsModal;
  }

  window.addEventListener('portal-components-ready', bind);
  if (document.readyState !== 'loading') bind();
  else document.addEventListener('DOMContentLoaded', bind);
})();
