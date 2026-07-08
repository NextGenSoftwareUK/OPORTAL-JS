/**
 * OasisStarField — animated canvas starfield background
 * Usage:
 *   const sf = new OasisStarField({ container: document.body, starCount: 160 })
 *   sf.destroy() // clean up
 */
class OasisStarField {
  constructor({ container = document.body, starCount = 160, speed = 0.3 } = {}) {
    this._container = container;
    this._starCount = starCount;
    this._speed = speed;
    this._stars = [];
    this._raf = null;

    this._canvas = document.createElement('canvas');
    Object.assign(this._canvas.style, {
      position: 'fixed', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '0'
    });
    this._ctx = this._canvas.getContext('2d');
    container.prepend(this._canvas);

    this._resize = this._resize.bind(this);
    this._tick = this._tick.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    this._init();
    this._raf = requestAnimationFrame(this._tick);
  }

  _resize() {
    this._canvas.width = window.innerWidth;
    this._canvas.height = window.innerHeight;
  }

  _init() {
    this._stars = Array.from({ length: this._starCount }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.3,
      o: Math.random() * 0.6 + 0.2,
      dy: (Math.random() * 0.3 + 0.1) * this._speed
    }));
  }

  _tick() {
    const { width, height } = this._canvas;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, width, height);
    for (const s of this._stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,230,255,${s.o})`;
      ctx.fill();
      s.y -= s.dy;
      if (s.y < -2) { s.y = height + 2; s.x = Math.random() * width; }
    }
    this._raf = requestAnimationFrame(this._tick);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    this._canvas.remove();
  }
}

window.OasisStarField = OasisStarField;
