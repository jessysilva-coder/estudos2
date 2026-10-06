/* Metas e regras: quanto tempo estudar em cada dia e como esse tempo é dividido */

const Mt = { $tela: null };
const SETE_DIAS = [1, 2, 3, 4, 5, 6, 7];

/* Cada regra vira um campo. Os valores ficam na aba Regras da planilha. */
const GRUPOS_REGRAS = [
  { titulo: 'Como o tempo de cada dia é dividido', itens: [
    { k: 'revisar_dia', rot: 'Revisar as matérias que tiveram aula hoje', tipo: 'select', op: [['SIM', 'Sim'], ['NAO', 'Não']] },
    { k: 'antecipar_modo', rot: 'Adiantar as matérias das próximas aulas', tipo: 'select',
      op: [['AMANHA', 'Sim, as de amanhã'], ['PROXIMO', 'Sim, as do próximo dia de aula'], ['NAO', 'Não']] },
    { k: 'divisao_tempo', rot: 'Divisão do tempo entre as matérias', tipo: 'select',
      op: [['IGUAL', 'Partes iguais'], ['FOCO_NOTAS', 'Mais tempo para as matérias com nota baixa']] },
    { k: 'arredondamento', rot: 'Tempo de cada matéria em blocos de', tipo: 'select', op: [['1', '1 minuto'], ['5', '5 minutos'], ['10', '10 minutos']] }
  ] },
  { titulo: 'Provas e trabalhos', itens: [
    { k: 'dias_prova', rot: 'Começar a estudar para a prova quantos dias antes', tipo: 'number', min: 1, max: 60 },
    { k: 'tempo_prova_bimestral', rot: 'Tempo sugerido: prova bimestral (minutos)', tipo: 'number', min: 0, max: 3000 },
    { k: 'tempo_prova_semestral', rot: 'Tempo sugerido: prova semestral (minutos)', tipo: 'number', min: 0, max: 3000 },
    { k: 'tempo_prova_recuperacao', rot: 'Tempo sugerido: recuperação (minutos)', tipo: 'number', min: 0, max: 3000 },
    { k: 'tempo_prova_simulado', rot: 'Tempo sugerido: simulado (minutos)', tipo: 'number', min: 0, max: 3000 },
    { k: 'tempo_prova_outra', rot: 'Tempo sugerido: outras provas (minutos)', tipo: 'number', min: 0, max: 3000 },
    { k: 'dias_trabalho', rot: 'Dedicar tempo ao trabalho quantos dias antes da entrega', tipo: 'number', min: 1, max: 60 },
    { k: 'tempo_trabalho', rot: 'Tempo sugerido para um trabalho (minutos)', tipo: 'number', min: 0, max: 3000 },
    { k: 'limite_prova_pct', rot: 'No máximo quanto do dia vai para provas e trabalhos (%)', tipo: 'number', min: 10, max: 100 }
  ] },
  { titulo: 'Notas', itens: [
    { k: 'modelo_nota', rot: 'Como a nota do bimestre é calculada', tipo: 'select',
      op: [['SOMA', 'Soma de pontos (as avaliações somam até a nota máxima)'], ['MEDIA', 'Média das avaliações']] },
    { k: 'escala_notas', rot: 'Nota máxima do bimestre', tipo: 'number', min: 1, max: 1000 }
  ] },
  { titulo: 'Início do cronograma', itens: [
    { k: 'inicio_plano', rot: 'Cobrar o cronograma a partir de', tipo: 'date', ajuda: 'Os dias antes dessa data não contam como atrasados. Deixe em branco para começar no dia em que as metas foram criadas.' }
  ] }
];

async function viewMetas($tela) {
  await Dados.carregar(TABELAS_MOTOR);
  if (rotaAtual !== 'metas') return;
  Mt.$tela = $tela;
  $tela.onclick = cliqueMetas;
  $tela.onchange = mudancaMetas;
  renderMetas();
}
VIEWS.metas = viewMetas;

const horaParaMin = (h) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(h || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

function renderMetas() {
  if (rotaAtual !== 'metas') return;
  const c = ctxAgora();
  const metas = {};
  c.metas.forEach(m => { metas[Number(m.dia_semana)] = m; });

  const linhas = SETE_DIAS.map(d => {
    const m = metas[d];
    return `<tr data-dia="${d}">
      <th scope="row">${NOMES_DIA[d]}</th>
      <td><input type="checkbox" class="m-on" ${m ? 'checked' : ''} aria-label="Estudar na ${NOMES_DIA[d].toLowerCase()}"></td>
      <td><input type="time" class="m-ini" value="${esc(m ? m.hora_inicio : '14:00')}" ${m ? '' : 'disabled'} aria-label="Início"></td>
      <td><input type="time" class="m-fim" value="${esc(m ? m.hora_fim : '17:30')}" ${m ? '' : 'disabled'} aria-label="Fim"></td>
      <td><input type="number" class="m-min" min="5" max="720" step="5" value="${esc(m ? m.meta_minutos : 210)}" ${m ? '' : 'disabled'} aria-label="Meta em minutos"></td>
    </tr>`;
  }).join('');

  const campo = (it) => {
    const v = it.k === 'inicio_plano' ? (c.regras.inicio_plano || '') : c.regras[it.k];
    const corpo = it.tipo === 'select'
      ? `<select id="r-${it.k}">${it.op.map(([val, rot]) => `<option value="${val}" ${String(v) === val ? 'selected' : ''}>${esc(rot)}</option>`).join('')}</select>`
      : `<input id="r-${it.k}" type="${it.tipo}" ${it.tipo === 'number' ? `min="${it.min}" max="${it.max}" step="1"` : ''} value="${esc(v)}">`;
    return `<div class="campo"><label for="r-${it.k}">${esc(it.rot)}</label><div class="entrada">${corpo}</div>${it.ajuda ? `<small class="ajuda">${esc(it.ajuda)}</small>` : ''}</div>`;
  };

  const hoje = Motor.resumoDia(c, c.hoje);
  Mt.$tela.innerHTML = `
  <header><h1>Metas e regras</h1><p>Defina quanto tempo estudar por dia e como o sistema divide esse tempo.</p></header>

  <section class="painel">
    <h2>Meta de estudo por dia</h2>
    <p class="dica">Marque os dias em que você estuda e o horário. A meta em minutos é o tempo que será dividido entre as matérias.</p>
    <div class="tabela-rolagem" style="margin-top:14px"><table class="tabela tabela-metas">
      <thead><tr><th>Dia</th><th>Estudar</th><th>Início</th><th>Fim</th><th>Meta (min)</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>
    <div class="painel-topo" style="margin:14px 0 0"><strong id="m-total"></strong><button class="btn" data-acao="salvar-metas">Salvar metas</button></div>
  </section>

  <section class="painel" style="margin-top:20px">
    <h2>Regras do cronograma</h2>
    <p class="dica">Os valores já vêm com uma sugestão inicial. Mude o que fizer sentido para você.</p>
    ${GRUPOS_REGRAS.map(g => `<h3 class="grupo-regra">${esc(g.titulo)}</h3><div class="campos-grade">${g.itens.map(campo).join('')}</div>`).join('')}
    <div class="painel-topo" style="margin:18px 0 0"><span></span><button class="btn" data-acao="salvar-regras">Salvar regras</button></div>
  </section>

  <section class="painel" style="margin-top:20px">
    <h2>Como o dia de hoje ficou</h2>
    ${hoje.itens.length ? `<p class="dica">Com as metas e regras atuais, o tempo de hoje é dividido assim:</p>
      <div class="chips" style="margin-top:12px">${hoje.itens.map(it => `<span class="chip"><i style="background:${esc(c.porId[it.materia_id].cor || '#b071ea')}"></i>${esc(c.porId[it.materia_id].nome)} · ${fmtMin(it.minutos)}</span>`).join('')}</div>`
      : '<p class="vazio">Hoje não tem nada planejado. Confira se há meta para o dia da semana e se as matérias têm aula cadastrada.</p>'}
  </section>`;
  atualizarTotalMetas();
}

function lerMetasDaTela() {
  return [...Mt.$tela.querySelectorAll('tr[data-dia]')].map(tr => ({
    dia: Number(tr.dataset.dia),
    on: tr.querySelector('.m-on').checked,
    ini: tr.querySelector('.m-ini').value,
    fim: tr.querySelector('.m-fim').value,
    min: Number(tr.querySelector('.m-min').value)
  }));
}

function atualizarTotalMetas() {
  const el = document.getElementById('m-total');
  if (!el) return;
  const total = lerMetasDaTela().filter(x => x.on && x.min > 0).reduce((s, x) => s + x.min, 0);
  el.textContent = total ? `Total da semana: ${fmtMin(total)}` : 'Nenhum dia marcado';
}

function mudancaMetas(ev) {
  const tr = ev.target.closest('tr[data-dia]');
  if (!tr) return;
  const on = tr.querySelector('.m-on'), ini = tr.querySelector('.m-ini'), fim = tr.querySelector('.m-fim'), min = tr.querySelector('.m-min');
  if (ev.target === on) [ini, fim, min].forEach(i => { i.disabled = !on.checked; });
  if (ev.target === ini || ev.target === fim) {
    const a = horaParaMin(ini.value), b = horaParaMin(fim.value);
    if (a !== null && b !== null && b > a) min.value = b - a;     // a meta acompanha a janela de horário
  }
  atualizarTotalMetas();
}

function cliqueMetas(ev) {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.disabled) return;
  if (el.dataset.acao === 'salvar-metas') salvarMetas(el);
  if (el.dataset.acao === 'salvar-regras') salvarRegras(el);
}

async function salvarMetas(btn) {
  const linhas = lerMetasDaTela();
  for (const x of linhas) {
    if (!x.on) continue;
    const a = horaParaMin(x.ini), b = horaParaMin(x.fim);
    if (a === null || b === null) return Toast.mostrar(`Informe o início e o fim na ${NOMES_DIA[x.dia].toLowerCase()}.`, 'erro');
    if (b <= a) return Toast.mostrar(`Na ${NOMES_DIA[x.dia].toLowerCase()}, o fim precisa ser depois do início.`, 'erro');
    if (!(x.min >= 5 && x.min <= 720)) return Toast.mostrar(`Na ${NOMES_DIA[x.dia].toLowerCase()}, a meta deve ficar entre 5 e 720 minutos.`, 'erro');
  }
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    const existentes = {};
    Dados.t.Metas.forEach(m => { existentes[Number(m.dia_semana)] = m; });
    await Promise.all(linhas.map(x => {
      const e = existentes[x.dia];
      if (!x.on) return e ? Dados.excluir('Metas', e.id) : null;
      const dados = { dia_semana: x.dia, hora_inicio: x.ini, hora_fim: x.fim, meta_minutos: x.min };
      if (e) dados.id = e.id;
      return Dados.salvar('Metas', dados);
    }));
    Toast.mostrar('Metas salvas.');
  } catch (e) { tratarErro(e); }
  renderMetas();
}

async function salvarRegras(btn) {
  const c = ctxAgora();
  const mudancas = [];
  for (const g of GRUPOS_REGRAS) {
    for (const it of g.itens) {
      const el = document.getElementById('r-' + it.k);
      let v = el.value.trim();
      if (it.tipo === 'number') {
        const n = Number(v);
        if (v === '' || !Number.isFinite(n) || n < it.min || n > it.max) return Toast.mostrar(`"${it.rot}": informe um número de ${it.min} a ${it.max}.`, 'erro');
        v = String(n);
      }
      const atual = it.k === 'inicio_plano' ? (c.regras.inicio_plano || '') : String(c.regras[it.k]);
      if (v !== atual) mudancas.push({ chave: it.k, valor: v, descricao: it.rot });
    }
  }
  if (!mudancas.length) return Toast.mostrar('Nada mudou nas regras.');
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    await Promise.all(mudancas.map(m => {
      const linha = Dados.t.Regras.find(r => r.chave === m.chave);
      const dados = { chave: m.chave, valor: m.valor, descricao: m.descricao };
      if (linha) dados.id = linha.id;
      return Dados.salvar('Regras', dados);
    }));
    Toast.mostrar('Regras salvas.');
  } catch (e) { tratarErro(e); }
  renderMetas();
}
