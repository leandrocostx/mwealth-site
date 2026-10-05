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

  /* ---------- cabeçalho: sólido ao rolar; some ao descer, volta ao subir ---------- */
  const cabecalho = $('[data-cabecalho]');
  let ultimoY = window.scrollY;
  aoRolar.push(() => {
    if (!cabecalho) return;
    const y = window.scrollY;
    cabecalho.classList.toggle('rolado', y > 10);
    const descendo = y > ultimoY + 4, subindo = y < ultimoY - 4;
    if (descendo && y > 240 && !document.body.classList.contains('menu-aberto')) cabecalho.classList.add('escondido');
    if (subindo || y < 240) cabecalho.classList.remove('escondido');
    if (Math.abs(y - ultimoY) > 4) ultimoY = y;
  });

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

  /* ---------- revelar ao entrar na tela ---------- */
  $$('[data-sequencia]').forEach(lista => [...lista.children].forEach((filho, i) => filho.style.setProperty('--i', i)));
  const alvos = $$('[data-revelar], [data-sequencia], [data-palavras], .mascara:not(.mascara--entrada), [data-zoom], [data-mapa]');
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

  /* ---------- soluções: abre no hover (desktop) ou toque (celular); uma por vez ---------- */
  $$('[data-acordeao]').forEach(acordeao => {
    const itens = $$('[data-item]', acordeao);
    const abrir = (item) => itens.forEach(i => {
      const aberto = i === item;
      i.classList.toggle('aberto', aberto);
      $('.item-solucao__cabeca', i).setAttribute('aria-expanded', String(aberto));
    });
    itens.forEach(item => {
      if (item.classList.contains('aberto')) $('.item-solucao__cabeca', item).setAttribute('aria-expanded', 'true');
      item.addEventListener('mouseenter', () => { if (mouseFino.matches && !celular.matches) abrir(item); });
      item.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        abrir(item.classList.contains('aberto') && celular.matches ? null : item);
      });
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

  /* ---------- diagrama em órbita (Estrutura): os cartões giram devagar ---------- */
  $$('[data-orbita]').forEach(orbita => {
    const cartoes = $$('.orbita__cartao', orbita);
    const angulos = cartoes.map(c => +c.dataset.angulo * Math.PI / 180);
    const volta = 90; // segundos por volta completa
    let giro = 0, anterior = performance.now(), visivel = false;
    const posicionar = () => {
      const w = orbita.clientWidth, h = orbita.clientHeight;
      const m = celular.matches;
      const cx = w * 0.5, cy = h * (m ? 0.442 : 0.5);
      const rx = w * (m ? 0.33 : 0.39), ry = h * (m ? 0.41 : 0.28);
      cartoes.forEach((c, i) => {
        const a = angulos[i] + giro;
        const frente = (Math.sin(a) + 1) / 2;               // 0 = atrás, 1 = na frente
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        const escala = 0.73 + 0.27 * frente;
        c.style.transform = `translate(${x - c.offsetWidth / 2}px, ${y - c.offsetHeight / 2}px) scale(${escala})`;
        c.style.opacity = (0.75 + 0.25 * frente).toFixed(3);
        c.style.zIndex = Math.sin(a) > -0.2 ? 20 : 5;
        c.style.setProperty('--sombra', (0.03 + 0.11 * frente).toFixed(3));
      });
    };
    const laco = (agora) => {
      const dt = Math.min((agora - anterior) / 1000, 0.1); anterior = agora;
      giro += (dt / volta) * Math.PI * 2;
      posicionar();
      if (visivel) requestAnimationFrame(laco);
    };
    posicionar();
    new ResizeObserver(posicionar).observe(orbita);
    if (reduzir) return;
    new IntersectionObserver(([e]) => {
      const estava = visivel; visivel = e.isIntersecting;
      if (visivel && !estava) { anterior = performance.now(); requestAnimationFrame(laco); }
    }).observe(orbita);
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
