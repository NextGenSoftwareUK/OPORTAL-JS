(function () {
  var rootId = 'portal-components-root';
  var wrapperClass = 'modal js-modal modal--animate-scale';
  var componentPaths = [
    'assets/components/modals/login.html',
    'assets/components/modals/signup.html',
    'assets/components/modals/forgot.html',
    'assets/components/modals/reset.html',
    'assets/components/modals/avatar.html',
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
    var htmlParts = [];

    for (var i = 0; i < componentPaths.length; i++) {
      try {
        htmlParts.push(await fetchFragment(componentPaths[i]));
      } catch (error) {
        console.error(error);
      }
    }

    if (!htmlParts.length) {
      return;
    }

    root.innerHTML = '<div class="' + wrapperClass + '">' + htmlParts.join('\n') + '</div>';
    window.dispatchEvent(new CustomEvent('portal-components-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadComponents);
  } else {
    loadComponents();
  }
})();
