(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var currentProvider = 'all';
  var isFetching = false;

  // ProviderType enum number → canonical string name (matches C# enum order)
  var PROVIDER_TYPE_MAP = {
    0:'None',1:'All',2:'Default',3:'SolanaOASIS',4:'ArbitrumOASIS',5:'AvalancheOASIS',
    6:'BaseOASIS',7:'EthereumOASIS',8:'PolygonOASIS',9:'EOSIOOASIS',10:'TelosOASIS',
    11:'SEEDSOASIS',12:'LoomOASIS',13:'TONOASIS',14:'StellarOASIS',15:'BlockStackOASIS',
    16:'HashgraphOASIS',17:'ElrondOASIS',18:'TRONOASIS',19:'CosmosBlockChainOASIS',
    20:'RootstockOASIS',21:'ChainLinkOASIS',22:'CardanoOASIS',23:'PolkadotOASIS',
    24:'BitcoinOASIS',25:'NEAROASIS',26:'SuiOASIS',27:'AptosOASIS',28:'OptimismOASIS',
    29:'BNBChainOASIS',30:'FantomOASIS',31:'StarknetOASIS',32:'AztecOASIS',33:'MidenOASIS',
    34:'ZcashOASIS',35:'RadixOASIS',36:'TelegramOASIS',37:'XRPLOASIS',38:'MonadOASIS',
    39:'LineaOASIS',40:'ScrollOASIS',41:'ZkSyncOASIS',42:'MoralisOASIS',43:'IPFSOASIS',
    44:'PinataOASIS',45:'HoloOASIS',46:'MongoDBOASIS',47:'Neo4jOASIS',48:'SQLLiteDBOASIS',
    49:'SQLServerDBOASIS',50:'OracleDBOASIS',51:'GoogleCloudOASIS',52:'AzureStorageOASIS',
    53:'AzureCosmosDBOASIS',54:'AWSOASIS',55:'UrbitOASIS',56:'ThreeFoldOASIS',
    57:'PLANOASIS',58:'HoloWebOASIS',59:'SOLIDOASIS',60:'ActivityPubOASIS',
    61:'ScuttlebuttOASIS',62:'LocalFileOASIS'
  };

  var NULL_GUID = '00000000-0000-0000-0000-000000000000';

  // HolonType enum number → display name
  var HOLON_TYPE_MAP = {
    0:'Default',1:'All',2:'Player',3:'Avatar',4:'AvatarDetail',5:'Clan',
    6:'Mission',7:'Chapter',8:'Quest',9:'Game',10:'GameSession',11:'GameArea',
    12:'InventoryItem',13:'Park',14:'Building',15:'Restaurant',16:'Cafe',
    17:'TrainStation',18:'UndergroundStation',19:'BusStation',
    20:'STARCelestialBody',21:'CelestialBodyMetaDataDNA',22:'STARCelestialSpace',
    23:'GreatGrandSuperStar',24:'GrandSuperStar',25:'SuperStar',26:'Star',
    27:'Planet',28:'Moon',29:'Asteroid',30:'Comet',31:'Meteroid',32:'Nebula',
    33:'Zome',34:'ZomeMetaDataDNA',35:'STARZome',36:'Holon',37:'STARHolon',
    38:'HolonMetaDataDNA',39:'Omniverse',40:'SuperVerse',41:'Multiverse',
    42:'Universe',43:'GalaxyCluster',44:'Galaxy',45:'SolarSystem',
    46:'Dimension',47:'WormHole',48:'BlackHole',49:'Portal',50:'StarGate',
    51:'SpaceTimeDistortion',52:'SpaceTimeAbnormally',53:'TemporalRift',
    54:'StarDust',55:'CosmicWave',56:'CosmicRay',57:'GravitationalWave',
    58:'Web3NFT',59:'Web4NFT',63:'Web5NFT',64:'Web4GeoNFT',65:'Web5GeoNFT',
    66:'Web4NFTCollection',67:'Web5NFTCollection',68:'Web4GeoNFTCollection',
    69:'Web5GeoNFTCollection',70:'GeoHotSpot',71:'STARNETHolon',72:'OAPP',
    73:'OAPPTemplate',74:'Runtime',75:'Library',76:'Plugin',
    77:'DownloadedSTARNETHolon',78:'DownloadedOAPP',79:'DownloadedOAPPTemplate',
    80:'DownloadedRuntime',81:'DownloadedLibrary',82:'DownloadedChapter',
    83:'DownloadedMission',84:'DownloadedQuest',85:'DownloadedGame',
    86:'DownloadedNFT',87:'DownloadedNFTCollection',88:'DownloadedGeoNFT',
    89:'DownloadedGeoNFTCollection',90:'DownloadedGeoHotSpot',
    91:'DownloadedInventoryItem',92:'DownloadedCelestialSpace',
    93:'DownloadedCelestialBody',100:'InstalledSTARNETHolon',101:'InstalledOAPP',
    102:'InstalledOAPPTemplate',103:'InstalledRuntime',104:'InstalledLibrary',
    105:'InstalledChapter',106:'InstalledMission',107:'InstalledQuest',
    108:'InstalledGame',109:'InstalledNFT',110:'InstalledNFTCollection',
    111:'InstalledGeoNFT',112:'InstalledGeoNFTCollection',113:'InstalledGeoHotSpot',
    114:'InstalledInventoryItem',123:'Proposal',124:'HolonicBraidGraph',
    125:'HolonicBraidLibrary',126:'ReasoningAgent',127:'ReasoningSession'
  };

  function holonTypeName(raw) {
    if (raw == null || raw === '') return '';
    // Object with .name property
    if (typeof raw === 'object') {
      var n = raw.name || raw.Name || raw.value || raw.Value;
      if (n != null) return holonTypeName(n);
      return '';
    }
    var num = Number(raw);
    if (!isNaN(num) && HOLON_TYPE_MAP[num]) return HOLON_TYPE_MAP[num];
    // Already a string name
    return String(raw);
  }

  function providerDisplayName(raw) {
    if (raw == null || raw === '') return '';
    if (typeof raw === 'object') {
      var n = raw.name || raw.Name;
      if (n) return providerDisplayName(n);
    }
    var s = String(raw);
    // Strip trailing OASIS for display
    return s.replace(/OASIS$/i, '').replace(/OASISdb$/i, ' DB');
  }

  function getProviderKey(h) {
    var raw = h.providerType || h.ProviderType || h.provider || h.Provider;
    if (raw == null || raw === '') return '';
    if (typeof raw === 'object') raw = raw.name || raw.Name || raw.value || '';
    var s = String(raw).trim();
    // Normalize numeric enum to canonical string
    var num = Number(s);
    if (!isNaN(num) && s !== '' && PROVIDER_TYPE_MAP[num]) return PROVIDER_TYPE_MAP[num];
    return s;
  }

  // Providers that mean "stored in the default provider (MongoDB)" when no explicit provider is tagged
  var MONGO_ALIASES = { '': true, 'None': true, 'All': true, 'Default': true, 'MongoDBOASIS': true };

  function providerMatches(h, selected) {
    var key = getProviderKey(h);
    if (selected === 'MongoDBOASIS') return !!MONGO_ALIASES[key];
    return key === selected;
  }

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

  function getToken(p) { return p && (p.jwtToken || p.JwtToken || p.token || p.Token || ''); }

  // ── Status ───────────────────────────────────────────────────────────────────

  var SPINNER_HTML = ' <span class="modal-spinner"></span>';

  function isUnauthorized(msg) {
    return msg && /unauthorized|401|authenticate/i.test(msg);
  }

  function showStatus(type, msg) {
    if (type === 'error' && isUnauthorized(msg)) {
      if (typeof window.handleUnauthorized === 'function') { window.handleUnauthorized(); return; }
    }
    var el = getById('data-modal-status');
    if (!el) return;
    el.className = 'data-status data-status--' + type;
    el.innerHTML = escapeHtml(msg) + (type === 'loading' ? SPINNER_HTML : '');
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('data-modal-status');
    if (el) el.hidden = true;
  }

  // ── Holon detail panel ───────────────────────────────────────────────────────

  function fmtDate(raw) {
    if (!raw) return '';
    try {
      var d = new Date(raw);
      if (isNaN(d)) return '';
      if (d.getFullYear() < 2000) return ''; // default/zero C# DateTime
      return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function detailRow(label, value) {
    if (value == null || value === '') return '';
    return '<div class="data-detail-row">' +
      '<span class="data-detail-row-label">' + escapeHtml(label) + '</span>' +
      '<span class="data-detail-row-value">' + escapeHtml(String(value)) + '</span>' +
    '</div>';
  }

  function resolveId(rawId, label, rowsEl) {
    if (!rawId || rawId === NULL_GUID) return '';
    var profile = readAvatar();
    var myId = profile && (profile.avatarId || profile.AvatarId || profile.id || profile.Id || '');
    var myName = profile && (profile.username || profile.Username || profile.email || profile.Email || '');
    if (myId && rawId === myId) return rawId + (myName ? ' (' + myName + ')' : ' (you)');
    return rawId; // raw ID — no extra API call needed for now
  }

  function openHolonDetail(h) {
    var panel = getById('data-detail-panel');
    var title = getById('data-detail-title');
    var rows  = getById('data-detail-rows');
    if (!panel || !title || !rows) return;

    var name = h.name || h.Name || h.title || h.Title || 'Unnamed Holon';
    title.textContent = name;

    var typeName = holonTypeName(h.holonType || h.HolonType || h.type || h.Type || '');
    var provName = providerDisplayName(getProviderKey(h));
    var id = h.id || h.Id || h.holonId || h.HolonId || '';
    var parentId = h.parentHolonId || h.ParentHolonId || h.parentId || h.ParentId || '';
    var desc = h.description || h.Description || '';
    var karma = h.karma || h.Karma;
    var xp = h.xp || h.XP;
    var level = h.level || h.Level;
    var createdDate = fmtDate(h.createdDate || h.CreatedDate || h.date || h.Date);
    var modifiedDate = fmtDate(h.modifiedDate || h.ModifiedDate);
    var deletedDate  = fmtDate(h.deletedDate  || h.DeletedDate);
    var createdByRaw  = h.createdByAvatarId  || h.CreatedByAvatarId  || '';
    var modifiedByRaw = h.modifiedByAvatarId || h.ModifiedByAvatarId || '';
    var isActive = (h.isActive != null ? h.isActive : (h.IsActive != null ? h.IsActive : null));

    // Skip null GUIDs entirely
    var createdBy  = (createdByRaw  && createdByRaw  !== NULL_GUID) ? resolveId(createdByRaw,  'Created By',  rows) : '';
    var modifiedBy = (modifiedByRaw && modifiedByRaw !== NULL_GUID) ? resolveId(modifiedByRaw, 'Modified By', rows) : '';
    var parentLabel = (parentId && parentId !== NULL_GUID) ? resolveId(parentId, 'Parent ID', rows) : '';

    var html = '';
    if (desc) html += detailRow('Description', desc);
    if (typeName) html += detailRow('Holon Type', typeName);
    if (provName) html += detailRow('Provider', provName);
    if (id) html += detailRow('ID', id);
    if (parentLabel) html += detailRow('Parent ID', parentLabel);
    if (karma != null) html += detailRow('Karma', karma);
    if (xp != null) html += detailRow('XP', xp);
    if (level != null) html += detailRow('Level', level);
    if (isActive != null) html += detailRow('Active', isActive ? 'Yes' : 'No');
    if (createdDate) html += detailRow('Created', createdDate);
    if (createdBy) html += detailRow('Created By', createdBy);
    if (modifiedDate) html += detailRow('Modified', modifiedDate);
    if (modifiedBy) html += detailRow('Modified By', modifiedBy);
    if (deletedDate) html += detailRow('Deleted', deletedDate);

    // MetaData — skip keys that duplicate top-level fields already shown above
    var META_SKIP = /^(id|holonid|parentid|parentholonid|createdbyavatarid|modifiedbyavatarid|isactive|active|createddate|modifieddate|deleteddate|holontype|providertype)$/i;
    var meta = h.metaData || h.MetaData || h.metadata;
    if (meta && typeof meta === 'object') {
      Object.keys(meta).forEach(function (k) {
        if (META_SKIP.test(k)) return;
        var v = meta[k];
        if (v != null && v !== '') html += detailRow(k, typeof v === 'object' ? JSON.stringify(v) : v);
      });
    }

    if (!html) html = '<p style="color:var(--color-contrast-medium);font-size:0.85rem">No additional details available.</p>';

    rows.innerHTML = html;
    panel.style.display = 'block';
  }

  function closeHolonDetail() {
    var panel = getById('data-detail-panel');
    if (panel) panel.style.display = 'none';
  }

  // ── Holon card ────────────────────────────────────────────────────────────────

  function buildHolonCard(h, showDelete) {
    var id = h.id || h.Id || h.holonId || h.HolonId || '';
    var name = escapeHtml(h.name || h.Name || h.title || h.Title || 'Unnamed Holon');
    var desc = escapeHtml(h.description || h.Description || '');
    var typeName = escapeHtml(holonTypeName(h.holonType || h.HolonType || h.type || h.Type || ''));
    var provName = escapeHtml(providerDisplayName(getProviderKey(h)));
    // Use modifiedDate as fallback when createdDate is missing/default C# zero date
    var dateStr = fmtDate(h.createdDate || h.CreatedDate || h.date || h.Date)
               || fmtDate(h.modifiedDate || h.ModifiedDate);

    var deleteBtn = showDelete && id
      ? '<button class="data-card-delete" onclick="event.stopPropagation();window._dataDeleteHolon(\'' + escapeHtml(id) + '\')" title="Delete holon">🗑</button>'
      : '';

    var dataAttr = 'data-holon-idx="' + escapeHtml(id) + '"';

    // Footer: 3 columns — type badge left | date centre | delete right (always present for alignment)
    var badgeHtml = typeName
      ? '<span class="data-holon-badge">' + typeName + '</span>'
      : '<span></span>';
    var dateHtml = dateStr
      ? '<span class="data-holon-date" style="text-align:center">' + escapeHtml(dateStr) + '</span>'
      : '<span></span>';
    var deleteHtml = '<div class="data-card-footer-right">' + (showDelete ? deleteBtn : '') + '</div>';

    return '<div class="data-holon-card" ' + dataAttr + ' onclick="window._dataOpenCard(this)">' +
      '<div class="data-holon-card-name">' + name + '</div>' +
      (desc ? '<div class="data-holon-card-desc">' + desc + '</div>' : '') +
      (provName ? '<div style="margin-top:4px"><span class="data-holon-badge data-holon-badge--provider">' + provName + '</span></div>' : '') +
      '<div class="data-card-footer">' +
        badgeHtml + dateHtml + deleteHtml +
      '</div>' +
    '</div>';
  }

  // Store holons by id for click-to-detail
  var _holonStore = {};

  function storeHolons(list) {
    list.forEach(function (h) {
      var id = h.id || h.Id || h.holonId || h.HolonId;
      if (id) _holonStore[id] = h;
    });
  }

  window._dataOpenCard = function (el) {
    var idx = el.getAttribute('data-holon-idx');
    var h = idx && _holonStore[idx];
    if (h) openHolonDetail(h);
  };

  function extractList(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.holons)) return data.holons;
    if (Array.isArray(data.items)) return data.items;
    if (data.id || data.Id || data.name || data.Name) return [data];
    return null;
  }

  // ── Browse ────────────────────────────────────────────────────────────────────

  async function loadAllHolons() {
    if (isFetching) return;
    isFetching = true;
    showStatus('loading', 'Loading holons…');

    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatus('error', 'Please sign in to load holons.'); isFetching = false; return; }

    var avatarId = profile && (profile.avatarId || profile.AvatarId || profile.id || profile.Id || '');

    try {
      var body = { Id: avatarId, holonType: 'All' };
      // Always load all from API; filter client-side by provider to ensure correct counts
      var sdkRes = await window.oasisClient.data.loadHolonsForParent(body);
      hideStatus();
      var list = sdkRes.isError ? null : extractList(sdkRes.result);
      _cachedBrowseList = list || [];
      storeHolons(_cachedBrowseList);

      // Client-side provider filter
      var filtered = _cachedBrowseList;
      if (currentProvider !== 'all' && filtered.length) {
        filtered = filtered.filter(function (h) { return providerMatches(h, currentProvider); });
      }

      renderBrowseGrid(filtered);
      if (!list) showStatus('warn', 'No holons returned from the API.');
    } catch (e) {
      hideStatus();
      showStatus('error', 'Network error loading holons.');
    } finally {
      isFetching = false;
    }
  }

  function renderBrowseGrid(list) {
    var grid = getById('data-browse-grid');
    var empty = getById('data-browse-empty');
    if (!grid) return;

    var existing = grid.querySelectorAll('.data-holon-card');
    existing.forEach(function (el) { el.parentNode.removeChild(el); });

    if (!list || !list.length) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    grid.insertAdjacentHTML('beforeend', list.map(function (h) { return buildHolonCard(h, true); }).join(''));
  }

  // ── Load by ID ────────────────────────────────────────────────────────────────

  async function loadHolonById(id, provider) {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatus('error', 'Please sign in first.'); return; }

    showStatus('loading', 'Loading holon…');
    var btn = getById('data-load-btn');
    if (btn) btn.disabled = true;

    try {
      var body = provider ? { id: id, providerType: provider } : { id: id };
      var sdkRes = await window.oasisClient.data.loadHolon(body);
      hideStatus();
      var list = sdkRes.isError ? null : extractList(sdkRes.result);
      if (list) storeHolons(list);
      var resultEl = getById('data-load-result');
      if (resultEl) {
        if (list && list.length) {
          resultEl.innerHTML = list.map(function (h) { return buildHolonCard(h, false); }).join('');
        } else {
          resultEl.innerHTML = '<div class="data-empty"><div class="data-empty-icon">🔍</div><p>No holon found with that ID.</p></div>';
        }
      }
      if (sdkRes.isError && list === null) {
        var msg = sdkRes.message || '';
        var isNotFound = /not found|no holon|404/i.test(msg);
        if (!isNotFound) showStatus('error', msg || 'Load failed.');
      }
    } catch (e) {
      showStatus('error', 'Network error loading holon.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function saveHolon(name, desc, type, provider, offchain) {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatus('error', 'Please sign in first.'); return; }

    var avatarId = profile && (profile.avatarId || profile.AvatarId || profile.id || profile.Id || '');

    if (offchain) {
      showStatus('info', 'Off-chain holon storage is coming soon — this feature is not yet live.');
      return;
    }

    var payload = {
      holon: { name: name, description: desc, holonType: Number(type), parentHolonId: avatarId },
      saveChildren: true
    };
    if (provider) payload.onChainProvider = provider;

    showStatus('loading', 'Saving holon…');
    var btn = getById('data-save-btn');
    if (btn) btn.disabled = true;

    try {
      var sdkRes = await window.oasisClient.data.saveHolon(payload);
      if (!sdkRes.isError) {
        showStatus('success', sdkRes.message || 'Holon saved successfully.');
        setTimeout(hideStatus, 3500);
        loadAllHolons();
      } else {
        showStatus('error', sdkRes.message || 'Save failed.');
      }
    } catch (e) {
      showStatus('error', 'Network error saving holon.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  var _cachedBrowseList = null;

  async function searchHolons(query, inName, inDesc, inMeta, metaKey, metaVal) {
    var resultsEl = getById('data-search-results');
    if (!resultsEl) return;
    if (!query && !metaKey) { resultsEl.innerHTML = '<div class="data-empty"><div class="data-empty-icon">🔍</div><p>Enter a search term above.</p></div>'; return; }

    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { showStatus('error', 'Please sign in first.'); return; }

    resultsEl.innerHTML = '<div class="data-empty"><div class="data-empty-icon" style="animation:spinner-spin 1s linear infinite">⌛</div><p>Searching…</p></div>';
    var btn = getById('data-search-btn');
    if (btn) btn.disabled = true;

    try {
      var searchParams = {
        searchOnlyForCurrentAvatar: true,
        recursive: true,
        searchGroups: [{
          searchHolons: true,
          searchAvatars: false,
          holonSearchParams: {
            searchAllFields: !inName && !inDesc && !inMeta,
            name: inName,
            description: inDesc,
            metaData: inMeta,
            metaDataKey: metaKey || null
          }
        }]
      };
      if (metaKey && metaVal) {
        searchParams.filterByMetaData = {};
        searchParams.filterByMetaData[metaKey] = metaVal;
      }

      var sdkRes = await window.oasisClient.search.get(searchParams);
      var list = null;
      if (!sdkRes.isError) {
        var r = sdkRes.result || sdkRes;
        list = extractList(r.holons || r.results || r.holonResults || r) || extractList(sdkRes.result);
      }

      if (list && list.length) {
        renderSearchResults(list, query);
      } else {
        renderSearchResults(clientSideSearch(query, inName, inDesc, inMeta, metaKey, metaVal), query);
      }
    } catch (e) {
      renderSearchResults(clientSideSearch(query, inName, inDesc, inMeta, metaKey, metaVal), query);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function clientSideSearch(query, inName, inDesc, inMeta, metaKey, metaVal) {
    var list = _cachedBrowseList;
    if (!list || !list.length) return [];
    var q = query ? query.toLowerCase() : '';
    return list.filter(function (h) {
      if (q) {
        var matched = false;
        if (inName && (h.name || h.Name || '').toLowerCase().includes(q)) matched = true;
        if (inDesc && (h.description || h.Description || '').toLowerCase().includes(q)) matched = true;
        if (inMeta) {
          var meta = h.metaData || h.MetaData || h.metadata || {};
          if (JSON.stringify(meta).toLowerCase().includes(q)) matched = true;
        }
        if (!matched) return false;
      }
      if (metaKey) {
        var meta2 = h.metaData || h.MetaData || h.metadata || {};
        var val = meta2[metaKey] || meta2[metaKey.toLowerCase()];
        if (val === undefined) return false;
        if (metaVal && String(val).toLowerCase() !== metaVal.toLowerCase()) return false;
      }
      return true;
    });
  }

  function renderSearchResults(list, query) {
    var el = getById('data-search-results');
    if (!el) return;
    if (!list || !list.length) {
      el.innerHTML = '<div class="data-empty"><div class="data-empty-icon">🔍</div><p>No holons found' + (query ? ' matching <em>' + escapeHtml(query) + '</em>' : '') + '.</p></div>';
      return;
    }
    if (list) storeHolons(list);
    el.innerHTML = '<div class="data-search-count">' + list.length + ' result' + (list.length === 1 ? '' : 's') + '</div>' +
      list.map(function (h) { return buildHolonCard(h, false); }).join('');
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  window._dataDeleteHolon = async function (id) {
    if (!confirm('Delete this holon? This cannot be undone.')) return;
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) return;

    showStatus('loading', 'Deleting holon…');
    try {
      // Use route-based DELETE so the ID is in the URL (body-only endpoint ignores payload without [FromBody])
      var sdkRes = await window.oasisClient.http.request('DELETE', 'api/data/delete-holon/' + encodeURIComponent(id) + '/false');
      if (!sdkRes.isError) {
        showStatus('success', 'Holon deleted.');
        setTimeout(function () { hideStatus(); loadAllHolons(); }, 1500);
      } else {
        showStatus('error', sdkRes.message || 'Delete failed.');
      }
    } catch (e) {
      showStatus('error', 'Network error deleting holon.');
    }
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  function switchTab(tab) {
    var block = getById('data-modal-block');
    if (!block) return;
    block.querySelectorAll('.data-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    block.querySelectorAll('.data-tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'data-tab-' + tab;
    });
    closeHolonDetail();
  }

  // ── Open / close ─────────────────────────────────────────────────────────────

  function openDataModal() {
    var loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) { if (typeof window.showCheckAPIMessage === 'function') window.showCheckAPIMessage(); return false; }

    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('data-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    switchTab('browse');
    loadAllHolons();
    return false;
  }

  function closeDataModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('data-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
    closeHolonDetail();
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('data-modal-block');
    if (!block || block.dataset.dataBound === 'true') {
      window.openDataModal = openDataModal;
      window.closeDataModal = closeDataModal;
      return;
    }

    var closeBtn = getById('data-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeDataModal(); });

    var backBtn = getById('data-detail-back-btn');
    if (backBtn) backBtn.addEventListener('click', closeHolonDetail);

    // Tabs
    var tabBar = block.querySelector('.data-tabs');
    if (tabBar) {
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.data-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    // Provider dropdown (replaces pills)
    var provSel = getById('data-provider-select');
    if (provSel) {
      provSel.addEventListener('change', function () {
        currentProvider = provSel.value;
        // Re-filter cached list instead of re-fetching for instant response
        if (_cachedBrowseList) {
          var filtered = _cachedBrowseList;
          if (currentProvider !== 'all') {
            filtered = _cachedBrowseList.filter(function (h) { return providerMatches(h, currentProvider); });
          }
          renderBrowseGrid(filtered);
        } else {
          loadAllHolons();
        }
      });
    }

    // Refresh
    var refreshBtn = getById('data-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () {
      _cachedBrowseList = null;
      loadAllHolons();
    });

    // Load by ID form
    var loadForm = getById('data-load-form');
    if (loadForm) {
      loadForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var id = (getById('data-load-id') || {}).value.trim();
        var provider = ((getById('data-load-provider') || {}).value || '').trim();
        if (!id) return;
        loadHolonById(id, provider);
      });
    }

    // Save holon form
    var saveForm = getById('data-save-form');
    if (saveForm) {
      saveForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (getById('data-save-name') || {}).value.trim();
        var desc = (getById('data-save-desc') || {}).value.trim();
        var type = (getById('data-save-type') || {}).value || '0';
        var provider = (getById('data-save-provider') || {}).value || '';
        if (!name) { showStatus('error', 'Please enter a holon name.'); return; }
        saveHolon(name, desc, type, provider, false);
      });
    }

    // Off-chain form
    var offchainForm = getById('data-offchain-form');
    if (offchainForm) {
      offchainForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (getById('data-offchain-name') || {}).value.trim();
        var desc = (getById('data-offchain-desc') || {}).value.trim();
        var provider = (getById('data-offchain-provider') || {}).value || '';
        if (!name) { showStatus('error', 'Please enter a holon name.'); return; }
        saveHolon(name, desc, '0', provider, true);
      });
    }

    // Search form
    var searchForm = getById('data-search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var query = (getById('data-search-query') || {}).value.trim();
        var inName = !!(getById('data-search-in-name') || {}).checked;
        var inDesc = !!(getById('data-search-in-desc') || {}).checked;
        var inMeta = !!(getById('data-search-in-meta') || {}).checked;
        var metaKey = ((getById('data-search-meta-key') || {}).value || '').trim();
        var metaVal = ((getById('data-search-meta-val') || {}).value || '').trim();
        searchHolons(query, inName, inDesc, inMeta, metaKey, metaVal);
      });
      var metaChk = getById('data-search-in-meta');
      if (metaChk) {
        metaChk.addEventListener('change', function () {
          var show = metaChk.checked;
          var r1 = getById('data-search-meta-row');
          var r2 = getById('data-search-meta-val-row');
          if (r1) r1.style.display = show ? '' : 'none';
          if (r2) r2.style.display = show ? '' : 'none';
        });
      }
    }

    block.dataset.dataBound = 'true';
    window.openDataModal = openDataModal;
    window.closeDataModal = closeDataModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
