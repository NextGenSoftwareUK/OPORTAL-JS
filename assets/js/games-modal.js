(function () {
  'use strict';

  function getById(id) { return document.getElementById(id); }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function showStatus(type, msg) { var el = getById('games-status'); if (!el) return; el.className = 'games-status games-status--' + type; el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : ''); el.hidden = false; }
  function hideStatus() { var el = getById('games-status'); if (el) el.hidden = true; }
  function showStatusBrief(type, msg) { showStatus(type, msg); setTimeout(hideStatus, 3500); }
  function setText(id, v) { var el = getById(id); if (el) el.textContent = v; }
  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    return [];
  }

  function buildGameCard(g) {
    var id    = g.id || g.Id || g.gameId || '';
    var name  = g.name || g.Name || g.title || g.Title || 'Unnamed Game';
    var desc  = g.description || g.Description || '';
    var genre = g.genre || g.Genre || g.gameType || g.GameType || '';
    var thumb = g.thumbnailUrl || g.ThumbnailUrl || g.imageUrl || g.ImageUrl || '';
    var icon  = genre.toLowerCase().includes('rpg') ? '⚔️' : genre.toLowerCase().includes('puzzle') ? '🧩' : '🎮';
    return '<div class="modal-game-card">' +
      (thumb ? '<img class="modal-game-thumb" src="' + escHtml(thumb) + '" alt="" loading="lazy">' : '<div class="modal-game-thumb-placeholder">' + icon + '</div>') +
      '<div class="modal-game-info">' +
        '<div class="modal-game-title">' + escHtml(name) + '</div>' +
        (genre ? '<div class="modal-game-genre">' + escHtml(genre) + '</div>' : '') +
        (desc  ? '<div class="modal-game-desc">'  + escHtml(desc.substring(0, 120) + (desc.length > 120 ? '…' : '')) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  async function loadAllGames() {
    var list = getById('games-all-list');
    if (list) list.innerHTML = '<div class="map-empty"><div class="map-empty-icon">🎮</div><p>Loading…</p></div>';
    if (!window.starClient) { if (list) list.innerHTML = '<div class="map-empty"><p>Web5 SDK not ready.</p></div>'; return; }
    try {
      // SDK: @oasisomniverse/web5-api
      var sdkRes = await window.starClient.games.getAllGames();
      var games = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      setText('games-stat-total', games.length || '0');
      if (!list) return;
      if (!games.length) { list.innerHTML = '<div class="map-empty"><div class="map-empty-icon">🎮</div><p>No games found.</p></div>'; return; }
      list.innerHTML = games.map(buildGameCard).join('');
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load games.</p></div>'; }
  }

  async function loadMyGames() {
    var list = getById('games-mine-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.starClient) return;
    try {
      var sdkRes = await window.starClient.games.loadAllGamesForAvatar();
      var games = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      setText('games-stat-mine', games.length || '0');
      if (!list) return;
      if (!games.length) { list.innerHTML = '<div class="map-empty"><div class="map-empty-icon">🎮</div><p>No games in your library yet.</p></div>'; return; }
      list.innerHTML = games.map(buildGameCard).join('');
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load your games.</p></div>'; }
  }

  async function loadCrossGameQuests() {
    var list = getById('games-quests-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.starClient) return;
    try {
      var sdkRes = await window.starClient.games.getCrossGameQuests();
      var quests = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      setText('games-stat-quests', quests.length || '0');
      if (!list) return;
      if (!quests.length) { list.innerHTML = '<div class="map-empty"><p>No cross-game quests available.</p></div>'; return; }
      list.innerHTML = quests.map(function(q) {
        var name  = q.name || q.Name || q.title || q.Title || 'Quest';
        var desc  = q.description || q.Description || '';
        var games = q.gameNames || q.games || [];
        return '<div class="modal-item-row">' +
          '<div class="modal-item-icon">⭐</div>' +
          '<div class="modal-item-body">' +
            '<div class="modal-item-title">' + escHtml(name) + '</div>' +
            (desc  ? '<div class="modal-item-meta">' + escHtml(desc) + '</div>' : '') +
            (Array.isArray(games) && games.length ? '<div class="modal-item-meta">Games: ' + games.map(function(g){ return escHtml(String(g)); }).join(', ') + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load quests.</p></div>'; }
  }

  function switchTab(tab) {
    var block = getById('games-modal-block');
    if (!block) return;
    block.querySelectorAll('.map-tab').forEach(function(t) { t.classList.toggle('is-active', t.dataset.tab === tab); });
    block.querySelectorAll('.map-tab-panel').forEach(function(p) { p.hidden = p.id !== 'games-tab-' + tab; });
    if (tab === 'mine')   loadMyGames();
    if (tab === 'quests') loadCrossGameQuests();
  }

  function openGamesModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('games-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('all'); loadAllGames();
    return false;
  }

  function closeGamesModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('games-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = getById('games-modal-block');
    if (!block || block.dataset.gamesBound === 'true') { window.openGamesModal = openGamesModal; window.closeGamesModal = closeGamesModal; return; }
    var closeBtn = getById('games-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e) { e.preventDefault(); closeGamesModal(); });
    var tabBar = block.querySelector('.map-tabs');
    if (tabBar) tabBar.addEventListener('click', function(e) { var t = e.target.closest('.map-tab'); if (t) switchTab(t.dataset.tab); });
    var refreshBtn = getById('games-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAllGames);
    block.dataset.gamesBound = 'true';
    window.openGamesModal = openGamesModal; window.closeGamesModal = closeGamesModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); } else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
