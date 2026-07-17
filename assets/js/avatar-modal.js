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
    if (v && /^\d+$/.test(String(v))) return parseInt(v, 10);
    // Derive from karma if not provided: RPG-style sqrt curve
    var karma = parseInt(pickValue(p, ['karma', 'Karma', 'karmaPoints', 'KarmaPoints']) || '0', 10);
    return karma > 0 ? Math.max(1, Math.floor(Math.sqrt(karma / 10))) : null;
  }

  function getLevelProgress(karma, level) {
    // Threshold formula: karmaForLevel(n) = n² × 10
    if (!level || !karma) return { pct: 0, current: karma || 0, needed: 10 };
    var thisThreshold = level * level * 10;
    var nextThreshold = (level + 1) * (level + 1) * 10;
    var current = Math.max(0, karma - thisThreshold);
    var needed   = nextThreshold - thisThreshold;
    var pct = Math.min(100, Math.round((current / needed) * 100));
    return { pct: pct, current: current, needed: needed, nextThreshold: nextThreshold };
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  function showStatus(type, msg) {
    var el = getById('avatar-modal-status');
    if (!el) return;
    el.className = 'avatar-inline-status avatar-inline-status--' + type;
    el.textContent = msg;
    el.style.visibility = 'visible';
  }

  function hideStatus() {
    var el = getById('avatar-modal-status');
    if (!el) return;
    el.style.visibility = 'hidden';
    el.textContent = ' '; // non-breaking space keeps height reserved
  }

  // ── Dirty tracking ────────────────────────────────────────────────────────────

  function setDirty(dirty) {
    isDirty = dirty;
    var saveBtn = getById('avatar-modal-save-btn');
    var discardBtn = getById('avatar-modal-discard-btn');
    // Use visibility so space is always reserved — modal won't resize on edit
    if (saveBtn)    saveBtn.style.visibility    = dirty ? 'visible' : 'hidden';
    if (discardBtn) discardBtn.style.visibility = dirty ? 'visible' : 'hidden';
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
    // TODO: remove mock once API returns karma/xp/level correctly
    if (!p.karma && !p.Karma && !p.level && !p.Level) {
      p.karma = 3450;
      p.xp    = 18750;
      p.level = 18;
    }
    var displayName = getDisplayName(p);
    var username = pickValue(p, ['username', 'userName', 'UserName']);
    var level = getLevel(p);
    var email = pickValue(p, ['email', 'Email', 'emailAddress', 'EmailAddress']);
    var title = pickValue(p, ['title', 'Title']);
    var firstName = pickValue(p, ['firstName', 'FirstName']);
    var lastName = pickValue(p, ['lastName', 'LastName']);
    var address = pickValue(p, ['address', 'Address']);
    var karma = pickValue(p, ['karma', 'Karma', 'karmaWeighting', 'KarmaWeighting', 'karmaPoints', 'KarmaPoints']);
    var xp = pickValue(p, ['xp', 'XP', 'experiencePoints', 'ExperiencePoints', 'experience', 'Experience']);

    var karmaNum = parseInt(karma, 10) || 0;
    var lvl = level || getLevel(p);
    var prog = getLevelProgress(karmaNum, lvl);

    var img = getById('avatar-modal-image-large');
    if (img) {
      img.alt = displayName;
      // Load portrait from API if we don't already have a local preview
      if (!img.dataset.localPreview) {
        var username2 = pickValue(p, ['username', 'userName', 'UserName']);
        if (username2) loadPortrait(username2, img); //TODO: Portrait should already have been loaded with the rest of the AvatarDetail after beaming in so we shouldnt need to do this again...
        else img.src = 'assets/img/loggedin.png';
      }
    }

    // Username — just the username, level is shown in the badge
    var nameEl = getById('avatar-summary-display-name');
    if (nameEl) nameEl.textContent = username || 'Avatar';

    // Level badge
    var lvlNum = getById('avatar-level-num');
    if (lvlNum) lvlNum.textContent = lvl || '—';

    // Karma & XP stats
    var karmaValEl = getById('avatar-karma-value');
    if (karmaValEl) karmaValEl.textContent = karmaNum ? karmaNum.toLocaleString() : '—';

    var xpValEl = getById('avatar-xp-value');
    if (xpValEl) xpValEl.textContent = xp ? parseInt(xp, 10).toLocaleString() : '—';

    // XP progress bar
    var xpFill = getById('avatar-xp-fill');
    var xpPct  = getById('avatar-xp-pct');
    var xpThr  = getById('avatar-xp-threshold');
    if (xpFill) xpFill.style.width = prog.pct + '%';
    if (xpPct)  xpPct.textContent  = prog.pct + '%';
    if (xpThr && lvl)  xpThr.textContent = prog.current.toLocaleString() + ' / ' + prog.needed.toLocaleString() + ' karma to level ' + (lvl + 1);

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
    if (email) urls.push(API_BASE + '/api/Avatar/get-avatar-detail-by-email/' + encodeURIComponent(email));
    if (username) urls.push(API_BASE + '/api/Avatar/get-avatar-detail-by-username/' + encodeURIComponent(username));
    if (id) urls.push(API_BASE + '/api/Avatar/get-avatar-detail-by-id/' + encodeURIComponent(id));
    return urls.filter(function (u, i, a) { return u && a.indexOf(u) === i; });
  }

  async function hydrateAvatar(profile) {
    var token = profile && (profile.jwtToken || profile.token || '');
    if (!token) return profile;
    // SDK: @oasisomniverse/web4-api — try by email then username then id
    var email = profile && (profile.email || profile.Email);
    var username = profile && (profile.username || profile.userName || profile.UserName);
    var id = profile && (profile.id || profile.Id || profile.avatarId || profile.AvatarId);
    var sdkRes = null;
    /* OLD fetch using getDetailUrls/loop:
    var urls = getDetailUrls(profile);
    for (var i = 0; i < urls.length; i++) { ... fetch(urls[i]) ... }
    */
    try {
      if (username) sdkRes = await window.oasisClient.avatar.getAvatarDetailByUsername({ username: username });
      if ((!sdkRes || sdkRes.isError) && id) sdkRes = await window.oasisClient.avatar.getAvatarDetail({ 'id:guid': id });
      if ((!sdkRes || sdkRes.isError) && email) sdkRes = await window.oasisClient.avatar.getAvatarDetailByEmail({ email: email });
    } catch (e) {}
    if (!sdkRes || sdkRes.isError || !sdkRes.result) return profile;
    var merged = Object.assign({}, profile, sdkRes.result);
    // Always preserve auth-critical fields from the original Avatar record —
    // AvatarDetail may return these as null/empty and must not overwrite them.
    var authFields = ['email', 'Email', 'jwtToken', 'JwtToken', 'token', 'Token',
                      'refreshToken', 'RefreshToken', 'id', 'Id', 'avatarId', 'AvatarId'];
    authFields.forEach(function (f) {
      if (profile[f] != null && profile[f] !== '') merged[f] = profile[f];
    });
    // Guard: if the returned detail has a different username than what we stored,
    // the fallback id lookup returned the wrong avatar — keep the original username.
    var origUsername = profile.username || profile.userName || profile.UserName;
    var detailUsername = sdkRes.result.username || sdkRes.result.userName || sdkRes.result.UserName;
    if (origUsername && detailUsername && detailUsername !== origUsername) {
      merged.username = origUsername;
      merged.userName = origUsername;
    }
    saveAvatar(merged);
    window.dispatchEvent(new CustomEvent('avatarUpdated', { detail: merged }));
    return merged;
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  function buildPayload() {
    var payload = {};
    var fields = document.querySelectorAll('#avatar-modal-block [data-av-field]');
    fields.forEach(function (input) {
      var key = input.dataset.avField;
      var val = input.value.trim();
      payload[key] = val;
      // Also send PascalCase so the C# model binder picks it up regardless of JSON settings
      var pascal = key.charAt(0).toUpperCase() + key.slice(1);
      payload[pascal] = val;
    });
    return payload;
  }

  function getUpdateUrl(profile) {
    var email = profile && (profile.email || profile.Email);
    var username = profile && (profile.username || profile.userName || profile.UserName);
    if (email) return API_BASE + '/api/Avatar/update-avatar-detail-by-email/' + encodeURIComponent(email);
    if (username) return API_BASE + '/api/Avatar/update-avatar-detail-by-username/' + encodeURIComponent(username);
    return '';
  }

  async function submitAvatar() {
    var profile = currentProfile || readAvatar();
    if (!profile) { showStatus('error', 'Not signed in. Please sign in before editing your avatar.'); return; }

    var payload = buildPayload();
    var saveBtn = getById('avatar-modal-save-btn');
    var email = profile.email || profile.Email;
    var username = profile.username || profile.userName || profile.UserName;

    if (!email && !username) { showStatus('error', 'Could not determine which avatar record to update.'); return; }

    showStatus('loading', 'Saving changes…');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
      // Preserve server-managed flags so a full-replace endpoint doesn't wipe them
      var preserved = {
        isVerified:   profile.isVerified   ?? profile.IsVerified   ?? false,
        verified:     profile.verified     ?? profile.Verified     ?? false,
        avatarId:     profile.avatarId     || profile.AvatarId     || profile.id || profile.Id || '',
        createdDate:  profile.createdDate  || profile.CreatedDate  || '',
        modifiedDate: profile.modifiedDate || profile.ModifiedDate || '',
      };
      // SDK: @oasisomniverse/web4-api
      var sdkRes = email
        ? await window.oasisClient.avatar.updateAvatarDetailByEmail(Object.assign({}, preserved, payload, { email: email }))
        : await window.oasisClient.avatar.updateAvatarDetailByUsername(Object.assign({}, preserved, payload, { username: username }));
      /* OLD fetch:
      var url = getUpdateUrl(profile);
      var res = await fetch(url, { method: 'POST', headers: {...}, body: JSON.stringify(payload) });
      */

      if (sdkRes.isError && sdkRes.message && /unauthori[zs]ed/i.test(sdkRes.message)) {
        if (typeof window.handleUnauthorized === 'function') window.handleUnauthorized();
        return;
      }
      if (!sdkRes.isError) {
        var updated = Object.assign({}, profile, payload);

        // If username changed, also update the Avatar record (not just AvatarDetail)
        var oldUsername = profile.username || profile.userName || profile.UserName;
        var newUsername = payload.username;
        if (newUsername && newUsername !== oldUsername && window.oasisClient) {
          try {
            var avatarUpdatePayload = { username: newUsername };
            if (email) {
              await window.oasisClient.avatar.updateByEmail(Object.assign({}, avatarUpdatePayload, { email: email }));
            } else if (oldUsername) {
              await window.oasisClient.avatar.updateByUsername(Object.assign({}, avatarUpdatePayload, { username: oldUsername }));
            }
          } catch (e) { /* non-fatal — detail already saved */ }
        }

        saveAvatar(updated);
        currentProfile = updated;
        populate(updated);
        showStatus('success', sdkRes.message || 'Avatar updated successfully.');
        setTimeout(hideStatus, 3500);
        window.dispatchEvent(new CustomEvent('avatarUpdated', { detail: updated }));
      } else {
        showStatus('error', sdkRes.message || 'Something went wrong. Please try again.');
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

    // Clear local preview flag so portrait is always fetched fresh from API
    var img = document.getElementById('avatar-modal-image-large');
    if (img) delete img.dataset.localPreview;

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

  // ── Portrait load & upload ────────────────────────────────────────────────────

  async function loadPortrait(username, imgEl) {
    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.avatar.getAvatarPortraitByUsername({ username: username });
      /* OLD fetch:
      var avatar = readAvatar();
      var token = avatar && (avatar.jwtToken || avatar.token || '');
      var res = await fetch(API_BASE + '/api/Avatar/get-avatar-portrait-by-username/' + encodeURIComponent(username), {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (!res.ok) throw new Error('no portrait');
      var data = await res.json();
      */
      if (sdkRes.isError) throw new Error('no portrait');
      var portrait = sdkRes.result || {};

      // Try imageUrl first (direct URL)
      var imageUrl = portrait && (portrait.imageUrl || portrait.ImageUrl);
      if (imageUrl) { imgEl.src = imageUrl; return; }

      // Try base64 fields — API returns 'image' as byte[] (base64 encoded)
      var b64 = portrait && (portrait.imageBase64 || portrait.ImageBase64 || portrait.image || portrait.Image);
      var mime = portrait && (portrait.contentType || portrait.ContentType || portrait.mimeType || 'image/png');
      if (b64) { imgEl.src = 'data:' + mime + ';base64,' + b64; return; }

      imgEl.src = 'assets/img/loggedin.png';
    } catch (e) {
      imgEl.src = 'assets/img/loggedin.png';
    }
  }

  async function uploadPortrait(base64Data) {
    var avatar = readAvatar();
    var token = avatar && (avatar.jwtToken || avatar.token || '');
    if (!token) { showStatus('error', 'Not signed in.'); return false; }
    showStatus('loading', 'Uploading photo…');
    try {
      // SDK: @oasisomniverse/web4-api
      var sdkRes = await window.oasisClient.avatar.uploadAvatarPortrait({
        username: avatar.username || avatar.userName,
        email:    avatar.email || avatar.Email,
        imageBase64: base64Data
      });
      /* OLD fetch:
      var res = await fetch(API_BASE + '/api/Avatar/upload-avatar-portrait', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      });
      */
      if (!sdkRes.isError) {
        showStatus('success', 'Photo updated successfully!');
        setTimeout(hideStatus, 3000);
        return true;
      }
      showStatus('error', sdkRes.message || 'Upload failed. Please try again.');
    } catch (e) {
      showStatus('error', 'Network error — could not upload photo.');
    }
    return false;
  }

  function dispatchPortraitUpdate(dataUrl) {
    var stored = readAvatar();
    if (stored) {
      var updated = Object.assign({}, stored, { avatarImage: dataUrl, AvatarImage: dataUrl });
      saveAvatar(updated);
      currentProfile = Object.assign({}, currentProfile || {}, { avatarImage: dataUrl, AvatarImage: dataUrl });
      window.dispatchEvent(new CustomEvent('avatarUpdated', { detail: updated }));
    }
  }

  function bindPhotoUpload() {
    var wrap  = getById('avatar-img-wrap');
    var input = getById('avatar-photo-input');
    if (!wrap || !input) return;

    wrap.addEventListener('click', function () { input.click(); });

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showStatus('error', 'Please select an image file.'); return; }
      if (file.size > 5 * 1024 * 1024) { showStatus('error', 'Image must be under 5 MB.'); return; }

      var reader = new FileReader();
      reader.onload = function (ev) {
        var dataUrl = ev.target.result;
        // Show preview immediately
        var img = getById('avatar-modal-image-large');
        if (img) { img.src = dataUrl; img.dataset.localPreview = '1'; }
        // Strip the data:image/xxx;base64, prefix for the API
        var base64 = dataUrl.split(',')[1];
        uploadPortrait(base64).then(function (ok) {
          if (ok) dispatchPortraitUpdate(dataUrl);
        });
      };
      reader.readAsDataURL(file);
      input.value = ''; // reset so same file can be re-selected
    });
  }

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

    bindPhotoUpload();
    avatarBlock.dataset.avatarModalBound = 'true';
    window.openAvatarModal = openAvatarModal;
    window.closeAvatarModal = closeAvatarModal;
    window.hydrateAvatarProfile = hydrateAvatar;
  }

  // Expose immediately so nav clicks work before portal components finish loading
  window.openAvatarModal = openAvatarModal;
  window.closeAvatarModal = closeAvatarModal;
  window.hydrateAvatarProfile = hydrateAvatar;
  window.loadAvatarPortrait = loadPortrait;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.addEventListener('portal-components-ready', bind);
})();
