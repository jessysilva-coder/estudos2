/* Agenda semanal: total da semana, dias, matérias de cada dia e exportação para a Agenda Google */

const Ag = { $tela: null, semana: null, dia: null, sel: new Set(), vistas: new Set(), exportando: false };

async function viewAgenda($tela) {
  await Dados.carregar(TABELAS_MOTOR, () => renderAgenda());
  if (rotaAtual !== 'agenda') return;
  Ag.$tela = $tela;
  const hoje = hojeISO();
  Ag.semana = inicioSemana(hoje);
  Ag.dia = hoje;
  Ag.sel = new Set(); Ag.vistas = new Set(); Ag.exportando = false;
  preSelecionar();
  $tela.onclick = cliqueAgenda;
  $tela.onchange = mudancaAgenda;
  renderAgenda();
}
VIEWS.agenda = viewAgenda;

/* Ao abrir uma semana, já deixa marcados os compromissos que ainda não estão na Agenda Google */
function preSelecionar() {
  if (Ag.vistas.has(Ag.semana)) return;
  Ag.vistas.add(Ag.semana);
  const c = ctxAgora();
  intervaloDias(Ag.semana, addDias(Ag.semana, 6)).forEach(d => {
    if (d < c.hoje) return;
    Motor.resumoDia(c, d).itens.forEach(it => { if (!it.evento) Ag.sel.add(d + '|' + it.materia_id); });
  });
}

function renderAgenda() {
  if (rotaAtual !== 'agenda') return;
  const c = ctxAgora();
  if (!c.ano) {
    Ag.$tela.innerHTML = `<header><h1>Agenda</h1></header><section class="painel em-breve">${Mascote.html('padrao', '')}
      <h2>Falta cadastrar o ano letivo</h2><p>A agenda é montada a partir das suas matérias.</p><a class="btn" href="#/ano">Ir para Ano letivo</a></section>`;
    return;
  }
  const dias = intervaloDias(Ag.semana, addDias(Ag.semana, 6));
  const resumos = dias.map(d => Motor.resumoDia(c, d));
  const metaSemana = resumos.reduce((s, r) => s + r.disponivel, 0);
  const estudadoSemana = resumos.reduce((s, r) => s + r.estudadoTotal, 0);
  const pct = metaSemana ? Math.min(100, Math.round(estudadoSemana / metaSemana * 100)) : 0;
  const ehEstaSemana = Ag.semana === inicioSemana(c.hoje);
  const selecionados = [...Ag.sel].filter(k => k.split('|')[0] >= c.hoje).length;

  const abas = dias.map((d, i) => {
    const r = resumos[i];
    const info = r.itens.length ? `${Math.round((r.pct || 0) * 100)}%` : 'livre';
    return `<button class="dia-aba ${d === Ag.dia ? 'ativo' : ''} ${d === c.hoje ? 'hoje' : ''}" data-acao="dia" data-d="${d}" aria-pressed="${d === Ag.dia}">
      <span>${NOMES_DIA_CURTO[i + 1]}</span><strong>${d.slice(8)}</strong><small>${info}</small></button>`;
  }).join('');

  Ag.$tela.innerHTML = `
  <header><h1>Agenda</h1><p>A semana inteira, dia por dia, e o envio para a sua Agenda Google.</p></header>
  <div class="nav-dia">
    <button class="btn btn-claro btn-p" data-acao="semana" data-n="-1" aria-label="Semana anterior">‹</button>
    <div><strong>Semana de ${fmtDataCurta(dias[0])} a ${fmtDataCurta(dias[6])}</strong></div>
    <button class="btn btn-claro btn-p" data-acao="semana" data-n="1" aria-label="Próxima semana">›</button>
    ${ehEstaSemana ? '' : '<button class="btn btn-claro btn-p" data-acao="esta-semana">Esta semana</button>'}
  </div>
  <section class="painel semana-resumo">
    <div class="semana-numeros">
      <div><small>Meta da semana</small><strong>${metaSemana ? fmtMin(metaSemana) : '—'}</strong></div>
      <div><small>Estudado</small><strong>${fmtMin(estudadoSemana)}</strong></div>
      <div><small>Atingido</small><strong>${metaSemana ? pct + '%' : '—'}</strong></div>
    </div>
    <div class="barra grande" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Meta da semana"><i style="width:${pct}%"></i></div>
    <div class="exportar-linha">
      <button class="btn" data-acao="exportar" ${selecionados && !Ag.exportando ? '' : 'disabled'}>${Ag.exportando ? 'Enviando...' : '📅 Exportar para a Agenda Google'}${selecionados && !Ag.exportando ? ` (${selecionados})` : ''}</button>
      <small class="dica">Só vão os compromissos marcados com a caixinha.</small>
    </div>
  </section>
  <div class="dias-abas" role="group" aria-label="Dias da semana">${abas}</div>
  ${htmlDiaAgenda(c, resumos[diasEntre(Ag.semana, Ag.dia)])}`;
}

function htmlDiaAgenda(c, r) {
  const iso = r.data;
  if (!r.itens.length) {
    return `<section class="painel em-breve">${Mascote.html('padrao', '')}<h2>Dia livre</h2>
      <p>${r.disponivel > 0 ? 'Nada planejado para este dia.' : 'Não há meta de estudo neste dia. Ajuste em Metas e regras se quiser estudar nele.'}</p></section>`;
  }
  const marcaveis = r.itens.filter(() => iso >= c.hoje);
  const todos = marcaveis.length > 0 && marcaveis.every(it => Ag.sel.has(iso + '|' + it.materia_id));
  return `
  <section>
    <div class="painel-topo" style="margin:6px 0 10px">
      <h2 class="subtitulo" style="margin:0">${esc(fmtDataLonga(iso))}</h2>
      ${marcaveis.length ? `<label class="sel-todos"><input type="checkbox" data-sel-dia="${iso}" ${todos ? 'checked' : ''}> Marcar todos deste dia</label>` : ''}
    </div>
    <ul class="lista-plano">${r.itens.map(it => htmlItem(c, iso, it, { selecionavel: true, selecionados: Ag.sel, horario: true, agenda: true })).join('')}</ul>
    <p class="dica" style="margin-top:10px">Planejado: ${fmtMin(r.total)} · Estudado: ${fmtMin(r.estudadoTotal)}</p>
  </section>`;
}

function cliqueAgenda(ev) {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.disabled) return;
  if (tratarAcaoItem(el, renderAgenda)) return;
  switch (el.dataset.acao) {
    case 'semana':       Ag.semana = addDias(Ag.semana, 7 * Number(el.dataset.n)); Ag.dia = Ag.semana; preSelecionar(); return renderAgenda();
    case 'esta-semana':  Ag.semana = inicioSemana(hojeISO()); Ag.dia = hojeISO(); preSelecionar(); return renderAgenda();
    case 'dia':          Ag.dia = el.dataset.d; return renderAgenda();
    case 'exportar':     return exportarSelecionados();
    case 'tirar-agenda': return tirarDaAgenda(el.dataset.d, el.dataset.m);
  }
}

function mudancaAgenda(ev) {
  const t = ev.target;
  if (t.dataset.sel) { if (t.checked) Ag.sel.add(t.dataset.sel); else Ag.sel.delete(t.dataset.sel); renderAgenda(); return; }
  if (t.dataset.selDia) {
    const c = ctxAgora();
    Motor.resumoDia(c, t.dataset.selDia).itens.forEach(it => {
      const k = t.dataset.selDia + '|' + it.materia_id;
      if (t.checked) Ag.sel.add(k); else Ag.sel.delete(k);
    });
    renderAgenda();
  }
}

async function exportarSelecionados() {
  const u = Sessao.usuario();
  if (!u.calendar_id) {
    const ir = await Dialogo.confirmar({
      titulo: 'Conecte a sua Agenda Google',
      texto: 'Para enviar os compromissos, primeiro informe qual agenda usar em Configurações.',
      ok: 'Ir para Configurações'
    });
    if (ir) location.hash = '#/config';
    return;
  }
  const c = ctxAgora();
  const porDia = new Map();
  [...Ag.sel].forEach(k => {
    const [d, mid] = k.split('|');
    if (d < c.hoje) return;
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d).push(mid);
  });
  if (!porDia.size) return;
  Ag.exportando = true;
  renderAgenda();
  let enviados = 0;
  try {
    for (const [d, mids] of [...porDia].sort((a, b) => a[0].localeCompare(b[0]))) {
      const itens = Motor.resumoDia(c, d).itens.filter(i => mids.includes(i.materia_id));
      if (!itens.length) continue;
      await Api.agendaExportar(d, itens.map(i => [i.materia_id, i.inicio, i.minutos, i.origens.join('+')]));
      enviados += itens.length;
    }
    Ag.sel.clear();
    Toast.mostrar(`${enviados} ${enviados === 1 ? 'compromisso enviado' : 'compromissos enviados'} para a Agenda Google.`);
  } catch (e) {
    tratarErro(e);
  } finally {
    Ag.exportando = false;
    try { await Dados.carregar(['Plano'], null, true); } catch (e) { /* mantém o que já está na tela */ }
    renderAgenda();
  }
}

async function tirarDaAgenda(d, mid) {
  const ok = await Dialogo.confirmar({ titulo: 'Tirar da Agenda Google?', texto: 'O compromisso será apagado da sua agenda. O estudo continua no cronograma.', ok: 'Tirar da agenda' });
  if (!ok) return;
  try {
    await Api.agendaRemover(d, mid);
    await Dados.carregar(['Plano'], null, true);
    Toast.mostrar('Compromisso removido da agenda.');
  } catch (e) { tratarErro(e); }
  renderAgenda();
}
