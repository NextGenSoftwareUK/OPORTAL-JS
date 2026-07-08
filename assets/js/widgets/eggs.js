/**
 * OasisEggs — standalone Egg incubation widget
 * Usage: new OasisEggs({ container: document.getElementById('eggs') })
 */
(function () {
  const EGGS = [
    { id: '1', name: 'Cosmic Egg', rarity: 'legendary', hatchProgress: 75, hatched: false, reward: '+500 Karma Companion' },
    { id: '2', name: 'Forest Egg', rarity: 'common', hatchProgress: 100, hatched: true, reward: 'Woodland Sprite' },
    { id: '3', name: 'Astral Egg', rarity: 'epic', hatchProgress: 30, hatched: false, reward: '+200 Karma Companion' },
    { id: '4', name: 'Ocean Egg', rarity: 'rare', hatchProgress: 55, hatched: false, reward: 'Sea Guardian' },
  ];
  const RARITY_COLORS = { common: '#7a9bbf', rare: '#5ba8ff', epic: '#b87fff', legendary: '#ffb43c' };

  const CSS = `
.oasis-eggs-shell{font-family:'Rajdhani',sans-serif;display:flex;flex-direction:column;gap:20px}
.oasis-eggs-header{text-align:center}
.oasis-eggs-title{font-family:'Orbitron',sans-serif;font-size:20px;color:#fff;margin:0 0 6px}
.oasis-eggs-sub{font-size:13px;color:#7a9bbf;margin:0}
.oasis-eggs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}
.oasis-egg-card{background:rgba(255,255,255,.04);border:1px solid rgba(0,200,255,.15);border-radius:12px;padding:18px 14px;display:flex;flex-direction:column;align-items:center;gap:10px;transition:border-color .2s}
.oasis-egg-card:hover{border-color:rgba(0,200,255,.35)}
.oasis-egg-card.hatched{border-color:rgba(255,180,60,.3);background:rgba(255,180,60,.04)}
.oasis-egg-rarity{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:3px 10px;border:1px solid currentColor}
.oasis-egg-icon{font-size:40px}
.oasis-egg-name{font-family:'Orbitron',sans-serif;font-size:12px;color:#fff;text-align:center}
.oasis-egg-progress-wrap{width:100%;display:flex;flex-direction:column;gap:4px;align-items:center}
.oasis-egg-progress-bar{width:100%;height:6px;background:rgba(255,255,255,.1);border-radius:999px;overflow:hidden}
.oasis-egg-progress-fill{height:100%;background:linear-gradient(90deg,#00c8ff,#0080ff);border-radius:999px;transition:width .4s}
.oasis-egg-pct{font-size:11px;color:#7a9bbf}
.oasis-egg-btn{width:100%;background:linear-gradient(135deg,#ffb43c,#ff8c00);border:none;border-radius:7px;color:#fff;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;letter-spacing:.08em;padding:8px;cursor:pointer;transition:opacity .2s}
.oasis-egg-btn:hover{opacity:.85}
.oasis-egg-reward{font-size:12px;color:#ffb43c;font-weight:600;text-align:center}
`;

  class OasisEggs {
    constructor({ container } = {}) {
      this._container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this._container) throw new Error('OasisEggs: container not found');
      if (!document.getElementById('oasis-eggs-styles')) {
        const s = document.createElement('style'); s.id = 'oasis-eggs-styles'; s.textContent = CSS;
        document.head.appendChild(s);
      }
      this._eggs = EGGS.map(e => ({ ...e }));
      this._render();
    }

    _render() {
      this._container.innerHTML = `
        <div class="oasis-eggs-shell">
          <div class="oasis-eggs-header">
            <h2 class="oasis-eggs-title">🥚 Eggs</h2>
            <p class="oasis-eggs-sub">Hatch eggs to discover rare OASIS companions and rewards.</p>
          </div>
          <div class="oasis-eggs-grid">
            ${this._eggs.map(e => `
              <div class="oasis-egg-card${e.hatched ? ' hatched' : ''}" data-id="${e.id}">
                <div class="oasis-egg-rarity" style="color:${RARITY_COLORS[e.rarity]};border-color:${RARITY_COLORS[e.rarity]}44">${e.rarity}</div>
                <div class="oasis-egg-icon">${e.hatched ? '🐣' : '🥚'}</div>
                <div class="oasis-egg-name">${e.name}</div>
                ${e.hatched
                  ? `<div class="oasis-egg-reward">✨ ${e.reward}</div>`
                  : `<div class="oasis-egg-progress-wrap">
                      <div class="oasis-egg-progress-bar"><div class="oasis-egg-progress-fill" style="width:${e.hatchProgress}%"></div></div>
                      <div class="oasis-egg-pct">${e.hatchProgress}%</div>
                    </div>
                    <button class="oasis-egg-btn" data-incubate="${e.id}">Incubate</button>`}
              </div>`).join('')}
          </div>
        </div>`;
      this._container.querySelectorAll('[data-incubate]').forEach(btn => {
        btn.addEventListener('click', () => this._incubate(btn.dataset.incubate));
      });
    }

    _incubate(id) {
      const e = this._eggs.find(x => x.id === id);
      if (e && !e.hatched) {
        e.hatchProgress = Math.min(100, e.hatchProgress + 25);
        if (e.hatchProgress >= 100) e.hatched = true;
        this._render();
      }
    }

    destroy() { this._container.innerHTML = ''; }
  }

  window.OasisEggs = OasisEggs;
})();
