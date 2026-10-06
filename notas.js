/* Notas: lançamentos do bimestre, média por matéria, pontos que faltam e onde focar os estudos */

const Nt = { $tela: null, bim: null };
const TABELAS_NOTAS = ['AnoLetivo', 'Bimestres', 'Materias', 'Regras', 'Provas', 'Trabalhos', 'Notas'];
const TIPOS_NOTA = ['Prova', 'Trabalho', 'Atividade', 'Participação', 'Recuperação', 'Outro'];
const ROTULO_STATUS = { ok: ['Na média', 'ok'], atencao: ['Atenção', 'alerta'], abaixo: ['Abaixo da média', 'erro'], sem_notas: ['Sem notas', 'neutro'] };

async function viewNotas($tela) {
  await Dados.carregar(TABELAS_NOTAS, () => renderNotas());
  if (rotaAtual !== 'notas') return;
  Nt.$tela = $tela;
  if (Nt.bim === null) { const c = ctxAgora(); Nt.bim = Motor.bimestreAtual(c) || 1; }
  $tela.onclick = cliqueNotas;
  renderNotas();
}
VIEWS.notas = viewNotas;

function textoSituacao(r) {
  if (r.status === 'sem_notas') return 'Nenhuma nota lançada ainda.';
  if (r.modelo === 'SOMA') {
    if (r.status === 'ok') return `Média mínima atingida.${r.restantes > 0 ? ` Ainda podem entrar ${fmtNum(r.restantes)} pontos.` : ''}`;
    if (r.status === 'atencao') return `Faltam ${fmtNum(r.faltam)} pontos para a média mínima. Ainda há ${fmtNum(r.restantes)} pontos para ganhar.`;
    return `Faltam ${fmtNum(r.faltam)} pontos, mas só restam ${fmtNum(r.restantes)} neste bimestre. Vale conversar com o professor sobre recuperação.`;
  }
  return r.status === 'ok' ? 'Acima da média mínima.' : `Abaixo da média mínima em ${fmtNum(r.faltam)} pontos.`;
}

function linhaAvaliacao(c, a, mid) {
  const quando = a.data ? ` · ${fmtDataCurta(a.data)}` : '';
  const acao = a.tabela === 'Notas'
    ? `<button class="btn btn-claro btn-p" data-acao="editar" data-id="${esc(a.id)}">Editar</button>`
    : `<a class="btn btn-claro btn-p" href="#/${a.tabela === 'Provas' ? 'provas' : 'trabalhos'}">Abrir</a>`;
  return `<div class="lista-linha"><div class="corpo"><strong>${esc(a.titulo)}</strong>
    <small>${esc(a.fonte)}${esc(quando)}${a.tabela === 'Notas' && c.regras.modelo_nota === 'MEDIA' && a.peso !== 1 ? ` · peso ${fmtNum(a.peso)}` : ''}</small></div>
    <strong>${fmtNum(a.nota)} <span class="de">de ${fmtNum(a.max)}</span></strong>${acao}</div>`;
}

function cartaoMateriaNotas(c, m) {
  const cabeca = (status) => `<div class="linha1"><span class="pto" style="background:${esc(m.cor || '#b071ea')}"></span><strong>${esc(m.nome)}</strong>
    <span class="selo ${ROTULO_STATUS[status][1]}">${ROTULO_STATUS[status][0]}</span></div>`;

  if (Nt.bim === 0) {
    const r = Motor.resultadoAno(c, m.id);
    return `<article class="cartao-nota">${cabeca(r.status)}
      ${r.status === 'sem_notas' ? '<p class="vazio">Nenhuma nota lançada neste ano.</p>' : `
        <p><strong>Resultado médio: ${fmtNum(r.resultado)}</strong> <span class="dica">· mínimo ${fmtNum(r.minima)}</span></p>
        <div class="chips">${r.bims.map(b => `<span class="chip">${b.bim}º bim.: ${fmtNum(b.resultado)}</span>`).join('')}</div>`}
    </article>`;
  }

  const r = Motor.resultadoBimestre(c, m.id, Nt.bim);
  const pontos = r.modelo === 'SOMA' ? r.obtidos : r.media;
  const pct = r.n ? Math.max(0, Math.min(100, pontos / r.escala * 100)) : 0;
  const marca = Math.max(0, Math.min(100, r.minima / r.escala * 100));
  return `<article class="cartao-nota">${cabeca(r.status)}
    ${r.n ? `<p><strong>${r.modelo === 'SOMA' ? `Pontos: ${fmtNum(r.obtidos)} de ${fmtNum(r.escala)}` : `Média: ${fmtNum(r.media)}`}</strong>
      <span class="dica">· mínimo ${fmtNum(r.minima)}</span></p>
      <div class="barra-nota" role="img" aria-label="${fmtNum(pontos)} de ${fmtNum(r.escala)}; mínimo ${fmtNum(r.minima)}"><i class="${r.status}" style="width:${pct}%"></i><b style="left:${marca}%"></b></div>` : ''}
    <p class="${r.status === 'abaixo' ? 'aviso-leve' : 'dica'}">${esc(textoSituacao(r))}</p>
    ${r.av.length ? `<div class="lista">${r.av.map(a => linhaAvaliacao(c, a, m.id)).join('')}</div>` : ''}
    <div><button class="btn btn-claro btn-p" data-acao="lancar" data-m="${esc(m.id)}">+ Lançar nota</button></div>
  </article>`;
}

function renderNotas() {
  if (rotaAtual !== 'notas') return;
  const c = ctxAgora();
  if (!c.ano || !c.ativas.length) {
    Nt.$tela.innerHTML = `<header><h1>Notas</h1></header><section class="painel em-breve">${Mascote.html('padrao', '')}
      <h2>Cadastre as matérias primeiro</h2><p>As notas são lançadas por matéria e por bimestre.</p><a class="btn" href="#/ano">Ir para Ano letivo</a></section>`;
    return;
  }
  const mats = c.ativas.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  const resultados = mats.map(m => ({ m, r: Nt.bim === 0 ? Motor.resultadoAno(c, m.id) : Motor.resultadoBimestre(c, m.id, Nt.bim) }));
  const foco = resultados.filter(x => x.r.status === 'abaixo' || x.r.status === 'atencao')
    .sort((a, b) => (b.r.status === 'abaixo') - (a.r.status === 'abaixo'));
  const modelo = c.regras.modelo_nota === 'SOMA' ? 'Soma de pontos: as avaliações somam até ' + fmtNum(c.regras.escala_notas) : 'Média das avaliações (de 0 a ' + fmtNum(c.regras.escala_notas) + ')';
  const chip = (v, r) => `<button data-acao="bim" data-v="${v}" aria-pressed="${Nt.bim === v}">${r}</button>`;

  // provas e trabalhos com nota, mas sem bimestre (as datas dos bimestres ainda não foram cadastradas)
  const semBim = [...c.provas.map(p => ({ t: `Prova ${String(p.tipo).toLowerCase()} de ${c.porId[p.materia_id].nome}`, n: p.nota, b: Number(p.bimestre) || Motor.bimestreDaData(c, p.data) })),
    ...c.trabalhos.map(x => ({ t: `${x.titulo} (${c.porId[x.materia_id].nome})`, n: x.nota, b: Number(x.bimestre) || Motor.bimestreDaData(c, x.data_entrega) }))]
    .filter(x => x.n !== '' && x.n != null && !x.b);
  Nt.$tela.innerHTML = `
  <header><h1>Notas</h1><p>Lance as notas e veja quanto falta para passar em cada matéria.</p></header>
  ${semBim.length ? `<div class="aviso-leve" style="display:block;margin-bottom:16px">${semBim.length === 1 ? '1 avaliação com nota ainda não entrou em nenhum bimestre' : semBim.length + ' avaliações com nota ainda não entraram em nenhum bimestre'}:
    ${esc(semBim.map(x => x.t).join('; '))}. Cadastre as datas dos bimestres em <a href="#/ano">Ano letivo</a> e elas entram sozinhas.</div>` : ''}
  <div class="filtros" role="group" aria-label="Período">${[1, 2, 3, 4].map(b => chip(b, `${b}º bimestre`)).join('')}${chip(0, 'Ano todo')}</div>
  <p class="dica" style="margin:12px 0 18px">Como a nota é calculada: ${esc(modelo)}. <a href="#/metas">Mudar</a></p>
  <section class="painel" style="margin-bottom:18px">
    <h2>Onde focar os estudos</h2>
    ${foco.length ? `<div class="chips" style="margin-top:12px">${foco.map(({ m, r }) =>
      `<span class="chip"><i style="background:${esc(m.cor || '#b071ea')}"></i>${esc(m.nome)} · ${r.status === 'abaixo' ? 'abaixo da média' : 'atenção'}</span>`).join('')}</div>
      <p class="dica" style="margin-top:10px">Dica: em Metas e regras dá para dar mais tempo de estudo a essas matérias.</p>`
      : `<p class="dica" style="margin-top:6px">${resultados.some(x => x.r.n || (x.r.bims && x.r.bims.length)) ? 'Nenhuma matéria em risco neste período.' : 'Quando as notas forem lançadas, as matérias que precisam de mais atenção aparecem aqui.'}</p>`}
  </section>
  <div class="pilha">${mats.map(m => cartaoMateriaNotas(c, m)).join('')}</div>`;
}

function cliqueNotas(ev) {
  const el = ev.target.closest('[data-acao]');
  if (!el) return;
  switch (el.dataset.acao) {
    case 'bim':    Nt.bim = Number(el.dataset.v); return renderNotas();
    case 'lancar': return formNota(null, el.dataset.m);
    case 'editar': return formNota(el.dataset.id, null);
  }
}

function formNota(id, mid) {
  const c = ctxAgora();
  const n = id ? Dados.t.Notas.find(x => x.id === id) : null;
  const mats = c.ativas.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  Dialogo.form({
    titulo: n ? 'Editar nota' : 'Lançar nota',
    campos: [
      { id: 'materia_id', rotulo: 'Matéria', tipo: 'select', valor: n ? n.materia_id : mid, obrigatorio: true, opcoes: mats.map(m => ({ valor: m.id, rotulo: m.nome })) },
      { id: 'bimestre', rotulo: 'Bimestre', tipo: 'select', valor: n ? String(n.bimestre) : String(Nt.bim || Motor.bimestreAtual(c) || 1), obrigatorio: true,
        opcoes: [1, 2, 3, 4].map(b => ({ valor: String(b), rotulo: `${b}º bimestre` })) },
      { id: 'tipo', rotulo: 'Tipo', tipo: 'select', valor: n ? n.tipo : 'Prova', obrigatorio: true, opcoes: TIPOS_NOTA.map(t => ({ valor: t, rotulo: t })) },
      { id: 'descricao', rotulo: 'Descrição', tipo: 'text', valor: n ? n.descricao : '', placeholder: 'Ex.: Prova de equações' },
      { id: 'nota', rotulo: 'Nota tirada', tipo: 'number', passo: '0.1', valor: n ? n.nota : '', obrigatorio: true },
      { id: 'nota_max', rotulo: 'Vale quantos pontos?', tipo: 'number', passo: '0.1', valor: n ? n.nota_max : 10, obrigatorio: true,
        ajuda: c.regras.modelo_nota === 'SOMA' ? 'No modelo de soma, é o que essa avaliação vale dentro do bimestre.' : 'Ex.: 10 para uma prova de 0 a 10.' },
      { id: 'peso', rotulo: 'Peso', tipo: 'number', passo: '0.1', valor: n && n.peso !== '' ? n.peso : 1,
        ajuda: c.regras.modelo_nota === 'MEDIA' ? 'Usado na média ponderada. Deixe 1 se todas valem igual.' : 'Só importa no modelo de média ponderada.' }
    ],
    onSalvar: async (v) => {
      if (v.nota_max <= 0) throw new Error('O valor da avaliação precisa ser maior que zero.');
      if (v.nota < 0 || v.nota > v.nota_max) throw new Error('A nota não pode ser maior que o valor da avaliação.');
      if (v.peso !== '' && v.peso <= 0) throw new Error('O peso precisa ser maior que zero.');
      const dados = { materia_id: v.materia_id, bimestre: Number(v.bimestre), tipo: v.tipo, descricao: v.descricao, nota: v.nota, nota_max: v.nota_max, peso: v.peso === '' ? 1 : v.peso };
      if (n) dados.id = n.id;
      await Dados.salvar('Notas', dados);
      Toast.mostrar('Nota salva.');
      renderNotas();
    },
    onExcluir: n ? async () => { await Dados.excluir('Notas', n.id); Toast.mostrar('Nota excluída.'); renderNotas(); } : null
  });
}
