(function () {
  var currentTab = 'account';

  function getById(id) { return document.getElementById(id); }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function readAvatar() {
    try { var r = localStorage.getItem('avatar'); return (r && r !== 'undefined') ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }

  function pickValue(source, keys) {
    if (!source) return '';
    for (var i = 0; i < keys.length; i++) {
      var v = source[keys[i]];
      if (v == null || v === '') continue;
      if (typeof v === 'string' || typeof v === 'number') return String(v);
    }
    return '';
  }

  // ── Populate account tab ──────────────────────────────────────────────────────

  function populate(profile) {
    var p = profile || {};

    setText('settings-avatar-id', pickValue(p, ['id', 'Id', 'avatarId', 'AvatarId']));
    setText('settings-username', pickValue(p, ['username', 'userName', 'UserName']));
    setText('settings-email', pickValue(p, ['email', 'Email', 'emailAddress', 'EmailAddress']));

    var type = pickValue(p, ['avatarType', 'AvatarType', 'avatarTypeName', 'AvatarTypeName', 'role', 'Role']);
    if (!type || /^\d+$/.test(type)) type = 'User';
    setText('settings-avatar-type', type);

    var created = pickValue(p, ['createdDate', 'CreatedDate', 'dateCreated', 'DateCreated', 'created', 'Created']);
    if (created) {
      try { created = new Date(created).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
      catch (e) {}
    }
    setText('settings-created', created || '—');

    // Linked providers
    var providersList = getById('settings-providers-list');
    if (providersList) {
      var providers = p.providerUniqueStorageKey || p.ProviderUniqueStorageKey ||
                      p.providerPublicKey || p.ProviderPublicKey || null;
      if (providers && typeof providers === 'object' && !Array.isArray(providers)) {
        var keys = Object.keys(providers);
        if (keys.length) {
          providersList.innerHTML = keys.map(function (k) {
            return '<div class="settings-provider-chip">' + escapeHtml(k) + '</div>';
          }).join('');
        } else {
          providersList.innerHTML = '<p class="settings-dim">No linked providers found.</p>';
        }
      } else {
        providersList.innerHTML = '<p class="settings-dim">No linked providers found.</p>';
      }
    }
  }

  function setText(id, value) {
    var el = getById(id);
    if (el) el.textContent = value || '—';
  }

  // ── Tab switching ─────────────────────────────────────────────────────────────

  function switchTab(tab) {
    currentTab = tab;
    var block = getById('settings-modal-block');
    if (!block) return;
    block.querySelectorAll('.settings-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    block.querySelectorAll('.settings-panel').forEach(function (p) {
      p.hidden = p.id !== 'settings-tab-' + tab;
    });
  }

  // ── Open / close ─────────────────────────────────────────────────────────────

  function openSettingsModal(tab) {
    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('settings-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    var profile = readAvatar();
    populate(profile);
    switchTab(tab || 'account');
    return false;
  }

  function closeSettingsModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('settings-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  // ── Bind ─────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('settings-modal-block');
    if (!block || block.dataset.settingsBound === 'true') {
      window.openSettingsModal = openSettingsModal;
      window.closeSettingsModal = closeSettingsModal;
      return;
    }

    var closeBtn = getById('settings-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeSettingsModal(); });

    var tabNav = block.querySelector('.settings-tabs');
    if (tabNav) {
      tabNav.addEventListener('click', function (e) {
        var tab = e.target.closest('.settings-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    block.dataset.settingsBound = 'true';
    window.openSettingsModal = openSettingsModal;
    window.closeSettingsModal = closeSettingsModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
