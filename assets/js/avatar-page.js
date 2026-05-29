(function () {
  var API_BASE = window.apiUrl;
  var storageKey = 'avatar';

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

  function getDisplayName(profile) {
    var title = pickValue(profile, ['title', 'Title']);
    var firstName = pickValue(profile, ['firstName', 'FirstName']);
    var lastName = pickValue(profile, ['lastName', 'LastName']);
    var parts = [title, firstName, lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (parts) return parts;
    return pickValue(profile, ['username', 'userName', 'UserName']) || 'Avatar';
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

  function setFieldText(selector, value) {
    var nodes = document.querySelectorAll(selector);
    if (!nodes.length) return;
    nodes.forEach(function (el) {
      el.textContent = value || 'Not set';
    });
  }

  function setStatus(state, title, message) {
    var panel = getById('avatar-status');
    if (!panel) return;

    panel.className = 'avatar-status avatar-status--' + state;
    panel.innerHTML =
      '<h3>' + escapeHtml(title || '') + '</h3>' +
      '<p>' + escapeHtml(message || '') + '</p>';
  }

  function setMode(mode) {
    var view = getById('avatar-view');
    var edit = getById('avatar-edit');
    var editBtn = getById('avatar-toggle-edit');
    var cancelBtn = getById('avatar-cancel');
    var saveBtn = getById('avatar-save');
    var title = getById('avatar-mode-title');
    var subtitle = getById('avatar-mode-subtitle');

    if (!view || !edit) return;

    var isEdit = mode === 'edit';
    view.hidden = isEdit;
    edit.hidden = !isEdit;
    editBtn.hidden = isEdit;
    cancelBtn.hidden = !isEdit;
    saveBtn.hidden = !isEdit;

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
    var username = pickValue(normalized, ['username', 'userName', 'UserName']);
    var email = pickValue(normalized, ['email', 'Email', 'emailAddress', 'EmailAddress']);
    var avatarType = normalizeAvatarType(normalized);
    var title = pickValue(normalized, ['title', 'Title']);
    var firstName = pickValue(normalized, ['firstName', 'FirstName']);
    var lastName = pickValue(normalized, ['lastName', 'LastName']);
    var address = pickValue(normalized, ['address', 'Address']);

    username = username + ' (77)';  //TODO: Need to get real level by loading avatar detail. (same as XP, Karma, address etc)

    var avatarImage = getById('avatar-image');
    if (avatarImage) {
      avatarImage.src = localStorage.getItem('loggedIn') === 'true' ? '../assets/img/loggedin.png' : '../assets/img/loggedout.png';
      avatarImage.alt = displayName;
    }

    var nameEls = document.querySelectorAll('[data-avatar-field="displayName"]');
    nameEls.forEach(function (el) { el.textContent = displayName || 'Avatar'; });

    setFieldText('[data-avatar-field="username"]', username);
    setFieldText('[data-avatar-field="email"]', email);
    setFieldText('[data-avatar-field="avatarType"]', avatarType);
    setFieldText('[data-avatar-field="title"]', title);
    setFieldText('[data-avatar-field="firstName"]', firstName);
    setFieldText('[data-avatar-field="lastName"]', lastName);
    setFieldText('[data-avatar-field="address"]', address);

    var fields = ['title', 'firstName', 'lastName', 'username', 'email', 'address'];
    fields.forEach(function (field) {
      var input = getById('avatar-' + field);
      if (input) input.value = pickValue(normalized, [field, field.charAt(0).toUpperCase() + field.slice(1)]);
    });
  }

  function buildPayload() {
    return {
      title: getById('avatar-title').value.trim(),
      firstName: getById('avatar-firstName').value.trim(),
      lastName: getById('avatar-lastName').value.trim(),
      username: getById('avatar-username').value.trim(),
      email: getById('avatar-email').value.trim(),
      address: getById('avatar-address').value.trim(),
    };
  }

  function getAuthToken(profile) {
    return profile && (profile.jwtToken || profile.token || '');
  }

  function getUpdateUrl(profile) {
    var originalEmail = profile && profile.email;
    var originalUsername = profile && profile.username;
    if (originalEmail) {
      return API_BASE + '/api/avatar/update-avatar-detail-by-email/' + encodeURIComponent(originalEmail);
    }
    if (originalUsername) {
      return API_BASE + '/api/avatar/update-avatar-detail-by-username/' + encodeURIComponent(originalUsername);
    }
    return '';
  }

  async function submitAvatar() {
    var profile = readAvatar();
    if (!profile) {
      setStatus('error', 'Not signed in', 'Please sign in before editing your avatar.');
      return;
    }

    var token = getAuthToken(profile);
    var url = getUpdateUrl(profile);
    var payload = buildPayload();
    var saveBtn = getById('avatar-save');

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
      } catch (e) {}

      if (response.ok) {
        var updated = Object.assign({}, profile, payload);
        saveAvatar(updated);
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

  function init() {
    var profile = readAvatar();
    var loggedIn = localStorage.getItem('loggedIn') === 'true';

    if (!profile || !loggedIn) {
      window.location.replace('/');
      return;
    }

    populate(profile);
    setMode(window.location.hash === '#edit' ? 'edit' : 'view');

    getById('avatar-toggle-edit').addEventListener('click', function () {
      setMode('edit');
      setStatus('neutral', 'Edit mode', 'Update the fields below, then save your changes.');
    });

    getById('avatar-cancel').addEventListener('click', function () {
      populate(readAvatar());
      setMode('view');
      setStatus('neutral', 'View mode', 'Your current avatar profile and account information.');
    });

    getById('avatar-save').addEventListener('click', function (event) {
      event.preventDefault();
      submitAvatar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
