(function () {
  var API_BASE = 'https://api.oasisweb4.one';
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
    var parts = [profile && profile.title, profile && profile.firstName, profile && profile.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (parts) return parts;
    return (profile && profile.username) || 'Avatar';
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
    var displayName = getDisplayName(profile);
    var username = profile && profile.username ? profile.username : '';
    var email = profile && profile.email ? profile.email : '';
    var avatarType = profile && (profile.avatarType || profile.AvatarType) ? (profile.avatarType || profile.AvatarType) : 'User';
    var title = profile && profile.title ? profile.title : '';
    var firstName = profile && profile.firstName ? profile.firstName : '';
    var lastName = profile && profile.lastName ? profile.lastName : '';
    var address = profile && profile.address ? profile.address : '';

    var avatarImage = getById('avatar-image');
    if (avatarImage) {
      avatarImage.src = localStorage.getItem('loggedIn') === 'true' ? '../assets/img/loggedin.png' : '../assets/img/loggedout.png';
      avatarImage.alt = displayName;
    }

    var nameEls = document.querySelectorAll('[data-avatar-field="displayName"]');
    nameEls.forEach(function (el) { el.textContent = displayName || 'Avatar'; });

    var setText = function (selector, value) {
      var el = document.querySelector(selector);
      if (el) el.textContent = value || 'Not set';
    };

    setText('[data-avatar-field="username"]', username);
    setText('[data-avatar-field="email"]', email);
    setText('[data-avatar-field="avatarType"]', avatarType);
    setText('[data-avatar-field="title"]', title);
    setText('[data-avatar-field="firstName"]', firstName);
    setText('[data-avatar-field="lastName"]', lastName);
    setText('[data-avatar-field="address"]', address);

    var fields = ['title', 'firstName', 'lastName', 'username', 'email', 'address'];
    fields.forEach(function (field) {
      var input = getById('avatar-' + field);
      if (input) input.value = profile && profile[field] ? profile[field] : '';
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
