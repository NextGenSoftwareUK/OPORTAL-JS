(function () {
  var rootId = 'portal-components-root';
  var shellPaths = [
    'assets/components/menu-message.html',
    'assets/components/side-nav.html',
  ];
  var modalPaths = [
    'assets/components/modals/login.html',
    'assets/components/modals/signup.html',
    'assets/components/modals/forgot.html',
    'assets/components/modals/reset.html',
    'assets/components/modals/avatar.html',
    'assets/components/modals/dev-portal.html',
    'assets/components/modals/nft.html',
    'assets/components/modals/search-avatars.html',
    'assets/components/modals/settings.html',
  ];

  function getRoot() {
    return document.getElementById(rootId) || document.body;
  }

  async function fetchFragment(path) {
    var response = await fetch(path, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('Failed to load ' + path + ' (' + response.status + ')');
    }
    return response.text();
  }

  async function loadComponents() {
    var root = getRoot();
    var shellParts = [];
    var modalParts = [];

    for (var i = 0; i < shellPaths.length; i++) {
      try {
        shellParts.push(await fetchFragment(shellPaths[i]));
      } catch (error) {
        console.error(error);
      }
    }

    for (var j = 0; j < modalPaths.length; j++) {
      try {
        modalParts.push(await fetchFragment(modalPaths[j]));
      } catch (error) {
        console.error(error);
      }
    }

    if (!shellParts.length && !modalParts.length) {
      return;
    }

    root.innerHTML =
      shellParts.join('\n') +
      (modalParts.length ? '<div class="modal js-modal modal--animate-scale">' + modalParts.join('\n') + '</div>' : '');
    window.dispatchEvent(new CustomEvent('portal-components-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadComponents);
  } else {
    loadComponents();
  }
})();
