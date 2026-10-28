/* Homepage data field: a few thousand glowing points drawn with WebGL behind
   the whole page, telling the story of a model learning as you scroll.

     0  hero         three t-SNE clusters (the opening plays a mixed blob
                     separating into them, driven by js/hero-motion.js)
     1  statement    the points flow into a neural network: layers of nodes
                     joined by streams of points
     2  stats        the network dissolves into a predicted-vs-actual scatter
                     plot with its fitted line and axes
     3  projects     the points settle into a slow, dim wave behind the cards

   Every shape is computed once (per screen shape) into its own buffer, and the
   vertex shader blends between them on the GPU, so scrolling costs no
   JavaScript per point. Each point changes shape a little earlier or later
   than its neighbours and arcs on the way, so the morphs read as a flow rather
   than a slide. The mouse pushes points aside, and fast scrolling stirs them.

   js/scroll-story.js reports how far each stage has progressed (setStage), and
   hero-motion.js animates state.fade and state.intro for the opening.

   Plain WebGL 1 with no library. Not started for reduced motion or without
   WebGL; the page then keeps its SVG constellation. Fewer points on small or
   low-power screens, pixel density capped at 2. */

(() => {
  const inactive = { active: false };
  window.dataField = inactive;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap || !document.querySelector('.hero')) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'data-field';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false });
  if (!gl) return;

  /* ------------------------------------------------------------ shaders */

  const VERT = `
    attribute vec2 aBlob, aClus, aNet, aReg, aWave;
    attribute vec3 aColor;
    attribute vec4 aRand; // x: timing offset, y: size, zw: arc direction
    uniform float uIntro, uFade, uMorph, uTime, uPush, uStir, uDpr, uAspect;
    uniform vec2 uMouse;
    varying vec3 vColor;
    varying float vAlpha;

    // How far this point is through the change into stage k, with its own
    // small timing offset so neighbours do not all move in lockstep.
    float stage(float k) {
      return smoothstep(0.0, 1.0, clamp((uMorph - k) * 1.5 - aRand.x * 0.5, 0.0, 1.0));
    }

    void main() {
      float s1 = stage(0.0);
      float s2 = stage(1.0);
      float s3 = stage(2.0);

      vec2 p = mix(aBlob, aClus, uIntro);
      p = mix(p, aNet, s1);
      p = mix(p, aReg, s2);
      p = mix(p, aWave, s3);

      // Arc between shapes instead of travelling in straight lines.
      float travel = sin(3.14159 * s1) + sin(3.14159 * s2) + sin(3.14159 * s3)
                   + 0.6 * sin(3.14159 * uIntro);
      p += aRand.zw * travel * 0.18;

      // Idle drift, and the wave keeps rolling.
      p += 0.012 * vec2(sin(uTime * 0.5 + aRand.x * 40.0), cos(uTime * 0.45 + aRand.y * 30.0));
      p.y += s3 * 0.04 * sin(uTime * 1.1 + p.x * 3.0);

      // The mouse pushes nearby points aside.
      vec2 d = p - uMouse;
      float dist = length(d);
      p += (d / max(dist, 0.0001)) * uPush * 0.16 * smoothstep(0.32, 0.0, dist);

      // Fast scrolling stirs the field.
      p += aRand.zw * uStir;

      gl_Position = vec4(p.x / uAspect, p.y, 0.0, 1.0);
      gl_PointSize = (1.6 + aRand.y * 2.6) * uDpr;
      vColor = aColor;
      // The wave sits behind the project cards, so it dims as it forms.
      vAlpha = uFade * (1.0 - 0.55 * s3);
    }
  `;

  const FRAG = `
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * vAlpha;
      gl_FragColor = vec4(vColor * a, a);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.warn('Data field disabled:', err.message);
    return;
  }
  gl.useProgram(program);

  /* ------------------------------------------------------------- points */

  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
  const N = small || lowPower ? 2000 : 4000;

  const COLORS = [
    [0.133, 0.827, 0.933], // cyan    #22D3EE
    [0.655, 0.545, 0.980], // violet  #A78BFA
    [0.984, 0.749, 0.141]  // amber   #FBBF24
  ];

  // Seeded random numbers, so the field looks the same on every visit.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());

  // Per-point constants: colour (its cluster) and the random numbers.
  const cluster = new Uint8Array(N);
  const color = new Float32Array(N * 3);
  const rnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const c = i % 3;
    cluster[i] = c;
    color.set(COLORS[c], i * 3);
    const a = rand() * Math.PI * 2;
    rnd.set([rand(), rand(), Math.cos(a) * (0.4 + rand() * 0.6), Math.sin(a) * (0.4 + rand() * 0.6)], i * 4);
  }

  // The shapes, in a space where y runs from -1 (bottom) to 1 (top) and x from
  // -A to A, A being the screen's width / height.
  function shapes(A) {
    seed = 11;
    const portrait = A < 1;
    const blob = new Float32Array(N * 2);
    const clus = new Float32Array(N * 2);
    const net = new Float32Array(N * 2);
    const reg = new Float32Array(N * 2);
    const wave = new Float32Array(N * 2);

    // Hero: three clusters, kept in the open space around the hero's text:
    // between the text and the photo, around the photo, and below the buttons
    // (on phones: beside the photo, and a thin band along the bottom edge).
    const centres = portrait
      ? [[-0.62 * A, 0.7], [0.62 * A, 0.62], [0.0, -0.97]]
      : [[0.2 * A, 0.32], [0.8 * A, 0.58], [-0.25 * A, -0.58]];
    const spreads = portrait
      ? [[0.16 * A, 0.1], [0.16 * A, 0.1], [0.4 * A, 0.04]]
      : [[0.09 * A, 0.16], [0.1 * A, 0.12], [0.24 * A, 0.1]];

    // Statement: a neural network, beside the text on wide screens and
    // above it on tall ones.
    const box = portrait
      ? { x0: -0.82 * A, x1: 0.82 * A, y0: 0.18, y1: 0.86 }
      : { x0: 0.1 * A, x1: 0.9 * A, y0: -0.72, y1: 0.72 };
    const layers = [4, 6, 6, 3];
    const nodes = layers.map((n, l) => {
      const x = box.x0 + (box.x1 - box.x0) * (l / (layers.length - 1));
      return Array.from({ length: n }, (_, j) => [x, box.y0 + (box.y1 - box.y0) * ((j + 0.5) / n)]);
    });
    const allNodes = nodes.flat();

    // Stats: predicted vs actual, with the fitted line and the two axes.
    const px0 = -0.82 * A, px1 = 0.82 * A, py0 = -0.72, py1 = 0.72;

    for (let i = 0; i < N; i++) {
      const o = i * 2;
      const r = rand();

      blob[o] = gauss() * 0.13;
      blob[o + 1] = gauss() * 0.13;

      if (r < 0.03) { // a few outliers between the clusters
        clus[o] = (rand() * 2 - 1) * A * 0.95;
        clus[o + 1] = rand() * 1.9 - 0.95;
      } else {
        const [cx, cy] = centres[cluster[i]];
        const [sx, sy] = spreads[cluster[i]];
        clus[o] = cx + gauss() * sx;
        clus[o + 1] = cy + gauss() * sy;
      }

      if (rand() < 0.4) { // a node: tight, so overlapping points glow
        const [nx, ny] = allNodes[Math.floor(rand() * allNodes.length)];
        net[o] = nx + gauss() * 0.016;
        net[o + 1] = ny + gauss() * 0.016;
      } else { // a point on the connection between two nodes
        const l = Math.floor(rand() * (layers.length - 1));
        const a = nodes[l][Math.floor(rand() * nodes[l].length)];
        const b = nodes[l + 1][Math.floor(rand() * nodes[l + 1].length)];
        const t = rand();
        net[o] = a[0] + (b[0] - a[0]) * t + gauss() * 0.004;
        net[o + 1] = a[1] + (b[1] - a[1]) * t + gauss() * 0.004;
      }

      const k = rand();
      const x = px0 + (px1 - px0) * rand();
      const fit = py0 + 0.12 + (x - px0) / (px1 - px0) * (py1 - py0 - 0.24);
      if (k < 0.08) { // axes
        if (rand() < 0.5) { reg[o] = px0 + (px1 - px0) * rand(); reg[o + 1] = py0; }
        else { reg[o] = px0; reg[o + 1] = py0 + (py1 - py0) * rand(); }
      } else if (k < 0.3) { // the fitted line
        reg[o] = x;
        reg[o + 1] = fit + gauss() * 0.004;
      } else { // predictions scattered around it
        reg[o] = x;
        reg[o + 1] = fit + gauss() * 0.075;
      }

      // Projects: three rolling bands low on the screen.
      const row = Math.floor(rand() * 3);
      const wx = (rand() * 2 - 1) * A * 1.05;
      wave[o] = wx;
      wave[o + 1] = -0.55 - row * 0.14 + (0.1 - row * 0.02) * Math.sin(wx * 2.2 + row) + gauss() * 0.025;
    }
    return { blob, clus, net, reg, wave };
  }

  /* ----------------------------------------------------------- buffers */

  function attrib(name, data, size) {
    const loc = gl.getAttribLocation(program, name);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return buf;
  }

  const shapeBuffers = {};
  function loadShapes(A) {
    const s = shapes(A);
    [['aBlob', 'blob'], ['aClus', 'clus'], ['aNet', 'net'], ['aReg', 'reg'], ['aWave', 'wave']].forEach(([attr, key]) => {
      if (shapeBuffers[attr]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffers[attr]);
        gl.bufferData(gl.ARRAY_BUFFER, s[key], gl.STATIC_DRAW);
      } else {
        shapeBuffers[attr] = attrib(attr, s[key], 2);
      }
    });
  }
  attrib('aColor', color, 3);
  attrib('aRand', rnd, 4);

  const U = {};
  ['uIntro', 'uFade', 'uMorph', 'uTime', 'uPush', 'uStir', 'uDpr', 'uAspect', 'uMouse']
    .forEach((n) => { U[n] = gl.getUniformLocation(program, n); });

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive: overlapping points glow
  gl.clearColor(0, 0, 0, 0);

  /* ------------------------------------------------------------- sizing */

  let aspect = 1;
  let shapedWidth = 0;
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = w / h;
    // Phones resize the height as the address bar slides; only a real width
    // change (rotation, window resize) recomputes the shapes.
    if (w !== shapedWidth) {
      shapedWidth = w;
      loadShapes(aspect);
    }
  }

  /* -------------------------------------------------------------- state */

  // Animated by hero-motion.js for the opening.
  const state = { fade: 0, intro: 0 };
  // How far each scroll stage has progressed (0 to 1), set by scroll-story.js.
  const stages = [0, 0, 0];
  let morph = 0;
  const mouse = { x: 0, y: 5, push: 0, target: 0 }; // y 5: off screen until the mouse moves
  let stir = 0;

  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse.x = (e.clientX / window.innerWidth * 2 - 1) * aspect;
      mouse.y = -(e.clientY / canvas.clientHeight * 2 - 1);
      mouse.target = 1;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.target = 0; });
    document.documentElement.addEventListener('mouseleave', () => { mouse.target = 0; });
  }

  /* ------------------------------------------------------------- render */

  const start = performance.now();
  function render() {
    const target = stages[0] + stages[1] + stages[2];
    morph += (target - morph) * 0.1;
    mouse.push += (mouse.target - mouse.push) * 0.08;

    // Scroll speed from Lenis (main.js), when it is running.
    const v = typeof lenis !== 'undefined' && lenis ? lenis.velocity : 0;
    stir += (Math.max(-1, Math.min(1, v / 60)) * 0.05 - stir) * 0.1;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uIntro, state.intro);
    gl.uniform1f(U.uFade, state.fade);
    gl.uniform1f(U.uMorph, morph);
    gl.uniform1f(U.uTime, (performance.now() - start) / 1000);
    gl.uniform1f(U.uPush, mouse.push);
    gl.uniform1f(U.uStir, stir);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uAspect, aspect);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.POINTS, 0, N);
  }

  /* --------------------------------------------------------------- boot */

  document.body.prepend(canvas);
  document.documentElement.classList.add('has-field');
  resize();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  gsap.ticker.add(render); // also drives Lenis on this page, so both stay in step

  // If the opening never runs (for example its script failed), show the field anyway.
  setTimeout(() => {
    if (state.fade === 0) { state.fade = 1; state.intro = 1; }
  }, 3500);

  window.dataField = {
    active: true,
    state,
    setStage(i, progress) { stages[i] = Math.max(0, Math.min(1, progress)); }
  };
})();
