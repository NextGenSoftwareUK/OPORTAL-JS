/**
 * OasisComingSoon — standalone Coming Soon widget
 * Usage: new OasisComingSoon({ container, title, message })
 */
(function () {
  const CSS = `
.oasis-cs-shell{font-family:'Rajdhani',sans-serif;display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px 20px;text-align:center}
.oasis-cs-icon{font-size:48px}
.oasis-cs-title{font-family:'Orbitron',sans-serif;font-size:20px;color:#fff;margin:0}
.oasis-cs-body{font-size:14px;color:#7a9bbf;line-height:1.6;margin:0;max-width:360px}
.oasis-cs-badge{background:rgba(255,180,60,.12);border:1px solid rgba(255,180,60,.28);color:#ffb43c;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:5px 14px;text-transform:uppercase}
`;

  class OasisComingSoon {
    constructor({ container, title = 'Feature Coming Soon', message = 'This feature is currently under development and will be available soon.' } = {}) {
      this._container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this._container) throw new Error('OasisComingSoon: container not found');
      if (!document.getElementById('oasis-cs-styles')) {
        const s = document.createElement('style'); s.id = 'oasis-cs-styles'; s.textContent = CSS;
        document.head.appendChild(s);
      }
      this._container.innerHTML = `
        <div class="oasis-cs-shell">
          <div class="oasis-cs-icon">🚀</div>
          <h2 class="oasis-cs-title">${title}</h2>
          <p class="oasis-cs-body">${message}</p>
          <div class="oasis-cs-badge">Coming Soon</div>
        </div>`;
    }

    destroy() { this._container.innerHTML = ''; }
  }

  window.OasisComingSoon = OasisComingSoon;
})();
