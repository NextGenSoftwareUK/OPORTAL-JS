/**
 * OasisKarmaToast — floating karma notification
 * Usage:
 *   OasisKarmaToast.show({ message: 'Healed a patient', amount: 150 })
 */
const OasisKarmaToast = (() => {
  let _el = null;
  let _timer = null;

  function _inject() {
    if (document.getElementById('oasis-karma-toast')) return;
    const el = document.createElement('div');
    el.id = 'oasis-karma-toast';
    el.innerHTML = `
      <div class="okt-inner">
        <span class="okt-icon">⚡</span>
        <div>
          <div class="okt-amount"></div>
          <div class="okt-message"></div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    _el = el;

    const s = document.createElement('style');
    s.textContent = `
      #oasis-karma-toast{position:fixed;bottom:28px;right:28px;z-index:10000;pointer-events:none;transform:translateY(20px);opacity:0;transition:opacity .35s,transform .35s}
      #oasis-karma-toast.is-visible{opacity:1;transform:none}
      .okt-inner{display:flex;align-items:center;gap:12px;background:#0d1829;border:1px solid rgba(0,200,255,.25);border-radius:12px;padding:14px 18px;box-shadow:0 8px 32px rgba(0,0,0,.5)}
      .okt-icon{font-size:22px}
      .okt-amount{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:700;color:#00c8ff}
      .okt-message{font-size:12px;color:#7a9bbf;margin-top:2px}
    `;
    document.head.appendChild(s);
  }

  function show({ message = '', amount = 0, duration = 4000 } = {}) {
    _inject();
    _el.querySelector('.okt-amount').textContent = `+${amount} Karma`;
    _el.querySelector('.okt-message').textContent = message;
    _el.classList.add('is-visible');
    clearTimeout(_timer);
    _timer = setTimeout(() => _el.classList.remove('is-visible'), duration);
  }

  return { show };
})();

window.OasisKarmaToast = OasisKarmaToast;
