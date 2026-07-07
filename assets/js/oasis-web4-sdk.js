/* @oasisomniverse/web4-api browser bundle — auto-generated, do not edit */
var _OASIS_WEB4_UNUSED_ = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // node_modules/@oasisomniverse/web4-api/src/core/httpClient.js
  var require_httpClient = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/core/httpClient.js"(exports, module) {
      "use strict";
      var DEFAULT_BASE_URL = "https://api.oasisweb4.one";
      function normalizeKeys(value) {
        if (Array.isArray(value)) return value.map(normalizeKeys);
        if (value !== null && typeof value === "object") {
          const out = {};
          for (const [k, v] of Object.entries(value)) {
            const camel = k.length > 0 ? k[0].toLowerCase() + k.slice(1) : k;
            out[camel] = normalizeKeys(v);
          }
          return out;
        }
        return value;
      }
      function buildQueryString(query) {
        const entries = Object.entries(query || {}).filter(([, v]) => v !== void 0 && v !== null);
        if (!entries.length) return "";
        const params = new URLSearchParams();
        for (const [key, value] of entries) {
          params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
        }
        return `?${params.toString()}`;
      }
      var HttpClient = class {
        constructor({ baseUrl = DEFAULT_BASE_URL, tokenStore, fetchImpl = globalThis.fetch && globalThis.fetch.bind(globalThis) } = {}) {
          if (!fetchImpl) {
            throw new Error(
              "No global fetch implementation found. Use Node 18+, a modern browser, or pass { fetchImpl } explicitly."
            );
          }
          this.baseUrl = baseUrl.replace(/\/+$/, "");
          this.tokenStore = tokenStore;
          this.fetchImpl = fetchImpl;
        }
        setBaseUrl(baseUrl) {
          this.baseUrl = baseUrl.replace(/\/+$/, "");
        }
        /**
         * @param {string} verb GET | POST | PUT | DELETE
         * @param {string} path e.g. "api/avatar/authenticate"
         * @param {object} [options]
         * @param {object} [options.query] query string params (GET/DELETE)
         * @param {object} [options.body] JSON body (POST/PUT/DELETE)
         * @param {boolean} [options.auth] attach Authorization: Bearer <token> (default true)
         * @param {string} [options.token] override token for this single request
         */
        async request(verb, path, { query, body, auth = true, token } = {}) {
          var _a, _b;
          const url = `${this.baseUrl}/${path.replace(/^\/+/, "")}${buildQueryString(query)}`;
          const headers = {
            "Content-Type": "application/json",
            Accept: "application/json"
          };
          const bearer = token || (auth ? (_a = this.tokenStore) == null ? void 0 : _a.getToken() : null);
          if (bearer) headers.Authorization = `Bearer ${bearer}`;
          const init = { method: verb, headers };
          if (body !== void 0 && verb !== "GET") init.body = JSON.stringify(body);
          let res;
          try {
            res = await this.fetchImpl(url, init);
          } catch (err) {
            return { isError: true, message: `Network error calling ${url}: ${err.message}`, exception: err };
          }
          const text = await res.text();
          let json;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (e) {
            json = null;
          }
          if (!res.ok) {
            const message = ((_b = json == null ? void 0 : json.result) == null ? void 0 : _b.message) || (json == null ? void 0 : json.message) || (json == null ? void 0 : json.title) || `Request failed with status ${res.status}`;
            return { isError: true, message, statusCode: res.status, raw: json };
          }
          const inner = (json == null ? void 0 : json.result) !== void 0 ? json.result : json;
          const payload = (inner == null ? void 0 : inner.result) !== void 0 ? inner.result : inner;
          return {
            isError: Boolean((inner == null ? void 0 : inner.isError) || (json == null ? void 0 : json.isError)),
            message: (inner == null ? void 0 : inner.message) || (json == null ? void 0 : json.message) || null,
            result: normalizeKeys(payload),
            raw: json,
            statusCode: res.status
          };
        }
        get(path, options) {
          return this.request("GET", path, options);
        }
        post(path, options) {
          return this.request("POST", path, options);
        }
        put(path, options) {
          return this.request("PUT", path, options);
        }
        delete(path, options) {
          return this.request("DELETE", path, options);
        }
      };
      module.exports = { HttpClient, DEFAULT_BASE_URL };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/core/tokenStore.js
  var require_tokenStore = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/core/tokenStore.js"(exports, module) {
      "use strict";
      var hasLocalStorage = typeof globalThis.localStorage !== "undefined";
      var STORAGE_KEY = "oasis_session";
      var TokenStore = class {
        constructor({ persist = hasLocalStorage } = {}) {
          this.persist = persist;
          this._session = null;
          if (this.persist) {
            try {
              const raw = globalThis.localStorage.getItem(STORAGE_KEY);
              if (raw) this._session = JSON.parse(raw);
            } catch (e) {
              this._session = null;
            }
          }
        }
        getSession() {
          return this._session;
        }
        getToken() {
          var _a, _b;
          return ((_a = this._session) == null ? void 0 : _a.jwtToken) || ((_b = this._session) == null ? void 0 : _b.token) || null;
        }
        setSession(session) {
          this._session = session || null;
          if (this.persist) {
            try {
              if (session) globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
              else globalThis.localStorage.removeItem(STORAGE_KEY);
            } catch (e) {
            }
          }
        }
        clear() {
          this.setSession(null);
        }
      };
      module.exports = { TokenStore };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/core/routeHelper.js
  var require_routeHelper = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/core/routeHelper.js"(exports, module) {
      "use strict";
      var TOKEN_PATTERN = /\{(\w+)(?::\w+)?\}/g;
      function resolveRoute(routeTemplate, args = {}) {
        const consumed = /* @__PURE__ */ new Set();
        const path = routeTemplate.replace(TOKEN_PATTERN, (match, name) => {
          const key = Object.keys(args).find((k) => k.toLowerCase() === name.toLowerCase());
          consumed.add(key);
          const value = key !== void 0 ? args[key] : void 0;
          if (value === void 0) {
            throw new Error(`Missing required route parameter "${name}" for route "${routeTemplate}"`);
          }
          return encodeURIComponent(value);
        });
        const rest = {};
        for (const [key, value] of Object.entries(args)) {
          if (!consumed.has(key)) rest[key] = value;
        }
        return { path, rest };
      }
      function makeOperation(http, routePrefix, verb, route) {
        return async function operation(args = {}) {
          const { path, rest } = resolveRoute(route, args);
          const fullPath = path ? `${routePrefix}/${path}` : routePrefix;
          const hasBody = Object.keys(rest).length > 0;
          if (verb === "GET") {
            return http.get(fullPath, { query: hasBody ? rest : void 0 });
          }
          return http.request(verb, fullPath, { body: hasBody ? rest : void 0 });
        };
      }
      module.exports = { resolveRoute, makeOperation };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Avatar.js
  var require_Avatar = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Avatar.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var AvatarModule = class {
        constructor(http) {
          this._http = http;
          this.addItemToAvatarInventory = makeOperation(http, "api/avatar", "POST", "inventory");
          this.addKarmaToAvatar = makeOperation(http, "api/avatar", "POST", "add-karma-to-avatar/{avatarId}");
          this.addXp = makeOperation(http, "api/avatar", "POST", "add-xp");
          this.authenticate = makeOperation(http, "api/avatar", "POST", "authenticate");
          this.avatarHasItem = makeOperation(http, "api/avatar", "GET", "inventory/{itemId}/has");
          this.avatarHasItemByName = makeOperation(http, "api/avatar", "GET", "inventory/has-by-name");
          this.create = makeOperation(http, "api/avatar", "POST", "create/{model}");
          this.createAvatarSession = makeOperation(http, "api/avatar", "POST", "{avatarId}/sessions");
          this.delete = makeOperation(http, "api/avatar", "DELETE", "{id:Guid}");
          this.deleteByEmail = makeOperation(http, "api/avatar", "DELETE", "delete-by-email/{email}");
          this.deleteByUsername = makeOperation(http, "api/avatar", "DELETE", "delete-by-username/{username}");
          this.forgotPassword = makeOperation(http, "api/avatar", "POST", "forgot-password");
          this.getAll = makeOperation(http, "api/avatar", "GET", "get-all-avatars");
          this.getAllAvatarDetails = makeOperation(http, "api/avatar", "GET", "get-all-avatar-details");
          this.getAllAvatarNames = makeOperation(http, "api/avatar", "GET", "get-all-avatar-names/{includeUsernames}/{includeIds}");
          this.getAllAvatarNamesGroupedByName = makeOperation(http, "api/avatar", "GET", "get-all-avatar-names-grouped-by-name/{includeUsernames}/{includeIds}");
          this.getAvatarDetail = makeOperation(http, "api/avatar", "GET", "get-avatar-detail-by-id/{id:guid}");
          this.getAvatarDetailByEmail = makeOperation(http, "api/avatar", "GET", "get-avatar-detail-by-email/{email}");
          this.getAvatarDetailByUsername = makeOperation(http, "api/avatar", "GET", "get-avatar-detail-by-username/{username}");
          this.getAvatarInventory = makeOperation(http, "api/avatar", "GET", "inventory");
          this.getAvatarInventoryItem = makeOperation(http, "api/avatar", "GET", "inventory/{itemId}");
          this.getAvatarPortraitByEmail = makeOperation(http, "api/avatar", "GET", "get-avatar-portrait-by-email/{email}");
          this.getAvatarPortraitById = makeOperation(http, "api/avatar", "GET", "get-avatar-portrait/{id}");
          this.getAvatarPortraitByUsername = makeOperation(http, "api/avatar", "GET", "get-avatar-portrait-by-username/{username}");
          this.getAvatarSessionStats = makeOperation(http, "api/avatar", "GET", "{avatarId}/sessions/stats");
          this.getAvatarSessions = makeOperation(http, "api/avatar", "GET", "{avatarId}/sessions");
          this.getByEmail = makeOperation(http, "api/avatar", "GET", "get-by-email/{email}");
          this.getById = makeOperation(http, "api/avatar", "GET", "get-by-id/{id}");
          this.getByUsername = makeOperation(http, "api/avatar", "GET", "get-by-username/{username}");
          this.getLoggedInAvatar = makeOperation(http, "api/avatar", "GET", "get-logged-in-avatar");
          this.getLoggedInAvatarWithXp = makeOperation(http, "api/avatar", "GET", "get-logged-in-avatar-with-xp");
          this.getTerms = makeOperation(http, "api/avatar", "GET", "get-terms");
          this.getUmaJsonByEmail = makeOperation(http, "api/avatar", "GET", "get-uma-json-by-email/{email}");
          this.getUmaJsonById = makeOperation(http, "api/avatar", "GET", "get-uma-json-by-id/{id}");
          this.getUmaJsonByUsername = makeOperation(http, "api/avatar", "GET", "get-uma-json-by-username/{username}");
          this.linkEOSIOAccountToAvatar = makeOperation(http, "api/avatar", "POST", "{avatarId}/{eosioAccountName}");
          this.linkHolochainAgentIDToAvatar = makeOperation(http, "api/avatar", "POST", "{avatarId}/{holochainAgentID}");
          this.linkTelosAccountToAvatar = makeOperation(http, "api/avatar", "POST", "{id:Guid}/{telosAccountName}");
          this.linkTelosAccountToAvatar2 = makeOperation(http, "api/avatar", "POST", "");
          this.logoutAllAvatarSessions = makeOperation(http, "api/avatar", "POST", "{avatarId}/sessions/logout-all");
          this.logoutAvatarSessions = makeOperation(http, "api/avatar", "POST", "{avatarId}/sessions/logout");
          this.register = makeOperation(http, "api/avatar", "POST", "register");
          this.removeItemFromAvatarInventory = makeOperation(http, "api/avatar", "DELETE", "inventory/{itemId}");
          this.removeKarmaFromAvatar = makeOperation(http, "api/avatar", "POST", "remove-karma-from-avatar/{avatarId}");
          this.resetPassword = makeOperation(http, "api/avatar", "POST", "reset-password");
          this.revokeToken = makeOperation(http, "api/avatar", "POST", "revoke-token");
          this.searchAvatar = makeOperation(http, "api/avatar", "POST", "search");
          this.searchAvatarInventory = makeOperation(http, "api/avatar", "GET", "inventory/search");
          this.sendItemToAvatar = makeOperation(http, "api/avatar", "POST", "inventory/send-to-avatar");
          this.sendItemToClan = makeOperation(http, "api/avatar", "POST", "inventory/send-to-clan");
          this.setActiveQuest = makeOperation(http, "api/avatar", "POST", "set-active-quest");
          this.update = makeOperation(http, "api/avatar", "POST", "update-by-id/{id}");
          this.updateAvatarDetail = makeOperation(http, "api/avatar", "POST", "update-avatar-detail-by-id/{id}");
          this.updateAvatarDetailByEmail = makeOperation(http, "api/avatar", "POST", "update-avatar-detail-by-email/{email}");
          this.updateAvatarDetailByUsername = makeOperation(http, "api/avatar", "POST", "update-avatar-detail-by-username/{username}");
          this.updateAvatarSession = makeOperation(http, "api/avatar", "PUT", "{avatarId}/sessions/{sessionId}");
          this.updateByEmail = makeOperation(http, "api/avatar", "POST", "update-by-email/{email}");
          this.updateByUsername = makeOperation(http, "api/avatar", "POST", "update-by-username/{username}");
          this.uploadAvatarPortrait = makeOperation(http, "api/avatar", "POST", "upload-avatar-portrait");
          this.validateResetToken = makeOperation(http, "api/avatar", "POST", "validate-reset-token");
          this.verifyEmail = makeOperation(http, "api/avatar", "GET", "verify-email");
        }
      };
      module.exports = { AvatarModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Bridge.js
  var require_Bridge = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Bridge.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var BridgeModule = class {
        constructor(http) {
          this._http = http;
          this.checkOrderBalance = makeOperation(http, "api/v1/bridge", "GET", "orders/{orderId:guid}/check-balance");
          this.createOrder = makeOperation(http, "api/v1/bridge", "POST", "orders");
          this.createPrivateOrder = makeOperation(http, "api/v1/bridge", "POST", "orders/private");
          this.getExchangeRate = makeOperation(http, "api/v1/bridge", "GET", "exchange-rate");
          this.getSupportedNetworks = makeOperation(http, "api/v1/bridge", "GET", "networks");
          this.recordViewingKey = makeOperation(http, "api/v1/bridge", "POST", "viewing-keys/audit");
          this.verifyProof = makeOperation(http, "api/v1/bridge", "POST", "proofs/verify");
        }
      };
      module.exports = { BridgeModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Chat.js
  var require_Chat = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Chat.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var ChatModule = class {
        constructor(http) {
          this._http = http;
          this.getChatHistory = makeOperation(http, "api/chat", "GET", "history/{sessionId}");
          this.sendMessage = makeOperation(http, "api/chat", "POST", "send-message/{sessionId}");
          this.startNewChatSession = makeOperation(http, "api/chat", "POST", "start-new-chat-session");
        }
      };
      module.exports = { ChatModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Clan.js
  var require_Clan = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Clan.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var ClanModule = class {
        constructor(http) {
          this._http = http;
          this.addAvatarToClan = makeOperation(http, "api/clan", "POST", "{clanId:guid}/members/{avatarId:guid}");
          this.create = makeOperation(http, "api/clan", "POST", "");
          this.delete = makeOperation(http, "api/clan", "DELETE", "{clanId:guid}");
          this.getClanInventory = makeOperation(http, "api/clan", "GET", "{clanId:guid}/inventory");
          this.getMembers = makeOperation(http, "api/clan", "GET", "{clanId:guid}/members");
          this.list = makeOperation(http, "api/clan", "GET", "");
          this.load = makeOperation(http, "api/clan", "GET", "{clanId:guid}");
          this.loadByName = makeOperation(http, "api/clan", "GET", "by-name");
          this.removeAvatarFromClan = makeOperation(http, "api/clan", "DELETE", "{clanId:guid}/members/{avatarId:guid}");
          this.update = makeOperation(http, "api/clan", "PUT", "{clanId:guid}");
        }
      };
      module.exports = { ClanModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Competition.js
  var require_Competition = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Competition.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var CompetitionModule = class {
        constructor(http) {
          this._http = http;
          this.getActiveTournaments = makeOperation(http, "api/competition", "GET", "tournaments");
          this.getAvailableLeagues = makeOperation(http, "api/competition", "GET", "leagues/{competitionType}/{seasonType}");
          this.getAvatarLeague = makeOperation(http, "api/competition", "GET", "league/{avatarId}/{competitionType}/{seasonType}");
          this.getAvatarRank = makeOperation(http, "api/competition", "GET", "rank/{avatarId}/{competitionType}/{seasonType}");
          this.getLeaderboard = makeOperation(http, "api/competition", "GET", "leaderboard/{competitionType}/{seasonType}");
          this.getMyLeague = makeOperation(http, "api/competition", "GET", "my-league/{competitionType}/{seasonType}");
          this.getMyRank = makeOperation(http, "api/competition", "GET", "my-rank/{competitionType}/{seasonType}");
          this.getMyStats = makeOperation(http, "api/competition", "GET", "stats/{competitionType}/{seasonType}");
          this.joinTournament = makeOperation(http, "api/competition", "POST", "tournaments/{tournamentId}/join");
        }
      };
      module.exports = { CompetitionModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Data.js
  var require_Data = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Data.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var DataModule = class {
        constructor(http) {
          this._http = http;
          this.deleteHolon = makeOperation(http, "api/data", "DELETE", "delete-holon");
          this.loadAllHolons = makeOperation(http, "api/data", "POST", "load-all-holons");
          this.loadData = makeOperation(http, "api/data", "POST", "load-data");
          this.loadFile = makeOperation(http, "api/data", "POST", "load-file");
          this.loadHolon = makeOperation(http, "api/data", "POST", "load-holon");
          this.loadHolonsForParent = makeOperation(http, "api/data", "POST", "load-holons-for-parent");
          this.saveData = makeOperation(http, "api/data", "POST", "save-data");
          this.saveFile = makeOperation(http, "api/data", "POST", "save-file");
          this.saveHolon = makeOperation(http, "api/data", "POST", "save-holon");
          this.saveHolonOffChain = makeOperation(http, "api/data", "POST", "save-holon-off-chain");
        }
      };
      module.exports = { DataModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/EOSIO.js
  var require_EOSIO = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/EOSIO.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var EOSIOModule = class {
        constructor(http) {
          this._http = http;
          this.getAvatarForEOSIOAccountName = makeOperation(http, "api/eosio", "GET", "get-avatar-for-eosio-account-name");
          this.getAvatarIdForEOSIOAccountName = makeOperation(http, "api/eosio", "GET", "get-avatar-id-for-eosio-account-name");
          this.getBalanceForAvatar = makeOperation(http, "api/eosio", "GET", "get-balance-for-avatar");
          this.getBalanceForEOSIOAccount = makeOperation(http, "api/eosio", "GET", "get-balance-for-eosio-account");
          this.getEOSIOAccount = makeOperation(http, "api/eosio", "GET", "get-eosio-account");
          this.getEOSIOAccountForAvatar = makeOperation(http, "api/eosio", "GET", "get-eosio-account-for-avatar");
          this.getEOSIOAccountNamesForAvatar = makeOperation(http, "api/eosio", "GET", "get-eosio-account-name-for-avatar");
          this.getTelosAccountPrivateKeyForAvatar = makeOperation(http, "api/eosio", "GET", "get-eosio-account-private-key-for-avatar");
          this.linkEOSIOAccountToAvatar = makeOperation(http, "api/eosio", "POST", "{avatarId}/{eosioAccountName}");
        }
      };
      module.exports = { EOSIOModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Eggs.js
  var require_Eggs = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Eggs.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var EggsModule = class {
        constructor(http) {
          this._http = http;
          this.discoverEgg = makeOperation(http, "api/eggs", "POST", "discover");
          this.getAllEggs = makeOperation(http, "api/eggs", "GET", "get-all-eggs");
          this.getCurrentEggQuestLeaderBoard = makeOperation(http, "api/eggs", "GET", "get-current-egg-quest-leader-board");
          this.getCurrentEggQuests = makeOperation(http, "api/eggs", "GET", "get-current-egg-quests");
          this.getMyEggs = makeOperation(http, "api/eggs", "GET", "my-eggs");
          this.hatchEgg = makeOperation(http, "api/eggs", "POST", "hatch/{eggId}");
        }
      };
      module.exports = { EggsModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Files.js
  var require_Files = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Files.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var FilesModule = class {
        constructor(http) {
          this._http = http;
          this.deleteFile = makeOperation(http, "api/files", "DELETE", "delete-file/{fileId}");
          this.downloadFile = makeOperation(http, "api/files", "GET", "download-file/{fileId}");
          this.getAllFilesStoredForCurrentLoggedInAvatar = makeOperation(http, "api/files", "GET", "get-all-files-stored-for-current-logged-in-avatar");
          this.getFileMetadata = makeOperation(http, "api/files", "GET", "file-metadata/{fileId}");
          this.updateFileMetadata = makeOperation(http, "api/files", "PUT", "update-file-metadata/{fileId}");
          this.uploadFile = makeOperation(http, "api/files", "POST", "upload-file");
        }
      };
      module.exports = { FilesModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Gifts.js
  var require_Gifts = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Gifts.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var GiftsModule = class {
        constructor(http) {
          this._http = http;
          this.getGiftHistory = makeOperation(http, "api/gifts", "GET", "history");
          this.getGiftStats = makeOperation(http, "api/gifts", "GET", "stats");
          this.getMyGifts = makeOperation(http, "api/gifts", "GET", "my-gifts");
          this.openGift = makeOperation(http, "api/gifts", "POST", "open-gift/{giftId}");
          this.receiveGift = makeOperation(http, "api/gifts", "POST", "receive-gift/{giftId}");
          this.sendGift = makeOperation(http, "api/gifts", "POST", "send-gift/{toAvatarId}");
        }
      };
      module.exports = { GiftsModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Health.js
  var require_Health = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Health.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var HealthModule = class {
        constructor(http) {
          this._http = http;
          this.get = makeOperation(http, "api/health", "GET", "");
          this.health = makeOperation(http, "api/health", "GET", "health");
        }
      };
      module.exports = { HealthModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Holochain.js
  var require_Holochain = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Holochain.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var HolochainModule = class {
        constructor(http) {
          this._http = http;
          this.getAvatarForHolochainAgentId = makeOperation(http, "api/holochain", "GET", "get-avatar-for-holochain-agentid");
          this.getAvatarIdForHolochainAgentId = makeOperation(http, "api/holochain", "GET", "get-avatar-id-for-holochain-agentid");
          this.getHoloFuelBalanceForAgentId = makeOperation(http, "api/holochain", "GET", "get-holo-fuel-balance-for-agentId");
          this.getHoloFuelBalanceForAvatar = makeOperation(http, "api/holochain", "GET", "get-holo-fuel-balance-for-avatar");
          this.getHolochainAgentIdsForAvatar = makeOperation(http, "api/holochain", "GET", "get-holochain-agentids-for-avatar");
          this.getHolochainAgentPrivateKeysForAvatar = makeOperation(http, "api/holochain", "GET", "get-holochain-agent-private-keys-for-avatar");
          this.linkHolochainAgentIdToAvatar = makeOperation(http, "api/holochain", "POST", "{avatarId}/{holochainAgentId}");
        }
      };
      module.exports = { HolochainModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/HyperDrive.js
  var require_HyperDrive = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/HyperDrive.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var HyperDriveModule = class {
        constructor(http) {
          this._http = http;
          this.checkQuotaStatus = makeOperation(http, "api/hyperDrive", "GET", "quota/status");
          this.createFailoverTrigger = makeOperation(http, "api/hyperDrive", "POST", "failover/triggers");
          this.createQuotaNotification = makeOperation(http, "api/hyperDrive", "POST", "subscription/quota-notifications");
          this.createReplicationTrigger = makeOperation(http, "api/hyperDrive", "POST", "replication/triggers");
          this.createUsageAlert = makeOperation(http, "api/hyperDrive", "POST", "subscription/usage-alerts");
          this.deleteFailoverTrigger = makeOperation(http, "api/hyperDrive", "DELETE", "failover/triggers/{id}");
          this.deleteQuotaNotification = makeOperation(http, "api/hyperDrive", "DELETE", "subscription/quota-notifications/{id}");
          this.deleteReplicationTrigger = makeOperation(http, "api/hyperDrive", "DELETE", "replication/triggers/{id}");
          this.deleteUsageAlert = makeOperation(http, "api/hyperDrive", "DELETE", "subscription/usage-alerts/{id}");
          this.disableIntelligentMode = makeOperation(http, "api/hyperDrive", "POST", "intelligent-mode/disable");
          this.enableIntelligentMode = makeOperation(http, "api/hyperDrive", "POST", "intelligent-mode/enable");
          this.getAIRecommendations = makeOperation(http, "api/hyperDrive", "GET", "ai/recommendations");
          this.getAnalyticsReport = makeOperation(http, "api/hyperDrive", "GET", "analytics/report");
          this.getBestProvider = makeOperation(http, "api/hyperDrive", "GET", "best-provider");
          this.getConfiguration = makeOperation(http, "api/hyperDrive", "GET", "config");
          this.getConnectionCounts = makeOperation(http, "api/hyperDrive", "GET", "connections");
          this.getCostHistory = makeOperation(http, "api/hyperDrive", "GET", "costs/history");
          this.getCostOptimizationRecommendations = makeOperation(http, "api/hyperDrive", "GET", "analytics/cost-optimization");
          this.getCostOptimizationRule = makeOperation(http, "api/hyperDrive", "GET", "replication/cost-optimization");
          this.getCostProjections = makeOperation(http, "api/hyperDrive", "GET", "costs/projections");
          this.getCurrentCosts = makeOperation(http, "api/hyperDrive", "GET", "costs/current");
          this.getCurrentUsage = makeOperation(http, "api/hyperDrive", "GET", "quota/usage");
          this.getDashboardData = makeOperation(http, "api/hyperDrive", "GET", "dashboard");
          this.getDataPermissions = makeOperation(http, "api/hyperDrive", "GET", "data-permissions");
          this.getDataTypeReplicationRules = makeOperation(http, "api/hyperDrive", "GET", "replication/data-type-rules");
          this.getEscalationRules = makeOperation(http, "api/hyperDrive", "GET", "failover/escalation-rules");
          this.getFailoverRules = makeOperation(http, "api/hyperDrive", "GET", "failover/rules");
          this.getFailurePredictions = makeOperation(http, "api/hyperDrive", "GET", "failover/predictions");
          this.getFreeProviders = makeOperation(http, "api/hyperDrive", "GET", "providers/free");
          this.getHyperDriveMode = makeOperation(http, "api/hyperDrive", "GET", "mode");
          this.getIntelligentMode = makeOperation(http, "api/hyperDrive", "GET", "intelligent-mode");
          this.getLowCostProviders = makeOperation(http, "api/hyperDrive", "GET", "providers/low-cost");
          this.getMetrics = makeOperation(http, "api/hyperDrive", "GET", "metrics");
          this.getPerformanceOptimizationRecommendations = makeOperation(http, "api/hyperDrive", "GET", "analytics/performance-optimization");
          this.getPredictiveAnalytics = makeOperation(http, "api/hyperDrive", "GET", "analytics/predictive/{providerType}");
          this.getProviderFailoverRules = makeOperation(http, "api/hyperDrive", "GET", "failover/provider-rules");
          this.getProviderMetrics = makeOperation(http, "api/hyperDrive", "GET", "metrics/{providerType}");
          this.getProviderReplicationRules = makeOperation(http, "api/hyperDrive", "GET", "replication/provider-rules");
          this.getQuotaLimits = makeOperation(http, "api/hyperDrive", "GET", "quota/limits");
          this.getQuotaNotifications = makeOperation(http, "api/hyperDrive", "GET", "subscription/quota-notifications");
          this.getReplicationRules = makeOperation(http, "api/hyperDrive", "GET", "replication/rules");
          this.getScheduleRules = makeOperation(http, "api/hyperDrive", "GET", "replication/schedule-rules");
          this.getSecurityRecommendations = makeOperation(http, "api/hyperDrive", "GET", "recommendations/security");
          this.getSmartRecommendations = makeOperation(http, "api/hyperDrive", "GET", "recommendations/smart");
          this.getStatus = makeOperation(http, "api/hyperDrive", "GET", "status");
          this.getSubscriptionConfig = makeOperation(http, "api/hyperDrive", "GET", "subscription/config");
          this.getUsageAlerts = makeOperation(http, "api/hyperDrive", "GET", "subscription/usage-alerts");
          this.initiatePreventiveFailover = makeOperation(http, "api/hyperDrive", "POST", "failover/preventive");
          this.recordAnalyticsData = makeOperation(http, "api/hyperDrive", "POST", "analytics/record");
          this.recordConnection = makeOperation(http, "api/hyperDrive", "POST", "record-connection");
          this.recordFailureEvent = makeOperation(http, "api/hyperDrive", "POST", "failover/record-failure");
          this.recordPerformanceData = makeOperation(http, "api/hyperDrive", "POST", "ai/record-performance");
          this.recordRequest = makeOperation(http, "api/hyperDrive", "POST", "record-request");
          this.resetAllMetrics = makeOperation(http, "api/hyperDrive", "POST", "metrics/reset-all");
          this.resetConfiguration = makeOperation(http, "api/hyperDrive", "POST", "config/reset");
          this.resetProviderMetrics = makeOperation(http, "api/hyperDrive", "POST", "metrics/{providerType}/reset");
          this.setCostLimits = makeOperation(http, "api/hyperDrive", "PUT", "costs/limits");
          this.setHyperDriveMode = makeOperation(http, "api/hyperDrive", "PUT", "mode");
          this.updateConfiguration = makeOperation(http, "api/hyperDrive", "PUT", "config");
          this.updateCostAnalysis = makeOperation(http, "api/hyperDrive", "PUT", "cost/{providerType}");
          this.updateCostOptimizationRule = makeOperation(http, "api/hyperDrive", "PUT", "replication/cost-optimization");
          this.updateDataPermissions = makeOperation(http, "api/hyperDrive", "PUT", "data-permissions");
          this.updateDataTypeReplicationRule = makeOperation(http, "api/hyperDrive", "PUT", "replication/data-type-rules");
          this.updateEscalationRule = makeOperation(http, "api/hyperDrive", "PUT", "failover/escalation-rules");
          this.updateFailoverRules = makeOperation(http, "api/hyperDrive", "PUT", "failover/rules");
          this.updateFailoverTrigger = makeOperation(http, "api/hyperDrive", "PUT", "failover/triggers/{id}");
          this.updateGeographicInfo = makeOperation(http, "api/hyperDrive", "PUT", "geographic/{providerType}");
          this.updateIntelligentMode = makeOperation(http, "api/hyperDrive", "PUT", "intelligent-mode");
          this.updateProviderFailoverRule = makeOperation(http, "api/hyperDrive", "PUT", "failover/provider-rules");
          this.updateProviderReplicationRule = makeOperation(http, "api/hyperDrive", "PUT", "replication/provider-rules");
          this.updateQuotaNotification = makeOperation(http, "api/hyperDrive", "PUT", "subscription/quota-notifications/{id}");
          this.updateReplicationRules = makeOperation(http, "api/hyperDrive", "PUT", "replication/rules");
          this.updateReplicationTrigger = makeOperation(http, "api/hyperDrive", "PUT", "replication/triggers/{id}");
          this.updateScheduleRule = makeOperation(http, "api/hyperDrive", "PUT", "replication/schedule-rules");
          this.updateSubscriptionConfig = makeOperation(http, "api/hyperDrive", "PUT", "subscription/config");
          this.updateUsageAlert = makeOperation(http, "api/hyperDrive", "PUT", "subscription/usage-alerts/{id}");
          this.validateConfiguration = makeOperation(http, "api/hyperDrive", "POST", "config/validate");
        }
      };
      module.exports = { HyperDriveModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Karma.js
  var require_Karma = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Karma.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var KarmaModule = class {
        constructor(http) {
          this._http = http;
          this.addKarmaToAvatar = makeOperation(http, "api/karma", "POST", "add-karma-to-avatar/{avatarId}");
          this.getKarmaAkashicRecordsForAvatar = makeOperation(http, "api/karma", "GET", "get-karma-akashic-records-for-avatar/{avatarId}");
          this.getKarmaForAvatar = makeOperation(http, "api/karma", "GET", "get-karma-for-avatar/{avatarId}");
          this.getKarmaHistory = makeOperation(http, "api/karma", "GET", "get-karma-history/{avatarId}");
          this.getKarmaStats = makeOperation(http, "api/karma", "GET", "get-karma-stats/{avatarId}");
          this.getNegativeKarmaWeighting = makeOperation(http, "api/karma", "GET", "get-negative-karma-weighting/{karmaType}");
          this.getPositiveKarmaWeighting = makeOperation(http, "api/karma", "GET", "get-positive-karma-weighting/{karmaType}");
          this.removeKarmaFromAvatar = makeOperation(http, "api/karma", "POST", "remove-karma-from-avatar/{avatarId}");
          this.setNegativeKarmaWeighting = makeOperation(http, "api/karma", "POST", "set-negative-karma-weighting/{karmaType}/{weighting}");
          this.setPositiveKarmaWeighting = makeOperation(http, "api/karma", "POST", "set-positive-karma-weighting/{karmaType}/{weighting}");
          this.voteForNegativeKarmaWeighting = makeOperation(http, "api/karma", "POST", "vote-for-negative-karma-weighting/{karmaType}/{weighting}");
          this.voteForPositiveKarmaWeighting = makeOperation(http, "api/karma", "POST", "vote-for-positive-karma-weighting/{karmaType}/{weighting}");
        }
      };
      module.exports = { KarmaModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Keys.js
  var require_Keys = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Keys.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var KeysModule = class {
        constructor(http) {
          this._http = http;
          this.base58CheckDecode = makeOperation(http, "api/keys", "POST", "base58_check_decode/{data}");
          this.clearCache = makeOperation(http, "api/keys", "POST", "clear_cache");
          this.createKey = makeOperation(http, "api/keys", "POST", "create");
          this.decodePrivateWif = makeOperation(http, "api/keys", "POST", "decode_private_wif/{data}");
          this.deleteKey = makeOperation(http, "api/keys", "DELETE", "{keyId}");
          this.encodeSignature = makeOperation(http, "api/keys", "POST", "encode_signature/{source}");
          this.generateKeyPairAndLinkProviderKeysToAvatarByAvatarEmail = makeOperation(http, "api/keys", "POST", "generate_keypair_and_link_provider_keys_to_avatar_by_email");
          this.generateKeyPairAndLinkProviderKeysToAvatarByAvatarId = makeOperation(http, "api/keys", "POST", "generate_keypair_and_link_provider_keys_to_avatar_by_id");
          this.generateKeyPairAndLinkProviderKeysToAvatarByAvatarUsername = makeOperation(http, "api/keys", "POST", "generate_keypair_and_link_provider_keys_to_avatar_by_username");
          this.generateKeyPairForProvider = makeOperation(http, "api/keys", "POST", "generate_keypair_for_provider/{providerType}");
          this.generateKeyPairWithWalletAddressAndLinkProviderKeysToAvatarByEmail = makeOperation(http, "api/keys", "POST", "generate_keypair_with_wallet_address_and_link_provider_keys_to_avatar_by_email");
          this.generateKeyPairWithWalletAddressAndLinkProviderKeysToAvatarById = makeOperation(http, "api/keys", "POST", "generate_keypair_with_wallet_address_and_link_provider_keys_to_avatar_by_id");
          this.generateKeyPairWithWalletAddressAndLinkProviderKeysToAvatarByUsername = makeOperation(http, "api/keys", "POST", "generate_keypair_with_wallet_address_and_link_provider_keys_to_avatar_by_username");
          this.generateKeyPairWithWalletAddressForProvider = makeOperation(http, "api/keys", "POST", "generate_keypair_with_wallet_address_for_provider/{providerType}");
          this.getAllKeysForAvatar = makeOperation(http, "api/keys", "GET", "all");
          this.getAllProviderPrivateKeysForAvatarById = makeOperation(http, "api/keys", "GET", "get_all_provider_private_keys_for_avatar_by_id/{id}");
          this.getAllProviderPrivateKeysForAvatarByUsername = makeOperation(http, "api/keys", "GET", "get_all_provider_private_keys_for_avatar_by_username/{username}");
          this.getAllProviderPublicKeysForAvatarByEmail = makeOperation(http, "api/keys", "GET", "get_all_provider_public_keys_for_avatar_by_email/{email}");
          this.getAllProviderPublicKeysForAvatarById = makeOperation(http, "api/keys", "GET", "get_all_provider_public_keys_for_avatar_by_id/{id}");
          this.getAllProviderPublicKeysForAvatarByUsername = makeOperation(http, "api/keys", "GET", "get_all_provider_public_keys_for_avatar_by_username/{username}");
          this.getAllProviderUniqueStorageKeysForAvatarByEmail = makeOperation(http, "api/keys", "GET", "get_all_provider_unique_storage_keys_for_avatar_by_email/{email}");
          this.getAllProviderUniqueStorageKeysForAvatarById = makeOperation(http, "api/keys", "GET", "get_all_provider_unique_storage_keys_for_avatar_by_id/{id}");
          this.getAllProviderUniqueStorageKeysForAvatarByUsername = makeOperation(http, "api/keys", "GET", "get_all_provider_unique_storage_keys_for_avatar_by_username/{username}");
          this.getAvatarEmailForProviderPublicKey = makeOperation(http, "api/keys", "GET", "get_avatar_email_for_provider_public_key/{providerKey}");
          this.getAvatarEmailForProviderUniqueStorageKey = makeOperation(http, "api/keys", "GET", "get_avatar_email_for_provider_unique_storage_key/{providerKey}");
          this.getAvatarForProviderPrivateKey = makeOperation(http, "api/keys", "GET", "get_avatar_for_provider_private_key/{providerKey}");
          this.getAvatarForProviderPublicKey = makeOperation(http, "api/keys", "GET", "get_avatar_for_provider_public_key/{providerKey}");
          this.getAvatarForProviderUniqueStorageKey = makeOperation(http, "api/keys", "GET", "get_avatar_for_provider_unique_storage_key/{providerKey}");
          this.getAvatarIdForProviderPrivateKey = makeOperation(http, "api/keys", "GET", "get_avatar_id_for_provider_private_key/{providerKey}");
          this.getAvatarIdForProviderPublicKey = makeOperation(http, "api/keys", "GET", "get_avatar_id_for_provider_public_key/{providerKey}");
          this.getAvatarIdForProviderUniqueStorageKey = makeOperation(http, "api/keys", "GET", "get_avatar_id_for_provider_unique_storage_key/{providerKey}");
          this.getAvatarUsernameForProviderPrivateKey = makeOperation(http, "api/keys", "GET", "get_avatar_username_for_provider_private_key/{providerKey}");
          this.getAvatarUsernameForProviderPublicKey = makeOperation(http, "api/keys", "GET", "get_avatar_username_for_provider_public_key/{providerKey}");
          this.getAvatarUsernameForProviderUniqueStorageKey = makeOperation(http, "api/keys", "GET", "get_avatar_username_for_provider_unique_storage_key/{providerKey}");
          this.getKeyStats = makeOperation(http, "api/keys", "GET", "stats");
          this.getPrivateWif = makeOperation(http, "api/keys", "POST", "get_private_wifi/{source}");
          this.getProviderPrivateKeyForAvatarById = makeOperation(http, "api/keys", "GET", "get_provider_private_key_for_avatar_by_id");
          this.getProviderPrivateKeyForAvatarByUsername = makeOperation(http, "api/keys", "GET", "get_provider_private_key_for_avatar_by_username");
          this.getProviderPublicKeysForAvatarByEmail = makeOperation(http, "api/keys", "GET", "get_provider_public_keys_for_avatar_by_email");
          this.getProviderPublicKeysForAvatarById = makeOperation(http, "api/keys", "GET", "get_provider_public_keys_for_avatar_by_id");
          this.getProviderPublicKeysForAvatarByUsername = makeOperation(http, "api/keys", "GET", "get_provider_public_keys_for_avatar_by_username");
          this.getProviderUniqueStorageKeyForAvatarByEmail = makeOperation(http, "api/keys", "GET", "get_provider_unique_storage_key_for_avatar_by_email");
          this.getProviderUniqueStorageKeyForAvatarById = makeOperation(http, "api/keys", "GET", "get_provider_unique_storage_key_for_avatar_by_id");
          this.getProviderUniqueStorageKeyForAvatarByUsername = makeOperation(http, "api/keys", "GET", "get_provider_unique_storage_key_for_avatar_by_username");
          this.getPublicWif = makeOperation(http, "api/keys", "POST", "get_public_wifi");
          this.linkEOSIOAccountToAvatar = makeOperation(http, "api/keys", "POST", "{avatarId}/{eosioAccountName}");
          this.linkHolochainAgentIDToAvatar = makeOperation(http, "api/keys", "POST", "{avatarId}/{holochainAgentID}");
          this.linkProviderPrivateKeyToAvatarByAvatarId = makeOperation(http, "api/keys", "POST", "link_provider_private_key_to_avatar_by_id");
          this.linkProviderPrivateKeyToAvatarByEmail = makeOperation(http, "api/keys", "POST", "link_provider_private_key_to_avatar_by_email");
          this.linkProviderPrivateKeyToAvatarByUsername = makeOperation(http, "api/keys", "POST", "link_provider_private_key_to_avatar_by_username");
          this.linkProviderPublicKeyToAvatarByAvatarId = makeOperation(http, "api/keys", "POST", "link_provider_public_key_to_avatar_by_id");
          this.linkProviderPublicKeyToAvatarByEmail = makeOperation(http, "api/keys", "POST", "link_provider_public_key_to_avatar_by_email");
          this.linkProviderPublicKeyToAvatarByUsername = makeOperation(http, "api/keys", "POST", "link_provider_public_key_to_avatar_by_username");
          this.linkProviderWalletAddressToAvatarByEmail = makeOperation(http, "api/keys", "POST", "link_provider_wallet_address_to_avatar_by_email");
          this.linkProviderWalletAddressToAvatarById = makeOperation(http, "api/keys", "POST", "link_provider_wallet_address_to_avatar_by_id");
          this.linkProviderWalletAddressToAvatarByUsername = makeOperation(http, "api/keys", "POST", "link_provider_wallet_address_to_avatar_by_username");
          this.linkTelosAccountToAvatar = makeOperation(http, "api/keys", "POST", "{id:Guid}/{telosAccountName}");
          this.linkTelosAccountToAvatar2 = makeOperation(http, "api/keys", "POST", "");
          this.updateKey = makeOperation(http, "api/keys", "PUT", "{keyId}");
        }
      };
      module.exports = { KeysModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Map.js
  var require_Map = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Map.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var MapModule = class {
        constructor(http) {
          this._http = http;
          this.createAndDrawRouteOnMapBetweenHolons = makeOperation(http, "api/map", "POST", "CreateAndDrawRouteOnMapBetweenHolons/{holonDNA}");
          this.createAndDrawRouteOnMapBeweenPoints = makeOperation(http, "api/map", "POST", "CreateAndDrawRouteOnMapBeweenPoints/{points}");
          this.draw2DSpriteOnHUD = makeOperation(http, "api/map", "POST", "Draw2DSpriteOnHUD/{sprite}/{x}/{y}");
          this.draw2DSpriteOnMap = makeOperation(http, "api/map", "POST", "Draw2DSpriteOnMap/{sprite}/{x}/{y}");
          this.draw3DObjectOnMap = makeOperation(http, "api/map", "POST", "Draw3DObjectOnMap/{obj}/{x}/{y}");
          this.getMapStats = makeOperation(http, "api/map", "GET", "stats");
          this.getNearbyLocations = makeOperation(http, "api/map", "GET", "nearby");
          this.getVisitHistory = makeOperation(http, "api/map", "GET", "visit-history");
          this.highlightBuildingOnMap = makeOperation(http, "api/map", "POST", "HighlightBuildingOnMap/{building}");
          this.pamMapDown = makeOperation(http, "api/map", "POST", "PamMapDown/{value}");
          this.pamMapLeft = makeOperation(http, "api/map", "POST", "PamMapLeft/{value}");
          this.pamMapRight = makeOperation(http, "api/map", "POST", "PamMapRight/{value}");
          this.pamMapUp = makeOperation(http, "api/map", "POST", "PamMapUp/{value}");
          this.search = makeOperation(http, "api/map", "POST", "search");
          this.selectBuildingOnMap = makeOperation(http, "api/map", "POST", "SelectBuildingOnMap/{building}");
          this.selectHolonOnMap = makeOperation(http, "api/map", "POST", "SelectHolonOnMap/{holon}");
          this.selectQuestOnMap = makeOperation(http, "api/map", "POST", "SelectQuestOnMap/{quest}");
          this.visitLocation = makeOperation(http, "api/map", "POST", "visit/{locationId}");
          this.zoomMapIn = makeOperation(http, "api/map", "POST", "ZoomMapIn/{value}");
          this.zoomMapOut = makeOperation(http, "api/map", "POST", "ZoomMapOut/{value}");
          this.zoomToHolonOnMap = makeOperation(http, "api/map", "POST", "ZoomToHolonOnMap/{holon}");
          this.zoomToQuestOnMap = makeOperation(http, "api/map", "POST", "ZoomToQuestOnMap/{quest}");
        }
      };
      module.exports = { MapModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Messaging.js
  var require_Messaging = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Messaging.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var MessagingModule = class {
        constructor(http) {
          this._http = http;
          this.getConversation = makeOperation(http, "api/messaging", "GET", "conversation/{otherAvatarId}");
          this.getMessages = makeOperation(http, "api/messaging", "GET", "messages");
          this.getNotifications = makeOperation(http, "api/messaging", "GET", "notifications");
          this.markMessagesAsRead = makeOperation(http, "api/messaging", "POST", "mark-messages-read");
          this.markNotificationsAsRead = makeOperation(http, "api/messaging", "POST", "mark-notifications-read");
          this.sendMessageToAvatar = makeOperation(http, "api/messaging", "POST", "send-message-to-avatar/{toAvatarId}");
        }
      };
      module.exports = { MessagingModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Nft.js
  var require_Nft = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Nft.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var NftModule = class {
        constructor(http) {
          this._http = http;
          this.collectGeoNFTAsync = makeOperation(http, "api/nft", "POST", "collect-geo-nft");
          this.collectNFTAsync = makeOperation(http, "api/nft", "POST", "collect-nft");
          this.createWeb4NFTCollectionAsync = makeOperation(http, "api/nft", "POST", "create-web4-nft-collection");
          this.exportWeb4NFTAsync = makeOperation(http, "api/nft", "POST", "export-web4-nft");
          this.exportWeb4NFTToFileAsync = makeOperation(http, "api/nft", "POST", "export-web4-nft-to-file/{oasisNFTId}/{fullPathToExportTo}");
          this.getNFTProviderFromProviderType = makeOperation(http, "api/nft", "GET", "get-nft-provider-from-provider-type/{providerType}");
          this.importWeb3NFTAsync = makeOperation(http, "api/nft", "POST", "import-web3-nft");
          this.importWeb4NFTAsync = makeOperation(http, "api/nft", "POST", "import-web4-nft/{importedByAvatarId}");
          this.importWeb4NFTFromFileAsync = makeOperation(http, "api/nft", "POST", "import-web4-nft-from-file/{importedByAvatarId}/{fullPathToOASISNFTJsonFile}");
          this.loadAllGeoNFTsAsync = makeOperation(http, "api/nft", "GET", "load-all-geo-nfts");
          this.loadAllGeoNFTsForMintAddressAsync = makeOperation(http, "api/nft", "GET", "load-all-geo-nfts-for-mint-wallet-address/{mintWalletAddress}");
          this.loadAllWeb3NFTsAsync = makeOperation(http, "api/nft", "GET", "load-all-web3-nfts");
          this.loadAllWeb3NFTsForAvatarAsync = makeOperation(http, "api/nft", "GET", "load-all-web3-nfts-for-avatar/{avatarId}");
          this.loadAllWeb3NFTsForMintAddressAsync = makeOperation(http, "api/nft", "GET", "load-all-web3-nfts-for-mint-address/{mintWalletAddress}");
          this.loadAllWeb4GeoNFTsAsync = makeOperation(http, "api/nft", "GET", "load-all-geo-nfts/{providerType}/{setGlobally}");
          this.loadAllWeb4GeoNFTsForAvatarAsync = makeOperation(http, "api/nft", "GET", "load-all-geo-nfts-for-avatar/{avatarId}");
          this.loadAllWeb4NFTsAsync = makeOperation(http, "api/nft", "GET", "load-all-nfts");
          this.loadAllWeb4NFTsForAvatarAsync = makeOperation(http, "api/nft", "GET", "load-all-nfts-for_avatar/{avatarId}");
          this.loadAllWeb4NFTsForMintAddressAsync = makeOperation(http, "api/nft", "GET", "load-all-nfts-for-mint-wallet-address/{mintWalletAddress}");
          this.loadWeb3NftByHashAsync = makeOperation(http, "api/nft", "GET", "load-web3-nft-by-hash/{onChainNftHash}");
          this.loadWeb3NftByIdAsync = makeOperation(http, "api/nft", "GET", "load-web3-nft-by-id/{id}");
          this.loadWeb4NftByHashAsync = makeOperation(http, "api/nft", "GET", "load-nft-by-hash/{hash}");
          this.loadWeb4NftByIdAsync = makeOperation(http, "api/nft", "GET", "load-nft-by-id/{id}");
          this.mintAndPlaceGeoNFTAsync = makeOperation(http, "api/nft", "POST", "mint-and-place-geo-nft");
          this.mintNftAsync = makeOperation(http, "api/nft", "POST", "mint-nft");
          this.placeGeoNFTAsync = makeOperation(http, "api/nft", "POST", "place-geo-nft");
          this.remintNftAsync = makeOperation(http, "api/nft", "POST", "remint-nft");
          this.searchWeb4GeoNFTsAsync = makeOperation(http, "api/nft", "GET", "search-web4-geo-nfts/{searchTerm}/{avatarId}");
          this.searchWeb4NFTCollectionsAsync = makeOperation(http, "api/nft", "GET", "search-web4-nft-collections/{searchTerm}/{avatarId}");
          this.searchWeb4NFTsAsync = makeOperation(http, "api/nft", "GET", "search-web4-nfts/{searchTerm}/{avatarId}");
          this.sendNFTAsync = makeOperation(http, "api/nft", "POST", "send-nft");
          this.updateWeb4NftAsync = makeOperation(http, "api/nft", "POST", "update-web4-nft");
        }
      };
      module.exports = { NftModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/OLand.js
  var require_OLand = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/OLand.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var OLandModule = class {
        constructor(http) {
          this._http = http;
          this.deleteOlandAsync = makeOperation(http, "api/oLand", "POST", "delete-oland/{olandId}");
          this.getOlandPrice = makeOperation(http, "api/oLand", "GET", "get-oland-price");
          this.loadAllOlands = makeOperation(http, "api/oLand", "GET", "load-all-olands");
          this.loadOlandAsync = makeOperation(http, "api/oLand", "GET", "load-oland/{olandId}");
          this.purchaseOland = makeOperation(http, "api/oLand", "POST", "purchase-oland");
          this.saveOlandAsync = makeOperation(http, "api/oLand", "POST", "save-oland");
          this.updateOlandAsync = makeOperation(http, "api/oLand", "POST", "update-oland");
        }
      };
      module.exports = { OLandModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/ONET.js
  var require_ONET = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/ONET.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var ONETModule = class {
        constructor(http) {
          this._http = http;
          this.broadcastMessage = makeOperation(http, "api/v1/onet", "POST", "network/broadcast");
          this.connectToNode = makeOperation(http, "api/v1/onet", "POST", "network/connect");
          this.disconnectFromNode = makeOperation(http, "api/v1/onet", "POST", "network/disconnect");
          this.getConnectedNodes = makeOperation(http, "api/v1/onet", "GET", "network/nodes");
          this.getNetworkStats = makeOperation(http, "api/v1/onet", "GET", "network/stats");
          this.getNetworkStatus = makeOperation(http, "api/v1/onet", "GET", "network/status");
          this.getNetworkTopology = makeOperation(http, "api/v1/onet", "GET", "network/topology");
          this.getOASISDNA = makeOperation(http, "api/v1/onet", "GET", "oasisdna");
          this.startNetwork = makeOperation(http, "api/v1/onet", "POST", "network/start");
          this.stopNetwork = makeOperation(http, "api/v1/onet", "POST", "network/stop");
          this.updateOASISDNA = makeOperation(http, "api/v1/onet", "PUT", "oasisdna");
        }
      };
      module.exports = { ONETModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/ONODE.js
  var require_ONODE = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/ONODE.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var ONODEModule = class {
        constructor(http) {
          this._http = http;
          this.getConnectedPeers = makeOperation(http, "api/v1/onode", "GET", "peers");
          this.getNodeConfig = makeOperation(http, "api/v1/onode", "GET", "config");
          this.getNodeInfo = makeOperation(http, "api/v1/onode", "GET", "info");
          this.getNodeLogs = makeOperation(http, "api/v1/onode", "GET", "logs");
          this.getNodeMetrics = makeOperation(http, "api/v1/onode", "GET", "metrics");
          this.getNodeStats = makeOperation(http, "api/v1/onode", "GET", "stats");
          this.getNodeStatus = makeOperation(http, "api/v1/onode", "GET", "status");
          this.getOASISDNA = makeOperation(http, "api/v1/onode", "GET", "oasisdna");
          this.restartNode = makeOperation(http, "api/v1/onode", "POST", "restart");
          this.startNode = makeOperation(http, "api/v1/onode", "POST", "start");
          this.stopNode = makeOperation(http, "api/v1/onode", "POST", "stop");
          this.updateNodeConfig = makeOperation(http, "api/v1/onode", "PUT", "config");
          this.updateOASISDNA = makeOperation(http, "api/v1/onode", "PUT", "oasisdna");
        }
      };
      module.exports = { ONODEModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Provider.js
  var require_Provider = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Provider.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var ProviderModule = class {
        constructor(http) {
          this._http = http;
          this.activateProvider = makeOperation(http, "api/provider", "POST", "activate-provider/{providerType}");
          this.deActivateProvider = makeOperation(http, "api/provider", "POST", "deactivate-provider/{providerType}");
          this.getAllRegisteredNetworkProviders = makeOperation(http, "api/provider", "GET", "get-all-registered-network-providers");
          this.getAllRegisteredProviderTypes = makeOperation(http, "api/provider", "GET", "get-all-registered-provider-types");
          this.getAllRegisteredProviders = makeOperation(http, "api/provider", "GET", "get-all-registered-providers");
          this.getAllRegisteredProvidersForCategory = makeOperation(http, "api/provider", "GET", "get-all-registered-providers-for-category/{category}");
          this.getAllRegisteredRendererProviders = makeOperation(http, "api/provider", "GET", "get-all-registered-renderer-providers");
          this.getAllRegisteredStorageProviders = makeOperation(http, "api/provider", "GET", "get-all-registered-storage-providers");
          this.getCurrentStorageProvider = makeOperation(http, "api/provider", "GET", "get-current-storage-provider");
          this.getCurrentStorageProviderType = makeOperation(http, "api/provider", "GET", "get-current-storage-provider-type");
          this.getProvidersThatAreAutoReplicating = makeOperation(http, "api/provider", "GET", "get-providers-that-are-auto-replicating");
          this.getProvidersThatHaveAutoFailOverEnabled = makeOperation(http, "api/provider", "GET", "get-providers-that-have-auto-fail-over-enabled");
          this.getProvidersThatHaveAutoLoadBalanceEnabled = makeOperation(http, "api/provider", "GET", "get-providers-that-have-auto-load-balance-enabled");
          this.getRegisteredProvider = makeOperation(http, "api/provider", "GET", "get-registered-provider/{providerType}");
          this.isProviderRegistered = makeOperation(http, "api/provider", "GET", "is-provider-registered/{providerType}");
          this.registerProvider = makeOperation(http, "api/provider", "POST", "register-provider/{provider}");
          this.registerProviderType = makeOperation(http, "api/provider", "POST", "register-provider-type/{providerType}");
          this.registerProviderTypes = makeOperation(http, "api/provider", "POST", "register-provider-types/{providerTypes}");
          this.registerProviders = makeOperation(http, "api/provider", "POST", "register-providers/{providers}");
          this.setAndActivateCurrentStorageProvider = makeOperation(http, "api/provider", "POST", "set-and-activate-current-storage-provider/{providerType}/{setGlobally}");
          this.setAutoFailOverForAllProviders = makeOperation(http, "api/provider", "POST", "set-auto-fail-over-for-all-providers/{addToFailOverList}");
          this.setAutoFailOverForListOfProviders = makeOperation(http, "api/provider", "POST", "set-auto-fail-over-for-list-of-providers/{addToFailOverList}/{providerTypes}");
          this.setAutoLoadBalanceForAllProviders = makeOperation(http, "api/provider", "POST", "set-auto-load-balance-for-all-providers/{addToLoadBalanceList}");
          this.setAutoLoadBalanceForListOfProviders = makeOperation(http, "api/provider", "POST", "set-auto-load-balance-for-list-of-providers/{addToLoadBalanceList}/{providerTypes}");
          this.setAutoReplicateForAllProviders = makeOperation(http, "api/provider", "POST", "set-auto-replicate-for-all-providers/{autoReplicate}");
          this.setAutoReplicateForListOfProviders = makeOperation(http, "api/provider", "POST", "set-auto-replicate-for-list-of-providers/{autoReplicate}/{providerTypes}");
          this.setProviderConfig = makeOperation(http, "api/provider", "POST", "set-provider-config/{providerType}/{connectionString}");
          this.unRegisterProvider = makeOperation(http, "api/provider", "POST", "unregister-provider/{provider}");
          this.unRegisterProviderType = makeOperation(http, "api/provider", "POST", "unregister-provider-type/{providerType}");
          this.unRegisterProviderTypes = makeOperation(http, "api/provider", "POST", "unregister-provider-types/{providerTypes}");
          this.unRegisterProviders = makeOperation(http, "api/provider", "POST", "unregister-providers/{providers}");
        }
      };
      module.exports = { ProviderModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Search.js
  var require_Search = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Search.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var SearchModule = class {
        constructor(http) {
          this._http = http;
          this.get = makeOperation(http, "api/search", "GET", "{searchParams}");
        }
      };
      module.exports = { SearchModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Seeds.js
  var require_Seeds = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Seeds.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var SeedsModule = class {
        constructor(http) {
          this._http = http;
          this.getMySeedTransactions = makeOperation(http, "api/seeds", "GET", "me/transactions");
          this.getSeedTransactionsForAvatar = makeOperation(http, "api/seeds", "GET", "avatar/{avatarId}/transactions");
          this.saveSeedTransaction = makeOperation(http, "api/seeds", "POST", "save-seed-transaction");
        }
      };
      module.exports = { SeedsModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Settings.js
  var require_Settings = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Settings.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var SettingsModule = class {
        constructor(http) {
          this._http = http;
          this.getAllSettingsForCurrentLoggedInAvatar = makeOperation(http, "api/settings", "GET", "get-all-settings-for-current-logged-in-avatar");
          this.getHyperDriveSettings = makeOperation(http, "api/settings", "GET", "hyperdrive-settings");
          this.getNotificationPreferences = makeOperation(http, "api/settings", "GET", "notification-preferences");
          this.getPrivacySettings = makeOperation(http, "api/settings", "GET", "privacy-settings");
          this.getSubscriptionSettings = makeOperation(http, "api/settings", "GET", "subscription-settings");
          this.getSystemConfig = makeOperation(http, "api/settings", "GET", "system-config");
          this.getSystemSettings = makeOperation(http, "api/settings", "GET", "system-settings");
          this.updateHyperDriveSettings = makeOperation(http, "api/settings", "PUT", "hyperdrive-settings");
          this.updateNotificationPreferences = makeOperation(http, "api/settings", "PUT", "notification-preferences");
          this.updatePrivacySettings = makeOperation(http, "api/settings", "PUT", "privacy-settings");
          this.updateSettings = makeOperation(http, "api/settings", "PUT", "update-settings");
          this.updateSubscriptionSettings = makeOperation(http, "api/settings", "PUT", "subscription-settings");
          this.updateSystemSettings = makeOperation(http, "api/settings", "PUT", "system-settings");
        }
      };
      module.exports = { SettingsModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Share.js
  var require_Share = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Share.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var ShareModule = class {
        constructor(http) {
          this._http = http;
          this.shareHolon = makeOperation(http, "api/share", "GET", "share-holon/{holonId:guid}/{avatarId:guid}");
        }
      };
      module.exports = { ShareModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Social.js
  var require_Social = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Social.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var SocialModule = class {
        constructor(http) {
          this._http = http;
          this.getRegisteredProviders = makeOperation(http, "api/social", "GET", "registered-providers");
          this.getSocialFeed = makeOperation(http, "api/social", "GET", "social-feed");
          this.registerSocialProvider = makeOperation(http, "api/social", "POST", "register-social-provider");
          this.shareHolon = makeOperation(http, "api/social", "POST", "share-holon");
        }
      };
      module.exports = { SocialModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Solana.js
  var require_Solana = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Solana.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var SolanaModule = class {
        constructor(http) {
          this._http = http;
          this.mintNft = makeOperation(http, "api/solana", "POST", "Mint");
          this.sendTransaction = makeOperation(http, "api/solana", "POST", "Send");
        }
      };
      module.exports = { SolanaModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Stats.js
  var require_Stats = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Stats.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var StatsModule = class {
        constructor(http) {
          this._http = http;
          this.getChatStats = makeOperation(http, "api/stats", "GET", "chat-stats/{avatarId}");
          this.getGiftStats = makeOperation(http, "api/stats", "GET", "gift-stats/{avatarId}");
          this.getKarmaHistory = makeOperation(http, "api/stats", "GET", "karma-history/{avatarId}");
          this.getKarmaStats = makeOperation(http, "api/stats", "GET", "karma-stats/{avatarId}");
          this.getKeyStats = makeOperation(http, "api/stats", "GET", "key-stats/{avatarId}");
          this.getLeaderboardStats = makeOperation(http, "api/stats", "GET", "leaderboard-stats/{avatarId}");
          this.getStatsForCurrentLoggedInAvatar = makeOperation(http, "api/stats", "GET", "get-stats-for-current-logged-in-avatar");
          this.getSystemStats = makeOperation(http, "api/stats", "GET", "system-stats");
        }
      };
      module.exports = { StatsModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Subscription.js
  var require_Subscription = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Subscription.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var SubscriptionModule = class {
        constructor(http) {
          this._http = http;
          this.checkHyperDriveQuota = makeOperation(http, "api/subscription", "POST", "check-hyperdrive-quota");
          this.createCheckoutSession = makeOperation(http, "api/subscription", "POST", "checkout/session");
          this.getHyperDriveUsage = makeOperation(http, "api/subscription", "GET", "hyperdrive-usage");
          this.getMyOrders = makeOperation(http, "api/subscription", "GET", "orders/me");
          this.getMySubscriptions = makeOperation(http, "api/subscription", "GET", "subscriptions/me");
          this.getPlans = makeOperation(http, "api/subscription", "GET", "plans");
          this.getUsage = makeOperation(http, "api/subscription", "GET", "usage");
          this.stripeWebhook = makeOperation(http, "api/subscription", "POST", "webhooks/stripe");
          this.togglePayAsYouGo = makeOperation(http, "api/subscription", "POST", "toggle-pay-as-you-go");
          this.updateHyperDriveConfig = makeOperation(http, "api/subscription", "POST", "update-hyperdrive-config");
        }
      };
      module.exports = { SubscriptionModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Video.js
  var require_Video = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Video.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var VideoModule = class {
        constructor(http) {
          this._http = http;
          this.endVideoCall = makeOperation(http, "api/video", "POST", "end-call/{callId}");
          this.joinVideoCall = makeOperation(http, "api/video", "POST", "join-call/{callId}");
          this.startVideoCall = makeOperation(http, "api/video", "POST", "start-video-call");
        }
      };
      module.exports = { VideoModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Wallet.js
  var require_Wallet = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Wallet.js"(exports, module) {
      "use strict";
      var { makeOperation } = require_routeHelper();
      var WalletModule = class {
        constructor(http) {
          this._http = http;
          this.createWalletForAvatarByEmailAsync = makeOperation(http, "api/wallet", "POST", "avatar/email/{email}/create-wallet");
          this.createWalletForAvatarByIdAsync = makeOperation(http, "api/wallet", "POST", "avatar/{avatarId}/create-wallet");
          this.createWalletForAvatarByUsernameAsync = makeOperation(http, "api/wallet", "POST", "avatar/username/{username}/create-wallet");
          this.getAvatarDefaultWalletByEmailAsync = makeOperation(http, "api/wallet", "GET", "avatar/email/{email}/default-wallet");
          this.getAvatarDefaultWalletByIdAsync = makeOperation(http, "api/wallet", "GET", "avatar/{id}/default-wallet");
          this.getAvatarDefaultWalletByUsernameAsync = makeOperation(http, "api/wallet", "GET", "avatar/username/{username}/default-wallet/{showOnlyDefault}/{decryptPrivateKeys}");
          this.getPortfolioValueAsync = makeOperation(http, "api/wallet", "GET", "avatar/{avatarId}/portfolio/value");
          this.getSupportedChains = makeOperation(http, "api/wallet", "GET", "supported-chains");
          this.getWalletAnalyticsAsync = makeOperation(http, "api/wallet", "GET", "avatar/{avatarId}/wallet/{walletId}/analytics");
          this.getWalletThatPublicKeyBelongsTo = makeOperation(http, "api/wallet", "GET", "find-wallet");
          this.getWalletTokensAsync = makeOperation(http, "api/wallet", "GET", "avatar/{avatarId}/wallet/{walletId}/tokens");
          this.getWalletsByChainAsync = makeOperation(http, "api/wallet", "GET", "avatar/{avatarId}/wallets/chain/{chain}");
          this.importWalletUsingPrivateKeyByEmail = makeOperation(http, "api/wallet", "POST", "avatar/email/{email}/import/private-key");
          this.importWalletUsingPrivateKeyById = makeOperation(http, "api/wallet", "POST", "avatar/{avatarId}/import/private-key");
          this.importWalletUsingPrivateKeyByUsername = makeOperation(http, "api/wallet", "POST", "avatar/username/{username}/import/private-key");
          this.importWalletUsingPublicKeyByEmail = makeOperation(http, "api/wallet", "POST", "avatar/email/{email}/import/public-key");
          this.importWalletUsingPublicKeyById = makeOperation(http, "api/wallet", "POST", "avatar/{avatarId}/import/public-key");
          this.importWalletUsingPublicKeyByUsername = makeOperation(http, "api/wallet", "POST", "avatar/username/{username}/import/public-key");
          this.loadProviderWalletsForAvatarByEmailAsync = makeOperation(http, "api/wallet", "GET", "avatar/email/{email}/wallets");
          this.loadProviderWalletsForAvatarByIdAsync = makeOperation(http, "api/wallet", "GET", "avatar/{id}/wallets/{showOnlyDefault}/{decryptPrivateKeys}");
          this.loadProviderWalletsForAvatarByUsernameAsync = makeOperation(http, "api/wallet", "GET", "avatar/username/{username}/wallets/{showOnlyDefault}/{decryptPrivateKeys}");
          this.saveProviderWalletsForAvatarByEmailAsync = makeOperation(http, "api/wallet", "POST", "avatar/email/{email}/wallets");
          this.saveProviderWalletsForAvatarByIdAsync = makeOperation(http, "api/wallet", "POST", "avatar/{id}/wallets");
          this.saveProviderWalletsForAvatarByUsernameAsync = makeOperation(http, "api/wallet", "POST", "avatar/username/{username}/wallets");
          this.sendTokenAsync = makeOperation(http, "api/wallet", "POST", "send_token");
          this.setAvatarDefaultWalletByEmailAsync = makeOperation(http, "api/wallet", "POST", "avatar/email/{email}/default-wallet/{walletId}");
          this.setAvatarDefaultWalletByIdAsync = makeOperation(http, "api/wallet", "POST", "avatar/{id}/default-wallet/{walletId}");
          this.setAvatarDefaultWalletByUsernameAsync = makeOperation(http, "api/wallet", "POST", "avatar/username/{username}/default-wallet/{walletId}");
          this.transferBetweenWalletsAsync = makeOperation(http, "api/wallet", "POST", "transfer");
          this.updateWalletForAvatarByEmailAsync = makeOperation(http, "api/wallet", "PUT", "avatar/email/{email}/wallet/{walletId}");
          this.updateWalletForAvatarByIdAsync = makeOperation(http, "api/wallet", "PUT", "avatar/{avatarId}/wallet/{walletId}");
          this.updateWalletForAvatarByUsernameAsync = makeOperation(http, "api/wallet", "PUT", "avatar/username/{username}/wallet/{walletId}");
        }
      };
      module.exports = { WalletModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/index.js
  var require_modules = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/index.js"(exports, module) {
      "use strict";
      var { AvatarModule } = require_Avatar();
      var { BridgeModule } = require_Bridge();
      var { ChatModule } = require_Chat();
      var { ClanModule } = require_Clan();
      var { CompetitionModule } = require_Competition();
      var { DataModule } = require_Data();
      var { EOSIOModule } = require_EOSIO();
      var { EggsModule } = require_Eggs();
      var { FilesModule } = require_Files();
      var { GiftsModule } = require_Gifts();
      var { HealthModule } = require_Health();
      var { HolochainModule } = require_Holochain();
      var { HyperDriveModule } = require_HyperDrive();
      var { KarmaModule } = require_Karma();
      var { KeysModule } = require_Keys();
      var { MapModule } = require_Map();
      var { MessagingModule } = require_Messaging();
      var { NftModule } = require_Nft();
      var { OLandModule } = require_OLand();
      var { ONETModule } = require_ONET();
      var { ONODEModule } = require_ONODE();
      var { ProviderModule } = require_Provider();
      var { SearchModule } = require_Search();
      var { SeedsModule } = require_Seeds();
      var { SettingsModule } = require_Settings();
      var { ShareModule } = require_Share();
      var { SocialModule } = require_Social();
      var { SolanaModule } = require_Solana();
      var { StatsModule } = require_Stats();
      var { SubscriptionModule } = require_Subscription();
      var { VideoModule } = require_Video();
      var { WalletModule } = require_Wallet();
      function attachGeneratedModules(client, http) {
        client.avatar = client.avatar || new AvatarModule(http);
        client.bridge = client.bridge || new BridgeModule(http);
        client.chat = client.chat || new ChatModule(http);
        client.clan = client.clan || new ClanModule(http);
        client.competition = client.competition || new CompetitionModule(http);
        client.data = client.data || new DataModule(http);
        client.eOSIO = client.eOSIO || new EOSIOModule(http);
        client.eggs = client.eggs || new EggsModule(http);
        client.files = client.files || new FilesModule(http);
        client.gifts = client.gifts || new GiftsModule(http);
        client.health = client.health || new HealthModule(http);
        client.holochain = client.holochain || new HolochainModule(http);
        client.hyperDrive = client.hyperDrive || new HyperDriveModule(http);
        client.karma = client.karma || new KarmaModule(http);
        client.keys = client.keys || new KeysModule(http);
        client.map = client.map || new MapModule(http);
        client.messaging = client.messaging || new MessagingModule(http);
        client.nft = client.nft || new NftModule(http);
        client.oLand = client.oLand || new OLandModule(http);
        client.oNET = client.oNET || new ONETModule(http);
        client.oNODE = client.oNODE || new ONODEModule(http);
        client.provider = client.provider || new ProviderModule(http);
        client.search = client.search || new SearchModule(http);
        client.seeds = client.seeds || new SeedsModule(http);
        client.settings = client.settings || new SettingsModule(http);
        client.share = client.share || new ShareModule(http);
        client.social = client.social || new SocialModule(http);
        client.solana = client.solana || new SolanaModule(http);
        client.stats = client.stats || new StatsModule(http);
        client.subscription = client.subscription || new SubscriptionModule(http);
        client.video = client.video || new VideoModule(http);
        client.wallet = client.wallet || new WalletModule(http);
        return client;
      }
      module.exports = { attachGeneratedModules };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/modules/Auth.js
  var require_Auth = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/modules/Auth.js"(exports, module) {
      "use strict";
      var AuthModule = class {
        constructor(http, tokenStore, avatarModule) {
          this._http = http;
          this._tokenStore = tokenStore;
          this._avatar = avatarModule;
        }
        /** Returns the currently stored session ({ avatarId, username, email, jwtToken, ... }) or null. */
        getSession() {
          return this._tokenStore.getSession();
        }
        isAuthenticated() {
          return Boolean(this._tokenStore.getToken());
        }
        /**
         * @param {{username: string, password: string}} credentials `username` may also be an email,
         *   OASIS' authenticate endpoint accepts either.
         */
        async login({ username, password }) {
          const res = await this._avatar.authenticate({ Username: username, Password: password });
          if (res.isError || !res.result) return res;
          const avatar = res.result;
          const session = {
            avatarId: avatar.id || avatar.Id,
            username: avatar.username || avatar.Username || username,
            email: avatar.email || avatar.Email,
            firstName: avatar.firstName || avatar.FirstName,
            lastName: avatar.lastName || avatar.LastName,
            jwtToken: avatar.jwtToken || avatar.JwtToken,
            refreshToken: avatar.refreshToken || avatar.RefreshToken
          };
          if (!session.jwtToken) {
            return { isError: true, message: "Authentication succeeded but no JWT token was returned.", raw: res.raw };
          }
          this._tokenStore.setSession(session);
          return { ...res, session };
        }
        /**
         * @param {object} data title, firstName, lastName, email, password, confirmPassword, avatarType, username (optional)
         */
        async register(data) {
          const res = await this._avatar.register({
            Title: data.title || "Mx",
            FirstName: data.firstName,
            LastName: data.lastName,
            Email: data.email,
            Password: data.password,
            ConfirmPassword: data.confirmPassword || data.password,
            Username: data.username || data.email,
            AvatarType: data.avatarType || "User",
            AcceptTerms: data.acceptTerms !== false
          });
          if (res.isError || !res.result) return res;
          const avatar = res.result;
          const session = {
            avatarId: avatar.id || avatar.Id,
            username: avatar.username || avatar.Username,
            email: avatar.email || avatar.Email,
            firstName: avatar.firstName || avatar.FirstName,
            lastName: avatar.lastName || avatar.LastName,
            jwtToken: avatar.jwtToken || avatar.JwtToken,
            refreshToken: avatar.refreshToken || avatar.RefreshToken
          };
          if (session.jwtToken) this._tokenStore.setSession(session);
          return { ...res, session };
        }
        async logout() {
          const token = this._tokenStore.getToken();
          if (token) {
            try {
              await this._avatar.revokeToken({ Token: token });
            } catch (e) {
            }
          }
          this._tokenStore.clear();
        }
      };
      module.exports = { AuthModule };
    }
  });

  // node_modules/@oasisomniverse/web4-api/src/index.js
  var require_src = __commonJS({
    "node_modules/@oasisomniverse/web4-api/src/index.js"(exports, module) {
      "use strict";
      var { HttpClient, DEFAULT_BASE_URL } = require_httpClient();
      var { TokenStore } = require_tokenStore();
      var { attachGeneratedModules } = require_modules();
      var { AuthModule } = require_Auth();
      var OASISClient2 = class {
        constructor({ baseUrl = DEFAULT_BASE_URL, persistSession, fetchImpl } = {}) {
          this.tokenStore = new TokenStore({ persist: persistSession });
          this.http = new HttpClient({ baseUrl, tokenStore: this.tokenStore, fetchImpl });
          attachGeneratedModules(this, this.http);
          this.auth = new AuthModule(this.http, this.tokenStore, this.avatar);
        }
        setBaseUrl(baseUrl) {
          this.http.setBaseUrl(baseUrl);
        }
        /** Use an externally-issued JWT (e.g. one your server already obtained) for subsequent calls. */
        setToken(jwtToken, sessionExtras = {}) {
          this.tokenStore.setSession({ ...sessionExtras, jwtToken });
        }
      };
      module.exports = { OASISClient: OASISClient2, HttpClient, TokenStore, DEFAULT_BASE_URL };
      module.exports.default = OASISClient2;
    }
  });

  // node_modules/@oasisomniverse/web4-api/index.js
  var require_web4_api = __commonJS({
    "node_modules/@oasisomniverse/web4-api/index.js"(exports, module) {
      "use strict";
      module.exports = require_src();
    }
  });

  // build/web4-entry.js
  var { OASISClient } = require_web4_api();
  if (typeof window !== "undefined") window.OASISClient = OASISClient;
})();
