/* Provas: cadastro, tempo de preparação (entra no cronograma) e nota */

const Pv = { $tela: null, anteriores: false };
const TABELAS_PROVAS = ['AnoLetivo', 'Bimestres', 'Materias', 'Metas', 'Regras', 'Provas'];

async function viewProvas($tela) {
  await Dados.carregar(TABELAS_PROVAS, () => renderProvas());
  if (rotaAtual !== 'provas') return;
  Pv.$tela = $tela;
  $tela.onclick = cliqueProvas;
  renderProvas();
}
VIEWS.provas = viewProvas;

const MES_CURTO = (iso) => NOMES_MES[Number(iso.slice(5, 7)) - 1].slice(0, 3).toUpperCase();

/* Resumo do tempo reservado para uma prova */
function resumoPreparo(c, p) {
  const total = Motor.N(p.minutos_preparo);
  const dias = [...Motor.cotasProva(c, p).keys()].sort();
  if (!total) return { total, dias, texto: 'Sem tempo de preparação definido.', ok: true };
  if (!dias.length) return { total, dias, ok: false, texto: 'Não há nenhum dia com meta de estudo antes da prova. Ajuste as metas ou os dias de preparação.' };
  return {
    total, dias, ok: true,
    texto: `${fmtMin(total)} de preparação em ${dias.length} ${dias.length === 1 ? 'dia' : 'dias'} (${fmtDataCurta(dias[0])} a ${fmtDataCurta(dias[dias.length - 1])}), cerca de ${fmtMin(total / dias.length)} por dia.`
  };
}

function cartaoProva(c, p) {
  const m = c.porId[p.materia_id];
  const prep = resumoPreparo(c, p);
  const passada = p.data < c.hoje;
  const temNota = p.nota !== '' && p.nota != null;
  const max = Motor.N(p.nota_max, 10) || 10;
  return `<article class="cartao-prova ${passada ? 'passada' : ''}">
    <div class="data-bloco"><strong>${esc(p.data.slice(8))}</strong><span>${MES_CURTO(p.data)}</span></div>
    <div class="corpo">
      <div class="linha1"><span class="pto" style="background:${esc(m.cor || '#b071ea')}"></span><strong>${esc(m.nome)}</strong>
        <span class="selo">${esc(p.tipo)}</span><span class="quando">${esc(quandoTexto(p.data, c.hoje))}</span></div>
      ${p.conteudo ? `<p class="texto-conteudo">${esc(p.conteudo)}</p>` : ''}
      ${passada ? '' : `<p class="${prep.ok ? 'dica' : 'aviso-leve'}">${esc(prep.texto)}</p>`}
      ${temNota ? `<p><strong>Nota: ${fmtNum(p.nota)} de ${fmtNum(max)}</strong> ${Motor.acimaDoMinimo(c, p.materia_id, p.nota, max)
        ? '<span class="selo ok">Acima do mínimo</span>' : '<span class="selo alerta">Abaixo do mínimo</span>'}</p>` : ''}
    </div>
    <button class="btn btn-claro btn-p" data-acao="editar" data-id="${esc(p.id)}">${passada && !temNota ? 'Lançar nota' : 'Editar'}</button>
  </article>`;
}

function renderProvas() {
  if (rotaAtual !== 'provas') return;
  const c = ctxAgora();
  if (!c.ano || !c.ativas.length) {
    Pv.$tela.innerHTML = `<header><h1>Provas</h1></header><section class="painel em-breve">${Mascote.html('padrao', '')}
      <h2>Cadastre as matérias primeiro</h2><p>As provas ficam ligadas a uma matéria do ano letivo.</p><a class="btn" href="#/ano">Ir para Ano letivo</a></section>`;
    return;
  }
  const todas = c.provas.slice().sort((a, b) => a.data.localeCompare(b.data));
  const proximas = todas.filter(p => p.data >= c.hoje);
  const anteriores = todas.filter(p => p.data < c.hoje).reverse();
  Pv.$tela.innerHTML = `
  <header><h1>Provas</h1><p>Cadastre as datas e o sistema reserva tempo de estudo nos dias antes de cada prova.</p></header>
  <div class="painel-topo"><h2 class="subtitulo" style="margin:0">Próximas provas</h2><button class="btn btn-p" data-acao="nova">+ Nova prova</button></div>
  ${proximas.length ? `<div class="pilha">${proximas.map(p => cartaoProva(c, p)).join('')}</div>`
    : `<section class="painel em-breve">${Mascote.html('padrao', '')}<h2>Nenhuma prova marcada</h2><p>Quando uma prova for cadastrada, ela entra no cronograma automaticamente.</p></section>`}
  ${anteriores.length ? `
    <div class="painel-topo" style="margin-top:28px"><h2 class="subtitulo" style="margin:0">Provas anteriores (${anteriores.length})</h2>
      <button class="btn btn-claro btn-p" data-acao="alternar-anteriores" aria-expanded="${Pv.anteriores}">${Pv.anteriores ? 'Esconder' : 'Mostrar'}</button></div>
    ${Pv.anteriores ? `<div class="pilha">${anteriores.map(p => cartaoProva(c, p)).join('')}</div>` : ''}` : ''}`;
}

function cliqueProvas(ev) {
  const el = ev.target.closest('[data-acao]');
  if (!el) return;
  if (el.dataset.acao === 'nova') formProva(null);
  if (el.dataset.acao === 'editar') formProva(el.dataset.id);
  if (el.dataset.acao === 'alternar-anteriores') { Pv.anteriores = !Pv.anteriores; renderProvas(); }
}

function formProva(id) {
  const c = ctxAgora();
  const p = id ? Dados.t.Provas.find(x => x.id === id) : null;
  const mats = c.ativas.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  const tipoIni = p ? p.tipo : 'Bimestral';
  let ultimoPadrao = c.regras[chaveTempoProva(tipoIni)];
  let resumoApos = null;

  const d = Dialogo.form({
    titulo: p ? 'Editar prova' : 'Nova prova',
    campos: [
      { id: 'materia_id', rotulo: 'Matéria', tipo: 'select', valor: p ? p.materia_id : mats[0].id, obrigatorio: true, opcoes: mats.map(m => ({ valor: m.id, rotulo: m.nome })) },
      { id: 'tipo', rotulo: 'Tipo de prova', tipo: 'select', valor: tipoIni, obrigatorio: true, opcoes: TIPOS_PROVA.map(t => ({ valor: t, rotulo: t })) },
      { id: 'data', rotulo: 'Data da prova', tipo: 'date', valor: p ? p.data : '', obrigatorio: true },
      { id: 'bimestre', rotulo: 'Bimestre', tipo: 'select', valor: p ? String(Number(p.bimestre) || 0) : '0', obrigatorio: true,
        opcoes: [{ valor: '0', rotulo: 'Automático (pela data)' }, { valor: '1', rotulo: '1º bimestre' }, { valor: '2', rotulo: '2º bimestre' }, { valor: '3', rotulo: '3º bimestre' }, { valor: '4', rotulo: '4º bimestre' }] },
      { id: 'conteudo', rotulo: 'Conteúdo da prova', tipo: 'textarea', valor: p ? p.conteudo : '', max: 400, placeholder: 'Ex.: capítulos 3 e 4, equações do 2º grau' },
      { id: 'minutos_preparo', rotulo: 'Tempo para estudar (minutos)', tipo: 'number', valor: p ? p.minutos_preparo : ultimoPadrao, obrigatorio: true,
        ajuda: 'Já vem sugerido pelo tipo de prova. Pode mudar. Esse tempo é dividido nos dias antes da prova.' },
      { id: 'dias_antes', rotulo: 'Começar a estudar quantos dias antes?', tipo: 'number', valor: p && p.dias_antes !== '' ? p.dias_antes : c.regras.dias_prova, obrigatorio: true },
      { id: 'nota', rotulo: 'Nota tirada', tipo: 'number', passo: '0.1', valor: p ? p.nota : '', ajuda: 'Preencha depois que receber o resultado.' },
      { id: 'nota_max', rotulo: 'Vale quantos pontos?', tipo: 'number', passo: '0.1', valor: p && p.nota_max !== '' ? p.nota_max : 10 }
    ],
    aoAlterar: (nome, valor, $f) => {
      if (nome !== 'tipo') return;
      const novo = c.regras[chaveTempoProva(valor)];
      const campo = $f.querySelector('[name=minutos_preparo]');
      if (campo && String(campo.value) === String(ultimoPadrao)) campo.value = novo;
      ultimoPadrao = novo;
    },
    onSalvar: async (v) => {
      if (v.minutos_preparo < 0 || v.minutos_preparo > 3000) throw new Error('Informe um tempo de estudo entre 0 e 3000 minutos.');
      if (v.dias_antes < 1 || v.dias_antes > 60) throw new Error('Informe de 1 a 60 dias de preparação.');
      const max = v.nota_max === '' ? 10 : v.nota_max;
      if (v.nota !== '') {
        if (max <= 0) throw new Error('O valor da prova precisa ser maior que zero.');
        if (v.nota < 0 || v.nota > max) throw new Error('A nota não pode ser maior que o valor da prova.');
      }
      const dados = {
        materia_id: v.materia_id, tipo: v.tipo, data: v.data, conteudo: v.conteudo,
        bimestre: Number(v.bimestre) || Motor.bimestreDaData(c, v.data),
        minutos_preparo: v.minutos_preparo, dias_antes: v.dias_antes,
        nota: v.nota, nota_max: v.nota === '' ? '' : max
      };
      if (p) dados.id = p.id;
      const reg = await Dados.salvar('Provas', dados);
      Toast.mostrar('Prova salva.');
      if (!p) resumoApos = reg;
      renderProvas();
    },
    onExcluir: p ? async () => { await Dados.excluir('Provas', p.id); Toast.mostrar('Prova excluída.'); renderProvas(); } : null
  });

  /* depois de cadastrar uma prova nova, mostra quanto tempo foi reservado */
  d.addEventListener('close', () => {
    if (!resumoApos) return;
    const c2 = ctxAgora();
    const r = resumoPreparo(c2, resumoApos);
    const m = c2.porId[resumoApos.materia_id];
    Dialogo.info({
      titulo: 'Tempo reservado para a prova',
      html: `<p><strong>${esc(m.nome)}</strong> · prova ${esc(String(resumoApos.tipo).toLowerCase())} em ${esc(fmtDataCurta(resumoApos.data))}</p>
        <p class="${r.ok ? '' : 'aviso-leve'}">${esc(r.texto)}</p>
        ${r.ok && r.dias.length ? '<p class="dica">Esse tempo já entra no cronograma, junto com as outras matérias do dia.</p>' : ''}`
    });
  });
}
