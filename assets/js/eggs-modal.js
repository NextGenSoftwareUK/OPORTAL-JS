(function () {
  'use strict';

  var API_BASE = window.apiUrl || '';

  function getProfile() { try { return JSON.parse(localStorage.getItem('avatar') || 'null'); } catch (e) { return null; } }
  function getToken(p) { return p && (p.jwtToken || p.JwtToken || p.token || p.Token || ''); }
  function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    var r = data.result || data.Result || data.data || data.Data;
    if (Array.isArray(r)) return r;
    var r2 = r && (r.result || r.Result);
    if (Array.isArray(r2)) return r2;
    return [];
  }

  var EGG_ICONS = { dragon:'&#129430;', phoenix:'&#129413;', unicorn:'&#129412;', turtle:'&#128034;', default:'&#129424;' };
  function eggIcon(type) { return EGG_ICONS[(type||'').toLowerCase()] || EGG_ICONS.default; }

  function renderEgg(egg, canHatch) {
    var name = escHtml(egg.name || egg.Name || 'Unknown Egg');
    var type = egg.eggType || egg.EggType || egg.type || egg.Type || '';
    var hatched = egg.isHatched || egg.IsHatched || false;
    var id = egg.id || egg.Id || '';
    return '<div class="egg-card' + (hatched ? ' egg-card--hatched' : '') + '">' +
      '<div class="egg-card-icon">' + eggIcon(type) + '</div>' +
      '<div class="egg-card-name">' + name + '</div>' +
      (type ? '<div class="egg-card-type">' + escHtml(type) + '</div>' : '') +
      (hatched
        ? '<div class="egg-card-hatched">Hatched &#10003;</div>'
        : (canHatch && id ? '<button class="egg-hatch-btn" data-egg-id="' + escHtml(id) + '">Hatch</button>' : '<div class="egg-card-unhatched">Not yet hatched</div>')
      ) +
    '</div>';
  }

  function renderEggQuest(q) {
    var name = escHtml(q.name || q.Name || q.title || q.Title || 'Egg Quest');
    var desc = escHtml(q.description || q.Description || '');
    var reward = q.eggReward || q.EggReward || q.reward || q.Reward || '';
    return '<div class="egg-quest-item">' +
      '<div class="egg-quest-name">' + name + '</div>' +
      (desc ? '<div class="egg-quest-desc">' + desc + '</div>' : '') +
      (reward ? '<div class="egg-quest-reward">Reward: ' + escHtml(String(reward)) + '</div>' : '') +
    '</div>';
  }

  function renderLeaderboard(entries) {
    if (!entries.length) return '<div class="eggs-empty"><p>No leaderboard data yet.</p></div>';
    return '<table class="eggs-leaderboard-table"><thead><tr><th>#</th><th>Avatar</th><th>Eggs</th><th>Score</th></tr></thead><tbody>' +
      entries.map(function(e, i) {
        var avatar = escHtml(e.avatarUsername || e.AvatarUsername || e.username || e.Username || 'Unknown');
        var count = e.eggCount || e.EggCount || e.count || e.Count || 0;
        var score = e.score || e.Score || e.totalScore || e.TotalScore || 0;
        return '<tr' + (i < 3 ? ' class="eggs-lb-top"' : '') + '><td>' + (i+1) + '</td><td>' + avatar + '</td><td>' + count + '</td><td>' + score + '</td></tr>';
      }).join('') +
    '</tbody></table>';
  }

  async function loadMyEggs() {
    var p = getProfile(); var token = getToken(p);
    var el = document.getElementById('eggs-my-grid');
    if (!el) return;
    if (!token) { el.innerHTML = '<div class="eggs-empty"><p>Please log in to view your eggs.</p></div>'; return; }
    el.innerHTML = '<div class="eggs-loading">Loading your eggs…</div>';
    try {
      var res = await fetch(API_BASE + '/api/eggs/my-eggs', { headers: { 'Authorization': 'Bearer ' + token } });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      if (!list.length) {
        el.innerHTML = '<div class="eggs-empty"><div class="eggs-empty-icon">&#129424;</div><p>You haven\'t collected any eggs yet.<br>Explore the map to discover hidden eggs!</p></div>';
      } else {
        el.innerHTML = list.map(function(e){ return renderEgg(e, true); }).join('');
        el.querySelectorAll('.egg-hatch-btn').forEach(function(btn) {
          btn.addEventListener('click', function(){ hatchEgg(btn.dataset.eggId, token); });
        });
      }
    } catch (e) {
      el.innerHTML = '<div class="eggs-empty"><p>Could not load eggs.</p></div>';
    }
  }

  async function loadAllEggs() {
    var p = getProfile(); var token = getToken(p);
    var el = document.getElementById('eggs-all-grid');
    if (!el) return;
    el.innerHTML = '<div class="eggs-loading">Loading all eggs…</div>';
    try {
      var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      var res = await fetch(API_BASE + '/api/eggs/get-all-eggs', { headers: headers });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      el.innerHTML = list.length ? list.map(function(e){ return renderEgg(e, false); }).join('') : '<div class="eggs-empty"><div class="eggs-empty-icon">&#129424;</div><p>No eggs found in the OASIS yet.</p></div>';
    } catch (e) {
      el.innerHTML = '<div class="eggs-empty"><p>Could not load eggs.</p></div>';
    }
  }

  async function loadEggQuests() {
    var p = getProfile(); var token = getToken(p);
    var el = document.getElementById('eggs-quests-list');
    if (!el) return;
    el.innerHTML = '<div class="eggs-loading">Loading egg quests…</div>';
    try {
      var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      var res = await fetch(API_BASE + '/api/eggs/get-current-egg-quests', { headers: headers });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      el.innerHTML = list.length ? list.map(renderEggQuest).join('') : '<div class="eggs-empty"><p>No active egg quests right now.</p></div>';
    } catch (e) {
      el.innerHTML = '<div class="eggs-empty"><p>Could not load egg quests.</p></div>';
    }
  }

  async function loadLeaderboard() {
    var p = getProfile(); var token = getToken(p);
    var el = document.getElementById('eggs-leaderboard-list');
    if (!el) return;
    el.innerHTML = '<div class="eggs-loading">Loading leaderboard…</div>';
    try {
      var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      var res = await fetch(API_BASE + '/api/eggs/get-current-egg-quest-leader-board', { headers: headers });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      el.innerHTML = renderLeaderboard(list);
    } catch (e) {
      el.innerHTML = '<div class="eggs-empty"><p>Could not load leaderboard.</p></div>';
    }
  }

  async function hatchEgg(eggId, token) {
    var statusEl = document.getElementById('eggs-status');
    if (statusEl) { statusEl.textContent = 'Hatching egg…'; statusEl.className = 'eggs-status eggs-status--loading'; statusEl.hidden = false; }
    try {
      var res = await fetch(API_BASE + '/api/eggs/hatch/' + encodeURIComponent(eggId), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } });
      if (res.ok) {
        if (statusEl) { statusEl.textContent = '&#129424; Egg hatched successfully!'; statusEl.className = 'eggs-status eggs-status--success'; setTimeout(function(){ statusEl.hidden = true; }, 4000); }
        loadMyEggs();
      } else {
        if (statusEl) { statusEl.textContent = 'Failed to hatch egg.'; statusEl.className = 'eggs-status eggs-status--error'; setTimeout(function(){ statusEl.hidden = true; }, 4000); }
      }
    } catch (e) {
      if (statusEl) { statusEl.textContent = 'Error hatching egg.'; statusEl.className = 'eggs-status eggs-status--error'; setTimeout(function(){ statusEl.hidden = true; }, 4000); }
    }
  }

  function switchTab(tab) {
    document.querySelectorAll('.eggs-tab').forEach(function(b){ b.classList.toggle('is-active', b.dataset.tab === tab); });
    document.querySelectorAll('.eggs-tab-panel').forEach(function(p){ p.hidden = p.id !== 'eggs-tab-' + tab; });
    if (tab === 'my') loadMyEggs();
    if (tab === 'all') loadAllEggs();
    if (tab === 'quests') loadEggQuests();
    if (tab === 'leaderboard') loadLeaderboard();
  }

  function openEggsModal() {
    var modal = document.querySelector('.js-modal');
    var block = document.getElementById('eggs-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b){ b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('my');
    return false;
  }

  function closeEggsModal() {
    var modal = document.querySelector('.js-modal');
    var block = document.getElementById('eggs-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = document.getElementById('eggs-modal-block');
    if (!block || block.dataset.eggsBound === 'true') { window.openEggsModal = openEggsModal; window.closeEggsModal = closeEggsModal; return; }

    var closeBtn = document.getElementById('eggs-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e){ e.preventDefault(); closeEggsModal(); });

    document.querySelectorAll('.eggs-tab').forEach(function(btn) {
      btn.addEventListener('click', function(){ switchTab(btn.dataset.tab); });
    });

    block.dataset.eggsBound = 'true';
    window.openEggsModal = openEggsModal;
    window.closeEggsModal = closeEggsModal;
  }

  window.addEventListener('portal-components-ready', bind);
  if (document.readyState !== 'loading') bind();
  else document.addEventListener('DOMContentLoaded', bind);
})();
