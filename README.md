# M Wealth — protótipo do novo site

Protótipo em HTML/CSS/JS (fase 5) do redesign do site da M Wealth, feito a partir do Figma
[M-WEALTH](https://www.figma.com/design/Iqj2NDYaUN4gi9WNeiIuVA/M-WEALTH) para o cliente aprovar antes do WordPress.

Sem framework e sem dependências: só Node para montar as páginas.

## Rodar no computador

```bash
npm run dev      # monta e abre em http://localhost:3000 (refaz a cada alteração)
npm run build    # só monta a pasta dist/
```

## Onde mexer

| O quê | Onde |
|---|---|
| Textos e estrutura de cada página | `src/paginas/` (`index.html` = Home; `blog/filosofia-de-alocacao.html` = post) |
| Cabeçalho, rodapé, chamada final e blocos repetidos | `src/partes/` (mudou aqui, muda em todas as páginas) |
| Cores, fontes, espaçamentos, celular | `css/estilo.css` (tokens no topo, celular até 860px) |
| Animações e interações | `js/principal.js` |
| Onda do hero (WebGL) | `js/onda.js` (valores aprovados: velocidade 92, intensidade 65, parallax 30%) |
| Mapa-múndi (SVG) | `src/partes/mapa.html` (arcos, marcadores, etiquetas) e `src/partes/mapa-pontos.html` (um `<circle>` por ponto) |
| Imagens, logos, ícones | `assets/` |

Nas páginas, `<!-- @parte nome chave="valor" -->` insere `src/partes/nome.html` trocando `{{chave}}` pelo valor.
Isso vira `get_template_part()` no tema WordPress.

## Publicação

Cada push na `main` publica na Vercel (projeto pessoal). O protótipo está com `noindex`
para não aparecer no Google enquanto não for o site oficial.
