/* Estatísticas: horas estudadas x meta, notas, mapa de calor do ano e calendário do mascote */

const Es = { $tela: null, aba: 'resumo', periodo: 'semana', de: null, ate: null, ano: null, mes: null };

async function viewEstatisticas($tela) {
  await Dados.carregar(TABELAS_MOTOR, () => renderEst());
  if (rotaAtual !== 'estatisticas') return;
  Es.$tela = $tela;
  const hoje = hojeISO();
  if (!Es.ano) Es.ano = Number(hoje.slice(0, 4));
  if (!Es.mes) Es.mes = hoje.slice(0, 7);
  if (!Es.de) { Es.de = hoje.slice(0, 8) + '01'; Es.ate = hoje; }
  $tela.onclick = cliqueEst;
  renderEst();
}
VIEWS.estatisticas = viewEstatisticas;

const ultimoDiaMes = (iso) => { const [a, m] = iso.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
const somaMapa = (mapa, dias) => dias.reduce((s, d) => s + (mapa.get(d) || 0), 0);

function intervaloPeriodo(c) {
  const h = c.hoje;
  if (Es.periodo === 'semana') return [inicioSemana(h), addDias(inicioSemana(h), 6)];
  if (Es.periodo === 'passada') { const i = addDias(inicioSemana(h), -7); return [i, addDias(i, 6)]; }
  if (Es.periodo === 'mes') return [h.slice(0, 8) + '01', ultimoDiaMes(h)];
  return [Es.de, Es.ate];
}

function renderEst() {
  if (rotaAtual !== 'estatisticas') return;
  const c = ctxAgora();
  if (!c.ano) {
    Es.$tela.innerHTML = `<header><h1>Estatísticas</h1></header><section class="painel em-breve">${Mascote.html('padrao', '')}
      <h2>Falta cadastrar o ano letivo</h2><p>As estatísticas nascem do que você estuda.</p><a class="btn" href="#/ano">Ir para Ano letivo</a></section>`;
    return;
  }
  const abas = [['resumo', 'Resumo'], ['consistencia', 'Consistência do ano'], ['calendario', 'Calendário do mascote']];
  Es.$tela.innerHTML = `
  <header><h1>Estatísticas</h1><p>Quanto você estudou, se bateu a meta e como foi a sua constância.</p></header>
  <div class="abas" role="tablist">${abas.map(([id, n]) => `<button role="tab" aria-selected="${Es.aba === id}" data-aba="${id}">${n}</button>`).join('')}</div>
  ${Es.aba === 'resumo' ? htmlResumo(c) : Es.aba === 'consistencia' ? htmlConsistencia(c) : htmlCalendario(c)}`;
}

/* ---------- gráfico de barras com linha da meta (SVG) ---------- */
function graficoBarras(pontos) {
  const W = 720, H = 280, mL = 48, mR = 12, mT = 14, mB = 44;
  const iw = W - mL - mR, ih = H - mT - mB;
  const maxV = Math.max(30, ...pontos.map(p => Math.max(p.valor, p.meta || 0)));
  // topo "redondo": as 4 marcas do eixo ficam em números inteiros (ex.: 1h, 2h, 3h, 4h)
  const topo = [40, 80, 120, 160, 240, 320, 400, 480, 640, 800, 960, 1200].find(v => v >= maxV) || Math.ceil(maxV / 240) * 240;
  const y = (v) => mT + ih - (v / topo) * ih;
  const bw = iw / pontos.length;
  const rotEixo = (v) => (v >= 60 ? `${Math.round(v / 6) / 10}h`.replace('.', ',') : `${Math.round(v)}min`);
  const passo = Math.ceil(pontos.length / 14);

  const grade = [0, 1, 2, 3, 4].map(i => {
    const v = topo * i / 4;
    return `<line x1="${mL}" x2="${W - mR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#DDE6F7" stroke-width="1"/>
      <text x="${mL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#56628F">${rotEixo(v)}</text>`;
  }).join('');
  const barras = pontos.map((p, i) => {
    if (p.futuro || p.valor <= 0) return '';
    const x = mL + i * bw + bw * 0.16, w = bw * 0.68, top = y(p.valor);
    const cor = p.meta > 0 && p.valor >= p.meta ? '#1F9E73' : '#376adf';
    return `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(mT + ih - top).toFixed(1)}" rx="4" fill="${cor}"><title>${esc(p.rot)}: ${fmtMin(p.valor)}${p.meta ? ' (meta ' + fmtMin(p.meta) + ')' : ''}</title></rect>`;
  }).join('');
  const comMeta = pontos.map((p, i) => ({ x: mL + i * bw + bw / 2, y: y(p.meta || 0), t: p.meta > 0 })).filter(q => q.t);
  const linha = comMeta.length ? `<polyline points="${comMeta.map(q => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#b071ea" stroke-width="2.5" stroke-dasharray="6 4" stroke-linejoin="round"/>
    ${comMeta.map(q => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="3.5" fill="#b071ea"/>`).join('')}` : '';
  const rotulos = pontos.map((p, i) => (i % passo === 0
    ? `<text x="${(mL + i * bw + bw / 2).toFixed(1)}" y="${H - 22}" text-anchor="middle" font-size="11" fill="${p.destaque ? '#18265A' : '#56628F'}" font-weight="${p.destaque ? 800 : 500}">${esc(p.rot)}</text>
       ${p.rot2 ? `<text x="${(mL + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#56628F">${esc(p.rot2)}</text>` : ''}` : '')).join('');

  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de horas estudadas por dia, com a linha da meta">${grade}${barras}${linha}${rotulos}</svg>
    <div class="legenda-grafico"><span><i style="background:#376adf"></i>Estudado</span><span><i style="background:#1F9E73"></i>Bateu a meta</span><span><i class="tracejado"></i>Meta do dia</span></div>`;
}

/* ---------- aba Resumo ---------- */
function htmlResumo(c) {
  const [de, ate] = intervaloPeriodo(c);
  const mapa = Motor.minutosPorDia(c);
  const todos = de <= ate && diasEntre(de, ate) <= 400 ? intervaloDias(de, ate) : [];
  const contados = todos.filter(d => d <= c.hoje && (!c.inicioPlano || d >= c.inicioPlano));
  const estudado = somaMapa(mapa, todos);
  const meta = contados.reduce((s, d) => s + Motor.metaDoDia(c, d), 0);
  const pct = meta ? Math.round(estudado / meta * 100) : null;
  const diasMeta = contados.filter(d => Motor.metaDoDia(c, d) > 0);
  const bateu = diasMeta.filter(d => (mapa.get(d) || 0) >= Motor.metaDoDia(c, d)).length;
  const mediaDia = contados.length ? estudado / contados.length : 0;

  let pontos;
  if (todos.length <= 62) {
    pontos = todos.map(d => ({ rot: todos.length > 10 ? d.slice(8) : NOMES_DIA_CURTO[diaSemana(d)], rot2: todos.length > 10 ? '' : d.slice(8) + '/' + d.slice(5, 7),
      valor: mapa.get(d) || 0, meta: Motor.metaDoDia(c, d), futuro: d > c.hoje, destaque: d === c.hoje }));
  } else {
    const semanas = new Map();
    todos.forEach(d => { const s = inicioSemana(d); if (!semanas.has(s)) semanas.set(s, []); semanas.get(s).push(d); });
    pontos = [...semanas].map(([s, ds]) => ({ rot: fmtDataCurta(s), valor: somaMapa(mapa, ds), meta: ds.reduce((t, d) => t + Motor.metaDoDia(c, d), 0), futuro: s > c.hoje }));
  }

  const porMateria = [...Motor.minutosPorMateria(c, de, ate)].filter(([id]) => c.porId[id]).sort((a, b) => b[1] - a[1]);
  const maxMat = porMateria.length ? porMateria[0][1] : 1;

  const avals = [];
  c.provas.forEach(p => { if (p.nota !== '' && p.nota != null && p.data >= de && p.data <= ate) avals.push({ mid: p.materia_id, titulo: `Prova ${String(p.tipo).toLowerCase()}`, data: p.data, nota: p.nota, max: p.nota_max }); });
  c.trabalhos.forEach(t => { if (t.nota !== '' && t.nota != null && t.data_entrega >= de && t.data_entrega <= ate) avals.push({ mid: t.materia_id, titulo: t.titulo, data: t.data_entrega, nota: t.nota, max: t.nota_max }); });
  c.notas.forEach(n => { const d = String(n.criado_em || ''); if (n.nota !== '' && n.nota != null && d >= de && d <= ate) avals.push({ mid: n.materia_id, titulo: n.descricao || n.tipo || 'Nota', data: d, nota: n.nota, max: n.nota_max }); });
  avals.sort((a, b) => b.data.localeCompare(a.data));
  const acima = avals.filter(a => Motor.acimaDoMinimo(c, a.mid, a.nota, a.max)).length;

  const chip = (v, r) => `<button data-acao="periodo" data-v="${v}" aria-pressed="${Es.periodo === v}">${r}</button>`;
  return `
  <div class="filtros" role="group" aria-label="Período">${chip('semana', 'Esta semana')}${chip('passada', 'Semana passada')}${chip('mes', 'Este mês')}${chip('custom', 'Escolher datas')}</div>
  ${Es.periodo === 'custom' ? `<div class="periodo-custom"><div class="campo"><label for="es-de">De</label><div class="entrada"><input id="es-de" type="date" value="${esc(Es.de)}"></div></div>
    <div class="campo"><label for="es-ate">Até</label><div class="entrada"><input id="es-ate" type="date" value="${esc(Es.ate)}"></div></div>
    <button class="btn btn-p" data-acao="aplicar">Ver</button></div>` : ''}
  <p class="dica" style="margin:12px 0 16px">${esc(fmtDataCurta(de))}/${esc(de.slice(0, 4))} a ${esc(fmtDataCurta(ate))}/${esc(ate.slice(0, 4))}</p>

  <div class="cartoes-numeros">
    <div class="numero"><small>Total estudado</small><strong>${fmtMin(estudado)}</strong></div>
    <div class="numero"><small>Meta até hoje</small><strong>${meta ? fmtMin(meta) : '—'}</strong></div>
    <div class="numero"><small>Meta atingida</small><strong>${pct === null ? '—' : pct + '%'}</strong>
      ${pct === null ? '' : pct >= 100 ? '<span class="selo ok">Acima da meta</span>' : '<span class="selo alerta">Abaixo da meta</span>'}</div>
    <div class="numero"><small>Média por dia</small><strong>${fmtMin(mediaDia)}</strong>${diasMeta.length ? `<span class="dica">${bateu} de ${diasMeta.length} dias com meta batida</span>` : ''}</div>
  </div>

  <section class="painel" style="margin-top:18px"><h2>Tempo de estudo por dia</h2>
    ${todos.length ? graficoBarras(pontos) : '<p class="vazio">Escolha um período válido.</p>'}</section>

  <div class="duas-colunas" style="margin-top:18px">
    <section class="painel"><h2>Por matéria</h2>
      ${porMateria.length ? `<div class="barras-h">${porMateria.map(([id, min]) => `
        <div class="barra-h"><span class="nome"><i style="background:${esc(c.porId[id].cor || '#b071ea')}"></i>${esc(c.porId[id].nome)}</span>
          <span class="trilha"><b style="width:${Math.max(3, min / maxMat * 100)}%;background:${esc(c.porId[id].cor || '#376adf')}"></b></span><span class="val">${fmtMin(min)}</span></div>`).join('')}</div>`
        : '<p class="vazio" style="margin-top:8px">Nenhum estudo registrado neste período.</p>'}</section>
    <section class="painel"><h2>Notas do período</h2>
      ${avals.length ? `<p class="dica" style="margin:4px 0 10px">${acima} de ${avals.length} ${avals.length === 1 ? 'nota acima' : 'notas acima'} do mínimo.</p>
        <div class="lista">${avals.map(a => `<div class="lista-linha"><span class="pto" style="background:${esc(c.porId[a.mid].cor || '#b071ea')}"></span>
          <div class="corpo"><strong>${esc(a.titulo)}</strong><small>${esc(c.porId[a.mid].nome)} · ${esc(fmtDataCurta(a.data))}</small></div>
          <strong>${fmtNum(a.nota)}<span class="de"> de ${fmtNum(Motor.N(a.max, 10) || 10)}</span></strong>
          ${Motor.acimaDoMinimo(c, a.mid, a.nota, a.max) ? '<span class="selo ok">Acima</span>' : '<span class="selo alerta">Abaixo</span>'}</div>`).join('')}</div>`
        : '<p class="vazio" style="margin-top:8px">Nenhuma nota neste período.</p>'}</section>
  </div>`;
}

/* ---------- aba Consistência do ano (mapa de calor) ---------- */
function htmlConsistencia(c) {
  const ano = Es.ano;
  const jan1 = `${ano}-01-01`, dez31 = `${ano}-12-31`;
  const mapa = Motor.minutosPorDia(c);
  const inicioGrade = inicioSemana(jan1);
  const semanas = Math.ceil((diasEntre(inicioGrade, dez31) + 1) / 7);
  const nivel = (est, meta) => {
    if (est <= 0) return 0;
    const r = est / (meta > 0 ? meta : 60);
    return r < 0.34 ? 1 : r < 0.67 ? 2 : r < 1 ? 3 : 4;
  };

  let celulas = '', meses = '';
  for (let w = 0; w < semanas; w++) {
    for (let d = 1; d <= 7; d++) {
      const iso = addDias(inicioGrade, w * 7 + d - 1);
      if (iso < jan1 || iso > dez31) continue;
      const est = mapa.get(iso) || 0, meta = Motor.metaDoDia(c, iso);
      const fut = iso > c.hoje;
      celulas += `<i class="h ${fut ? 'fut' : 'l' + nivel(est, meta)} ${iso === c.hoje ? 'hoje' : ''}" style="grid-column:${w + 2};grid-row:${d + 1}"
        title="${esc(fmtDataCurta(iso))}: ${fut ? 'ainda não chegou' : fmtMin(est) + (meta ? ' (meta ' + fmtMin(meta) + ')' : '')}"></i>`;
    }
    const primeiroDoMes = intervaloDias(addDias(inicioGrade, w * 7), addDias(inicioGrade, w * 7 + 6)).find(x => x.slice(8) === '01' && x >= jan1 && x <= dez31);
    if (primeiroDoMes) meses += `<span class="mes-rot" style="grid-column:${w + 2};grid-row:1">${NOMES_MES[Number(primeiroDoMes.slice(5, 7)) - 1].slice(0, 3)}</span>`;
  }
  const estudado = somaMapa(mapa, intervaloDias(jan1, dez31));
  const desde = c.inicioPlano && c.inicioPlano > jan1 ? c.inicioPlano : jan1;
  const fimMeta = c.hoje < dez31 ? c.hoje : dez31;
  const metaAcum = desde <= fimMeta ? intervaloDias(desde, fimMeta).reduce((t, d) => t + Motor.metaDoDia(c, d), 0) : 0;
  const seq = Motor.sequencias(c);
  const pct = metaAcum ? Math.round(estudado / metaAcum * 100) : null;

  return `
  <div class="nav-dia"><button class="btn btn-claro btn-p" data-acao="ano" data-n="-1" aria-label="Ano anterior">‹</button>
    <div><strong>${ano}</strong></div><button class="btn btn-claro btn-p" data-acao="ano" data-n="1" aria-label="Próximo ano">›</button></div>
  <div class="cartoes-numeros">
    <div class="numero"><small>Horas estudadas no ano</small><strong>${fmtMin(estudado)}</strong></div>
    <div class="numero"><small>Meta acumulada</small><strong>${metaAcum ? fmtMin(metaAcum) : '—'}</strong></div>
    <div class="numero"><small>Meta atingida</small><strong>${pct === null ? '—' : pct + '%'}</strong></div>
    <div class="numero"><small>Sequência de dias</small><strong>${seq.atual}</strong><span class="dica">maior: ${seq.maior}</span></div>
  </div>
  <section class="painel" style="margin-top:18px"><h2>Um quadradinho por dia</h2>
    <div class="heat-rolagem"><div class="heat" style="grid-template-columns:28px repeat(${semanas}, 13px)" role="img" aria-label="Mapa de calor de estudo do ano ${ano}">
      ${meses}<span class="dia-rot" style="grid-row:2">Seg</span><span class="dia-rot" style="grid-row:4">Qua</span><span class="dia-rot" style="grid-row:6">Sex</span>${celulas}</div></div>
    <div class="legenda-heat"><span>Menos</span><i class="h l0"></i><i class="h l1"></i><i class="h l2"></i><i class="h l3"></i><i class="h l4"></i><span>Mais</span></div>
    <p class="dica" style="margin-top:8px">A cor mostra quanto você estudou em relação à meta do dia.</p>
  </section>`;
}

/* ---------- aba Calendário do mascote ---------- */
function htmlCalendario(c) {
  const primeiro = `${Es.mes}-01`, ultimo = ultimoDiaMes(primeiro);
  const ini = inicioSemana(primeiro), fim = addDias(inicioSemana(ultimo), 6);
  const [a, m] = Es.mes.split('-').map(Number);
  let felizes = 0, tristes = 0, celulas = '';
  intervaloDias(ini, fim).forEach(iso => {
    if (iso < primeiro || iso > ultimo) { celulas += '<div class="cal-dia fora"></div>'; return; }
    const st = Motor.statusDia(c, iso);
    const r = (st === 'feliz' || st === 'triste' || st === 'andamento') ? Motor.resumoDia(c, iso) : null;
    let mascote = '';
    if (st === 'feliz') { felizes++; mascote = Mascote.html('padrao', 'Dia de estudo cumprido'); }
    if (st === 'triste') { tristes++; mascote = Mascote.html('chateado', 'Dia sem cumprir o plano'); }
    if (st === 'andamento') mascote = r && r.estudadoTotal > 0 ? Mascote.html('estudando', 'Hoje, estudando') : '';
    const dica = r ? `${fmtMin(r.estudadoTotal)} estudados${r.total ? ` de ${fmtMin(r.total)} planejados` : ''}` : '';
    celulas += `<div class="cal-dia ${st} ${iso === c.hoje ? 'hoje' : ''}" title="${esc(dica)}"><span class="n">${Number(iso.slice(8))}</span>${mascote}</div>`;
  });
  return `
  <div class="nav-dia"><button class="btn btn-claro btn-p" data-acao="mes" data-n="-1" aria-label="Mês anterior">‹</button>
    <div><strong>${maiuscula(NOMES_MES[m - 1])} de ${a}</strong></div><button class="btn btn-claro btn-p" data-acao="mes" data-n="1" aria-label="Próximo mês">›</button>
    ${Es.mes === c.hoje.slice(0, 7) ? '' : '<button class="btn btn-claro btn-p" data-acao="mes-hoje">Este mês</button>'}</div>
  <section class="painel">
    <div class="calendario" role="grid" aria-label="Calendário do mês">
      ${NOMES_DIA_CURTO.slice(1).map(n => `<div class="cal-cab" role="columnheader">${n}</div>`).join('')}${celulas}
    </div>
    <div class="legenda-cal"><span><i class="feliz"></i>Fez tudo</span><span><i class="triste"></i>Faltou estudar</span><span><i class="andamento"></i>Hoje</span></div>
    <p class="dica" style="margin-top:10px">${felizes} ${felizes === 1 ? 'dia feliz' : 'dias felizes'} e ${tristes} ${tristes === 1 ? 'dia triste' : 'dias tristes'} neste mês.</p>
  </section>`;
}

function cliqueEst(ev) {
  const el = ev.target.closest('[data-acao],[data-aba]');
  if (!el) return;
  if (el.dataset.aba) { Es.aba = el.dataset.aba; return renderEst(); }
  switch (el.dataset.acao) {
    case 'periodo': Es.periodo = el.dataset.v; return renderEst();
    case 'aplicar': {
      const de = document.getElementById('es-de').value, ate = document.getElementById('es-ate').value;
      if (!de || !ate || ate < de) return Toast.mostrar('Escolha as duas datas, com o fim depois do início.', 'erro');
      if (diasEntre(de, ate) > 400) return Toast.mostrar('Escolha um período de até 400 dias.', 'erro');
      Es.de = de; Es.ate = ate; return renderEst();
    }
    case 'ano': Es.ano += Number(el.dataset.n); return renderEst();
    case 'mes': { const [a, m] = Es.mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + Number(el.dataset.n), 1)); Es.mes = d.toISOString().slice(0, 7); return renderEst(); }
    case 'mes-hoje': Es.mes = hojeISO().slice(0, 7); return renderEst();
  }
}
