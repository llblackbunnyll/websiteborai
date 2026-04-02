/**
 * WebGL "Arctic Light" Background
 * ──────────────────────────────────────────────────────────────
 * Soft, minimal white-toned effect: milky wisps of cool lavender,
 * ice-blue, and warm cream drift slowly across an almost-white
 * canvas — gentle enough that the BICEC lettermark behind still
 * reads clearly.
 *
 * Same FBM domain-warping technique as before, palette shifted
 * from deep-space vivid to near-white pastels.
 */
(function () {
  const canvas = document.getElementById('hero-webgl');
  if (!canvas || !window.WebGLRenderingContext) return;

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return;

  // ─── Vertex shader ───────────────────────────────────────────────────────
  const VS = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  // ─── Fragment shader — white / Arctic palette ─────────────────────────────
  const FS = `
    precision mediump float;
    uniform float u_time;
    uniform vec2  u_resolution;

    /* ── Noise helpers ────────────────────────────────────────────────────── */
    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 43.21);
      return fract(p.x * p.y);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1,0)), f.x),
        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0, a = 0.55, fr = 1.0;
      for (int i = 0; i < 5; i++) {
        v  += a  * vnoise(p * fr);
        a  *= 0.5;
        fr *= 2.03;
      }
      return v;
    }

    /* ── Arctic Light palette ─────────────────────────────────────────────
       All colours are very close to white — shifts are barely perceptible
       individually but together create soft depth and movement.

       Base     #f8f7ff — barely-off-white with a cool purple hint
       Ice-blue #e8f4ff — lightest sky reflected on snow
       Lavender #ece8ff — misted lavender
       Crystal  #f2fafc — cold crystal teal
       Warm     #fff8f4 — candlelight warmth (contrast anchor)
    ─────────────────────────────────────────────────────────────────────── */
    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;

      /* Slow drift — very gentle motion */
      float t = u_time * 0.06;

      /* Two-level domain warp */
      vec2 q = vec2(
        fbm(uv * 2.0 + vec2(0.0,  0.0)),
        fbm(uv * 2.0 + vec2(5.2,  1.3))
      );
      vec2 r = vec2(
        fbm(uv * 2.5 + 3.5 * q + vec2(1.7, 9.2) + 0.10 * t),
        fbm(uv * 2.5 + 3.5 * q + vec2(8.3, 2.8) + 0.08 * t)
      );
      float f = fbm(uv * 2.0 + 4.0 * r + 0.04 * t);

      /* Arctic palette — all near-white */
      vec3 base     = vec3(0.973, 0.969, 1.000);   /* #f8f7ff */
      vec3 ice      = vec3(0.910, 0.957, 1.000);   /* #e8f4ff */
      vec3 lavender = vec3(0.929, 0.910, 1.000);   /* #ece8ff */
      vec3 crystal  = vec3(0.949, 0.980, 0.988);   /* #f2fafc */
      vec3 warm     = vec3(1.000, 0.973, 0.957);   /* #fff8f4 */

      /* Blend driven by noise — max shift from white ≈ 9 % */
      vec3 col = base;
      col = mix(col, ice,      clamp(f * 1.4,              0.0, 0.50));
      col = mix(col, lavender, clamp(length(q) * 0.8,      0.0, 0.40));
      col = mix(col, crystal,  clamp(r.x * 0.9,            0.0, 0.35));
      col = mix(col, warm,     clamp((1.0 - f) * 0.5,      0.0, 0.25));

      /* Floating shimmer streak — horizontal wisp */
      float streak = sin(uv.x * 6.28 + t * 0.7 + r.y * 3.0) * 0.5 + 0.5;
      float band   = exp(-12.0 * pow(uv.y - 0.42 - 0.06 * sin(t + uv.x * 4.0), 2.0));
      col += lavender * streak * band * 0.06;

      /* Very soft radial vignette — barely visible on white */
      float vign = length(uv - 0.5);
      col -= 0.04 * vign;

      /* Clamp safely */
      col = clamp(col, 0.0, 1.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ── Compile helpers ─────────────────────────────────────────────────── */
  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[WebGL] Shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compileShader(gl.VERTEX_SHADER,   VS);
  const fs = compileShader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[WebGL] Link error:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  /* Full-screen quad */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1,  -1,1,
    -1, 1,  1,-1,   1,1,
  ]), gl.STATIC_DRAW);

  const aPos  = gl.getAttribLocation(prog,  'a_pos');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes  = gl.getUniformLocation(prog, 'u_resolution');

  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  /* Resize */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = canvas.offsetWidth  * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  /* Render loop */
  const t0 = performance.now();
  let raf;

  function render() {
    const elapsed = (performance.now() - t0) / 1000;
    gl.uniform1f(uTime, elapsed);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    raf = requestAnimationFrame(render);
  }

  render();

  /* Pause when tab hidden */
  document.addEventListener('visibilitychange', () => {
    document.hidden ? cancelAnimationFrame(raf) : render();
  });
})();
