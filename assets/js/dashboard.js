(function () {
  'use strict';

  var API_BASE = window.apiUrl || window.API_BASE || '';

  // ---- helpers ----
  function getProfile() {
    try { return JSON.parse(localStorage.getItem('avatar') || 'null'); } catch (e) { return null; }
  }
  function getToken(p) { return p && (p.jwtToken || p.JwtToken || p.token || p.Token || ''); }
  function getAvatarId(p) { return p && (p.id || p.Id || p.avatarId || p.AvatarId || ''); }
  function getKarma(p) { return p && (p.karma || p.Karma || p.karmaPoints || p.KarmaPoints || p.karmaWeighting || p.KarmaWeighting || 0); }
  function getXP(p) { return p && (p.xp || p.XP || p.experiencePoints || p.ExperiencePoints || 0); }
  function getLevel(p) { return p && (p.level || p.Level || 1); }
  function unwrapEnum(v) {
    if (v == null) return null;
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      for (var k of ['name', 'Name', 'title', 'Title', 'label', 'Label', 'value', 'Value']) {
        if (v[k] != null && v[k] !== '') return String(v[k]);
      }
    }
    return null;
  }
  function getType(p) {
    var raw = p && (p.avatarType || p.AvatarType || p.type || p.Type);
    var v = unwrapEnum(raw);
    if (!v || /^\d+$/.test(v)) return 'Human';
    return v;
  }
  function getName(p) {
    if (!p) return 'Avatar';
    var uname = p.username || p.UserName || p.userName || '';
    if (uname) return uname;
    var fullName = ((p.firstName || p.FirstName || '') + ' ' + (p.lastName || p.LastName || '')).trim();
    if (fullName) return fullName;
    return p.email || p.Email || 'Avatar';
  }
  function fmtNum(n) {
    if (n === null || n === undefined || n === '' || n === '—') return '—';
    var num = Number(n);
    if (isNaN(num)) return '—';
    return num.toLocaleString();
  }
  function fmtDate(d) {
    if (!d) return '';
    try {
      var dt = new Date(d);
      if (isNaN(dt)) return '';
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  /* OLD fetch helpers:
  function authHeaders(token) { return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }; }
  async function apiFetch(url, token) { ... }
  */
  function sdkVal(res) { return res && !res.isError ? res.result : null; }
  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    var r = data.result || data.Result;
    if (Array.isArray(r)) return r;
    var r2 = r && (r.result || r.Result);
    if (Array.isArray(r2)) return r2;
    for (var k of ['data','holons','items','nfts','records']) {
      if (data[k] && Array.isArray(data[k])) return data[k];
      if (r && r[k] && Array.isArray(r[k])) return r[k];
    }
    return [];
  }
  function set(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ---- Akashic records list ----
  function renderAkashicList(records) {
    var ul = document.getElementById('dash-akashic-list');
    if (!ul) return;

    var sorted = records.slice().sort(function (a, b) {
      var da = new Date(a.date || a.Date || a.createdDate || a.CreatedDate || 0);
      var db = new Date(b.date || b.Date || b.createdDate || b.CreatedDate || 0);
      return db - da;
    }).slice(0, 12);

    if (sorted.length === 0) {
      ul.innerHTML = '<li class="dash-akashic-loading">No karma records found.</li>';
      return;
    }

    ul.innerHTML = sorted.map(function (r) {
      var desc = r.description || r.Description || r.karmaType || r.KarmaType || r.karmaSourceTitle || r.KarmaSourceTitle || 'Karma event';
      var pts = Number(r.karmaPoints || r.KarmaPoints || r.points || r.Points || r.amount || r.Amount || 0);
      var date = fmtDate(r.date || r.Date || r.createdDate || r.CreatedDate);
      var cls = pts >= 0 ? 'dash-akashic-pts--pos' : 'dash-akashic-pts--neg';
      return '<li class="dash-akashic-item">' +
        '<span class="dash-akashic-desc">' + escHtml(desc) + '</span>' +
        (date ? '<span class="dash-akashic-date">' + escHtml(date) + '</span>' : '') +
        '<span class="dash-akashic-pts ' + cls + '">' + (pts > 0 ? '+' : '') + pts + '</span>' +
        '</li>';
    }).join('');
  }

  // ---- Main init ----
  async function initDashboard() {
    var p = getProfile();
    if (!p) return;

    var token = getToken(p);
    var avatarId = getAvatarId(p);

    // Immediate render from localStorage
    var name = getName(p);
    set('dash-name', name);
    set('dash-avatar-type', getType(p));
    var lvl = getLevel(p);
    set('dash-level', lvl);
    var karma = getKarma(p);
    set('dash-karma-hero', fmtNum(karma));
    set('dash-card-karma', fmtNum(karma));
    set('dash-xp-hero', fmtNum(getXP(p)));
    set('dash-karma-pos', '…');
    set('dash-karma-neg', '…');
    set('dash-karma-net', fmtNum(karma));
    set('dash-wallet-provider', 'Multi-chain');
    set('dash-oapps-msg', 'Coming soon…');

    // Hydrate with fresh API data so username/karma/xp/level are correct from the start
    if (typeof window.hydrateAvatarProfile === 'function') {
      window.hydrateAvatarProfile(p).catch(function () {});
    }

    // Avatar image
    var img = document.getElementById('dash-avatar-img');
    if (img) {
      var photo = p.avatarImage || p.AvatarImage || p.profileImage || p.ProfileImage || p.photo || p.Photo;
      if (photo && typeof photo === 'string' && (photo.startsWith('http') || photo.startsWith('data:'))) {
        img.src = photo;
        img.onerror = function () { img.src = 'assets/img/loggedin.png'; };
      } else {
        var uname = p.username || p.userName || p.UserName;
        if (uname && typeof window.loadAvatarPortrait === 'function') {
          window.loadAvatarPortrait(uname, img);
        }
      }
    }

    // Show spinners on all cards that require an API call
    var SPINNER = '<span class="dash-spinner"></span>';
    var apiCards = [
      'dash-card-karma', 'dash-card-holons', 'dash-card-files', 'dash-card-wallets',
      'dash-card-nfts', 'dash-card-geonfts', 'dash-card-games', 'dash-card-rank',
      'dash-card-gifts', 'dash-card-messages', 'dash-card-inventory', 'dash-card-plan',
      'dash-nfts-hero', 'dash-wallet-nfts', 'dash-wallet-balance',
      'dash-map-visited', 'dash-map-total', 'dash-map-geo',
      'dash-karma-pos', 'dash-karma-neg', 'dash-karma-net',
    ];
    apiCards.forEach(function (id) { setHtml(id, SPINNER); });
    setHtml('dash-akashic-list', '<li class="dash-akashic-loading">' + SPINNER + ' Loading karma records…</li>');

    function setHtml(id, html) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = html;
    }

    // Fire all API calls in parallel — each .then() updates its card(s) as soon as data arrives
    var safe = function (promise) { return promise.catch(function () { return { isError: true }; }); };

    // [0] Akashic records
    (avatarId && token
      ? safe(window.oasisClient.karma.getKarmaAkashicRecordsForAvatar({ avatarId: avatarId }))
      : Promise.resolve(null)
    ).then(function (res) {
      var records = extractList(sdkVal(res));
      renderAkashicList(records);
    });

    // [1] Karma stats
    (avatarId && token
      ? safe(window.oasisClient.karma.getKarmaStats({ avatarId: avatarId }))
      : Promise.resolve(null)
    ).then(function (res) {
      var ks = sdkVal(res);
      ks = ks && (ks.result || ks.Result || ks);
      if (ks) {
        var pos = ks.totalPositiveKarma || ks.TotalPositiveKarma || ks.positiveKarma || ks.PositiveKarma;
        var neg = ks.totalNegativeKarma || ks.TotalNegativeKarma || ks.negativeKarma || ks.NegativeKarma;
        var net = ks.totalKarma || ks.TotalKarma || ks.netKarma || ks.NetKarma || karma;
        if (pos !== undefined) set('dash-karma-pos', '+' + fmtNum(pos));
        if (neg !== undefined) set('dash-karma-neg', fmtNum(neg));
        if (net !== undefined) { set('dash-karma-net', fmtNum(net)); set('dash-karma-hero', fmtNum(net)); set('dash-card-karma', fmtNum(net)); }
      } else {
        set('dash-karma-pos', '—'); set('dash-karma-neg', '—');
      }
    });

    // [2] Holons / Data
    (token
      ? safe(window.oasisClient.data.loadAllHolons({ holonType: 'All' }))
      : Promise.resolve(null)
    ).then(function (res) {
      set('dash-card-holons', fmtNum(extractList(sdkVal(res)).length) || '0');
    });

    // [3] NFTs + [4] GeoNFTs — run together so hero stat and map geo stay in sync
    var nftPromise = avatarId && token
      ? safe(window.oasisClient.nft.loadAllWeb4NFTsForAvatarAsync({ avatarId: avatarId }))
      : Promise.resolve(null);
    var geoNftPromise = avatarId && token
      ? safe(window.oasisClient.nft.loadAllWeb4GeoNFTsForAvatarAsync({ avatarId: avatarId }))
      : Promise.resolve(null);

    nftPromise.then(function (res) {
      var count = extractList(sdkVal(res)).length;
      set('dash-card-nfts', fmtNum(count) || '0');
      set('dash-nfts-hero', fmtNum(count) || '0');
      set('dash-wallet-nfts', fmtNum(count) || '0');
    });

    geoNftPromise.then(function (res) {
      var geoNfts = extractList(sdkVal(res));
      set('dash-card-geonfts', fmtNum(geoNfts.length) || '0');
      // Update map geo count when geoNFTs arrive (map stats may refine this)
      set('dash-map-geo', fmtNum(geoNfts.length) || '0');
    });

    // [5] Map stats (may override geoNFT geo count with server value)
    Promise.all([
      token ? safe(window.oasisClient.map.getMapStats()) : Promise.resolve(null),
      geoNftPromise
    ]).then(function (vals) {
      var mapRes = vals[0]; var geoNfts = extractList(sdkVal(vals[1]));
      var ms = sdkVal(mapRes); ms = ms && (ms.result || ms.Result || ms);
      if (ms) {
        set('dash-map-visited', fmtNum(ms.totalVisited || ms.TotalVisited || ms.visitedCount || ms.VisitedCount || 0));
        set('dash-map-total',   fmtNum(ms.totalLocations || ms.TotalLocations || ms.locationCount || ms.LocationCount || 0));
        set('dash-map-geo',     fmtNum(ms.geoNFTsPlaced || ms.GeoNFTsPlaced || geoNfts.length || 0));
      } else {
        set('dash-map-visited', '—'); set('dash-map-total', '—');
        set('dash-map-geo', fmtNum(geoNfts.length) || '0');
      }
    });

    // [6] Files
    (token
      ? safe(window.oasisClient.files.getAllFilesStoredForCurrentLoggedInAvatar())
      : Promise.resolve(null)
    ).then(function (res) {
      set('dash-card-files', fmtNum(extractList(sdkVal(res)).length) || '0');
    });

    // [7] Competition rank
    (token
      ? safe(window.oasisClient.competition.getMyRank({ competitionType: 'Karma', seasonType: 'AllTime' }))
      : Promise.resolve(null)
    ).then(function (res) {
      var rank = sdkVal(res); rank = rank && (rank.result || rank);
      var rankVal = rank && (rank.rank || rank.Rank || rank.position || rank.Position);
      set('dash-card-rank', rankVal != null ? '#' + rankVal : '—');
    });

    // [8] Subscription
    (token
      ? safe(window.oasisClient.subscription.getMySubscriptions())
      : Promise.resolve(null)
    ).then(function (res) {
      var subs = extractList(sdkVal(res));
      var activeSub = subs.find(function (s) { return s.isActive || s.IsActive || s.status === 'active' || s.Status === 'active'; });
      var planName = activeSub && (activeSub.planName || activeSub.PlanName || activeSub.name || activeSub.Name);
      set('dash-card-plan', planName || (subs.length ? 'Active' : 'Free'));
    });

    // [9] Games (web5)
    (token && window.starClient
      ? safe(window.starClient.games.getAllGames())
      : Promise.resolve(null)
    ).then(function (res) {
      set('dash-card-games', fmtNum(extractList(sdkVal(res)).length) || '0');
    });

    // [10] Gifts
    (token
      ? safe(window.oasisClient.gifts.getMyGifts())
      : Promise.resolve(null)
    ).then(function (res) {
      var gifts = extractList(sdkVal(res));
      var pending = gifts.filter(function (g) { return !(g.isOpened || g.IsOpened || g.opened); }).length;
      set('dash-card-gifts', pending > 0 ? pending + ' pending' : fmtNum(gifts.length) || '0');
      if (pending > 0) set('dash-oapps-msg', pending + ' gift' + (pending === 1 ? '' : 's') + ' waiting!');
    });

    // [11] Wallets
    (avatarId && token
      ? safe(window.oasisClient.wallet.loadProviderWalletsForAvatarByIdAsync({ id: avatarId, showOnlyDefault: false, decryptPrivateKeys: false }))
      : Promise.resolve(null)
    ).then(function (res) {
      set('dash-card-wallets', fmtNum(extractList(sdkVal(res)).length) || '0');
    });

    // [12] Messages
    (token
      ? safe(window.oasisClient.messaging.getMessages())
      : Promise.resolve(null)
    ).then(function (res) {
      var messages = extractList(sdkVal(res));
      var unread = messages.filter(function (m) { return !(m.isRead || m.IsRead || m.read); }).length;
      set('dash-card-messages', unread > 0 ? unread + ' unread' : fmtNum(messages.length) || '0');
    });

    // [13] Inventory (direct REST)
    (token
      ? safe(fetch(API_BASE + '/api/Avatar/inventory', { headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) { return r.json(); }))
      : Promise.resolve(null)
    ).then(function (res) {
      set('dash-card-inventory', fmtNum(extractList(res).length) || '0');
    });

    // [14] Clans
    (token
      ? safe(window.oasisClient.clan.list())
      : Promise.resolve(null)
    ).then(function (res) {
      set('dash-card-clans', fmtNum(extractList(sdkVal(res)).length) || '0');
    });

    // [15] ONET
    safe(window.oasisClient.oNET.getNetworkStats()).then(function (res) {
      var onetStats = sdkVal(res); onetStats = onetStats && (onetStats.result || onetStats);
      var nodeCount = onetStats && (onetStats.totalNodes || onetStats.TotalNodes || onetStats.nodeCount || onetStats.NodeCount);
      set('dash-card-onet', nodeCount != null ? fmtNum(nodeCount) : '—');
    });

    // Quests & Missions (APIs TBD)
    set('dash-card-quests', '—');
    set('dash-card-missions', '—');
  }

  // ---- Show / Hide ----
  window.showDashboard = function () {
    var el = document.getElementById('dashboard');
    if (el) {
      el.classList.remove('dashboard--hidden');
      el.style.display = '';
      initDashboard();
    }
  };

  window.hideDashboard = function () {
    var el = document.getElementById('dashboard');
    if (el) el.classList.add('dashboard--hidden');
  };

  // Re-init on re-login event
  window.addEventListener('oasis-login', function () {
    if (localStorage.getItem('loggedIn') === 'true') window.showDashboard();
  });

  // Refresh hero fields whenever avatar data is saved or hydrated
  window.addEventListener('avatarUpdated', function (e) {
    var p = e.detail;
    if (!p) return;
    set('dash-name', getName(p));
    set('dash-avatar-type', getType(p));
    set('dash-level', getLevel(p));
    var karma = getKarma(p);
    set('dash-karma-hero', fmtNum(karma));
    set('dash-card-karma', fmtNum(karma));
    set('dash-karma-net', fmtNum(karma));
    set('dash-xp-hero', fmtNum(getXP(p)));
    var img = document.getElementById('dash-avatar-img');
    if (img) {
      var photo = p.avatarImage || p.AvatarImage || p.profileImage || p.ProfileImage || p.photo || p.Photo;
      if (photo && typeof photo === 'string' && (photo.startsWith('http') || photo.startsWith('data:'))) {
        img.src = photo;
        img.onerror = function () { img.src = 'assets/img/loggedin.png'; };
      }
    }
  });

})();
