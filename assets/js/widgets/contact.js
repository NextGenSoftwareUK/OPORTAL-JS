/**
 * OasisContact — standalone Contact form widget
 * Usage: new OasisContact({ container: document.getElementById('contact') })
 */
(function () {
  const CSS = `
.oasis-contact-shell{font-family:'Rajdhani',sans-serif;display:flex;flex-direction:column;gap:18px}
.oasis-contact-header{text-align:center}
.oasis-contact-title{font-family:'Orbitron',sans-serif;font-size:20px;color:#fff;margin:0 0 6px}
.oasis-contact-sub{font-size:13px;color:#7a9bbf;margin:0}
.oasis-contact-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.oasis-contact-field{display:flex;flex-direction:column;gap:6px}
.oasis-contact-label{font-size:12px;font-weight:600;letter-spacing:.06em;color:#7a9bbf;text-transform:uppercase}
.oasis-contact-input,.oasis-contact-textarea{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(0,200,255,.2);border-radius:8px;padding:10px 14px;color:#fff;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;transition:border-color .2s}
.oasis-contact-input:focus,.oasis-contact-textarea:focus{border-color:rgba(0,200,255,.5)}
.oasis-contact-textarea{resize:vertical;min-height:100px}
.oasis-contact-btn{background:linear-gradient(135deg,#00c8ff,#0080ff);border:none;border-radius:8px;color:#fff;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:.08em;padding:12px;cursor:pointer;transition:opacity .2s;width:100%}
.oasis-contact-btn:disabled{opacity:.5;cursor:not-allowed}
.oasis-contact-success{background:rgba(72,220,130,.12);border:1px solid rgba(72,220,130,.3);color:#48dc82;border-radius:8px;padding:10px 14px;font-size:13px}
.oasis-contact-error{background:rgba(255,80,80,.12);border:1px solid rgba(255,80,80,.3);color:#ff6b6b;border-radius:8px;padding:10px 14px;font-size:13px}
`;

  class OasisContact {
    constructor({ container } = {}) {
      this._container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this._container) throw new Error('OasisContact: container not found');
      if (!document.getElementById('oasis-contact-styles')) {
        const s = document.createElement('style'); s.id = 'oasis-contact-styles'; s.textContent = CSS;
        document.head.appendChild(s);
      }
      this._fields = { firstName: '', lastName: '', email: '', subject: '', message: '' };
      this._loading = false;
      this._sent = false;
      this._error = '';
      this._render();
    }

    _render() {
      if (this._sent) {
        this._container.innerHTML = `<div class="oasis-contact-shell"><div class="oasis-contact-header"><h2 class="oasis-contact-title">Contact Us</h2></div><div class="oasis-contact-success">✅ Message sent! We'll be in touch soon.</div></div>`;
        return;
      }
      const f = this._fields;
      this._container.innerHTML = `
        <div class="oasis-contact-shell">
          <div class="oasis-contact-header">
            <h2 class="oasis-contact-title">✉️ Contact Us</h2>
            <p class="oasis-contact-sub">Get in touch with the OASIS team.</p>
          </div>
          ${this._error ? `<div class="oasis-contact-error">${this._error}</div>` : ''}
          <div class="oasis-contact-grid2">
            <div class="oasis-contact-field"><label class="oasis-contact-label">First Name</label><input class="oasis-contact-input" data-field="firstName" value="${f.firstName}" placeholder="John" /></div>
            <div class="oasis-contact-field"><label class="oasis-contact-label">Last Name</label><input class="oasis-contact-input" data-field="lastName" value="${f.lastName}" placeholder="Doe" /></div>
          </div>
          <div class="oasis-contact-field"><label class="oasis-contact-label">Email</label><input class="oasis-contact-input" type="email" data-field="email" value="${f.email}" placeholder="name@example.com" /></div>
          <div class="oasis-contact-field"><label class="oasis-contact-label">Subject</label><input class="oasis-contact-input" data-field="subject" value="${f.subject}" placeholder="How can we help?" /></div>
          <div class="oasis-contact-field"><label class="oasis-contact-label">Message</label><textarea class="oasis-contact-textarea" data-field="message" placeholder="Your message…">${f.message}</textarea></div>
          <button class="oasis-contact-btn" id="oasis-contact-submit" ${this._loading ? 'disabled' : ''}>${this._loading ? 'Sending…' : 'Send Message'}</button>
        </div>`;
      this._container.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('input', () => { this._fields[el.dataset.field] = el.value; });
      });
      document.getElementById('oasis-contact-submit')?.addEventListener('click', () => this._submit());
    }

    async _submit() {
      if (!this._fields.email || !this._fields.message) { this._error = 'Please fill in your email and message.'; this._render(); return; }
      this._loading = true; this._error = ''; this._render();
      try {
        await fetch('https://formsubmit.co/ajax/davidellams@hotmail.com', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(this._fields),
        });
        this._sent = true;
      } catch (e) { this._error = e?.message || 'Send failed. Please try again.'; }
      this._loading = false;
      this._render();
    }

    destroy() { this._container.innerHTML = ''; }
  }

  window.OasisContact = OasisContact;
})();
