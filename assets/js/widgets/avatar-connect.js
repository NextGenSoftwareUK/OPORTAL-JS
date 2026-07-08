/**
 * OasisAvatarConnect — login/logout toggle widget
 * Renders a button that shows login state and opens an OasisModal with the login form.
 * Usage:
 *   const ac = new OasisAvatarConnect({ container: document.querySelector('#nav-auth') })
 *   ac.destroy()
 */
class OasisAvatarConnect {
  constructor({ container, apiUrl = 'https://api.web4.oasisomniverse.one', sessionKey = 'oasis_session', onLogin = null, onLogout = null } = {}) {
    this._container = container;
    this._apiUrl = apiUrl;
    this._sessionKey = sessionKey;
    this._onLogin = onLogin;
    this._onLogout = onLogout;
    this._modal = null;
    this._session = this._loadSession();
    this._render();
    this._injectStyles();
  }

  _loadSession() {
    try { return JSON.parse(sessionStorage.getItem(this._sessionKey)); } catch { return null; }
  }

  _saveSession(sess) {
    sessionStorage.setItem(this._sessionKey, JSON.stringify(sess));
    this._session = sess;
  }

  _clearSession() {
    sessionStorage.removeItem(this._sessionKey);
    this._session = null;
  }

  _render() {
    this._container.innerHTML = '';
    if (this._session) {
      const btn = document.createElement('div');
      btn.className = 'oac-avatar-chip';
      btn.innerHTML = `<span class="oac-avatar-icon">👤</span><span class="oac-username">${this._session.username}</span><span class="oac-karma">⚡ ${this._session.karma ?? 0}</span><button class="oac-logout-btn">Logout</button>`;
      btn.querySelector('.oac-logout-btn').addEventListener('click', () => this._logout());
      this._container.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'oac-login-btn';
      btn.textContent = 'Beam In';
      btn.addEventListener('click', () => this._openLogin());
      this._container.appendChild(btn);
    }
  }

  _openLogin() {
    const formHtml = `
      <div class="oac-form" id="oac-login-form">
        <div id="oac-error" class="oac-error" style="display:none"></div>
        <div class="oac-field"><label class="oac-label">Username</label><input class="oac-input" id="oac-username" type="text" placeholder="yourusername" autocomplete="username" /></div>
        <div class="oac-field"><label class="oac-label">Password</label><input class="oac-input" id="oac-password" type="password" placeholder="••••••••" autocomplete="current-password" /></div>
        <button class="oac-submit-btn" id="oac-submit">Beam In</button>
      </div>
    `;
    this._modal = new OasisModal({ title: 'Beam In', content: formHtml, accentColor: '#00c8ff' });
    this._modal.open();
    document.getElementById('oac-submit').addEventListener('click', () => this._doLogin());
    document.getElementById('oac-password').addEventListener('keydown', e => { if (e.key === 'Enter') this._doLogin(); });
  }

  async _doLogin() {
    const username = document.getElementById('oac-username').value.trim();
    const password = document.getElementById('oac-password').value;
    const errEl = document.getElementById('oac-error');
    const btn = document.getElementById('oac-submit');
    if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; errEl.style.display = 'block'; return; }
    btn.textContent = 'Connecting…'; btn.disabled = true; errEl.style.display = 'none';
    try {
      const { OASISClient } = await import('https://esm.sh/@oasisomniverse/web4-api@2.0.2');
      const oasis = new OASISClient({ baseUrl: this._apiUrl });
      const result = await oasis.auth.login({ username, password });
      const karma = await oasis.karma.getKarmaForAvatar({ avatarId: result.avatarId });
      this._saveSession({ avatarId: result.avatarId, username, karma: karma.total ?? 0 });
      this._modal.close();
      this._render();
      if (this._onLogin) this._onLogin(this._session);
    } catch (e) {
      errEl.textContent = e?.message ?? 'Login failed. Please check your credentials.';
      errEl.style.display = 'block';
      btn.textContent = 'Beam In'; btn.disabled = false;
    }
  }

  _logout() {
    this._clearSession();
    this._render();
    if (this._onLogout) this._onLogout();
  }

  _injectStyles() {
    if (document.getElementById('oac-styles')) return;
    const s = document.createElement('style');
    s.id = 'oac-styles';
    s.textContent = `
      .oac-login-btn{background:linear-gradient(135deg,#00c8ff,#0080ff);border:none;border-radius:8px;color:#fff;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;padding:9px 18px;cursor:pointer;transition:opacity .2s}
      .oac-login-btn:hover{opacity:.85}
      .oac-avatar-chip{display:flex;align-items:center;gap:10px;background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.2);border-radius:999px;padding:6px 14px 6px 10px;font-size:13px}
      .oac-avatar-icon{font-size:18px}
      .oac-username{color:#fff;font-weight:600}
      .oac-karma{color:#00c8ff;font-family:'Orbitron',sans-serif;font-size:11px}
      .oac-logout-btn{background:none;border:1px solid rgba(255,100,100,.3);color:#ff8080;border-radius:6px;font-size:11px;padding:3px 8px;cursor:pointer;margin-left:4px}
      .oac-form{display:flex;flex-direction:column;gap:16px}
      .oac-error{background:rgba(255,80,80,.12);border:1px solid rgba(255,80,80,.3);color:#ff6b6b;border-radius:8px;padding:10px 14px;font-size:13px}
      .oac-field{display:flex;flex-direction:column;gap:6px}
      .oac-label{font-size:11px;font-weight:600;letter-spacing:.06em;color:#7a9bbf;text-transform:uppercase}
      .oac-input{background:rgba(255,255,255,.05);border:1px solid rgba(0,200,255,.2);border-radius:8px;padding:10px 14px;color:#fff;font-size:14px;outline:none;transition:border-color .2s}
      .oac-input:focus{border-color:rgba(0,200,255,.5)}
      .oac-submit-btn{background:linear-gradient(135deg,#00c8ff,#0080ff);border:none;border-radius:8px;color:#fff;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:.08em;padding:12px;cursor:pointer}
      .oac-submit-btn:disabled{opacity:.5;cursor:not-allowed}
    `;
    document.head.appendChild(s);
  }

  destroy() {
    this._modal?.destroy();
    this._container.innerHTML = '';
  }
}

window.OasisAvatarConnect = OasisAvatarConnect;
