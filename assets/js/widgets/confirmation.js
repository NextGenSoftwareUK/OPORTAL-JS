/**
 * OasisConfirmation — standalone Confirmation dialog widget
 * Usage: new OasisConfirmation({ container, title, message, onConfirm, onCancel })
 */
(function () {
  const CSS = `
.oasis-conf-shell{font-family:'Rajdhani',sans-serif;display:flex;flex-direction:column;align-items:center;gap:18px;padding:20px;text-align:center}
.oasis-conf-icon{font-size:44px}
.oasis-conf-title{font-family:'Orbitron',sans-serif;font-size:18px;color:#fff;margin:0}
.oasis-conf-body{font-size:14px;color:#a8bfd8;line-height:1.6;margin:0;max-width:360px}
.oasis-conf-actions{display:flex;gap:12px;margin-top:4px}
.oasis-conf-btn{border:none;border-radius:8px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;padding:11px 24px;cursor:pointer;transition:opacity .2s}
.oasis-conf-btn:hover{opacity:.85}
.oasis-conf-btn--confirm{background:linear-gradient(135deg,#ff4444,#cc0000);color:#fff}
.oasis-conf-btn--cancel{background:transparent;border:1px solid rgba(0,200,255,.3);color:#00c8ff}
`;

  class OasisConfirmation {
    constructor({
      container,
      title = 'Are you sure?',
      message = 'This action cannot be undone.',
      icon = '⚠️',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      onConfirm = () => {},
      onCancel = () => {},
    } = {}) {
      this._container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this._container) throw new Error('OasisConfirmation: container not found');
      if (!document.getElementById('oasis-conf-styles')) {
        const s = document.createElement('style'); s.id = 'oasis-conf-styles'; s.textContent = CSS;
        document.head.appendChild(s);
      }
      this._container.innerHTML = `
        <div class="oasis-conf-shell">
          <div class="oasis-conf-icon">${icon}</div>
          <h2 class="oasis-conf-title">${title}</h2>
          <p class="oasis-conf-body">${message}</p>
          <div class="oasis-conf-actions">
            <button class="oasis-conf-btn oasis-conf-btn--confirm" id="oasis-conf-confirm">${confirmLabel}</button>
            <button class="oasis-conf-btn oasis-conf-btn--cancel" id="oasis-conf-cancel">${cancelLabel}</button>
          </div>
        </div>`;
      document.getElementById('oasis-conf-confirm')?.addEventListener('click', onConfirm);
      document.getElementById('oasis-conf-cancel')?.addEventListener('click', onCancel);
    }

    destroy() { this._container.innerHTML = ''; }
  }

  window.OasisConfirmation = OasisConfirmation;
})();
