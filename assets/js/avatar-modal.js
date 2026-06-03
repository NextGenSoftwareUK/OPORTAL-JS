(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var storageKey = 'avatar';
  var currentMode = 'view';
  var currentProfile = null;

  function getById(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readAvatar() {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw || raw === 'undefined') return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function saveAvatar(profile) {
    localStorage.setItem(storageKey, JSON.stringify(profile));
  }

  function pickValue(source, keys) {
    if (!source) return '';
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = source[key];
      if (value == null || value === '') continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      if (typeof value === 'object') {
        var nestedKeys = ['value', 'name', 'title', 'label', 'text', 'displayName', 'code'];
        for (var j = 0; j < nestedKeys.length; j++) {
          var nestedValue = value[nestedKeys[j]];
          if (nestedValue != null && nestedValue !== '') {
            return String(nestedValue);
          }
        }
        if (Array.isArray(value) && value.length) {
          return String(value[0]);
        }
        try {
          var serialized = JSON.stringify(value);
          if (serialized && serialized !== '{}' && serialized !== '[]') {
            return serialized;
          }
        } catch (error) {}
      }
    }
    return '';
  }

  function normalizeAvatarType(profile) {
    var value = pickValue(profile, ['avatarType', 'AvatarType', 'type', 'Type', 'avatarTypeName', 'AvatarTypeName', 'role', 'Role']);
    if (!value) return 'User';
    if (/^\d+$/.test(value)) return 'User';
    return value;
  }

  function getAvatarLevel(profile) {
    var level = pickValue(profile, ['level', 'Level', 'rank', 'Rank', 'avatarLevel', 'AvatarLevel']);
    if (!level || /^\d+$/.test(level) === false) {
      return '77';
    }
    return level;
  }

  function formatUsername(profile) {
    var username = pickValue(profile, ['username', 'userName', 'UserName']);
    var level = getAvatarLevel(profile);
    return username ? username + ' (' + level + ')' : 'Avatar';
  }

  function getDisplayName(profile) {
    var title = pickValue(profile, ['title', 'Title']);
    var firstName = pickValue(profile, ['firstName', 'FirstName']);
    var lastName = pickValue(profile, ['lastName', 'LastName']);
    var parts = [title, firstName, lastName].filter(Boolean).join(' ').trim();
    if (parts) return parts;
    return pickValue(profile, ['username', 'userName', 'UserName']) || 'Avatar';
  }

  function setText(selector, value) {
    var nodes = document.querySelectorAll(selector);
    if (!nodes.length) return;
    nodes.forEach(function (el) {
      el.textContent = value || 'Not set';
    });
  }

  function setMode(mode) {
    currentMode = mode === 'edit' ? 'edit' : 'view';
    var view = getById('avatar-modal-view');
    var edit = getById('avatar-modal-edit');
    var editBtn = getById('avatar-modal-edit-btn');
    var cancelBtn = getById('avatar-modal-cancel-btn');
    var saveBtn = getById('avatar-modal-save-btn');
    var title = getById('avatar-modal-title');
    var subtitle = getById('avatar-modal-subtitle');

    if (!view || !edit) return;

    var isEdit = currentMode === 'edit';
    view.hidden = isEdit;
    edit.hidden = !isEdit;
    if (editBtn) {
      editBtn.hidden = isEdit;
      editBtn.style.display = isEdit ? 'none' : 'inline-flex';
      editBtn.setAttribute('aria-hidden', isEdit ? 'true' : 'false');
    }
    if (cancelBtn) {
      cancelBtn.hidden = !isEdit;
      cancelBtn.style.display = isEdit ? 'inline-flex' : 'none';
      cancelBtn.setAttribute('aria-hidden', isEdit ? 'false' : 'true');
    }
    if (saveBtn) {
      saveBtn.hidden = !isEdit;
      saveBtn.style.display = isEdit ? 'inline-flex' : 'none';
      saveBtn.setAttribute('aria-hidden', isEdit ? 'false' : 'true');
    }

    if (title) title.textContent = isEdit ? 'Edit Avatar' : 'View Avatar';
    if (subtitle) {
      subtitle.textContent = isEdit
        ? 'Update your avatar details and save the changes.'
        : 'Your current avatar profile and account information.';
    }
  }

  function populate(profile) {
    var normalized = profile || {};
    var displayName = getDisplayName(normalized);
    var username = formatUsername(normalized);
    var email = pickValue(normalized, ['email', 'Email', 'emailAddress', 'EmailAddress']);
    var avatarType = normalizeAvatarType(normalized);
    var title = pickValue(normalized, ['title', 'Title']);
    var firstName = pickValue(normalized, ['firstName', 'FirstName']);
    var lastName = pickValue(normalized, ['lastName', 'LastName']);
    var address = pickValue(normalized, ['address', 'Address']);
    var karma = pickValue(normalized, ['karma', 'Karma', 'karmaWeighting', 'KarmaWeighting', 'karmaPoints', 'KarmaPoints']);
    var xp = pickValue(normalized, ['xp', 'XP', 'experiencePoints', 'ExperiencePoints', 'experience', 'Experience']);
    var avatarImage = getById('avatar-modal-image');
    var avatarImageLarge = getById('avatar-modal-image-large');

    if (avatarImage) {
      avatarImage.src = '../assets/img/loggedin.png';
      avatarImage.alt = displayName;
    }
    if (avatarImageLarge) {
      avatarImageLarge.src = '../assets/img/loggedin.png';
      avatarImageLarge.alt = displayName;
    }

    setText('[data-avatar-modal-field="username"]', username);
    setText('[data-avatar-modal-field="email"]', email);
    setText('[data-avatar-modal-field="avatarType"]', avatarType);
    setText('[data-avatar-modal-field="title"]', title);
    setText('[data-avatar-modal-field="firstName"]', firstName);
    setText('[data-avatar-modal-field="lastName"]', lastName);
    setText('[data-avatar-modal-field="address"]', address);
    setText('[data-avatar-modal-field="karma"]', karma !== '' ? 'Karma: ' + karma : 'Karma: 777');
    setText('[data-avatar-modal-field="xp"]', xp !== '' ? 'XP: ' + xp : 'XP: 777');

    var fields = ['title', 'firstName', 'lastName', 'username', 'email', 'address'];
    fields.forEach(function (field) {
      var input = getById('avatar-modal-' + field);
      if (input) {
        input.value = pickValue(normalized, [field, field.charAt(0).toUpperCase() + field.slice(1)]);
      }
    });
  }

  function setStatus(state, title, message) {
    var panel = getById('avatar-modal-status');
    if (!panel) return;

    panel.className = 'status-card avatar-modal-status avatar-modal-status--' + state;
    panel.innerHTML =
      '<h3>' + escapeHtml(title || '') + '</h3>' +
      '<p>' + escapeHtml(message || '') + '</p>';
  }

  function buildPayload() {
    return {
      title: getById('avatar-modal-title-input').value.trim(),
      firstName: getById('avatar-modal-firstName').value.trim(),
      lastName: getById('avatar-modal-lastName').value.trim(),
      username: getById('avatar-modal-username').value.trim(),
      email: getById('avatar-modal-email').value.trim(),
      address: getById('avatar-modal-address').value.trim(),
    };
  }

  function getAuthToken(profile) {
    return profile && (profile.jwtToken || profile.token || '');
  }

  function getAvatarDetailUrls(profile) {
    var urls = [];
    var email = profile && (profile.email || profile.Email || profile.emailAddress || profile.EmailAddress);
    var username = profile && (profile.username || profile.userName || profile.UserName);
    var id = profile && (profile.id || profile.Id || profile.avatarId || profile.AvatarId);

    if (email) {
      urls.push(API_BASE + '/api/avatar/get-avatar-detail-by-email/' + encodeURIComponent(email));
    }
    if (username) {
      urls.push(API_BASE + '/api/avatar/get-avatar-detail-by-username/' + encodeURIComponent(username));
    }
    if (id) {
      urls.push(API_BASE + '/api/avatar/get-avatar-detail-by-id/' + encodeURIComponent(id));
    }

    return urls.filter(function (url, index, list) {
      return url && list.indexOf(url) === index;
    });
  }

  function profileNeedsHydration(profile) {
    return !pickValue(profile, ['title', 'Title']) ||
      !pickValue(profile, ['address', 'Address']) ||
      !pickValue(profile, ['karma', 'Karma', 'karmaWeighting', 'KarmaWeighting', 'karmaPoints', 'KarmaPoints']) ||
      !pickValue(profile, ['xp', 'XP', 'experiencePoints', 'ExperiencePoints', 'experience', 'Experience']) ||
      !pickValue(profile, ['level', 'Level', 'rank', 'Rank', 'avatarLevel', 'AvatarLevel']);
  }

  async function hydrateAvatarDetails(profile) {
    var avatar = profile || {};
    var token = getAuthToken(avatar);
    var urls = getAvatarDetailUrls(avatar);

    if (!token || !urls.length) {
      return avatar;
    }

    console.log("token:", token);

    for (var i = 0; i < urls.length; i++) {
      try {
        var response = await fetch(urls[i], {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
        });

        if (!response.ok) {
          continue;
        }

        var data = await response.json();

        console.log("token:", token);
        console.log('Fetched avatar details:', data);
        
        var fullAvatar = data && typeof data === 'object'
          ? (data.avatar || (data.result && data.result.result) || (data.result && data.result.avatar) || data.result || data.data || data)
          : null;

        if (!fullAvatar || typeof fullAvatar !== 'object') {
          continue;
        }

        var merged = Object.assign({}, avatar, fullAvatar);
        saveAvatar(merged);
        return merged;
      } catch (error) {}
    }

    return avatar;
  }

  function getUpdateUrl(profile) {
    var originalEmail = profile && (profile.email || profile.Email);
    var originalUsername = profile && (profile.username || profile.userName || profile.UserName);
    if (originalEmail) {
      return API_BASE + '/api/avatar/update-avatar-detail-by-email/' + encodeURIComponent(originalEmail);
    }
    if (originalUsername) {
      return API_BASE + '/api/avatar/update-avatar-detail-by-username/' + encodeURIComponent(originalUsername);
    }
    return '';
  }

  async function submitAvatar() {
    var profile = currentProfile || readAvatar();
    if (!profile) {
      setStatus('error', 'Not signed in', 'Please sign in before editing your avatar.');
      return;
    }

    var token = getAuthToken(profile);
    var url = getUpdateUrl(profile);
    var payload = buildPayload();
    var saveBtn = getById('avatar-modal-save-btn');

    if (!url) {
      setStatus('error', 'Missing account info', 'We could not determine which avatar record to update.');
      return;
    }

    setStatus('loading', 'Saving changes', 'Updating your avatar details...');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      var response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify(payload),
      });

      var data = {};
      try {
        data = await response.json();
      } catch (error) {}

      if (response.ok) {
        var updated = Object.assign({}, profile, payload);
        saveAvatar(updated);
        currentProfile = updated;
        populate(updated);
        setMode('view');
        setStatus('success', 'Avatar updated', (data && (data.message || data.title)) || 'Your avatar details have been saved.');
      } else {
        setStatus('error', 'Update failed', (data && (data.message || data.error)) || 'Something went wrong while saving your avatar.');
      }
    } catch (error) {
      setStatus('error', 'Network error', 'We could not reach the API right now.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save changes';
      }
    }
  }

  function openAvatarModal(mode) {
    var loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
      if (typeof window.showCheckAPIMessage === 'function') {
        window.showCheckAPIMessage();
      }
      return false;
    }

    currentProfile = readAvatar();
    if (!currentProfile) {
      setStatus('error', 'No avatar data', 'We could not find your saved avatar profile.');
      return false;
    }

    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var avatarBlock = getById('avatar-modal-block');
    if (!modal || !avatarBlock) return false;

    blocks.forEach(function (block) {
      block.classList.remove('is-selected');
    });

    modal.classList.add('is-visible');
    avatarBlock.classList.add('is-selected');

    populate(currentProfile);
    setMode(mode || 'view');
    setStatus('neutral', currentMode === 'edit' ? 'Edit mode' : 'View mode', currentMode === 'edit'
      ? 'Update the fields below, then save your changes.'
      : 'Your current avatar profile and account information.');

    if (profileNeedsHydration(currentProfile)) {
      hydrateAvatarDetails(currentProfile).then(function (updated) {
        if (!updated || updated === currentProfile) return;
        currentProfile = updated;
        populate(updated);
        if (currentMode === 'edit') {
          setMode('edit');
        } else {
          setMode('view');
        }
      });
    }

    return false;
  }

  function closeAvatarModal() {
    var modal = document.querySelector('.js-modal');
    var avatarBlock = getById('avatar-modal-block');
    if (modal) {
      modal.classList.remove('is-visible');
    }
    if (avatarBlock) {
      avatarBlock.classList.remove('is-selected');
    }
  }

  function bind() {
    var avatarBlock = getById('avatar-modal-block');
    if (avatarBlock && avatarBlock.dataset.avatarModalBound === 'true') {
      window.openAvatarModal = openAvatarModal;
      window.closeAvatarModal = closeAvatarModal;
      return;
    }

    var editBtn = getById('avatar-modal-edit-btn');
    var cancelBtn = getById('avatar-modal-cancel-btn');
    var saveBtn = getById('avatar-modal-save-btn');
    var closeBtn = getById('avatar-modal-close-btn');

    if (editBtn) {
      editBtn.addEventListener('click', function () {
        setMode('edit');
        setStatus('neutral', 'Edit mode', 'Update the fields below, then save your changes.');
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        populate(currentProfile || readAvatar());
        setMode('view');
        setStatus('neutral', 'View mode', 'Your current avatar profile and account information.');
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function (event) {
        event.preventDefault();
        submitAvatar();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function (event) {
        event.preventDefault();
        closeAvatarModal();
      });
    }

    if (avatarBlock) {
      avatarBlock.dataset.avatarModalBound = 'true';
    }

    window.openAvatarModal = openAvatarModal;
    window.closeAvatarModal = closeAvatarModal;
  }

  function initWhenReady() {
    bind();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.addEventListener('portal-components-ready', initWhenReady);
})();
