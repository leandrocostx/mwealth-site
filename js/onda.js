/* =========================================================
   ONDA ANIMADA (WebGL) — aprovada no teste do hero
   A imagem da onda é desenhada pela placa de vídeo e os pixels
   são deslocados por ondas lentas e contínuas, dando a impressão
   de que as dobras do tecido estão se movendo.
   Valores aprovados: velocidade 92, intensidade 65, parallax 30%
   (só desktop), opacidade 100%. Pausa fora da tela; com "reduzir
   movimento" ou sem WebGL fica a imagem parada.
   ========================================================= */
(function () {
  const ONDA = {
    velocidade: 0.92,      // 92
    intensidade: 0.01625,  // 65 → 0,65 × 0,025
    parallax: 0.30,        // 30%, só desktop
  };

  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)');
  const celular = window.matchMedia('(max-width: 860px)');

  const VERT = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform sampler2D u_img;
    uniform vec2 u_tela;
    uniform vec2 u_imagem;
    uniform float u_t;
    uniform float u_amp;
    varying vec2 v_uv;
    void main() {
      // "cover": preenche sem distorcer, como background-size: cover
      float rt = u_tela.x / u_tela.y, ri = u_imagem.x / u_imagem.y;
      vec2 escala = rt > ri ? vec2(1.0, ri / rt) : vec2(rt / ri, 1.0);
      vec2 uv = (v_uv - 0.5) * escala * 0.94 + 0.5;   // 0.94 = sobra nas bordas para o movimento
      // soma de ondas longas e contínuas (sem emendas)
      float t = u_t;
      float diag = uv.x * 0.8 + uv.y * 1.2;
      vec2 d;
      d.x = 0.50 * sin(diag * 2.2 + t * 0.90)
          + 0.30 * sin(uv.y * 3.7 - t * 0.60 + 1.3)
          + 0.20 * sin((uv.x - uv.y) * 5.1 + t * 0.45 + 2.1);
      d.y = 0.50 * cos(diag * 1.9 - t * 0.70)
          + 0.30 * sin(uv.x * 3.1 + t * 0.50 + 0.7)
          + 0.20 * cos((uv.x + uv.y) * 4.3 - t * 0.40 + 4.0);
      uv += d * u_amp;
      gl_FragColor = texture2D(u_img, clamp(uv, 0.002, 0.998));
    }`;

  // Sem placa de vídeo (WebGL por software: SwiftShader, llvmpipe) cada quadro trava a página
  // por centenas de ms; nesse caso fica a imagem parada, como em "reduzir movimento".
  // O teste usa um canvas fora da página: um contexto criado e abandonado no canvas visível
  // atrasa o primeiro quadro da página.
  function temPlacaDeVideo() {
    const gl = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const nome = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software/i.test(nome);
  }

  function iniciar(caixa) {
    const secao = caixa.parentElement;
    const canvas = caixa.querySelector('canvas');
    ligarParallax(caixa, secao);
    if (reduzir.matches || !canvas) return;

    if (!temPlacaDeVideo()) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) return;

    const compilar = (tipo, fonte) => {
      const s = gl.createShader(tipo); gl.shaderSource(s, fonte); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compilar(gl.VERTEX_SHADER, VERT), fs = compilar(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // um triângulo que cobre a tela toda
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTela = gl.getUniformLocation(prog, 'u_tela');
    const uImagem = gl.getUniformLocation(prog, 'u_imagem');
    const uT = gl.getUniformLocation(prog, 'u_t');
    const uAmp = gl.getUniformLocation(prog, 'u_amp');

    const redimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);   // limite para não pesar em telas retina
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(uTela, w, h);
    };

    let visivel = true, rodando = false, tempo = 0, anterior = 0;
    const quadro = (agora) => {
      const dt = Math.min((agora - anterior) / 1000, 0.1); anterior = agora;
      tempo += dt * ONDA.velocidade;
      gl.uniform1f(uT, tempo);
      gl.uniform1f(uAmp, ONDA.intensidade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (visivel && !document.hidden) requestAnimationFrame(quadro); else rodando = false;
    };
    const iniciarLaco = () => { if (!rodando) { rodando = true; anterior = performance.now(); requestAnimationFrame(quadro); } };

    // textura = a foto que o navegador já escolheu no <picture> (AVIF retrato no celular etc.), sem baixar de novo
    const img = caixa.querySelector('.onda__parada img');
    if (!img) return;
    const usarFoto = () => {
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform2f(uImagem, img.naturalWidth, img.naturalHeight);
      caixa.classList.add('com-webgl');
      redimensionar();
      iniciarLaco();
    };
    if (img.complete && img.naturalWidth) usarFoto(); else img.addEventListener('load', usarFoto, { once: true });

    new ResizeObserver(redimensionar).observe(canvas);
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) iniciarLaco(); }).observe(secao);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && visivel) iniciarLaco(); });
  }

  // parallax: a onda desce numa fração da rolagem (só desktop)
  function ligarParallax(caixa, secao) {
    let agendado = false;
    const atualizar = () => {
      agendado = false;
      if (reduzir.matches || celular.matches) { caixa.style.transform = ''; return; }
      const y = Math.min(window.scrollY, secao.offsetTop + secao.offsetHeight);
      caixa.style.transform = `translate3d(0, ${Math.max(0, y - secao.offsetTop) * ONDA.parallax}px, 0)`;
    };
    window.addEventListener('scroll', () => { if (!agendado) { agendado = true; requestAnimationFrame(atualizar); } }, { passive: true });
    celular.addEventListener('change', atualizar);
  }

  document.querySelectorAll('[data-onda]').forEach(iniciar);
})();
