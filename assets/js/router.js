/* ============================================================================
 * OPORTAL client-side router + history
 * ----------------------------------------------------------------------------
 * Maps clean URLs (e.g. /avatar, /data, /beamin) to the portal's modal popups,
 * and keeps a full browser history so Back / Forward step through the popups.
 *
 *   • Opening a popup (side-nav, account menu, deep link) pushes a history entry
 *   • Browser Back/Forward replays the popup that matches the URL (popstate)
 *   • Closing a popup steps back to the portal home (so Back is never off-site)
 *   • Deep links / bookmarks (e.g. /data) open straight into that popup, with a
 *     synthetic "home" entry beneath them so Back always returns to the portal
 *
 * Server note: nginx serves portal.html for these exact single-segment paths
 * (see nginx.conf). Routes are single words with NO trailing slash so the real
 * /avatar/ folder page is left untouched.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__oportalRouterInit) return;
  window.__oportalRouterInit = true;

  // route key -> global open function exposed by each *-modal.js file
  var ROUTES = {
    avatar:     'openAvatarModal',
    wallet:     'openWalletModal',
    nft:        'openNftModal',
    karma:      'openKarmaModal',
    messages:   'openMessagingModal',
    search:     'openSearchModal',
    settings:   'openSettingsModal',
    map:        'openMapModal',
    data:       'openDataModal',
    hyperdrive: 'openHyperdriveModal',
    onet:       'openONETModal',
    onode:      'openONODEModal',
    developer:  'openDevPortalModal'
  };

  // routes that open the sign-in modal (data-type on the .js-modal-block)
  var SIGNIN = { beamin: 'login', signin: 'login', login: 'login', signup: 'signup' };

  // routes that need a beamed-in avatar — fall back to the login form if not
  var PROTECTED = { avatar: 1, wallet: 1, nft: 1, karma: 1, messages: 1, search: 1, settings: 1 };

  var applyingRoute = false;   // true while we sync the DOM to the URL (mutes history writes)
  var initialised = false;

  // ── helpers ────────────────────────────────────────────────────────────────
  function routeFromPath(pathname) {
    var seg = (pathname || '/').replace(/^\/+|\/+$/g, '').toLowerCase().split('/')[0];
    if (ROUTES[seg] || SIGNIN[seg]) return seg;
    return '';
  }

  function getModal() { return document.querySelector('.js-modal'); }

  function modalIsVisible() {
    var m = getModal();
    return !!(m && m.classList.contains('is-visible'));
  }

  function isLoggedIn() {
    try { return localStorage.getItem('loggedIn') === 'true'; } catch (e) { return false; }
  }

  function universalClose() {
    var m = getModal();
    if (m) m.classList.remove('is-visible');
    var blocks = document.querySelectorAll('.js-modal-block.is-selected');
    Array.prototype.forEach.call(blocks, function (b) { b.classList.remove('is-selected'); });
  }

  function openSignin(type) {
    var m = getModal();
    if (!m) return false;
    var blocks = document.querySelectorAll('.js-modal-block');
    var found = false;
    Array.prototype.forEach.call(blocks, function (b) {
      if (b.getAttribute('data-type') === type) { b.classList.add('is-selected'); found = true; }
      else b.classList.remove('is-selected');
    });
    if (found) m.classList.add('is-visible');
    return found;
  }

  // Sync the DOM to a route key WITHOUT writing history.
  function applyRoute(route) {
    applyingRoute = true;
    try {
      if (!route) { universalClose(); return; }
      if (SIGNIN[route]) { openSignin(SIGNIN[route]); return; }
      if (PROTECTED[route] && !isLoggedIn()) { openSignin('login'); return; }
      var fn = ROUTES[route] && window[ROUTES[route]];
      if (typeof fn === 'function') fn();
    } finally {
      // release on the next tick so DOM mutations from the open fn aren't
      // mistaken for a user action by the close observer
      setTimeout(function () { applyingRoute = false; }, 0);
    }
  }

  function pushRoute(route) {
    var path = route ? '/' + route : '/';
    var state = { oportal: true, route: route };
    if (location.pathname === path) history.replaceState(state, '', path);
    else history.pushState(state, '', path);
  }

  // ── wrap global open* fns so user-initiated opens record history ────────────
  function wrapOpeners() {
    Object.keys(ROUTES).forEach(function (route) {
      var name = ROUTES[route];
      var orig = window[name];
      if (typeof orig !== 'function' || orig.__oportalWrapped) return;
      var wrapped = function () {
        var r = orig.apply(this, arguments);
        if (!applyingRoute && modalIsVisible()) pushRoute(route);
        return r;
      };
      wrapped.__oportalWrapped = true;
      window[name] = wrapped;
    });
  }

  // ── Beam in / Sign up triggers also record history ──────────────────────────
  function bindSigninTriggers() {
    document.addEventListener('click', function (e) {
      var trig = e.target.closest && e.target.closest('.js-modal-trigger[data-signin]');
      if (!trig) return;
      var type = trig.getAttribute('data-signin');           // login | signup
      var route = type === 'signup' ? 'signup' : 'beamin';
      // the existing ModalSignin handler opens the form; we just log the route
      setTimeout(function () { if (!applyingRoute && modalIsVisible()) pushRoute(route); }, 0);
    }, true);
  }

  // ── detect a user closing a popup (X button, backdrop, Esc, post-login) ─────
  function watchClose() {
    var target = getModal();
    if (!target) return;
    var obs = new MutationObserver(function () {
      if (applyingRoute) return;
      var visible = target.classList.contains('is-visible');
      var onModalRoute = routeFromPath(location.pathname) !== '';
      if (!visible && onModalRoute) history.back();   // step back to the home base
    });
    obs.observe(target, { attributes: true, attributeFilter: ['class'] });
  }

  // ── browser Back / Forward → replay the popup for the new URL ────────────────
  window.addEventListener('popstate', function () {
    applyRoute(routeFromPath(location.pathname));
  });

  // ── boot ─────────────────────────────────────────────────────────────────--
  function init() {
    if (initialised) return;
    initialised = true;

    wrapOpeners();
    bindSigninTriggers();
    watchClose();

    var initial = routeFromPath(location.pathname);
    if (initial) {
      // Guarantee a "home" entry beneath a deep-linked / bookmarked popup so the
      // Back button always returns to the portal home and never leaves the site.
      history.replaceState({ oportal: true, route: '' }, '', '/');
      history.pushState({ oportal: true, route: initial }, '', '/' + initial);
      applyRoute(initial);
    } else {
      history.replaceState({ oportal: true, route: '' }, '', location.pathname + location.search);
    }
  }

  // Modals are injected asynchronously by portal-components.js.
  window.addEventListener('portal-components-ready', init);
  if (getModal()) init();   // in case components were ready before this script ran
})();
