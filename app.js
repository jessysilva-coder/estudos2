/* Controle Estudantil — Etapa 1: login, estrutura do app e tela inicial */

const $raiz = document.getElementById('raiz');

/* ---------- utilidades ---------- */
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';

/* ---------- mascote ---------- */
const ROTULO_MASCOTE = { padrao: 'Padrão', estudando: 'Estudando', chateado: 'Chateado', bravo: 'Com raiva' };

const Mascote = {
  html(estado, alt) {
    const src = window.APP_CONFIG.MASCOTE[estado] || window.APP_CONFIG.MASCOTE.padrao;
    return `<img class="mascote" src="${esc(src)}" alt="${esc(alt || 'Mascote')}" data-estado="${esc(estado)}" onerror="Mascote.provisorio(this)">`;
  },
  /* Desenho provisório, usado enquanto a imagem real não estiver em img/ */
  provisorio(img) {
    const e = img.dataset.estado;
    const rosto = {
      padrao:    '<path d="M72 128 Q100 154 128 128" />',
      estudando: '<circle cx="72" cy="94" r="17"/><circle cx="128" cy="94" r="17"/><path d="M89 94 H111"/><path d="M76 132 Q100 150 124 132" />',
      chateado:  '<path d="M72 148 Q100 122 128 148" /><path d="M64 70 L88 78 M136 70 L112 78" stroke-width="4"/>',
      bravo:     '<path d="M56 72 L90 88 M144 72 L110 88" stroke-width="7"/><path d="M78 142 H122" />'
    }[e] || '';
    const lagrima = e === 'chateado' ? '<path d="M128 108 q8 12 0 18 q-8 -6 0 -18z" fill="#9fdbfc" stroke="none"/>' : '';
    const faceCor = e === 'bravo' ? '#E6A1C8' : '#b071ea';
    img.outerHTML = `<svg class="mascote-provisorio" viewBox="0 0 200 200" role="img" aria-label="Mascote (${esc(ROTULO_MASCOTE[e] || '')})">
      <circle cx="100" cy="104" r="78" fill="${faceCor}" stroke="#18265A" stroke-width="5"/>
      <g fill="#18265A" stroke="none"><circle cx="72" cy="94" r="8"/><circle cx="128" cy="94" r="8"/></g>
      <g fill="none" stroke="#18265A" stroke-width="5" stroke-linecap="round">${rosto}</g>${lagrima}
    </svg>`;
  }
};
window.Mascote = Mascote;

/* ---------- rotas ---------- */
const ROTAS = [
  { id: 'inicio',       nome: 'Início',          ico: '🏠' },
  { id: 'plano',        nome: 'Plano de estudos', ico: '📋' },
  { id: 'agenda',       nome: 'Agenda',          ico: '🗓️' },
  { id: 'cronometro',   nome: 'Cronômetro',      ico: '⏱️' },
  { id: 'provas',       nome: 'Provas',          ico: '📝' },
  { id: 'trabalhos',    nome: 'Trabalhos',       ico: '📎' },
  { id: 'notas',        nome: 'Notas',           ico: '🏅' },
  { id: 'metas',        nome: 'Metas e regras',  ico: '🎯' },
  { id: 'estatisticas', nome: 'Estatísticas',    ico: '📊' },
  { id: 'ano',          nome: 'Ano letivo',      ico: '📚' },
  { id: 'config',       nome: 'Configurações',   ico: '⚙️' }
];

let rotaAtual = null;

/* Cada tela é uma função que recebe o elemento #tela e devolve o HTML (ou desenha sozinha).
   Cada arquivo de tela registra a sua aqui (VIEWS.nome = função). */
const VIEWS = {};

function sessaoExpirada() {
  Sessao.limpar();
  mostrarLogin('Sua sessão expirou. Entre de novo.');
}

/* ---------- login ---------- */
function mostrarLogin(mensagem) {
  rotaAtual = null;
  Dados.limpar();                       // nunca deixa dados de um aluno na memória para o próximo
  $raiz.innerHTML = `
  <main class="login">
    <section class="login-lado" aria-hidden="true">
      <div class="login-lado-conteudo">
        ${Mascote.html('padrao', '')}
        <h1>Estudar um pouquinho a cada dia</h1>
        <p>Seu cronograma, suas provas, seus trabalhos e suas notas em um só lugar.</p>
      </div>
    </section>
    <section class="login-form-area">
      <form class="login-form" id="form-login" novalidate>
        <div>
          <h2>Entrar</h2>
        </div>
        <p class="sub">Use o e-mail e a senha que a escola ou a sua família cadastrou.</p>
        <div class="aviso-erro" id="erro-login" role="alert" ${mensagem ? '' : 'hidden'}>${esc(mensagem || '')}</div>
        <div class="campo">
          <label for="email">E-mail</label>
          <div class="entrada"><input id="email" type="email" autocomplete="username" inputmode="email" required></div>
        </div>
        <div class="campo">
          <label for="senha">Senha</label>
          <div class="entrada">
            <input id="senha" type="password" autocomplete="current-password" required>
            <button type="button" class="ver" id="ver-senha" aria-label="Mostrar senha">Mostrar</button>
          </div>
        </div>
        <button class="btn" id="btn-entrar" type="submit">Entrar</button>
        <p class="login-ajuda">Esqueceu a senha? Peça para quem fez o seu cadastro.</p>
      </form>
    </section>
  </main>`;

  const $erro = document.getElementById('erro-login');
  const $senha = document.getElementById('senha');
  document.getElementById('ver-senha').addEventListener('click', (ev) => {
    const mostrando = $senha.type === 'text';
    $senha.type = mostrando ? 'password' : 'text';
    ev.target.textContent = mostrando ? 'Mostrar' : 'Ocultar';
    ev.target.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
  });

  document.getElementById('form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = $senha.value;
    const $btn = document.getElementById('btn-entrar');
    $erro.hidden = true;
    if (!email || !senha) {
      $erro.textContent = 'Preencha o e-mail e a senha.';
      $erro.hidden = false;
      return;
    }
    $btn.disabled = true; $btn.textContent = 'Entrando...';
    try {
      const r = await Api.login(email, senha);
      Sessao.salvar(r.token, r.usuario);
      iniciarApp();
    } catch (err) {
      $erro.textContent = err.message;
      $erro.hidden = false;
      $btn.disabled = false; $btn.textContent = 'Entrar';
    }
  });
}

function sair() {
  Sessao.limpar();
  mostrarLogin();
}

/* ---------- estrutura do app ---------- */
function iniciarApp() {
  const u = Sessao.usuario();
  if (!u) { mostrarLogin(); return; }

  $raiz.innerHTML = `
  <div class="app">
    <aside class="lateral">
      <div class="marca">${Mascote.html('padrao', '')}<strong>${esc(window.APP_CONFIG.NOME_APP)}</strong></div>
      <nav class="nav" aria-label="Principal">
        ${ROTAS.map(r => `<a href="#/${r.id}" data-rota="${r.id}"><span class="ico" aria-hidden="true">${r.ico}</span>${esc(r.nome)}</a>`).join('')}
      </nav>
      <div class="lateral-rodape">
        <div class="quem">${esc(primeiroNome(u.nome))}<small>${esc(u.email)}</small></div>
        <button type="button" id="btn-sair">Sair</button>
      </div>
    </aside>
    <main class="conteudo" id="conteudo" tabindex="-1">
      <div class="topo-mobile"><span>${esc(primeiroNome(u.nome))}</span><button type="button" id="btn-sair-m">Sair</button></div>
      <div id="tela"></div>
    </main>
  </div>`;
  document.getElementById('btn-sair').addEventListener('click', sair);
  document.getElementById('btn-sair-m').addEventListener('click', sair);
  if (typeof atualizarIndicadorCron === 'function') atualizarIndicadorCron();
  // carrega tudo em segundo plano já na entrada: depois disso, trocar de tela é instantâneo
  Dados.carregar(TABELAS_TUDO).catch(() => { /* cada tela mostra o erro, se precisar */ });
  if (!location.hash) location.hash = '#/inicio';
  rotear();
}

async function rotear() {
  if (!Sessao.token()) return;
  const id = (location.hash.replace(/^#\/?/, '') || 'inicio');
  const rota = ROTAS.find(r => r.id === id) || ROTAS[0];
  rotaAtual = rota.id;
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.dataset.rota === rota.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const $tela = document.getElementById('tela');
  if (!$tela) return;
  document.title = rota.nome + ' · ' + window.APP_CONFIG.NOME_APP;
  window.scrollTo(0, 0);

  $tela.onclick = null; $tela.onchange = null;
  const view = VIEWS[rota.id];
  if (!view) { $tela.innerHTML = viewEmBreve(rota); return; }
  $tela.innerHTML = carregando();
  try {
    const html = await view($tela);
    if (rotaAtual === rota.id && typeof html === 'string') $tela.innerHTML = html;
  } catch (err) {
    if (err.message === 'SESSAO_INVALIDA') { sessaoExpirada(); return; }
    if (rotaAtual === rota.id) {
      $tela.innerHTML = `<div class="painel"><h2>Não foi possível carregar</h2>
        <p class="dica">${esc(err.message)}</p>
        <button class="btn" onclick="rotear()">Tentar de novo</button></div>`;
    }
  }
}
window.addEventListener('hashchange', rotear);

const carregando = () => `<div class="carregando">${Mascote.html('estudando', '')}<span>Carregando...</span></div>`;

function viewEmBreve(rota) {
  return `<header><h1>${esc(rota.nome)}</h1></header>
  <section class="painel em-breve">
    ${Mascote.html('estudando', '')}
    <h2>Esta área ainda não está disponível</h2>
    <p>${esc(rota.texto || '')}</p>
  </section>`;
}

/* ---------- partida ----------
   Só começa depois que TODOS os arquivos .js foram lidos (DOMContentLoaded). Se começasse antes,
   a resposta do servidor podia chegar antes de as telas se registrarem em VIEWS. */
async function boot() {
  if (!Api.configurada()) {
    mostrarLogin('O endereço do Apps Script ainda não foi colocado em config.js.');
    return;
  }
  if (!Sessao.token()) { mostrarLogin(); return; }
  $raiz.innerHTML = carregando();
  try {
    const r = await Api.me();
    Sessao.atualizarUsuario(r.usuario);
    if (typeof Aj !== 'undefined') Aj.conta = r.conta_agenda || '';
    iniciarApp();
  } catch (err) {
    Sessao.limpar();
    mostrarLogin(err.message === 'SESSAO_INVALIDA' ? '' : err.message);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
