/**
 * OasisModal — reusable modal wrapper
 * Usage:
 *   const modal = new OasisModal({ title: 'My Modal', content: '<p>Hello</p>' })
 *   modal.open()  /  modal.close()  /  modal.destroy()
 */
class OasisModal {
  constructor({ title = '', content = '', accentColor = '#00c8ff', onClose = null } = {}) {
    this._onClose = onClose;
    this._el = null;
    this._title = title;
    this._content = content;
    this._accent = accentColor;
    this._build();
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'oasis-modal-backdrop';
    el.innerHTML = `
      <div class="oasis-modal-box" role="dialog" aria-modal="true">
        <div class="oasis-modal-header" style="border-bottom-color:${this._accent}33">
          <span class="oasis-modal-title" style="color:${this._accent}">${this._title}</span>
          <button class="oasis-modal-close" aria-label="Close">&#x2715;</button>
        </div>
        <div class="oasis-modal-body">${this._content}</div>
      </div>
    `;
    el.querySelector('.oasis-modal-close').addEventListener('click', () => this.close());
    el.addEventListener('click', e => { if (e.target === el) this.close(); });
    document.addEventListener('keydown', this._onKey = e => { if (e.key === 'Escape') this.close(); });
    this._el = el;
    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById('oasis-modal-styles')) return;
    const s = document.createElement('style');
    s.id = 'oasis-modal-styles';
    s.textContent = `
      .oasis-modal-backdrop{position:fixed;inset:0;background:rgba(3,7,20,.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;transition:opacity .25s}
      .oasis-modal-backdrop.is-open{opacity:1}
      .oasis-modal-box{background:#0d1829;border:1px solid rgba(0,200,255,.18);border-radius:16px;padding:28px;width:min(520px,92vw);max-height:88vh;overflow-y:auto;transform:translateY(16px);transition:transform .25s}
      .oasis-modal-backdrop.is-open .oasis-modal-box{transform:none}
      .oasis-modal-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid;margin-bottom:20px}
      .oasis-modal-title{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:700;letter-spacing:.06em}
      .oasis-modal-close{background:none;border:none;color:#7a9bbf;font-size:18px;cursor:pointer;padding:0;line-height:1}
      .oasis-modal-close:hover{color:#fff}
      .oasis-modal-body{color:#a8bfd8;font-size:14px;line-height:1.6}
    `;
    document.head.appendChild(s);
  }

  setContent(html) {
    this._el.querySelector('.oasis-modal-body').innerHTML = html;
  }

  open() {
    document.body.appendChild(this._el);
    requestAnimationFrame(() => this._el.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
  }

  close() {
    this._el.classList.remove('is-open');
    this._el.addEventListener('transitionend', () => {
      this._el.remove();
      document.body.style.overflow = '';
    }, { once: true });
    if (this._onClose) this._onClose();
  }

  destroy() {
    document.removeEventListener('keydown', this._onKey);
    this._el.remove();
  }
}

window.OasisModal = OasisModal;
