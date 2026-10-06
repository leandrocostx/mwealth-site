/* =========================================================
   M Wealth — movimentos e interações
   Segue as "Notas de movimento" do Figma. Tudo respeita
   "reduzir movimento" do sistema.
   ========================================================= */
(function () {
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const celular = window.matchMedia('(max-width: 860px)');
  const mouseFino = window.matchMedia('(hover: hover) and (pointer: fine)');
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

  /* ---------- rolagem suave (Lenis) ---------- */
  let lenis = null;
  if (!reduzir && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, anchors: { offset: -90 } });
    const rodar = (t) => { lenis.raf(t); requestAnimationFrame(rodar); };
    requestAnimationFrame(rodar);
  }

  /* tarefas que acompanham a rolagem, num único laço */
  const aoRolar = [];
  let agendado = false;
  const executar = () => { agendado = false; aoRolar.forEach(f => f()); };
  const pedir = () => { if (!agendado) { agendado = true; requestAnimationFrame(executar); } };
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);

  /* ---------- cabeçalho: vira vidro ao rolar e fica sempre visível ---------- */
  const cabecalho = $('[data-cabecalho]');
  aoRolar.push(() => { if (cabecalho) cabecalho.classList.toggle('rolado', window.scrollY > 10); });

  /* ---------- menu do celular ---------- */
  const botaoMenu = $('[data-abrir-menu]');
  const menu = $('[data-menu]');
  const textoMenu = botaoMenu && $('.cabecalho__menu-texto', botaoMenu);
  function alternarMenu(abrir) {
    document.body.classList.toggle('menu-aberto', abrir);
    botaoMenu.setAttribute('aria-expanded', String(abrir));
    textoMenu.textContent = abrir ? 'Fechar' : 'Menu';
    menu.inert = !abrir;
    if (lenis) abrir ? lenis.stop() : lenis.start();
  }
  if (botaoMenu && menu) {
    menu.hidden = false;
    menu.inert = true;
    botaoMenu.addEventListener('click', () => alternarMenu(!document.body.classList.contains('menu-aberto')));
    $$('a', menu).forEach(a => a.addEventListener('click', () => alternarMenu(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-aberto')) alternarMenu(false); });
    window.matchMedia('(min-width: 1181px)').addEventListener('change', e => { if (e.matches) alternarMenu(false); });
  }

  /* ---------- quebra frases em palavras (para revelar/acender) ---------- */
  function separarPalavras(el) {
    const palavras = [];
    const andar = (no) => {
      [...no.childNodes].forEach(filho => {
        if (filho.nodeType === 3) {
          const partes = filho.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          partes.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const s = document.createElement('span');
            s.className = 'palavra';
            s.textContent = p;
            palavras.push(s);
            frag.appendChild(s);
          });
          filho.replaceWith(frag);
        } else if (filho.nodeType === 1) {
          andar(filho);
        }
      });
    };
    andar(el);
    return palavras;
  }

  // frase que se revela por palavras (Abordagem)
  $$('[data-palavras]').forEach(el => {
    separarPalavras(el).forEach((p, i) => { p.style.transitionDelay = `${i * 60}ms`; });
  });

  // manifesto que "acende" palavra por palavra com a rolagem (do cinza para o marinho)
  $$('[data-manifesto]').forEach(el => {
    if (reduzir) return;
    const suave = $('.suave', el);
    if (!suave) return;
    const palavras = separarPalavras(suave).filter(p => p.offsetParent !== null || !p.closest('.so-celular-inline, .so-desktop-inline'));
    aoRolar.push(() => {
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      const progresso = limitar((vh * 0.85 - r.top) / (r.height + vh * 0.35));
      const acesas = Math.round(progresso * palavras.length);
      palavras.forEach((p, i) => { p.style.color = i < acesas ? 'var(--marinho)' : ''; });
    });
  });

  /* ---------- mapa: pontos acendem em onda a partir dos escritórios ---------- */
  $$('[data-mapa]').forEach(mapa => {
    const escritorios = $$('.mapa__marco', mapa).map(m => m.transform.baseVal.consolidate().matrix);
    $$('.mapa__pontos circle', mapa).forEach(ponto => {
      const x = ponto.cx.baseVal.value, y = ponto.cy.baseVal.value;
      const distancia = Math.min(...escritorios.map(e => Math.hypot(x - e.e, y - e.f)));
      ponto.style.transitionDelay = Math.round(distancia * 1.3) + 'ms';
    });

    /* lanterna: um círculo de luz segue o mouse; perto de um escritório fica bege e maior */
    const svg = $('svg', mapa), foco = $('.mapa__luz-foco', mapa);
    if (!foco) return;
    const RAIO = 170, RAIO_ESCRITORIO = 250, PERTO = 70;   // unidades do viewBox
    const atual = { x: 0, y: 0, r: 0 }, alvo = { x: 0, y: 0, r: 0 };
    let rodando = false;
    const animar = () => {
      const k = reduzir ? 1 : 0.18;
      for (const c of ['x', 'y', 'r']) atual[c] += (alvo[c] - atual[c]) * k;
      foco.setAttribute('cx', atual.x.toFixed(1));
      foco.setAttribute('cy', atual.y.toFixed(1));
      foco.setAttribute('r', Math.max(0, atual.r).toFixed(1));
      rodando = Math.abs(alvo.x - atual.x) + Math.abs(alvo.y - atual.y) + Math.abs(alvo.r - atual.r) > 0.5;
      if (rodando) requestAnimationFrame(animar);
    };
    const iluminar = () => { if (!rodando) { rodando = true; requestAnimationFrame(animar); } };
    mapa.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
      const perto = escritorios.some(m => Math.hypot(p.x - m.e, p.y - m.f) < PERTO);
      if (!mapa.classList.contains('mapa--lanterna')) Object.assign(atual, { x: p.x, y: p.y });
      mapa.classList.add('mapa--lanterna');
      mapa.classList.toggle('mapa--dourado', perto);
      Object.assign(alvo, { x: p.x, y: p.y, r: perto ? RAIO_ESCRITORIO : RAIO });
      iluminar();
    });
    mapa.addEventListener('pointerleave', () => {
      mapa.classList.remove('mapa--lanterna', 'mapa--dourado');
      alvo.r = 0;
      iluminar();
    });
  });

  /* ---------- revelar ao entrar na tela ---------- */
  $$('[data-sequencia]').forEach(lista => [...lista.children].forEach((filho, i) => filho.style.setProperty('--i', i)));
  const alvos = $$('[data-revelar], [data-sequencia], [data-palavras], .mascara:not(.mascara--entrada), [data-zoom], [data-mapa], [data-coord]');
  if (reduzir || !('IntersectionObserver' in window)) {
    alvos.forEach(el => el.classList.add('visivel'));
  } else {
    const obs = new IntersectionObserver(entradas => entradas.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visivel'); obs.unobserve(e.target); }
    }), { rootMargin: '0px 0px -12% 0px' });
    alvos.forEach(el => obs.observe(el));
  }

  /* ---------- números contam de 0 até o valor ---------- */
  const contadores = $$('[data-contar]');
  if (!reduzir && contadores.length) {
    const contar = (el) => {
      const fim = +el.dataset.contar, inicio = +(el.dataset.contarDe || 0), sufixo = el.dataset.contarSufixo || '';
      const duracao = 1600, t0 = performance.now();
      const passo = (agora) => {
        const p = limitar((agora - t0) / duracao);
        const suav = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(inicio + (fim - inicio) * suav) + sufixo;
        if (p < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    };
    const obsNum = new IntersectionObserver(entradas => entradas.forEach(e => {
      if (e.isIntersecting) { contar(e.target); obsNum.unobserve(e.target); }
    }), { threshold: 0.6 });
    contadores.forEach(el => {
      el.textContent = (el.dataset.contarDe || 0) + (el.dataset.contarSufixo || '');
      obsNum.observe(el);
    });
  }

  /* ---------- soluções: o hover abre como "prévia"; o clique fixa ----------
     - passar o mouse abre a linha (uma por vez);
     - clicar fixa a linha: ao tirar o mouse da lista, ela volta a ficar aberta;
     - clicar de novo na linha fixada solta (e ela fecha);
     - no celular (sem hover), o toque abre e fecha. */
  $$('[data-acordeao]').forEach(acordeao => {
    const itens = $$('[data-item]', acordeao);
    const temHover = () => mouseFino.matches && !celular.matches;
    let fixado = itens.find(i => i.classList.contains('aberto')) || null;  // a que vem aberta no Figma começa fixada
    let clicou = false;                                                       // o anel de "fixado" só aparece depois de um clique
    const abrir = (item) => itens.forEach(i => {
      const aberto = i === item;
      i.classList.toggle('aberto', aberto);
      i.classList.toggle('fixado', clicou && aberto && i === fixado);
      $('.item-solucao__cabeca', i).setAttribute('aria-expanded', String(aberto));
    });
    abrir(fixado);
    // Abrir uma linha muda a altura da lista e "move" as linhas debaixo do mouse parado.
    // Para não entrar em loop, só reage a movimento real do mouse e espera a animação
    // (450ms) terminar antes de trocar de novo.
    let ultimoX = null, ultimoY = null, travadoAte = 0;
    acordeao.addEventListener('mousemove', e => {
      if (!temHover()) return;
      if (e.clientX === ultimoX && e.clientY === ultimoY) return;   // evento falso gerado pela mudança de layout
      ultimoX = e.clientX; ultimoY = e.clientY;
      const item = e.target.closest('[data-item]');
      if (!item || item.classList.contains('aberto') || performance.now() < travadoAte) return;
      abrir(item);
      travadoAte = performance.now() + 500;
    });
    itens.forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        clicou = true;
        fixado = fixado === item ? null : item;
        abrir(fixado);
      });
    });
    acordeao.addEventListener('mouseleave', e => {
      if (!temHover() || !fixado) return;
      if (e.clientX === ultimoX && e.clientY === ultimoY) return;   // a lista encolheu sob o mouse parado: não conta como saída
      abrir(fixado);
      travadoAte = performance.now() + 500;
    });
  });

  /* ---------- processo: a linha se preenche com a rolagem e acende cada etapa ---------- */
  $$('[data-etapas]').forEach(lista => {
    const etapas = $$('.etapa', lista);
    if (reduzir) { etapas.forEach(e => { e.classList.add('acesa'); e.style.setProperty('--p', 1); }); return; }
    aoRolar.push(() => {
      const vh = window.innerHeight;
      if (celular.matches) {
        etapas.forEach(e => {
          const r = e.getBoundingClientRect();
          const p = limitar((vh * 0.85 - r.top) / (vh * 0.35));
          e.style.setProperty('--p', p);
          e.classList.toggle('acesa', p > 0);
        });
      } else {
        const r = lista.getBoundingClientRect();
        const total = limitar((vh * 0.8 - r.top) / (vh * 0.5)) * etapas.length;
        etapas.forEach((e, i) => {
          e.style.setProperty('--p', limitar(total - i));
          e.classList.toggle('acesa', total > i);
        });
      }
    });
  });

  /* ---------- parallax lento nas texturas ---------- */
  $$('[data-parallax]').forEach(el => {
    if (reduzir) return;
    const fator = +el.dataset.parallax;
    const secao = el.parentElement;
    aoRolar.push(() => {
      const r = secao.getBoundingClientRect();
      const centro = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${-centro * fator}px, 0)`;
    });
  });

  /* ---------- botão "magnético" ---------- */
  $$('[data-magnetico]').forEach(botao => {
    if (reduzir) return;
    const area = botao.parentElement;
    area.addEventListener('pointermove', e => {
      if (!mouseFino.matches) return;
      const r = botao.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.abs(dx) > r.width || Math.abs(dy) > r.height * 1.6) { botao.style.transform = ''; return; }
      botao.style.transform = `translate(${dx * 0.22}px, ${dy * 0.32}px)`;
    });
    area.addEventListener('pointerleave', () => { botao.style.transform = ''; });
  });

  /* ---------- diagrama de coordenação (Estrutura): as pills giram bem devagar, no sentido horário, em volta do logo ---------- */
  $$('[data-coord]').forEach(coord => {
    const pills = $$('.coord__area', coord), tablet = window.matchMedia('(max-width: 1100px)');
    const angulos = pills.map(p => +p.dataset.angulo * Math.PI / 180);
    pills.forEach((p, i) => p.style.setProperty('--i', i));
    const volta = 160; // segundos por volta completa
    let giro = 0, anterior = performance.now(), visivel = false;
    const posicionar = () => {
      const w = coord.clientWidth, h = coord.clientHeight;
      // raios da volta testados para as pills não se encostarem em nenhum ponto do giro
      const [fx, fy] = celular.matches ? [0.33, 0.40] : tablet.matches ? [0.32, 0.38] : [0.31, 0.36];
      const maiorL = Math.max(...pills.map(p => p.offsetWidth)), maiorA = Math.max(...pills.map(p => p.offsetHeight));
      const rx = Math.min(w * fx, (w - maiorL) / 2 - 2), ry = Math.min(h * fy, (h - maiorA) / 2 - 2);   // nunca sai da área
      pills.forEach((p, i) => {
        const a = angulos[i] + giro;   // ângulo crescendo = sentido horário na tela
        const x = w / 2 + Math.cos(a) * rx, y = h / 2 + Math.sin(a) * ry;
        p.style.transform = `translate(${(x - p.offsetWidth / 2).toFixed(1)}px, ${(y - p.offsetHeight / 2).toFixed(1)}px)`;
      });
    };
    const laco = (agora) => {
      const dt = Math.min((agora - anterior) / 1000, 0.1); anterior = agora;
      giro += (dt / volta) * Math.PI * 2;
      posicionar();
      if (visivel) requestAnimationFrame(laco);
    };
    posicionar();
    new ResizeObserver(posicionar).observe(coord);
    if (reduzir) return;
    new IntersectionObserver(([e]) => {
      const estava = visivel; visivel = e.isIntersecting;
      if (visivel && !estava) { anterior = performance.now(); requestAnimationFrame(laco); }
    }).observe(coord);
  });

  /* ---------- blog: filtro por categoria e "carregar mais" ---------- */
  $$('[data-filtros]').forEach(filtros => {
    const botoes = $$('[data-filtro]', filtros);
    const cards = $$('[data-categoria]', document.querySelector('[data-lista-posts]'));
    const total = $('[data-total]', filtros);
    botoes.forEach(b => b.addEventListener('click', () => {
      const cat = b.dataset.filtro;
      botoes.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      let n = 0;
      cards.forEach(c => {
        const mostra = cat === 'Todos' || c.dataset.categoria === cat;
        c.hidden = !mostra;
        if (mostra) n++;
      });
      if (total) total.textContent = `${n} ${n === 1 ? 'conteúdo' : 'conteúdos'}`;
    }));
  });
  $$('[data-carregar-mais]').forEach(b => b.addEventListener('click', () => {
    $('.grade-posts').classList.add('mostrar-todos');
    b.remove();
  }));

  /* ---------- copiar link do post ---------- */
  $$('[data-copiar-link]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); } catch (e) { return; }
    const original = b.textContent;
    b.textContent = 'Link copiado';
    setTimeout(() => { b.textContent = original; }, 2000);
  }));
  $$('[data-compartilhar]').forEach(a => {
    const url = encodeURIComponent(location.href);
    a.href = a.dataset.compartilhar === 'linkedin'
      ? `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
      : `https://wa.me/?text=${encodeURIComponent(document.title + ' ')}${url}`;
  });

  /* ---------- voltar ao topo ---------- */
  $$('[data-topo]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    lenis ? lenis.scrollTo(0) : window.scrollTo({ top: 0, behavior: reduzir ? 'auto' : 'smooth' });
  }));

  executar();
})();
