// Monta o site estático em dist/ a partir de src/.
// Sem dependências: só Node.
//
//   node build.mjs          → gera dist/
//   node build.mjs --dev    → gera, serve em http://localhost:3000 e refaz a cada alteração
//
// Nas páginas (src/paginas), use:
//   <!-- @parte nome chave="valor" -->   insere src/partes/nome.html
// Dentro das partes, {{chave}} é trocado pelo valor passado.
// Links com data-nav="x" ganham aria-current="page" quando a página
// declara <!-- @pagina ativo="x" -->.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, existsSync, watch } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const SRC = join(raiz, 'src');
const DIST = join(raiz, 'dist');
const ESTATICOS = ['assets', 'css', 'js'];

const lerAtributos = (texto = '') =>
  Object.fromEntries([...texto.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

function montarParte(nome, valores) {
  const arquivo = join(SRC, 'partes', `${nome}.html`);
  if (!existsSync(arquivo)) throw new Error(`Parte não encontrada: ${nome}`);
  let html = readFileSync(arquivo, 'utf8');
  html = html.replace(/<!--\s*@parte\s+([\w-]+)([^>]*?)-->/g, (_, n, a) => montarParte(n, { ...valores, ...lerAtributos(a) }));
  return html.replace(/\{\{([\w-]+)\}\}/g, (_, chave) => valores[chave] ?? '');
}

function montarPagina(arquivo) {
  let html = readFileSync(arquivo, 'utf8');
  const pagina = lerAtributos((html.match(/<!--\s*@pagina([^>]*?)-->/) || [])[1]);
  html = html.replace(/<!--\s*@pagina[^>]*?-->\n?/, '');
  html = html.replace(/<!--\s*@parte\s+([\w-]+)([^>]*?)-->/g, (_, nome, atributos) =>
    montarParte(nome, { ...pagina, ...lerAtributos(atributos) }));
  if (pagina.ativo) {
    html = html.replace(new RegExp(`data-nav="${pagina.ativo}"`, 'g'), `data-nav="${pagina.ativo}" aria-current="page"`);
  }
  return html;
}

function listarHtml(pasta) {
  return readdirSync(pasta).flatMap(nome => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return listarHtml(caminho);
    return extname(nome) === '.html' ? [caminho] : [];
  });
}

function construir() {
  const inicio = Date.now();
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  const paginas = join(SRC, 'paginas');
  for (const arquivo of listarHtml(paginas)) {
    const destino = join(DIST, relative(paginas, arquivo));
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, montarPagina(arquivo));
  }
  for (const pasta of ESTATICOS) cpSync(join(raiz, pasta), join(DIST, pasta), { recursive: true });
  console.log(`✓ dist/ gerado em ${Date.now() - inicio} ms`);
}

construir();

if (process.argv.includes('--dev')) {
  const tipos = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.pdf': 'application/pdf', '.ico': 'image/x-icon',
  };
  // mesmas regras de URL da Vercel (cleanUrls): /estrutura → estrutura.html
  createServer((req, res) => {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let arquivo = join(DIST, caminho);
    if (caminho.endsWith('/')) arquivo = join(arquivo, 'index.html');
    else if (!extname(caminho)) arquivo += '.html';
    if (!existsSync(arquivo)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': tipos[extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(arquivo));
  }).listen(3000, () => console.log('→ http://localhost:3000'));

  let agendado;
  for (const pasta of ['src', ...ESTATICOS]) {
    watch(join(raiz, pasta), { recursive: true }, () => {
      clearTimeout(agendado);
      agendado = setTimeout(() => { try { construir(); } catch (e) { console.error(e.message); } }, 120);
    });
  }
}
