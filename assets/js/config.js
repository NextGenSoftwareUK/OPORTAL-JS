//window.apiUrl = 'https://oasisapionode-hseudrexdvbhenhv.canadacentral-01.azurewebsites.net';
//window.apiUrl = 'https://api.web4.oasisomniverse.one';
// window.apiUrl = 'https://localhost:5002/';
window.apiUrl = 'https://api.web4.oasisomniverse.one';
window.API_BASE = window.apiUrl;
window.web5ApiUrl = 'https://api.web5.oasisomniverse.one';

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
