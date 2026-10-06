/* Trabalhos: prazo, detalhes, checklist de etapas, tempo de estudo e nota */

const Tb = { $tela: null, concluidos: false };
const TABELAS_TRAB = ['AnoLetivo', 'Bimestres', 'Materias', 'Metas', 'Regras', 'Trabalhos'];
const STATUS_TRAB = ['Não iniciado', 'Em andamento', 'Concluído'];
const CHECKLIST_PADRAO = [
  'Entender o que o professor pediu', 'Pesquisar o conteúdo', 'Montar o roteiro', 'Escrever o trabalho',
  'Fazer a capa e a folha de rosto', 'Formatar nas normas da ABNT', 'Colocar as referências',
  'Revisar texto e conteúdo', 'Entregar'
];

async function viewTrabalhos($tela) {
  await Dados.carregar(TABELAS_TRAB, () => renderTrabalhos());
  if (rotaAtual !== 'trabalhos') return;
  Tb.$tela = $tela;
  $tela.onclick = cliqueTrabalhos;
  renderTrabalhos();
}
VIEWS.trabalhos = viewTrabalhos;

function cartaoTrabalho(c, t) {
  const m = c.porId[t.materia_id];
  const lista = Motor.lerChecklist(t);
  const feitas = lista.filter(x => x.f).length;
  const concluido = Motor.trabalhoConcluido(t);
  const pct = Math.round(Motor.progressoTrabalho(t) * 100);
  const dias = diasEntre(c.hoje, t.data_entrega);
  const atrasado = !concluido && dias < 0;
  const falta = Math.round(Motor.N(t.minutos_estimados) * (1 - Motor.progressoTrabalho(t)));
  const temNota = t.nota !== '' && t.nota != null;
  const max = Motor.N(t.nota_max, 10) || 10;
  return `<article class="cartao-trabalho ${concluido ? 'passada' : ''}">
    <div class="linha1"><span class="pto" style="background:${esc(m.cor || '#b071ea')}"></span><strong>${esc(t.titulo)}</strong>
      <span class="selo neutro">${esc(m.nome)}</span>
      ${concluido ? '<span class="selo ok">Concluído</span>' : atrasado ? '<span class="selo alerta">Atrasado</span>' : ''}</div>
    <p class="dica">Entrega em ${esc(fmtDataCurta(t.data_entrega))} · ${esc(quandoTexto(t.data_entrega, c.hoje))}${!concluido && falta > 0 ? ` · faltam cerca de ${esc(fmtMin(falta))} de estudo` : ''}</p>
    ${lista.length ? `<div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Etapas do trabalho"><i style="width:${pct}%"></i></div>
      <small class="detalhes">${feitas} de ${lista.length} etapas</small>` : ''}
    ${temNota ? `<p><strong>Nota: ${fmtNum(t.nota)} de ${fmtNum(max)}</strong> ${Motor.acimaDoMinimo(c, t.materia_id, t.nota, max)
      ? '<span class="selo ok">Acima do mínimo</span>' : '<span class="selo alerta">Abaixo do mínimo</span>'}</p>` : ''}
    <div><button class="btn btn-claro btn-p" data-acao="abrir" data-id="${esc(t.id)}">Abrir</button></div>
  </article>`;
}

function renderTrabalhos() {
  if (rotaAtual !== 'trabalhos') return;
  const c = ctxAgora();
  if (!c.ano || !c.ativas.length) {
    Tb.$tela.innerHTML = `<header><h1>Trabalhos</h1></header><section class="painel em-breve">${Mascote.html('padrao', '')}
      <h2>Cadastre as matérias primeiro</h2><p>Cada trabalho fica ligado a uma matéria.</p><a class="btn" href="#/ano">Ir para Ano letivo</a></section>`;
    return;
  }
  const abertos = c.trabalhos.filter(t => !Motor.trabalhoConcluido(t)).sort((a, b) => a.data_entrega.localeCompare(b.data_entrega));
  const feitos = c.trabalhos.filter(Motor.trabalhoConcluido).sort((a, b) => b.data_entrega.localeCompare(a.data_entrega));
  Tb.$tela.innerHTML = `
  <header><h1>Trabalhos</h1><p>Acompanhe cada etapa e deixe o tempo de estudo entrar no cronograma.</p></header>
  <div class="painel-topo"><h2 class="subtitulo" style="margin:0">A entregar</h2><button class="btn btn-p" data-acao="novo">+ Novo trabalho</button></div>
  ${abertos.length ? `<div class="pilha">${abertos.map(t => cartaoTrabalho(c, t)).join('')}</div>`
    : `<section class="painel em-breve">${Mascote.html('padrao', '')}<h2>Nenhum trabalho pendente</h2><p>Quando cadastrar um trabalho, o tempo para fazê-lo é reservado nos dias antes da entrega.</p></section>`}
  ${feitos.length ? `
    <div class="painel-topo" style="margin-top:28px"><h2 class="subtitulo" style="margin:0">Concluídos (${feitos.length})</h2>
      <button class="btn btn-claro btn-p" data-acao="alternar" aria-expanded="${Tb.concluidos}">${Tb.concluidos ? 'Esconder' : 'Mostrar'}</button></div>
    ${Tb.concluidos ? `<div class="pilha">${feitos.map(t => cartaoTrabalho(c, t)).join('')}</div>` : ''}` : ''}`;
}

function cliqueTrabalhos(ev) {
  const el = ev.target.closest('[data-acao]');
  if (!el) return;
  if (el.dataset.acao === 'novo') abrirTrabalho(null);
  if (el.dataset.acao === 'abrir') abrirTrabalho(el.dataset.id);
  if (el.dataset.acao === 'alternar') { Tb.concluidos = !Tb.concluidos; renderTrabalhos(); }
}

/* Janela completa do trabalho (detalhes + checklist) */
function abrirTrabalho(id) {
  const c = ctxAgora();
  const t = id ? Dados.t.Trabalhos.find(x => x.id === id) : null;
  const mats = c.ativas.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  let itens = t ? Motor.lerChecklist(t) : CHECKLIST_PADRAO.map(x => ({ t: x, f: 0 }));

  const d = Dialogo._abrir(`
  <form class="dialogo-corpo" novalidate>
    <h2>${t ? 'Trabalho' : 'Novo trabalho'}</h2>
    <div class="aviso-erro" role="alert" hidden></div>
    <div class="campo"><label for="tb-titulo">Título</label><div class="entrada"><input id="tb-titulo" value="${esc(t ? t.titulo : '')}" maxlength="80" autocomplete="off"></div></div>
    <div class="duas-campos">
      <div class="campo"><label for="tb-mat">Matéria</label><div class="entrada"><select id="tb-mat">${mats.map(m =>
        `<option value="${esc(m.id)}" ${t && t.materia_id === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></div></div>
      <div class="campo"><label for="tb-data">Data de entrega</label><div class="entrada"><input id="tb-data" type="date" value="${esc(t ? t.data_entrega : '')}"></div></div>
    </div>
    <div class="duas-campos">
      <div class="campo"><label for="tb-min">Tempo para fazer (minutos)</label><div class="entrada"><input id="tb-min" type="number" min="0" max="3000" step="5" value="${esc(t ? t.minutos_estimados : c.regras.tempo_trabalho)}"></div>
        <small class="ajuda">Entra no cronograma nos dias antes da entrega.</small></div>
      <div class="campo"><label for="tb-status">Situação</label><div class="entrada"><select id="tb-status">${STATUS_TRAB.map(s =>
        `<option ${((t && t.status) || 'Não iniciado') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    </div>
    <div class="campo"><label for="tb-desc">Detalhes <span class="opc">(opcional)</span></label>
      <div class="entrada"><textarea id="tb-desc" rows="3" maxlength="1000" placeholder="O que o professor pediu, o que já foi feito, o que falta...">${esc(t ? t.descricao : '')}</textarea></div>
      <small class="ajuda" id="tb-cont"></small></div>
    <fieldset class="checklist"><legend>Etapas <span id="tb-prog"></span></legend>
      <ul id="tb-lista"></ul>
      <div class="add-check"><input id="tb-novo" placeholder="Nova etapa" maxlength="60" autocomplete="off"><button type="button" class="btn btn-claro btn-p" data-x="add">Adicionar</button></div>
    </fieldset>
    <div class="duas-campos">
      <div class="campo"><label for="tb-nota">Nota <span class="opc">(opcional)</span></label><div class="entrada"><input id="tb-nota" type="number" step="0.1" value="${esc(t ? t.nota : '')}"></div></div>
      <div class="campo"><label for="tb-max">Vale quantos pontos?</label><div class="entrada"><input id="tb-max" type="number" step="0.1" value="${esc(t && t.nota_max !== '' ? t.nota_max : 10)}"></div></div>
    </div>
    <div class="dialogo-acoes">
      ${t ? '<button type="button" class="btn btn-perigo-claro" data-x="excluir">Excluir</button>' : '<span></span>'}
      <span class="grupo"><button type="button" class="btn btn-claro" data-x="cancelar">Cancelar</button><button type="submit" class="btn">Salvar</button></span>
    </div>
  </form>`);

  const $f = d.querySelector('form');
  const $erro = d.querySelector('.aviso-erro');
  const $lista = d.querySelector('#tb-lista');
  const $desc = d.querySelector('#tb-desc');
  const mostrarErro = (txt) => { $erro.textContent = txt; $erro.hidden = false; $erro.scrollIntoView({ block: 'nearest' }); };
  const ocupado = (b) => $f.querySelectorAll('button').forEach(x => { x.disabled = b; });

  function desenhar() {
    $lista.innerHTML = itens.map((it, i) => `<li>
      <input type="checkbox" data-i="${i}" ${it.f ? 'checked' : ''} aria-label="Etapa feita">
      <input type="text" class="txt" data-t="${i}" value="${esc(it.t)}" maxlength="60" aria-label="Nome da etapa">
      <button type="button" class="x" data-rm="${i}" aria-label="Remover etapa">×</button></li>`).join('');
    const feitas = itens.filter(x => x.f).length;
    d.querySelector('#tb-prog').textContent = itens.length ? `(${feitas} de ${itens.length})` : '';
  }
  const contar = () => { d.querySelector('#tb-cont').textContent = `${$desc.value.length} de 1000 caracteres`; };
  desenhar(); contar();
  $desc.addEventListener('input', contar);
  d.querySelector('#tb-titulo').focus();

  $lista.addEventListener('change', (ev) => { const i = ev.target.dataset.i; if (i !== undefined) { itens[i].f = ev.target.checked ? 1 : 0; desenhar(); } });
  $lista.addEventListener('input', (ev) => { const i = ev.target.dataset.t; if (i !== undefined) itens[i].t = ev.target.value; });
  const adicionar = () => {
    const $n = d.querySelector('#tb-novo'); const txt = $n.value.trim();
    if (!txt) return;
    if (itens.length >= 15) { mostrarErro('São no máximo 15 etapas.'); return; }
    itens.push({ t: txt, f: 0 }); $n.value = ''; desenhar(); $n.focus();
  };
  d.querySelector('#tb-novo').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); adicionar(); } });

  $f.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-x],[data-rm]');
    if (!el) return;
    if (el.dataset.rm !== undefined) { itens.splice(Number(el.dataset.rm), 1); desenhar(); return; }
    if (el.dataset.x === 'add') return adicionar();
    if (el.dataset.x === 'cancelar') return d.close();
    if (el.dataset.x === 'excluir') {
      const sim = await Dialogo.confirmar({ titulo: 'Excluir este trabalho?', texto: 'Esta ação não pode ser desfeita.', ok: 'Excluir', perigo: true });
      if (!sim) return;
      ocupado(true);
      try { await Dados.excluir('Trabalhos', t.id); d.close(); Toast.mostrar('Trabalho excluído.'); renderTrabalhos(); }
      catch (e) { if (e.message === 'SESSAO_INVALIDA') { d.close(); return sessaoExpirada(); } mostrarErro(e.message); ocupado(false); }
    }
  });

  $f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $erro.hidden = true;
    const val = (sel) => d.querySelector(sel).value.trim();
    const titulo = val('#tb-titulo'), data = val('#tb-data');
    if (!titulo) return mostrarErro('Dê um título ao trabalho.');
    if (!data) return mostrarErro('Informe a data de entrega.');
    const minutos = val('#tb-min') === '' ? 0 : Number(val('#tb-min'));
    if (!(minutos >= 0 && minutos <= 3000)) return mostrarErro('Informe um tempo entre 0 e 3000 minutos.');
    const nota = val('#tb-nota'), max = val('#tb-max') === '' ? 10 : Number(val('#tb-max'));
    if (nota !== '' && (Number(nota) < 0 || Number(nota) > max)) return mostrarErro('A nota não pode ser maior que o valor do trabalho.');
    const lista = itens.map(x => ({ t: x.t.trim(), f: x.f })).filter(x => x.t);

    let status = val('#tb-status');
    const todas = lista.length > 0 && lista.every(x => x.f);
    if (status !== 'Concluído' && (todas || nota !== '')) status = 'Concluído';
    else if (status === 'Não iniciado' && lista.some(x => x.f)) status = 'Em andamento';

    const dados = {
      materia_id: val('#tb-mat'), titulo, data_entrega: data, bimestre: Motor.bimestreDaData(c, data),
      descricao: $desc.value.trim(), status, minutos_estimados: minutos,
      checklist: JSON.stringify(lista.map(x => ({ t: x.t, f: x.f }))),
      nota: nota === '' ? '' : Number(nota), nota_max: nota === '' ? '' : max
    };
    if (t) dados.id = t.id;
    ocupado(true);
    try {
      await Dados.salvar('Trabalhos', dados);
      d.close();
      Toast.mostrar(status === 'Concluído' ? 'Trabalho concluído. Parabéns!' : 'Trabalho salvo.');
      renderTrabalhos();
    } catch (e) {
      if (e.message === 'SESSAO_INVALIDA') { d.close(); return sessaoExpirada(); }
      mostrarErro(e.message); ocupado(false);
    }
  });
}
