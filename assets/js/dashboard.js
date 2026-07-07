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

  // ---- Karma bar chart (pure SVG) ----
  function renderKarmaChart(records) {
    var svg = document.getElementById('dash-karma-chart');
    var empty = document.getElementById('dash-karma-chart-empty');
    if (!svg) return;

    // Aggregate by karma type/action
    var buckets = {};
    records.forEach(function (r) {
      var label = r.karmaType || r.KarmaType || r.description || r.Description ||
                  r.karmaSourceTitle || r.KarmaSourceTitle || 'Other';
      // Shorten label
      if (label.length > 20) label = label.substring(0, 18) + '…';
      var pts = Number(r.karmaPoints || r.KarmaPoints || r.points || r.Points || r.amount || r.Amount || 0);
      if (!buckets[label]) buckets[label] = 0;
      buckets[label] += pts;
    });

    var entries = Object.entries(buckets).sort(function (a, b) { return Math.abs(b[1]) - Math.abs(a[1]); }).slice(0, 8);

    if (entries.length === 0) {
      svg.setAttribute('hidden', '');
      if (empty) empty.removeAttribute('hidden');
      return;
    }
    svg.removeAttribute('hidden');
    if (empty) empty.setAttribute('hidden', '');

    var W = 420, H = 200;
    var padL = 110, padR = 16, padT = 12, padB = 24;
    var chartW = W - padL - padR;
    var barH = Math.min(18, (H - padT - padB) / entries.length - 4);
    var spacing = (H - padT - padB) / entries.length;

    var maxVal = Math.max.apply(null, entries.map(function (e) { return Math.abs(e[1]); })) || 1;

    var svgParts = [];
    // Gridline at zero (vertical)
    svgParts.push('<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '" stroke="rgba(255,255,255,.08)" stroke-width="1"/>');

    entries.forEach(function (entry, i) {
      var label = entry[0], val = entry[1];
      var y = padT + i * spacing + spacing / 2;
      var barW = Math.max(2, (Math.abs(val) / maxVal) * chartW);
      var color = val >= 0 ? '#48dc82' : '#ff7070';

      // Label
      svgParts.push('<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="9" fill="#a8bfd8">' + escHtml(label) + '</text>');
      // Bar
      svgParts.push('<rect x="' + padL + '" y="' + (y - barH / 2) + '" width="' + barW + '" height="' + barH + '" rx="3" fill="' + color + '" opacity="0.85"/>');
      // Value label
      svgParts.push('<text x="' + (padL + barW + 4) + '" y="' + (y + 4) + '" font-size="9" fill="' + color + '" font-weight="bold">' + (val > 0 ? '+' : '') + val + '</text>');
    });

    svg.innerHTML = svgParts.join('');
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
    set('dash-wallet-provider', 'Solana');
    set('dash-oapps-msg', 'Coming soon…');

    // Hydrate with fresh API data so username/karma/xp/level are correct from the start
    if (typeof window.hydrateAvatarProfile === 'function') {
      window.hydrateAvatarProfile(p).catch(function () {});
    }

    // Avatar image
    var img = document.getElementById('dash-avatar-img');
    if (img) {
      var photo = p.avatarImage || p.AvatarImage || p.profileImage || p.ProfileImage || p.photo || p.Photo;
      if (photo && typeof photo === 'string' && photo.startsWith('http')) {
        img.src = photo;
        img.onerror = function () { img.src = 'assets/img/loggedin.png'; };
      }
    }

    // Fire parallel API calls — SDK: @oasisomniverse/web4-api + web5-api
    var safe = function (p) { return p.catch(function () { return { isError: true }; }); };
    var results = await Promise.allSettled([
      avatarId && token ? safe(window.oasisClient.karma.getKarmaAkashicRecordsForAvatar({ avatarId: avatarId })) : Promise.resolve(null),  // [0]
      avatarId && token ? safe(window.oasisClient.karma.getKarmaStats({ avatarId: avatarId })) : Promise.resolve(null),                      // [1]
      token ? safe(window.oasisClient.data.loadAllHolons({})) : Promise.resolve(null),                                                       // [2]
      avatarId && token ? safe(window.oasisClient.nft.loadAllWeb4NFTsForAvatarAsync({ avatarId: avatarId })) : Promise.resolve(null),        // [3]
      avatarId && token ? safe(window.oasisClient.nft.loadAllWeb4GeoNFTsForAvatarAsync({ avatarId: avatarId })) : Promise.resolve(null),     // [4]
      token ? safe(window.oasisClient.map.getMapStats()) : Promise.resolve(null),                                                             // [5]
      token ? safe(window.oasisClient.files.getAllFilesStoredForCurrentLoggedInAvatar()) : Promise.resolve(null),                             // [6]
      token ? safe(window.oasisClient.competition.getMyRank({ competitionType: 'Karma', seasonType: 'AllTime' })) : Promise.resolve(null),   // [7]
      token ? safe(window.oasisClient.subscription.getMySubscriptions()) : Promise.resolve(null),                                            // [8]
      token && window.starClient ? safe(window.starClient.games.getAllGames()) : Promise.resolve(null),                                       // [9]
      token ? safe(window.oasisClient.gifts.getMyGifts()) : Promise.resolve(null),                                                           // [10]
      avatarId && token ? safe(window.oasisClient.wallet.loadProviderWalletsForAvatarByIdAsync({ id: avatarId, showOnlyDefault: false, decryptPrivateKeys: false })) : Promise.resolve(null), // [11]
      token ? safe(window.oasisClient.messaging.getMessages()) : Promise.resolve(null),                                                        // [12]
      token ? safe(fetch(API_BASE + '/api/Avatar/inventory', { headers: { 'Authorization': 'Bearer ' + token } }).then(function(r){ return r.json(); })) : Promise.resolve(null), // [13]
    ]);
    /* OLD fetch calls:
    apiFetch(API_BASE + '/api/karma/get-karma-akashic-records-for-avatar/' + avatarId, token)
    apiFetch(API_BASE + '/api/karma/get-karma-stats/' + avatarId, token)
    apiFetch(API_BASE + '/api/data/load-all-holons/all', token)
    apiFetch(API_BASE + '/api/Nft/load-all-nfts-for_avatar/' + avatarId + '/Solana', token)
    apiFetch(API_BASE + '/api/Nft/load-all-geo-nfts-for-avatar/' + avatarId + '/Solana', token)
    apiFetch(API_BASE + '/api/map/stats', token)
    */

    var akashicData  = sdkVal(results[0].value);
    var karmaStats   = sdkVal(results[1].value);
    var holonData    = sdkVal(results[2].value);
    var nftData      = sdkVal(results[3].value);
    var geoNftData   = sdkVal(results[4].value);
    var mapData      = sdkVal(results[5].value);
    var filesData    = sdkVal(results[6].value);
    var rankData     = sdkVal(results[7].value);
    var subsData     = sdkVal(results[8].value);
    var gamesData    = sdkVal(results[9].value);
    var giftsData    = sdkVal(results[10].value);
    var walletsData   = sdkVal(results[11].value);
    var messagesData  = sdkVal(results[12].value);
    var inventoryData = results[13] && results[13].value;

    // Akashic records
    var records = extractList(akashicData);
    renderAkashicList(records);
    renderKarmaChart(records);

    // Karma stats
    var ks = karmaStats && (karmaStats.result || karmaStats.Result || karmaStats);
    if (ks) {
      var pos = ks.totalPositiveKarma || ks.TotalPositiveKarma || ks.positiveKarma || ks.PositiveKarma;
      var neg = ks.totalNegativeKarma || ks.TotalNegativeKarma || ks.negativeKarma || ks.NegativeKarma;
      var net = ks.totalKarma || ks.TotalKarma || ks.netKarma || ks.NetKarma || karma;
      if (pos !== undefined) set('dash-karma-pos', '+' + fmtNum(pos));
      if (neg !== undefined) set('dash-karma-neg', fmtNum(neg));
      if (net !== undefined) { set('dash-karma-net', fmtNum(net)); set('dash-karma-hero', fmtNum(net)); set('dash-card-karma', fmtNum(net)); }
    } else {
      set('dash-karma-pos', '—');
      set('dash-karma-neg', '—');
    }

    // Holons
    var holons = extractList(holonData);
    set('dash-card-holons', fmtNum(holons.length) || '0');

    // NFTs
    var nfts = extractList(nftData);
    var nftCount = nfts.length;
    set('dash-card-nfts', fmtNum(nftCount) || '0');
    set('dash-nfts-hero', fmtNum(nftCount) || '0');
    set('dash-wallet-nfts', fmtNum(nftCount) || '0');

    // GeoNFTs
    var geoNfts = extractList(geoNftData);
    set('dash-card-geonfts', fmtNum(geoNfts.length) || '0');

    // Map stats
    var ms = mapData && (mapData.result || mapData.Result || mapData);
    if (ms) {
      set('dash-map-visited', fmtNum(ms.totalVisited || ms.TotalVisited || ms.visitedCount || ms.VisitedCount || 0));
      set('dash-map-total', fmtNum(ms.totalLocations || ms.TotalLocations || ms.locationCount || ms.LocationCount || 0));
      set('dash-map-geo', fmtNum(ms.geoNFTsPlaced || ms.GeoNFTsPlaced || geoNfts.length || 0));
    } else {
      set('dash-map-visited', '—');
      set('dash-map-total', '—');
      set('dash-map-geo', fmtNum(geoNfts.length) || '0');
    }

    // Quests & Missions (placeholders — APIs TBD)
    set('dash-card-quests', '—');
    set('dash-card-missions', '—');

    // Files
    var files = extractList(filesData);
    set('dash-card-files', fmtNum(files.length) || '0');

    // Competition rank
    var rank = rankData && (rankData.result || rankData);
    var rankVal = rank && (rank.rank || rank.Rank || rank.position || rank.Position);
    set('dash-card-rank', rankVal != null ? '#' + rankVal : '—');

    // Subscription plan
    var subs = extractList(subsData);
    var activeSub = subs.find(function(s) { return s.isActive || s.IsActive || s.status === 'active' || s.Status === 'active'; });
    var planName = activeSub && (activeSub.planName || activeSub.PlanName || activeSub.name || activeSub.Name);
    set('dash-card-plan', planName || (subs.length ? 'Active' : 'Free'));

    // Games (web5)
    var games = extractList(gamesData);
    set('dash-card-games', fmtNum(games.length) || '0');

    // Gifts
    var gifts = extractList(giftsData);
    var pendingGifts = gifts.filter(function(g) { return !(g.isOpened || g.IsOpened || g.opened); }).length;
    set('dash-card-gifts', fmtNum(gifts.length) || '0');
    if (pendingGifts > 0) {
      set('dash-card-gifts', pendingGifts + ' pending');
      set('dash-oapps-msg', pendingGifts + ' gift' + (pendingGifts === 1 ? '' : 's') + ' waiting!');
    }

    // Wallets
    var wallets = extractList(walletsData);
    set('dash-card-wallets', fmtNum(wallets.length) || '0');

    // Messages
    var messages = extractList(messagesData);
    var unread = messages.filter(function(m) { return !(m.isRead || m.IsRead || m.read); }).length;
    set('dash-card-messages', unread > 0 ? unread + ' unread' : fmtNum(messages.length) || '0');

    // Inventory (direct REST call — not in SDK)
    var inventory = extractList(inventoryData);
    set('dash-card-inventory', fmtNum(inventory.length) || '0');
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
  });

})();
