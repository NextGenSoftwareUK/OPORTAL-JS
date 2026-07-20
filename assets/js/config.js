//window.apiUrl = 'https://oasisapionode-hseudrexdvbhenhv.canadacentral-01.azurewebsites.net';
//window.apiUrl = 'https://api.web4.oasisomniverse.one';
// window.apiUrl = 'https://localhost:5002/';
window.apiUrl = 'https://api.web4.oasisomniverse.one';
window.API_BASE = window.apiUrl;
window.web5ApiUrl = 'https://api.starnet.oasisomniverse.one';
window.web6ApiUrl = 'https://api.web6.oasisomniverse.one';
window.web7ApiUrl = 'https://api.web7.oasisomniverse.one';
window.web8ApiUrl = 'https://api.web8.oasisomniverse.one';
window.web9ApiUrl = 'https://api.web9.oasisomniverse.one';
window.web10ApiUrl = 'https://api.web10.oasisomniverse.one';

// GraphQL endpoints (Hot Chocolate — /graphql on each API host)
window.graphqlWeb4Url  = window.apiUrl    + '/graphql';
window.graphqlWeb5Url  = window.web5ApiUrl + '/graphql';
window.graphqlWeb6Url  = window.web6ApiUrl + '/graphql';
window.graphqlWeb7Url  = window.web7ApiUrl + '/graphql';
window.graphqlWeb8Url  = window.web8ApiUrl + '/graphql';
window.graphqlWeb9Url  = window.web9ApiUrl + '/graphql';
window.graphqlWeb10Url = window.web10ApiUrl + '/graphql';

// gRPC endpoints (HTTP/2, same host as REST, port 443)
window.grpcWeb4Host  = 'api.web4.oasisomniverse.one:443';
window.grpcWeb5Host  = 'api.starnet.oasisomniverse.one:443';
window.grpcWeb6Host  = 'api.web6.oasisomniverse.one:443';
window.grpcWeb7Host  = 'api.web7.oasisomniverse.one:443';
window.grpcWeb8Host  = 'api.web8.oasisomniverse.one:443';
window.grpcWeb9Host  = 'api.web9.oasisomniverse.one:443';
window.grpcWeb10Host = 'api.web10.oasisomniverse.one:443';

// ── OASIS SDK clients (@oasisomniverse/web4-api + web5-api) ──────────────────
// OASISClient and STARClient are loaded by the SDK bundle scripts that appear
// before config.js in portal.html. We instantiate them here and expose them as
// window.oasisClient / window.starClient so every modal can use them directly.
(function initSdkClients() {
  // Bind fetch to window here, outside any module wrapper, so the SDK always
  // has a correctly-bound fetch regardless of how esbuild wraps the CommonJS code.
  var boundFetch = window.fetch.bind(window);
  if (typeof OASISClient !== 'undefined') {
    window.oasisClient = new OASISClient({ baseUrl: window.apiUrl, fetchImpl: boundFetch });
  }
  if (typeof STARClient !== 'undefined') {
    window.starClient = new STARClient({ baseUrl: window.web5ApiUrl, fetchImpl: boundFetch });
  }
  if (typeof Web6Client !== 'undefined') {
    window.aiClient = new Web6Client({ baseUrl: window.web6ApiUrl, fetchImpl: boundFetch });
  }

  // Intercept every SDK response — if the server returns HTTP 401 and the
  // stored JWT is genuinely expired, route the user back to the Beam In popup.
  // Only fires when: real 401 status, loggedIn=true, JWT invalid, not an auth
  // path, and debounced so parallel failures only trigger one redirect.
  var _unauthorizedPending = false;
  // strictMode=true  → only fire if local JWT check says expired (used for non-primary APIs
  //                    like starnet whose 401s may mean no permission, not expired session)
  // strictMode=false → fire on any 401 from an authenticated path (server is authoritative)
  function attachUnauthorizedInterceptor(client, strictMode) {
    if (!client || !client.http) return;
    var orig = client.http.request.bind(client.http);
    client.http.request = async function (verb, path, options) {
      var res = await orig(verb, path, options);
      var isHttp401 = res && res.statusCode === 401;
      var isAuthPath = /\/(authenticate|refresh-token|forgot-password|reset-password|register|signup)/i.test(path);
      var isLoggedIn = localStorage.getItem('loggedIn') === 'true';
      var tokenExpired = isLoggedIn && typeof isJwtValid === 'function' && !isJwtValid();
      var shouldFire = strictMode ? tokenExpired : true; // non-strict: server 401 = needs re-auth
      if (isHttp401 && !isAuthPath && isLoggedIn && shouldFire && !_unauthorizedPending) {
        _unauthorizedPending = true;
        if (typeof window.handleUnauthorized === 'function') {
          window.handleUnauthorized().finally(function () { _unauthorizedPending = false; });
        }
      }
      return res;
    };
  }
  // Primary API (web4): fire handleUnauthorized on any 401 — server is authoritative
  attachUnauthorizedInterceptor(window.oasisClient, false);
  // Secondary APIs: only redirect on locally-confirmed expiry to avoid false positives
  attachUnauthorizedInterceptor(window.starClient, true);
  attachUnauthorizedInterceptor(window.aiClient, true);

  // If the user is already logged in (page refresh / revisit), inject their
  // stored JWT so the SDK sends authenticated requests immediately.
  try {
    var _av = JSON.parse(localStorage.getItem('avatar') || 'null');
    var _tok = _av && (_av.jwtToken || _av.JwtToken || _av.token || _av.Token || '');
    if (_tok) {
      if (window.oasisClient) window.oasisClient.setToken(_tok);
      if (window.starClient)  window.starClient.setToken(_tok);
      if (window.aiClient)    window.aiClient.setToken(_tok);
    }
  } catch (e) {}
})();

// ── Nav preferences (defaults — overridden by localStorage if user has saved a preference) ──
// OLD_SIDE_MENU   : true = old flat menu, false = new grouped sections
// NAV_CHEVRONS    : true = show chevrons, false = hide
// SUB_MENU_LOWERCASE : true = "My Avatar", false = "MY AVATAR"
function _navPref(key, def) {
  var v = localStorage.getItem(key);
  return v !== null ? v === 'true' : def;
}
window.OLD_SIDE_MENU      = _navPref('nav_old_menu',   true);
window.NAV_CHEVRONS       = _navPref('nav_chevrons',   false);
window.SUB_MENU_LOWERCASE = _navPref('nav_lowercase',  true);
