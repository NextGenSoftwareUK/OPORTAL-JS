(function () {
  'use strict';

  var API_BASE = window.web5ApiUrl || window.apiUrl || '';

  function getProfile() { try { return JSON.parse(localStorage.getItem('avatar') || 'null'); } catch (e) { return null; } }
  function getToken(p) { return p && (p.jwtToken || p.JwtToken || p.token || p.Token || ''); }
  function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmtDate(d) { try { return d ? new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : ''; } catch(e){return '';} }

  function showStatus(type, msg) {
    var el = document.getElementById('oapps-status');
    if (!el) return;
    el.textContent = msg; el.className = 'oapps-status oapps-status--' + type; el.hidden = false;
    if (type === 'loading') return;
    setTimeout(function(){ el.hidden = true; }, 4000);
  }

  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    var r = data.result || data.Result || data.data || data.Data;
    if (Array.isArray(r)) return r;
    var r2 = r && (r.result || r.Result);
    if (Array.isArray(r2)) return r2;
    return [];
  }

  function renderOAPPCard(oapp) {
    var id = oapp.id || oapp.Id || '';
    var name = escHtml(oapp.name || oapp.Name || 'Unnamed OApp');
    var desc = escHtml(oapp.description || oapp.Description || '');
    var version = escHtml(oapp.version || oapp.Version || '');
    var type = escHtml(oapp.oAPPType || oapp.OAPPType || oapp.type || oapp.Type || '');
    var published = oapp.publishedOn || oapp.PublishedOn || oapp.createdDate || oapp.CreatedDate || '';
    var isPublished = oapp.isPublished || oapp.IsPublished || false;
    return '<div class="oapps-card">' +
      '<div class="oapps-card-header">' +
        '<div class="oapps-card-icon">&#128421;</div>' +
        '<div class="oapps-card-meta">' +
          '<div class="oapps-card-name">' + name + '</div>' +
          (version ? '<div class="oapps-card-version">v' + version + '</div>' : '') +
        '</div>' +
        (isPublished ? '<span class="oapps-badge oapps-badge--published">Published</span>' : '<span class="oapps-badge oapps-badge--draft">Draft</span>') +
      '</div>' +
      (desc ? '<div class="oapps-card-desc">' + desc + '</div>' : '') +
      '<div class="oapps-card-footer">' +
        (type ? '<span class="oapps-card-type">' + type + '</span>' : '') +
        (published ? '<span class="oapps-card-date">' + fmtDate(published) + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  async function loadMyOAPPs() {
    var p = getProfile(); var token = getToken(p);
    var el = document.getElementById('oapps-my-list');
    if (!el) return;
    if (!token) { el.innerHTML = '<div class="oapps-empty"><p>Please log in to view your OAPPs.</p></div>'; return; }
    el.innerHTML = '<div class="oapps-loading">Loading your OAPPs…</div>';
    try {
      var res = await fetch(API_BASE + '/api/OAPPs/load-all-for-avatar', { headers: { 'Authorization': 'Bearer ' + token } });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      if (!list.length) {
        el.innerHTML = '<div class="oapps-empty"><div class="oapps-empty-icon">&#128421;</div><p>You have no OAPPs yet.<br>Create one using the STAR SDK.</p></div>';
      } else {
        el.innerHTML = list.map(renderOAPPCard).join('');
      }
    } catch (e) {
      el.innerHTML = '<div class="oapps-empty"><p>Could not load OAPPs.</p></div>';
    }
  }

  async function loadAllOAPPs() {
    var p = getProfile(); var token = getToken(p);
    var el = document.getElementById('oapps-all-list');
    if (!el) return;
    el.innerHTML = '<div class="oapps-loading">Loading OAPPs…</div>';
    try {
      var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      var res = await fetch(API_BASE + '/api/OAPPs', { headers: headers });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      if (!list.length) {
        el.innerHTML = '<div class="oapps-empty"><div class="oapps-empty-icon">&#128421;</div><p>No OAPPs found in the OASIS yet.</p></div>';
      } else {
        el.innerHTML = list.map(renderOAPPCard).join('');
      }
    } catch (e) {
      el.innerHTML = '<div class="oapps-empty"><p>Could not load OAPPs.</p></div>';
    }
  }

  async function searchOAPPs() {
    var q = (document.getElementById('oapps-search-input') || {}).value || '';
    var el = document.getElementById('oapps-search-results');
    if (!el || !q.trim()) return;
    var p = getProfile(); var token = getToken(p);
    el.innerHTML = '<div class="oapps-loading">Searching…</div>';
    try {
      var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      var res = await fetch(API_BASE + '/api/OAPPs/search?searchTerm=' + encodeURIComponent(q), { headers: headers });
      var data = res.ok ? await res.json() : null;
      var list = extractList(data);
      el.innerHTML = list.length ? list.map(renderOAPPCard).join('') : '<div class="oapps-empty"><p>No OAPPs found for "' + escHtml(q) + '".</p></div>';
    } catch (e) {
      el.innerHTML = '<div class="oapps-empty"><p>Search failed.</p></div>';
    }
  }

  function switchTab(tab) {
    document.querySelectorAll('.oapps-tab').forEach(function(b){ b.classList.toggle('is-active', b.dataset.tab === tab); });
    document.querySelectorAll('.oapps-tab-panel').forEach(function(p){ p.hidden = p.id !== 'oapps-tab-' + tab; });
    if (tab === 'my') loadMyOAPPs();
    if (tab === 'all') loadAllOAPPs();
  }

  function openOAPPsModal() {
    var modal = document.querySelector('.js-modal');
    var block = document.getElementById('oapps-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b){ b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('my');
    return false;
  }

  function closeOAPPsModal() {
    var modal = document.querySelector('.js-modal');
    var block = document.getElementById('oapps-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = document.getElementById('oapps-modal-block');
    if (!block || block.dataset.oappsBound === 'true') { window.openOAPPsModal = openOAPPsModal; window.closeOAPPsModal = closeOAPPsModal; return; }

    var closeBtn = document.getElementById('oapps-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e){ e.preventDefault(); closeOAPPsModal(); });

    document.querySelectorAll('.oapps-tab').forEach(function(btn) {
      btn.addEventListener('click', function(){ switchTab(btn.dataset.tab); });
    });

    var searchBtn = document.getElementById('oapps-search-btn');
    if (searchBtn) searchBtn.addEventListener('click', searchOAPPs);
    var searchInput = document.getElementById('oapps-search-input');
    if (searchInput) searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') searchOAPPs(); });

    block.dataset.oappsBound = 'true';
    window.openOAPPsModal = openOAPPsModal;
    window.closeOAPPsModal = closeOAPPsModal;
  }

  window.addEventListener('portal-components-ready', bind);
  if (document.readyState !== 'loading') bind();
  else document.addEventListener('DOMContentLoaded', bind);
})();
