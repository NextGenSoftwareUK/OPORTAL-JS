/**
 * OasisNavBar — standalone responsive navigation bar widget
 * Usage: new OasisNavBar({ container, brand, links, onLogin })
 */
(function () {
  const CSS = `
.oasis-nav{position:relative;z-index:100;padding:16px 32px;display:flex;align-items:center;justify-content:space-between;background:rgba(3,7,20,.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(0,200,255,.1);font-family:'Rajdhani',sans-serif;box-sizing:border-box}
.oasis-nav-brand{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:.16em;color:#fff;text-decoration:none;display:flex;align-items:center;gap:10px;white-space:nowrap}
.oasis-nav-brand-icon{color:#00c8ff;font-size:16px}
.oasis-nav-links{display:flex;gap:16px;list-style:none;margin:0;padding:0}
.oasis-nav-links a{font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:.08em;color:#a8bfd8;text-decoration:none;transition:color .2s;text-transform:uppercase}
.oasis-nav-links a:hover{color:#00c8ff}
.oasis-nav-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
.oasis-nav-login{background:linear-gradient(135deg,#00c8ff,#0080ff);border:none;border-radius:7px;color:#fff;font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;letter-spacing:.08em;padding:8px 16px;cursor:pointer;white-space:nowrap;transition:opacity .2s}
.oasis-nav-login:hover{opacity:.85}
.oasis-nav-toggle{display:none;flex-direction:column;justify-content:center;gap:5px;width:32px;height:32px;background:none;border:none;cursor:pointer;padding:0}
.oasis-nav-toggle span{display:block;width:100%;height:2px;background:#a8bfd8;transition:transform .25s,opacity .25s;border-radius:1px}
.oasis-nav-toggle.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.oasis-nav-toggle.open span:nth-child(2){opacity:0}
.oasis-nav-toggle.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
@media(max-width:900px){
  .oasis-nav-toggle{display:flex}
  .oasis-nav-links{position:fixed;top:0;right:0;height:100vh;width:min(78vw,300px);flex-direction:column;justify-content:flex-start;align-items:flex-start;gap:14px;padding:72px 28px 24px;overflow-y:auto;background:rgba(3,7,20,.98);border-left:1px solid rgba(0,200,255,.12);transform:translateX(100%);transition:transform .3s ease;z-index:200}
  .oasis-nav-links.open{transform:translateX(0)}
}
`;

  class OasisNavBar {
    constructor({
      container,
      brand = 'OASIS',
      brandIcon = '✦',
      links = [],
      loginLabel = 'Login',
      onLogin = null,
    } = {}) {
      this._container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this._container) throw new Error('OasisNavBar: container not found');
      if (!document.getElementById('oasis-nav-styles')) {
        const s = document.createElement('style'); s.id = 'oasis-nav-styles'; s.textContent = CSS;
        document.head.appendChild(s);
      }
      this._brand = brand;
      this._brandIcon = brandIcon;
      this._links = links;
      this._loginLabel = loginLabel;
      this._onLogin = onLogin;
      this._open = false;
      this._render();
    }

    _render() {
      this._container.innerHTML = `
        <nav class="oasis-nav">
          <a class="oasis-nav-brand" href="#">
            <span class="oasis-nav-brand-icon">${this._brandIcon}</span>
            <span>${this._brand}</span>
          </a>
          <button class="oasis-nav-toggle${this._open ? ' open' : ''}" id="oasis-nav-toggle" aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
          <ul class="oasis-nav-links${this._open ? ' open' : ''}">
            ${this._links.map(l => `<li><a href="${l.href || '#'}">${l.label}</a></li>`).join('')}
          </ul>
          ${this._onLogin ? `<div class="oasis-nav-right"><button class="oasis-nav-login" id="oasis-nav-login">${this._loginLabel}</button></div>` : ''}
        </nav>`;
      document.getElementById('oasis-nav-toggle')?.addEventListener('click', () => {
        this._open = !this._open; this._render();
      });
      document.getElementById('oasis-nav-login')?.addEventListener('click', this._onLogin);
      this._container.querySelectorAll('.oasis-nav-links a').forEach(a => {
        a.addEventListener('click', () => { this._open = false; this._render(); });
      });
    }

    destroy() { this._container.innerHTML = ''; }
  }

  window.OasisNavBar = OasisNavBar;
})();
