(function () {
  var rootId = 'portal-components-root';
  var shellPaths = [
    'assets/components/menu-message.html',
    window.OLD_SIDE_MENU ? 'assets/components/side-nav-old.html' : 'assets/components/side-nav-new.html',
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
    'assets/components/modals/karma.html',
    'assets/components/modals/data.html',
    'assets/components/modals/hyperdrive.html',
    'assets/components/modals/wallet.html',
    'assets/components/modals/messaging.html',
    'assets/components/modals/onet.html',
    'assets/components/modals/onode.html',
    'assets/components/modals/map.html',
    'assets/components/modals/oapps.html',
    'assets/components/modals/quests.html',
    'assets/components/modals/missions.html',
    'assets/components/modals/eggs.html',
    'assets/components/modals/ai.html',
    'assets/components/modals/files.html',
    'assets/components/modals/competition.html',
    'assets/components/modals/clan.html',
    'assets/components/modals/gifts.html',
    'assets/components/modals/subscription.html',
    'assets/components/modals/games.html',
    'assets/components/modals/inventory.html',
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

    // Load dashboard HTML into .content-wrapper (hidden by default; setup() reveals it after login)
    fetchFragment('assets/components/dashboard.html').then(function (html) {
      var wrapper = document.querySelector('.content-wrapper');
      if (wrapper && html) {
        wrapper.innerHTML = html;
        // If setup() already ran (page refresh / slow dashboard fetch), show it now
        if (localStorage.getItem('loggedIn') === 'true' && typeof window.showDashboard === 'function') {
          window.showDashboard();
        }
      }
    }).catch(function (e) { console.error('dashboard load failed', e); });

    // Fetch shell and modals in parallel
    var shellPromises = shellPaths.map(function (p) {
      return fetchFragment(p).catch(function (e) { console.error(e); return null; });
    });
    var modalPromises = modalPaths.map(function (p) {
      return fetchFragment(p).catch(function (e) { console.error(e); return null; });
    });

    // Inject shell (side nav) as soon as it's ready — don't wait for modals
    var shellParts = (await Promise.all(shellPromises)).filter(Boolean);
    if (shellParts.length) {
      root.innerHTML = shellParts.join('\n');
    }

    // Then inject modals once they've all arrived in parallel
    var modalParts = (await Promise.all(modalPromises)).filter(Boolean);
    if (modalParts.length) {
      var modalWrapper = document.createElement('div');
      modalWrapper.className = 'modal js-modal modal--animate-scale';
      modalWrapper.innerHTML = modalParts.join('\n');
      root.appendChild(modalWrapper);
    }

    window.dispatchEvent(new CustomEvent('portal-components-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadComponents);
  } else {
    loadComponents();
  }
})();
