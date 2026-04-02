/**
 * Gravity Particles — Canvas 2D overlay (above WebGL aurora)
 * Dark-mode optimized: bright glowing particles + connection lines
 * Mouse repel / spring-back interaction
 */
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  const PARTICLE_COUNT = 100;
  const MOUSE = { x: -9999, y: -9999 };

  // ─── Particle class ────────────────────────────────────────────────────
  class Particle {
    constructor() { this.reset(); }

    reset() {
      this.x     = Math.random() * width;
      this.y     = Math.random() * height;
      this.baseX = this.x;
      this.baseY = this.y;
      this.size  = Math.random() * 1.6 + 0.4;
      this.vx    = (Math.random() - 0.5) * 0.5;
      this.vy    = (Math.random() - 0.5) * 0.5;
      // Deeper colors visible on white bg
      const hues = [260, 200, 320, 220, 280];
      this.hue   = hues[Math.floor(Math.random() * hues.length)];
      this.sat   = Math.floor(Math.random() * 25 + 60); // 60-85%
      this.alpha = Math.random() * 0.35 + 0.15;         // 0.15–0.50
      this.glow  = this.size > 1.2;
    }

    update() {
      const dx   = MOUSE.x - this.x;
      const dy   = MOUSE.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const R    = 130;

      if (dist < R && dist > 0) {
        const force = (R - dist) / R;
        this.vx -= (dx / dist) * force * 2.2;
        this.vy -= (dy / dist) * force * 2.2;
      }

      // Spring back
      this.vx += (this.baseX - this.x) * 0.006;
      this.vy += (this.baseY - this.y) * 0.006;

      // Damping
      this.vx *= 0.94;
      this.vy *= 0.94;

      this.x += this.vx;
      this.y += this.vy;
    }

    draw() {
      if (this.glow) {
        // Soft radial glow — subtle on white
        const grad = ctx.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.size * 4
        );
        grad.addColorStop(0, `hsla(${this.hue}, ${this.sat}%, 58%, ${this.alpha * 0.5})`);
        grad.addColorStop(1, `hsla(${this.hue}, ${this.sat}%, 58%, 0)`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Core dot — visible on white
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue}, ${this.sat}%, 50%, ${this.alpha})`;
      ctx.fill();
    }
  }

  // ─── Setup ────────────────────────────────────────────────────────────
  let particles;

  function resize() {
    width  = canvas.width  = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
  }

  function init() {
    resize();
    particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle());
  }

  // ─── Draw connections ─────────────────────────────────────────────────
  function drawConnections() {
    const MAX_DIST = 110;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          const a   = 0.18 * (1 - dist / MAX_DIST);
          const hue = (particles[i].hue + particles[j].hue) / 2;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `hsla(${hue}, 65%, 45%, ${a})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }

  // ─── Animate ──────────────────────────────────────────────────────────
  function animate() {
    ctx.clearRect(0, 0, width, height);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }

  // ─── Events ───────────────────────────────────────────────────────────
  // Mirror mouse events from the hero-hover-zone (content layer)
  const hero = document.getElementById('home');
  if (hero) {
    hero.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      MOUSE.x = e.clientX - rect.left;
      MOUSE.y = e.clientY - rect.top;
    });
    hero.addEventListener('mouseleave', () => {
      MOUSE.x = -9999; MOUSE.y = -9999;
    });
  }

  window.addEventListener('resize', () => {
    resize();
    particles.forEach(p => p.reset());
  });

  init();
  animate();
})();


// ═══════════════════════════════════════════════════════════════════════════
// Section Background Canvas — Animated floating orbs & mesh for page body
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('section-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H;

  // ─── Orb definition ───────────────────────────────────────────────────
  const ORBS = [
    { xPct: 0.15, yPct: 0.20, r: 320, hue: 260, speed: 0.00028, phase: 0.0 },
    { xPct: 0.82, yPct: 0.40, r: 280, hue: 195, speed: 0.00022, phase: 1.5 },
    { xPct: 0.50, yPct: 0.75, r: 360, hue: 320, speed: 0.00018, phase: 3.0 },
    { xPct: 0.25, yPct: 0.60, r: 200, hue: 210, speed: 0.00035, phase: 5.0 },
    { xPct: 0.70, yPct: 0.10, r: 240, hue: 280, speed: 0.00025, phase: 2.2 },
  ];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function drawOrbs(t) {
    ctx.clearRect(0, 0, W, H);
    ORBS.forEach(orb => {
      const drift = 50;
      const cx = orb.xPct * W + Math.sin(t * orb.speed * 1000 + orb.phase) * drift;
      const cy = orb.yPct * H + Math.cos(t * orb.speed * 800  + orb.phase) * drift * 0.7;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb.r);
      grad.addColorStop(0.00, `hsla(${orb.hue}, 85%, 65%, 0.07)`);
      grad.addColorStop(0.45, `hsla(${orb.hue}, 80%, 60%, 0.04)`);
      grad.addColorStop(1.00, `hsla(${orb.hue}, 70%, 55%, 0.00)`);

      ctx.beginPath();
      ctx.arc(cx, cy, orb.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
  }

  resize();
  window.addEventListener('resize', resize);

  function loop(t) {
    drawOrbs(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
