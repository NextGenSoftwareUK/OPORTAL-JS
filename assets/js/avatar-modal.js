(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var storageKey = 'avatar';
  var currentProfile = null;
  var originalValues = {};
  var isDirty = false;

  function getById(id) { return document.getElementById(id); }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function readAvatar() {
    try {
      var raw = localStorage.getItem(storageKey);
      return (raw && raw !== 'undefined') ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveAvatar(profile) {
    localStorage.setItem(storageKey, JSON.stringify(profile));
  }

  function pickValue(source, keys) {
    if (!source) return '';
    for (var i = 0; i < keys.length; i++) {
      var v = source[keys[i]];
      if (v == null || v === '') continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (typeof v === 'object') {
        var nested = ['value', 'name', 'title', 'label', 'text', 'displayName', 'code'];
        for (var j = 0; j < nested.length; j++) {
          if (v[nested[j]] != null && v[nested[j]] !== '') return String(v[nested[j]]);
        }
        if (Array.isArray(v) && v.length) return String(v[0]);
      }
    }
    return '';
  }

  function getDisplayName(p) {
    var parts = [pickValue(p, ['title', 'Title']), pickValue(p, ['firstName', 'FirstName']), pickValue(p, ['lastName', 'LastName'])].filter(Boolean).join(' ').trim();
    return parts || pickValue(p, ['username', 'userName', 'UserName']) || 'Avatar';
  }

  function getAvatarType(p) {
    var v = pickValue(p, ['avatarType', 'AvatarType', 'type', 'Type', 'avatarTypeName', 'AvatarTypeName', 'role', 'Role']);
    return (!v || /^\d+$/.test(v)) ? 'User' : v;
  }

  function getLevel(p) {
    var v = pickValue(p, ['level', 'Level', 'rank', 'Rank', 'avatarLevel', 'AvatarLevel']);
    return (v && /^\d+$/.test(v)) ? v : null;
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  function showStatus(type, msg) {
    var el = getById('avatar-modal-status');
    if (!el) return;
    el.className = 'avatar-inline-status avatar-inline-status--' + type;
    el.textContent = msg;
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('avatar-modal-status');
    if (el) { el.hidden = true; el.textContent = ''; }
  }

  // ── Dirty tracking ────────────────────────────────────────────────────────────

  function setDirty(dirty) {
    isDirty = dirty;
    var saveBtn = getById('avatar-modal-save-btn');
    var discardBtn = getById('avatar-modal-discard-btn');
    if (saveBtn) { saveBtn.hidden = !dirty; saveBtn.style.display = dirty ? '' : 'none'; }
    if (discardBtn) { discardBtn.hidden = !dirty; discardBtn.style.display = dirty ? '' : 'none'; }
  }

  function checkDirty() {
    var fields = document.querySelectorAll('#avatar-modal-block [data-av-field]');
    var dirty = false;
    fields.forEach(function (input) {
      if (input.value !== (originalValues[input.dataset.avField] || '')) dirty = true;
    });
    setDirty(dirty);
  }

  // ── Populate ──────────────────────────────────────────────────────────────────

  function populate(profile) {
    var p = profile || {};
    var displayName = getDisplayName(p);
    var username = pickValue(p, ['username', 'userName', 'UserName']);
    var level = getLevel(p);
    var usernameLabel = username ? (level ? username + ' (Lv ' + level + ')' : username) : 'Avatar';
    var email = pickValue(p, ['email', 'Email', 'emailAddress', 'EmailAddress']);
    var avatarType = getAvatarType(p);
    var title = pickValue(p, ['title', 'Title']);
    var firstName = pickValue(p, ['firstName', 'FirstName']);
    var lastName = pickValue(p, ['lastName', 'LastName']);
    var address = pickValue(p, ['address', 'Address']);
    var karma = pickValue(p, ['karma', 'Karma', 'karmaWeighting', 'KarmaWeighting', 'karmaPoints', 'KarmaPoints']);
    var xp = pickValue(p, ['xp', 'XP', 'experiencePoints', 'ExperiencePoints', 'experience', 'Experience']);

    var img = getById('avatar-modal-image-large');
    if (img) { img.src = 'assets/img/loggedin.png'; img.alt = displayName; }

    var nameEl = getById('avatar-summary-display-name');
    if (nameEl) nameEl.textContent = usernameLabel;

    var karmaEl = getById('avatar-summary-karma');
    if (karmaEl) karmaEl.textContent = 'Karma: ' + (karma || '—');

    var xpEl = getById('avatar-summary-xp');
    if (xpEl) xpEl.textContent = 'XP: ' + (xp || '—');

    var typeEl = getById('avatar-summary-type');
    if (typeEl) typeEl.textContent = avatarType;

    var subtitleEl = getById('avatar-modal-subtitle');
    if (subtitleEl) subtitleEl.textContent = displayName !== username ? displayName : 'Your OASIS avatar profile.';

    var fieldMap = { title: title, firstName: firstName, lastName: lastName, username: username, email: email, address: address };
    Object.keys(fieldMap).forEach(function (key) {
      var input = document.querySelector('#avatar-modal-block [data-av-field="' + key + '"]');
      if (input) input.value = fieldMap[key];
      originalValues[key] = fieldMap[key];
    });

    setDirty(false);
    hideStatus();
  }

  // ── Hydration ─────────────────────────────────────────────────────────────────

  function needsHydration(p) {
    return !pickValue(p, ['title', 'Title']) ||
      !pickValue(p, ['address', 'Address']) ||
      !pickValue(p, ['karma', 'Karma', 'karmaWeighting', 'KarmaWeighting', 'karmaPoints', 'KarmaPoints']) ||
      !pickValue(p, ['xp', 'XP', 'experiencePoints', 'ExperiencePoints']);
  }

  function getDetailUrls(p) {
    var urls = [];
    var email = p && (p.email || p.Email || p.emailAddress || p.EmailAddress);
    var username = p && (p.username || p.userName || p.UserName);
    var id = p && (p.id || p.Id || p.avatarId || p.AvatarId);
    if (email) urls.push(API_BASE + '/api/avatar/get-avatar-detail-by-email/' + encodeURIComponent(email));
    if (username) urls.push(API_BASE + '/api/avatar/get-avatar-detail-by-username/' + encodeURIComponent(username));
    if (id) urls.push(API_BASE + '/api/avatar/get-avatar-detail-by-id/' + encodeURIComponent(id));
    return urls.filter(function (u, i, a) { return u && a.indexOf(u) === i; });
  }

  async function hydrateAvatar(profile) {
    var token = profile && (profile.jwtToken || profile.token || '');
    var urls = getDetailUrls(profile);
    if (!token || !urls.length) return profile;

    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i], {
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) continue;
        var data = await res.json();
        var full = data && (data.avatar || (data.result && data.result.result) || (data.result && data.result.avatar) || data.result || data.data || data);
        if (!full || typeof full !== 'object') continue;
        var merged = Object.assign({}, profile, full);
        saveAvatar(merged);
        return merged;
      } catch (e) {}
    }
    return profile;
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  function buildPayload() {
    var payload = {};
    var fields = document.querySelectorAll('#avatar-modal-block [data-av-field]');
    fields.forEach(function (input) {
      payload[input.dataset.avField] = input.value.trim();
    });
    return payload;
  }

  function getUpdateUrl(profile) {
    var email = profile && (profile.email || profile.Email);
    var username = profile && (profile.username || profile.userName || profile.UserName);
    if (email) return API_BASE + '/api/avatar/update-avatar-detail-by-email/' + encodeURIComponent(email);
    if (username) return API_BASE + '/api/avatar/update-avatar-detail-by-username/' + encodeURIComponent(username);
    return '';
  }

  async function submitAvatar() {
    var profile = currentProfile || readAvatar();
    if (!profile) { showStatus('error', 'Not signed in. Please sign in before editing your avatar.'); return; }

    var token = profile.jwtToken || profile.token || '';
    var url = getUpdateUrl(profile);
    var payload = buildPayload();
    var saveBtn = getById('avatar-modal-save-btn');

    if (!url) { showStatus('error', 'Could not determine which avatar record to update.'); return; }

    showStatus('loading', 'Saving changes…');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
      var res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(payload)
      });
      var data = {};
      try { data = await res.json(); } catch (e) {}

      if (res.ok) {
        var updated = Object.assign({}, profile, payload);
        saveAvatar(updated);
        currentProfile = updated;
        populate(updated);
        showStatus('success', (data && (data.message || data.title)) || 'Avatar updated successfully.');
        setTimeout(hideStatus, 3500);
      } else {
        showStatus('error', (data && (data.message || data.error)) || 'Something went wrong. Please try again.');
      }
    } catch (e) {
      showStatus('error', 'Network error — could not reach the API.');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
    }
  }

  // ── Open / close ─────────────────────────────────────────────────────────────

  function openAvatarModal() {
    var loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
      if (typeof window.showCheckAPIMessage === 'function') window.showCheckAPIMessage();
      return false;
    }

    currentProfile = readAvatar();
    if (!currentProfile) {
      if (typeof window.showCheckAPIMessage === 'function') window.showCheckAPIMessage();
      return false;
    }

    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var avatarBlock = getById('avatar-modal-block');
    if (!modal || !avatarBlock) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    avatarBlock.classList.add('is-selected');

    populate(currentProfile);

    if (needsHydration(currentProfile)) {
      hydrateAvatar(currentProfile).then(function (updated) {
        if (updated && updated !== currentProfile) {
          currentProfile = updated;
          populate(updated);
        }
      });
    }

    return false;
  }

  function closeAvatarModal() {
    var modal = document.querySelector('.js-modal');
    var avatarBlock = getById('avatar-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (avatarBlock) avatarBlock.classList.remove('is-selected');
  }

  // ── Bind ─────────────────────────────────────────────────────────────────────

  function bind() {
    var avatarBlock = getById('avatar-modal-block');
    if (!avatarBlock || avatarBlock.dataset.avatarModalBound === 'true') {
      window.openAvatarModal = openAvatarModal;
      window.closeAvatarModal = closeAvatarModal;
      return;
    }

    var closeBtn = getById('avatar-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeAvatarModal(); });

    var saveBtn = getById('avatar-modal-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function (e) { e.preventDefault(); submitAvatar(); });

    var discardBtn = getById('avatar-modal-discard-btn');
    if (discardBtn) discardBtn.addEventListener('click', function (e) {
      e.preventDefault();
      populate(currentProfile || readAvatar());
      hideStatus();
    });

    avatarBlock.addEventListener('input', function (e) {
      if (e.target.dataset.avField) checkDirty();
    });

    avatarBlock.dataset.avatarModalBound = 'true';
    window.openAvatarModal = openAvatarModal;
    window.closeAvatarModal = closeAvatarModal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.addEventListener('portal-components-ready', bind);
})();
