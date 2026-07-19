(function () {
  'use strict';

  function getById(id) { return document.getElementById(id); }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function showStatus(type, msg) { var el = getById('competition-status'); if (!el) return; el.className = 'competition-status competition-status--' + type; el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : ''); el.hidden = false; }
  function hideStatus() { var el = getById('competition-status'); if (el) el.hidden = true; }
  function showStatusBrief(type, msg) { showStatus(type, msg); setTimeout(hideStatus, 3500); }
  function setText(id, v) { var el = getById(id); if (el) el.textContent = v; }
  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    return [];
  }
  function getFilters() {
    var t = getById('comp-type-sel'); var s = getById('comp-season-sel');
    return { competitionType: t ? t.value : 'Karma', seasonType: s ? s.value : 'AllTime' };
  }

  async function loadLeaderboard() {
    var list = getById('comp-leaderboard-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) return;
    var f = getFilters();
    try {
      var sdkRes = await window.oasisClient.competition.getLeaderboard(f);
      var entries = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      if (!list) return;
      if (!entries.length) { list.innerHTML = '<div class="map-empty"><p>No leaderboard data.</p></div>'; return; }
      list.innerHTML = entries.slice(0, 50).map(function(e, i) {
        var name = e.username || e.UserName || e.avatarName || e.name || e.Name || 'Unknown';
        var pts  = e.points || e.Points || e.karma || e.Karma || e.score || e.Score || 0;
        var rank = e.rank || e.Rank || (i + 1);
        var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
        return '<div class="modal-item-row">' +
          '<div class="modal-item-icon">' + medal + '</div>' +
          '<div class="modal-item-body"><div class="modal-item-title">' + escHtml(name) + '</div></div>' +
          '<div class="modal-item-actions"><span class="modal-badge">' + Number(pts).toLocaleString() + ' pts</span></div>' +
        '</div>';
      }).join('');
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load leaderboard.</p></div>'; }
  }

  async function loadMyRank() {
    var panel = getById('comp-myrank-panel');
    if (panel) panel.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) return;
    var f = getFilters();
    try {
      var [rankRes, statsRes, leagueRes] = await Promise.all([
        window.oasisClient.competition.getMyRank(f).catch(function(){ return { isError: true }; }),
        window.oasisClient.competition.getMyStats(f).catch(function(){ return { isError: true }; }),
        window.oasisClient.competition.getMyLeague(f).catch(function(){ return { isError: true }; }),
      ]);
      var rank   = rankRes  && !rankRes.isError  ? (rankRes.result  || rankRes)  : null;
      var stats  = statsRes && !statsRes.isError  ? (statsRes.result || statsRes) : null;
      var league = leagueRes && !leagueRes.isError ? (leagueRes.result|| leagueRes) : null;
      var rankVal   = rank   && (rank.rank   || rank.Rank   || rank.position || '—');
      var leagueVal = league && (league.name || league.Name || league.leagueName || '—');
      var ptsVal    = stats  && (stats.points || stats.Points || stats.score || stats.Score || '—');
      setText('comp-stat-rank',   rankVal   || '—');
      setText('comp-stat-league', leagueVal || '—');
      if (!panel) return;
      panel.innerHTML =
        '<div class="modal-kv-grid">' +
          '<div class="modal-kv"><span class="modal-kv-label">Rank</span><span class="modal-kv-value">' + escHtml(String(rankVal || '—')) + '</span></div>' +
          '<div class="modal-kv"><span class="modal-kv-label">League</span><span class="modal-kv-value">' + escHtml(String(leagueVal || '—')) + '</span></div>' +
          '<div class="modal-kv"><span class="modal-kv-label">Points</span><span class="modal-kv-value">' + escHtml(String(ptsVal || '—')) + '</span></div>' +
        '</div>';
    } catch(e) { if (panel) panel.innerHTML = '<div class="map-empty"><p>Could not load rank.</p></div>'; }
  }

  async function loadTournaments() {
    var list = getById('comp-tournaments-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.oasisClient) return;
    try {
      var sdkRes = await window.oasisClient.competition.getActiveTournaments();
      var tournaments = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      setText('comp-stat-tournaments', tournaments.length || '0');
      if (!list) return;
      if (!tournaments.length) { list.innerHTML = '<div class="map-empty"><p>No active tournaments.</p></div>'; return; }
      list.innerHTML = tournaments.map(function(t) {
        var id   = t.id || t.Id || t.tournamentId || '';
        var name = t.name || t.Name || t.title || 'Tournament';
        var desc = t.description || t.Description || '';
        var start= t.startDate || t.StartDate || '';
        var end  = t.endDate   || t.EndDate   || '';
        var dateStr = '';
        if (start) { try { dateStr = 'Starts ' + new Date(start).toLocaleDateString(); } catch(e){} }
        if (end)   { try { dateStr += (dateStr ? ' · ' : '') + 'Ends ' + new Date(end).toLocaleDateString(); } catch(e){} }
        return '<div class="modal-item-row">' +
          '<div class="modal-item-icon">🏆</div>' +
          '<div class="modal-item-body">' +
            '<div class="modal-item-title">' + escHtml(name) + '</div>' +
            (desc ? '<div class="modal-item-meta">' + escHtml(desc) + '</div>' : '') +
            (dateStr ? '<div class="modal-item-meta">' + escHtml(dateStr) + '</div>' : '') +
          '</div>' +
          (id ? '<div class="modal-item-actions"><button class="button button--primary modal-btn-sm" data-join-tournament="' + escHtml(id) + '">Join</button></div>' : '') +
        '</div>';
      }).join('');
      list.querySelectorAll('[data-join-tournament]').forEach(function(btn) {
        btn.addEventListener('click', function() { joinTournament(btn.dataset.joinTournament, btn); });
      });
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load tournaments.</p></div>'; }
  }

  async function joinTournament(tournamentId, btn) {
    if (!window.oasisClient) return;
    if (btn) btn.disabled = true;
    try {
      var sdkRes = await window.oasisClient.competition.joinTournament({ tournamentId: tournamentId });
      if (sdkRes && !sdkRes.isError) { showStatusBrief('success', 'Joined tournament!'); }
      else { showStatusBrief('error', (sdkRes && sdkRes.message) || 'Could not join.'); }
    } catch(e) { showStatusBrief('error', 'Error joining tournament.'); }
    if (btn) btn.disabled = false;
  }

  function loadAll() {
    loadLeaderboard(); loadTournaments(); loadMyRank();
  }

  function switchTab(tab) {
    var block = getById('competition-modal-block');
    if (!block) return;
    block.querySelectorAll('.map-tab').forEach(function(t) { t.classList.toggle('is-active', t.dataset.tab === tab); });
    block.querySelectorAll('.map-tab-panel').forEach(function(p) { p.hidden = p.id !== 'comp-tab-' + tab; });
  }

  function openCompetitionModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('competition-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('leaderboard'); loadAll();
    return false;
  }

  function closeCompetitionModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('competition-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = getById('competition-modal-block');
    if (!block || block.dataset.compBound === 'true') { window.openCompetitionModal = openCompetitionModal; window.closeCompetitionModal = closeCompetitionModal; return; }
    var closeBtn = getById('competition-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e) { e.preventDefault(); closeCompetitionModal(); });
    var tabBar = block.querySelector('.map-tabs');
    if (tabBar) tabBar.addEventListener('click', function(e) { var t = e.target.closest('.map-tab'); if (t) switchTab(t.dataset.tab); });
    var loadBtn = getById('comp-load-btn');
    if (loadBtn) loadBtn.addEventListener('click', loadAll);
    block.dataset.compBound = 'true';
    window.openCompetitionModal = openCompetitionModal; window.closeCompetitionModal = closeCompetitionModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); } else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
