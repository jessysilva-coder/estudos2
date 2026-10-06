/* Cronômetro de estudo: escolhe a matéria e a meta de tempo, dá o play e, ao parar, atribui o tempo à matéria. */

const Cr = { $tela: null, timer: null };
const CHAVE_CRON = 'ce_cron';

const lerCron = () => { try { return JSON.parse(localStorage.getItem(CHAVE_CRON)); } catch (e) { return null; } };
function gravarCron(s) {
  if (s) localStorage.setItem(CHAVE_CRON, JSON.stringify(s)); else localStorage.removeItem(CHAVE_CRON);
  atualizarIndicadorCron();
}
const segundosCron = (s) => (s.acumulado || 0) + (s.inicio ? (Date.now() - s.inicio) / 1000 : 0);

/* pontinho no menu quando há um cronômetro rodando */
function atualizarIndicadorCron() {
  const a = document.querySelector('.nav a[data-rota="cronometro"]');
  if (!a) return;
  const s = lerCron();
  a.classList.toggle('rodando', !!(s && s.inicio));
}

function fmtRelogio(seg) {
  seg = Math.max(0, Math.floor(seg));
  const h = Math.floor(seg / 3600), m = Math.floor(seg % 3600 / 60), s = seg % 60;
  return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
const fmtDuracao = (seg) => {
  seg = Math.round(seg);
  const m = Math.floor(seg / 60), s = seg % 60;
  return m ? `${m} min${s ? ` ${s} s` : ''}` : `${s} s`;
};

function bip() {
  try {
    const A = window.AudioContext || window.webkitAudioContext;
    const a = new A(), o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.frequency.value = 880; g.gain.value = 0.15;
    o.start();
    setTimeout(() => { o.stop(); a.close(); }, 400);
  } catch (e) { /* sem som, tudo bem */ }
}

async function viewCronometro($tela) {
  await Dados.carregar(TABELAS_MOTOR);
  if (rotaAtual !== 'cronometro') return;
  Cr.$tela = $tela;
  let pre = null;
  try { pre = JSON.parse(localStorage.getItem('ce_cron_pre')); } catch (e) { /* ignora */ }
  localStorage.removeItem('ce_cron_pre');
  Cr.pre = pre;
  $tela.onclick = cliqueCron;
  renderCron();
  clearInterval(Cr.timer);
  Cr.timer = setInterval(tickCron, 500);
}
VIEWS.cronometro = viewCronometro;

function anelCron(p) {
  const r = 70, circ = 2 * Math.PI * r;
  return `<svg class="anel-cron" viewBox="0 0 180 180" aria-hidden="true">
    <circle cx="90" cy="90" r="${r}" fill="none" stroke="#E9DDFB" stroke-width="14"/>
    <circle id="cr-anel" cx="90" cy="90" r="${r}" fill="none" stroke="var(--azul)" stroke-width="14" stroke-linecap="round"
      stroke-dasharray="${(circ * p).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 90 90)" data-circ="${circ.toFixed(1)}"/></svg>`;
}

function renderCron() {
  if (rotaAtual !== 'cronometro') return;
  const c = ctxAgora();
  if (!c.ano || !c.ativas.length) {
    Cr.$tela.innerHTML = `<header><h1>Cronômetro</h1></header><section class="painel em-breve">${Mascote.html('padrao', '')}
      <h2>Cadastre as matérias primeiro</h2><p>O cronômetro soma o tempo na matéria que você escolher.</p><a class="btn" href="#/ano">Ir para Ano letivo</a></section>`;
    return;
  }
  const s = lerCron();
  const hoje = c.hoje;
  const registros = c.registros.filter(r => r.data === hoje && c.porId[r.materia_id])
    .sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
  const totalHoje = registros.reduce((t, r) => t + Motor.N(r.minutos), 0);
  const ROTULO = (o) => String(o).startsWith('check') ? 'Marcado como feito' : o === 'cronometro' ? 'Cronômetro' : 'Registrado à mão';

  let topo;
  if (!s) {
    const plano = Motor.resumoDia(c, hoje);
    const pendente = plano.itens.find(i => i.pct < 1);
    const mid = (Cr.pre && c.porId[Cr.pre.mid] && Cr.pre.mid) || (pendente && pendente.materia_id) || c.ativas[0].id;
    const itemMid = plano.itens.find(i => i.materia_id === mid);
    const meta = (Cr.pre && Cr.pre.min) || (itemMid ? Math.max(5, Math.round(itemMid.minutos - itemMid.estudado)) : 25);
    const mats = c.ativas.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    topo = `
    <section class="painel cron-setup">
      <div class="cron-mascote">${Mascote.html('padrao', '')}</div>
      <div class="cron-campos">
        <h2>O que vamos estudar?</h2>
        <div class="campo"><label for="cr-mat">Matéria</label><div class="entrada"><select id="cr-mat">${mats.map(m =>
          `<option value="${esc(m.id)}" ${m.id === mid ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></div></div>
        <div class="campo"><label for="cr-meta">Quanto tempo você vai estudar? (minutos)</label>
          <div class="entrada"><input id="cr-meta" type="number" min="1" max="600" step="1" value="${meta}"></div></div>
        <div class="filtros">${[15, 25, 30, 45, 60].map(n => `<button data-acao="preset" data-v="${n}">${n} min</button>`).join('')}</div>
        <button class="btn" data-acao="comecar">▶ Começar</button>
      </div>
    </section>`;
  } else {
    const m = c.porId[s.mid];
    const seg = segundosCron(s);
    const p = s.meta ? Math.min(1, seg / (s.meta * 60)) : 0;
    const rodando = !!s.inicio;
    topo = `
    <section class="painel cron-rodando">
      <div class="cron-nome"><span class="pto" style="background:${esc(m ? m.cor : '#b071ea')}"></span><strong>${esc(m ? m.nome : 'Matéria')}</strong>
        <span class="selo neutro">${rodando ? 'Estudando' : 'Em pausa'}</span></div>
      <div class="cron-relogio">
        ${anelCron(p)}
        <div class="cron-centro"><div id="cr-tempo" class="cron-tempo">${fmtRelogio(seg)}</div><small id="cr-meta-txt">de ${fmtMin(s.meta || 0)}</small></div>
      </div>
      <div class="cron-mascote pequeno">${Mascote.html(rodando ? 'estudando' : 'padrao', '')}</div>
      <div class="cron-botoes">
        ${rodando ? '<button class="btn btn-claro" data-acao="pausar">⏸ Pausar</button>' : '<button class="btn" data-acao="continuar">▶ Continuar</button>'}
        <button class="btn" data-acao="parar">⏹ Parar e salvar</button>
        <button class="link-btn" data-acao="descartar">Descartar</button>
      </div>
    </section>`;
  }

  Cr.$tela.innerHTML = `
  <header><h1>Cronômetro</h1><p>Dê o play, estude, e o tempo vai direto para a matéria.</p></header>
  ${topo}
  <section class="painel" style="margin-top:20px">
    <div class="painel-topo"><h2>Estudado hoje: ${fmtMin(totalHoje)}</h2><button class="btn btn-claro btn-p" data-acao="manual">+ Registrar tempo</button></div>
    ${registros.length ? `<div class="lista">${registros.map(r => `
      <div class="lista-linha"><span class="pto" style="background:${esc(c.porId[r.materia_id].cor || '#b071ea')}"></span>
        <div class="corpo"><strong>${esc(c.porId[r.materia_id].nome)}</strong><small>${ROTULO(r.origem)}</small></div>
        <strong>${fmtMin(Motor.N(r.minutos))}</strong>
        ${String(r.origem).startsWith('check') ? '' : `<button class="btn btn-claro btn-p" data-acao="apagar-reg" data-id="${esc(r.id)}" aria-label="Apagar este registro">Apagar</button>`}
      </div>`).join('')}</div>` : '<p class="vazio">Nada registrado hoje ainda.</p>'}
  </section>`;
}

function tickCron() {
  if (rotaAtual !== 'cronometro') { clearInterval(Cr.timer); return; }
  const s = lerCron();
  const el = document.getElementById('cr-tempo');
  if (!s || !el) return;
  const seg = segundosCron(s);
  el.textContent = fmtRelogio(seg);
  const anel = document.getElementById('cr-anel');
  if (anel && s.meta) {
    const circ = Number(anel.dataset.circ);
    anel.setAttribute('stroke-dasharray', `${(circ * Math.min(1, seg / (s.meta * 60))).toFixed(1)} ${circ}`);
  }
  if (s.inicio && s.meta && !s.avisado && seg >= s.meta * 60) {
    s.avisado = true;
    gravarCron(s);
    Toast.mostrar('Chegou no tempo que você planejou. Parabéns!');
    bip();
  }
}

function cliqueCron(ev) {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.disabled) return;
  const s = lerCron();
  switch (el.dataset.acao) {
    case 'preset': { const i = document.getElementById('cr-meta'); if (i) i.value = el.dataset.v; return; }
    case 'comecar': {
      const mid = document.getElementById('cr-mat').value;
      const meta = Number(document.getElementById('cr-meta').value);
      if (!(meta >= 1 && meta <= 600)) { Toast.mostrar('Escolha um tempo entre 1 e 600 minutos.', 'erro'); return; }
      gravarCron({ mid, meta, acumulado: 0, inicio: Date.now(), avisado: false });
      return renderCron();
    }
    case 'pausar':     s.acumulado = segundosCron(s); s.inicio = null; gravarCron(s); return renderCron();
    case 'continuar':  s.inicio = Date.now(); gravarCron(s); return renderCron();
    case 'parar':      return pararCron();
    case 'descartar':  return descartarCron();
    case 'manual':     return formTempo(hojeISO(), '', renderCron);
    case 'apagar-reg': return apagarRegistro(el.dataset.id);
  }
}

async function descartarCron() {
  const ok = await Dialogo.confirmar({ titulo: 'Descartar este tempo?', texto: 'O que o cronômetro contou não será salvo em nenhuma matéria.', ok: 'Descartar', perigo: true });
  if (ok) { gravarCron(null); renderCron(); }
}

async function apagarRegistro(id) {
  const ok = await Dialogo.confirmar({ titulo: 'Apagar este registro?', texto: 'O tempo sai da sua conta de horas estudadas.', ok: 'Apagar', perigo: true });
  if (!ok) return;
  try { await Dados.excluir('Registros', id); } catch (e) { tratarErro(e); }
  renderCron();
}

/* Parar: pausa e pergunta a qual matéria atribuir o tempo (já vem a matéria escolhida e o tempo integral) */
function pararCron() {
  const s = lerCron();
  if (!s) return;
  s.acumulado = segundosCron(s); s.inicio = null;
  gravarCron(s);
  renderCron();
  const seg = s.acumulado;
  if (seg < 30) {
    Dialogo.confirmar({ titulo: 'Tempo muito curto', texto: 'O cronômetro marcou menos de 30 segundos. Quer descartar?', ok: 'Descartar', perigo: true })
      .then(ok => { if (ok) { gravarCron(null); renderCron(); } });
    return;
  }
  const c = ctxAgora();
  const mats = c.ativas.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  Dialogo.form({
    titulo: 'Atribuir o tempo estudado',
    ok: 'Atribuir tempo',
    campos: [
      { id: 'materia_id', rotulo: 'Para qual matéria?', tipo: 'select', valor: c.porId[s.mid] ? s.mid : mats[0].id, obrigatorio: true,
        opcoes: mats.map(m => ({ valor: m.id, rotulo: m.nome })) },
      { id: 'minutos', rotulo: 'Tempo (minutos)', tipo: 'number', passo: '0.1', valor: Math.round(seg / 6) / 10, obrigatorio: true,
        ajuda: `O cronômetro marcou ${fmtDuracao(seg)}. Você pode ajustar se precisar.` }
    ],
    onSalvar: async (v) => {
      if (v.minutos <= 0 || v.minutos > 720) throw new Error('Informe um tempo entre 0,1 e 720 minutos.');
      await Dados.salvar('Registros', { data: hojeISO(), materia_id: v.materia_id, minutos: v.minutos, origem: 'cronometro' });
      gravarCron(null);
      const c2 = ctxAgora();
      const item = Motor.resumoDia(c2, c2.hoje).itens.find(i => i.materia_id === v.materia_id);
      const resta = item ? Math.max(0, item.minutos - item.estudado) : 0;
      Toast.mostrar(`${fmtMin(v.minutos)} em ${c2.porId[v.materia_id].nome}.` + (item ? (resta > 0 ? ` Faltam ${fmtMin(resta)} do plano de hoje.` : ' Plano de hoje dessa matéria concluído!') : ''));
      renderCron();
    }
  });
}
