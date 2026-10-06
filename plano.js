/* Plano de estudos: progresso do dia, lista por matéria e atrasados.
   Também guarda peças usadas pela Agenda e pelo Início. */

const ctxAgora = () => Motor.ctx(Dados.t, hojeISO());

/* ---------- peças compartilhadas ---------- */
function donut(pct, texto) {
  const r = 52, circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct || 0));
  const meio = texto != null ? texto : Math.round(p * 100) + '%';
  return `<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="${esc(meio)} concluído">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="#E9DDFB" stroke-width="16"/>
    ${p > 0 ? `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${p >= 1 ? 'var(--ok)' : 'var(--azul)'}" stroke-width="16" stroke-linecap="round"
      stroke-dasharray="${(circ * p).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 70 70)"/>` : ''}
    <text x="70" y="79" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="30" fill="#18265A">${esc(meio)}</text></svg>`;
}

/* Um item do plano (uma matéria em um dia) */
function htmlItem(c, iso, it, opt = {}) {
  const m = c.porId[it.materia_id];
  const futuro = iso > c.hoje;
  const pct = Math.round(it.pct * 100);
  const concluido = it.feito || it.pct >= 1;
  const marcado = opt.selecionados && opt.selecionados.has(iso + '|' + it.materia_id);
  const restante = Math.max(5, Math.round(it.minutos - it.estudado));
  return `<li class="item-plano ${concluido ? 'feito' : ''}">
    ${opt.selecionavel ? `<label class="sel"><input type="checkbox" data-sel="${esc(iso + '|' + it.materia_id)}" ${marcado ? 'checked' : ''} ${iso < c.hoje ? 'disabled' : ''}>
      <span class="sr">Enviar ${esc(m.nome)} para a Agenda Google</span></label>` : ''}
    <span class="pto" style="background:${esc(m.cor || '#b071ea')}"></span>
    <div class="corpo">
      <div class="linha1"><strong>${esc(m.nome)}</strong>${it.origens.map(o => `<span class="selo origem-${o}">${ROTULO_ORIGEM[o]}</span>`).join('')}</div>
      <div class="linha2">${opt.horario && it.inicio ? `${esc(it.inicio)}–${esc(it.fim)} · ` : ''}${fmtMin(it.minutos)} planejados · ${fmtMin(it.estudado)} estudados${it.evento ? ' <span class="selo neutro">Na agenda</span>' : ''}</div>
      <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progresso de ${esc(m.nome)}"><i style="width:${pct}%"></i></div>
      ${it.detalhes && it.detalhes.length ? `<small class="detalhes">${it.detalhes.map(esc).join(' · ')}</small>` : ''}
    </div>
    <div class="acoes">
      <button class="btn btn-claro btn-p" data-acao="estudar" data-m="${esc(it.materia_id)}" data-min="${restante}" ${futuro ? 'disabled' : ''}>▶ Estudar</button>
      <button class="btn btn-p ${concluido ? 'btn-ok' : 'btn-claro'}" data-acao="feito" data-d="${esc(iso)}" data-m="${esc(it.materia_id)}" ${futuro ? 'disabled' : ''}
        aria-pressed="${concluido}">${concluido ? '✓ Feito' : 'Marcar feito'}</button>
      ${opt.agenda && it.evento ? `<button class="link-btn" data-acao="tirar-agenda" data-d="${esc(iso)}" data-m="${esc(it.materia_id)}">Tirar da agenda</button>` : ''}
    </div>
  </li>`;
}

/* Trata os botões de um item. Devolve true se tratou. */
function tratarAcaoItem(el, depois) {
  const { acao, d, m } = el.dataset;
  if (acao === 'feito') { alternarFeito(d, m).then(depois); return true; }
  if (acao === 'estudar') { irCronometro(m, Number(el.dataset.min) || 25); return true; }
  if (acao === 'tempo') { formTempo(d, m, depois); return true; }
  return false;
}

function irCronometro(mid, min) {
  localStorage.setItem('ce_cron_pre', JSON.stringify({ mid, min }));
  if (location.hash === '#/cronometro') rotear(); else location.hash = '#/cronometro';
}

const Feito = { pendente: new Set() };

/* Marcar / desmarcar "estudei". Marcar soma o que faltava aos registros de hoje (origem "check:DATA"). */
async function alternarFeito(iso, mid) {
  const chave = iso + '|' + mid;
  if (Feito.pendente.has(chave)) return;
  Feito.pendente.add(chave);
  try {
    const c = ctxAgora();
    const it = Motor.resumoDia(c, iso).itens.find(i => i.materia_id === mid);
    if (!it) return;
    const row = Motor.linhaPlano(c, iso, mid);
    if (it.feito) {
      const checks = Dados.t.Registros.filter(r => r.materia_id === mid && r.origem === 'check:' + iso);
      await Promise.all(checks.map(r => Dados.excluir('Registros', r.id)));
      if (row) await Dados.salvar('Plano', { id: row.id, concluido: 'NAO' });
    } else {
      const falta = Math.max(0, it.minutos - it.estudado);
      if (falta > 0) await Dados.salvar('Registros', { data: c.hoje, materia_id: mid, minutos: falta, origem: 'check:' + iso });
      if (row) await Dados.salvar('Plano', { id: row.id, concluido: 'SIM' });
      else await Dados.salvar('Plano', { data: iso, materia_id: mid, origem: it.origens.join('+'), minutos_planejados: it.minutos, concluido: 'SIM' });
    }
  } catch (e) {
    tratarErro(e);
  } finally {
    Feito.pendente.delete(chave);
  }
}

/* Registrar tempo estudado à mão */
function formTempo(iso, mid, depois) {
  const c = ctxAgora();
  const mats = c.ativas.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  if (!mats.length) { Toast.mostrar('Cadastre as matérias primeiro.', 'erro'); return; }
  Dialogo.form({
    titulo: 'Registrar tempo estudado',
    campos: [
      { id: 'materia_id', rotulo: 'Matéria', tipo: 'select', valor: mid || mats[0].id, obrigatorio: true, opcoes: mats.map(m => ({ valor: m.id, rotulo: m.nome })) },
      { id: 'data', rotulo: 'Dia', tipo: 'date', valor: iso && iso <= c.hoje ? iso : c.hoje, obrigatorio: true },
      { id: 'minutos', rotulo: 'Quantos minutos?', tipo: 'number', passo: '1', obrigatorio: true }
    ],
    onSalvar: async (v) => {
      if (v.minutos <= 0 || v.minutos > 720) throw new Error('Informe um tempo entre 1 e 720 minutos.');
      if (v.data > hojeISO()) throw new Error('Não dá para registrar estudo em um dia que ainda não chegou.');
      await Dados.salvar('Registros', { data: v.data, materia_id: v.materia_id, minutos: v.minutos, origem: 'manual' });
      Toast.mostrar('Tempo registrado.');
      if (depois) depois();
    }
  });
}

/* ---------- tela ---------- */
const Pl = { $tela: null, data: null, aba: 'hoje', periodo: 'quinze' };

async function viewPlano($tela) {
  await Dados.carregar(TABELAS_MOTOR, () => renderPlano());
  if (rotaAtual !== 'plano') return;
  Pl.$tela = $tela;
  Pl.data = hojeISO();
  Pl.aba = 'hoje';
  $tela.onclick = cliquePlano;
  renderPlano();
}
VIEWS.plano = viewPlano;

function humorDoDia(c, iso, r) {
  if (r.pct != null && r.pct >= 1) return 'padrao';
  if (r.estudadoTotal > 0) return 'estudando';
  if (r.itens.length && iso < c.hoje) return 'chateado';
  return 'padrao';
}

function renderPlano() {
  if (rotaAtual !== 'plano') return;
  const c = ctxAgora();
  if (!c.ano) {
    Pl.$tela.innerHTML = `<header><h1>Plano de estudos</h1></header><section class="painel em-breve">${Mascote.html('padrao', '')}
      <h2>Falta cadastrar o ano letivo</h2><p>O plano nasce das suas matérias e dos dias de aula.</p><a class="btn" href="#/ano">Ir para Ano letivo</a></section>`;
    return;
  }
  const nAtr = Motor.atrasados(c, addDias(c.hoje, -14), addDias(c.hoje, -1)).length;
  Pl.$tela.innerHTML = `
  <header><h1>Plano de estudos</h1><p>O que estudar, quanto já foi feito e o que ficou para trás.</p></header>
  <div class="abas" role="tablist">
    <button role="tab" aria-selected="${Pl.aba === 'hoje'}" data-aba="hoje">Dia</button>
    <button role="tab" aria-selected="${Pl.aba === 'atrasados'}" data-aba="atrasados">Atrasados${nAtr ? ` (${nAtr})` : ''}</button>
  </div>
  ${Pl.aba === 'hoje' ? htmlDia(c) : htmlAtrasados(c)}`;
}

function htmlDia(c) {
  const iso = Pl.data;
  const r = Motor.resumoDia(c, iso);
  const ehHoje = iso === c.hoje;
  const humor = humorDoDia(c, iso, r);
  let titulo, texto;
  if (!r.itens.length) {
    titulo = 'Dia livre';
    texto = r.disponivel > 0 ? 'Nada planejado para este dia.' : 'Não há meta de estudo neste dia. Você pode ajustar em Metas e regras.';
  } else if (r.pct >= 1) {
    titulo = 'Tudo certo!'; texto = 'Você concluiu o plano deste dia.';
  } else {
    titulo = `Faltam ${fmtMin(Math.max(0, r.total - r.feito))}`;
    texto = `Planejado: ${fmtMin(r.total)} · Estudado: ${fmtMin(r.estudadoTotal)}`;
  }
  const noPlano = new Set(r.itens.map(i => i.materia_id));
  const extras = new Map();
  c.registros.filter(x => x.data === iso && !noPlano.has(x.materia_id) && c.porId[x.materia_id]).forEach(x => {
    extras.set(x.materia_id, (extras.get(x.materia_id) || 0) + Motor.N(x.minutos));
  });

  return `
  <div class="nav-dia">
    <button class="btn btn-claro btn-p" data-acao="dia" data-n="-1" aria-label="Dia anterior">‹</button>
    <div><strong>${ehHoje ? 'Hoje · ' : ''}${esc(fmtDataLonga(iso))}</strong></div>
    <button class="btn btn-claro btn-p" data-acao="dia" data-n="1" aria-label="Próximo dia">›</button>
    ${ehHoje ? '' : '<button class="btn btn-claro btn-p" data-acao="hoje">Voltar para hoje</button>'}
  </div>
  <section class="painel resumo-dia">
    <div class="donut-caixa">${donut(r.pct, r.pct == null ? '—' : null)}</div>
    <div class="resumo-texto"><h2>${esc(titulo)}</h2><p class="dica">${esc(texto)}</p>
      ${r.avisos.map(a => `<p class="aviso-leve">${esc(a)}</p>`).join('')}
      <div class="resumo-acoes"><button class="btn btn-claro btn-p" data-acao="registrar">+ Registrar tempo</button></div>
    </div>
    <div class="resumo-mascote">${Mascote.html(humor, '')}</div>
  </section>
  ${r.itens.length ? `<h2 class="subtitulo">O que estudar</h2><ul class="lista-plano">${r.itens.map(it => htmlItem(c, iso, it)).join('')}</ul>` : ''}
  ${extras.size ? `<h2 class="subtitulo">Estudos extras</h2><div class="painel"><div class="chips">${[...extras].map(([id, min]) =>
    `<span class="chip"><i style="background:${esc(c.porId[id].cor || '#b071ea')}"></i>${esc(c.porId[id].nome)} · ${fmtMin(min)}</span>`).join('')}</div></div>` : ''}`;
}

function htmlAtrasados(c) {
  let de = c.inicioPlano || c.hoje;
  if (Pl.periodo === 'quinze') de = addDias(c.hoje, -14);
  if (Pl.periodo === 'semana') de = inicioSemana(c.hoje);
  if (Pl.periodo === 'mes') de = c.hoje.slice(0, 8) + '01';
  const lista = Motor.atrasados(c, de, addDias(c.hoje, -1));
  const falta = lista.reduce((s, i) => s + i.falta, 0);
  const porDia = new Map();
  lista.forEach(i => { if (!porDia.has(i.data)) porDia.set(i.data, []); porDia.get(i.data).push(i); });
  const chip = (v, r) => `<button data-acao="periodo" data-v="${v}" aria-pressed="${Pl.periodo === v}">${r}</button>`;

  return `
  <div class="filtros" role="group" aria-label="Período">${chip('quinze', 'Últimos 14 dias')}${chip('semana', 'Esta semana')}${chip('mes', 'Este mês')}${chip('tudo', 'Desde o início')}</div>
  <section class="painel resumo-dia" style="margin-top:16px">
    <div class="resumo-texto"><h2>${lista.length ? `${lista.length} ${lista.length === 1 ? 'item atrasado' : 'itens atrasados'}` : 'Nada atrasado!'}</h2>
      <p class="dica">${lista.length ? `Ficaram ${fmtMin(falta)} de estudo para trás. Dá para marcar como feito ou estudar agora.` : 'Você está em dia com o cronograma neste período.'}</p></div>
    <div class="resumo-mascote">${Mascote.html(lista.length >= 15 ? 'bravo' : lista.length ? 'chateado' : 'padrao', '')}</div>
  </section>
  ${[...porDia].sort((a, b) => b[0].localeCompare(a[0])).map(([d, itens]) => `
    <h2 class="subtitulo">${esc(fmtDataLonga(d))}</h2>
    <ul class="lista-plano">${itens.map(it => htmlItem(c, d, it)).join('')}</ul>`).join('')}`;
}

function cliquePlano(ev) {
  const el = ev.target.closest('[data-acao],[data-aba]');
  if (!el || el.disabled) return;
  if (el.dataset.aba) { Pl.aba = el.dataset.aba; renderPlano(); return; }
  if (tratarAcaoItem(el, renderPlano)) return;
  switch (el.dataset.acao) {
    case 'dia':      Pl.data = addDias(Pl.data, Number(el.dataset.n)); return renderPlano();
    case 'hoje':     Pl.data = hojeISO(); return renderPlano();
    case 'periodo':  Pl.periodo = el.dataset.v; return renderPlano();
    case 'registrar': return formTempo(Pl.data, '', renderPlano);
  }
}
