/* Etapa 2 — Ano letivo: bimestres, matérias, grade semanal e materiais didáticos */

const DIAS = [
  { n: 1, curto: 'Seg', longo: 'segunda' }, { n: 2, curto: 'Ter', longo: 'terça' },
  { n: 3, curto: 'Qua', longo: 'quarta' },  { n: 4, curto: 'Qui', longo: 'quinta' },
  { n: 5, curto: 'Sex', longo: 'sexta' },   { n: 6, curto: 'Sáb', longo: 'sábado' }
];
const CORES_MATERIA = ['#376adf', '#4F7CFF', '#2FB5D6', '#14B8A6', '#34C48B', '#7BC74D', '#F5A524', '#F08A4B',
                       '#E5566D', '#E879B9', '#b071ea', '#8B6CF0', '#C58B5A', '#9AA7C7'];
const TIPOS_MATERIAL = ['Apostila', 'Livro', 'Caderno de atividades', 'Outro'];

const Ano = {
  anoId: null, aba: 'bimestres', filtroBim: 'todos',
  pendentes: new Set(), $tela: null,
  // as listas moram no armazém de dados (Dados.t), compartilhado com as outras telas
  get anos() { return Dados.t.AnoLetivo || []; },      set anos(v) { Dados.t.AnoLetivo = v; },
  get bimestres() { return Dados.t.Bimestres || []; }, set bimestres(v) { Dados.t.Bimestres = v; },
  get materias() { return Dados.t.Materias || []; },   set materias(v) { Dados.t.Materias = v; },
  get grade() { return Dados.t.Grade || []; },         set grade(v) { Dados.t.Grade = v; },
  get materiais() { return Dados.t.Materiais || []; }, set materiais(v) { Dados.t.Materiais = v; }
};

/* ---------- dados ---------- */
function ajustarAnoEscolhido() {
  if (!Ano.anos.some(a => a.id === Ano.anoId)) { const a = escolherAno(Ano.anos); Ano.anoId = a ? a.id : null; }
}

const anoAtual = () => Ano.anos.find(a => a.id === Ano.anoId) || null;
const porNome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR');
const materiasDoAno = () => Ano.materias.filter(m => m.ano_id === Ano.anoId).sort(porNome);
const bimestresDoAno = () => Ano.bimestres.filter(b => b.ano_id === Ano.anoId).sort((a, b) => Number(a.numero) - Number(b.numero));
const idsMaterias = () => new Set(materiasDoAno().map(m => m.id));
const gradeDoAno = () => { const ids = idsMaterias(); return Ano.grade.filter(g => ids.has(g.materia_id)); };
const materiaisDoAno = () => { const ids = idsMaterias(); return Ano.materiais.filter(m => ids.has(m.materia_id)); };

const msUTC = (s) => { const [a, m, d] = String(s).split('-').map(Number); return Date.UTC(a, m - 1, d); };
const semanasEntre = (ini, fim) => Math.floor((msUTC(fim) - msUTC(ini)) / 864e5 / 7);

/* ---------- entrada da tela ---------- */
async function viewAno($tela) {
  await Dados.carregar(TABELAS_ANO, () => { ajustarAnoEscolhido(); renderAno(); });
  if (rotaAtual !== 'ano') return;
  Ano.anoId = null; ajustarAnoEscolhido();
  Ano.$tela = $tela;
  $tela.onclick = cliqueAno;
  $tela.onchange = mudancaAno;
  renderAno();
}
VIEWS.ano = viewAno;

/* ---------- desenho ---------- */
function renderAno() {
  const $t = Ano.$tela;
  const a = anoAtual();
  if (!a) {
    $t.innerHTML = `
    <header><h1>Ano letivo</h1></header>
    <section class="painel em-breve">
      ${Mascote.html('padrao', '')}
      <h2>Vamos começar pelo ano letivo</h2>
      <p>Cadastre o ano, os bimestres, as matérias e os dias de aula. Depois disso o cronograma de estudos monta o resto.</p>
      <button class="btn" data-acao="novo-ano">Cadastrar ano letivo</button>
    </section>`;
    return;
  }

  const seletor = Ano.anos.length > 1
    ? `<select id="sel-ano" aria-label="Ano letivo">${Ano.anos.map(x =>
        `<option value="${esc(x.id)}" ${x.id === a.id ? 'selected' : ''}>${esc(x.ano)}</option>`).join('')}</select>`
    : `<span class="ano-badge">${esc(a.ano)}</span>`;
  const abas = [
    ['bimestres', 'Bimestres'],
    ['materias', `Matérias (${materiasDoAno().length})`],
    ['grade', 'Grade semanal'],
    ['materiais', 'Materiais didáticos']
  ];

  $t.innerHTML = `
  <header><h1>Ano letivo</h1><p>Cadastre bimestres, matérias, dias de aula e materiais didáticos.</p></header>
  <section class="painel ano-topo">
    <div class="ano-info">${seletor}
      <div><strong>${esc(a.nome)}</strong><small class="dica" style="display:block">Média mínima para passar: ${esc(num(a.media_minima))}</small></div>
    </div>
    <div class="ano-acoes">
      <button class="btn btn-claro btn-p" data-acao="editar-ano">Editar</button>
      <button class="btn btn-claro btn-p" data-acao="novo-ano">Novo ano letivo</button>
    </div>
  </section>
  <div class="abas" role="tablist" aria-label="Seções do ano letivo">
    ${abas.map(([id, nome]) => `<button role="tab" aria-selected="${Ano.aba === id}" data-aba="${id}">${esc(nome)}</button>`).join('')}
  </div>
  <section role="tabpanel">${{ bimestres: htmlBimestres, materias: htmlMaterias, grade: htmlGrade, materiais: htmlMateriais }[Ano.aba]()}</section>`;
}

function htmlBimestres() {
  const bims = bimestresDoAno();
  const hoje = hojeISO();
  const faltam = [1, 2, 3, 4].filter(n => !bims.some(b => Number(b.numero) === n));
  const aviso = faltam.length
    ? `<div class="painel painel-topo" style="margin-bottom:16px"><p>${bims.length ? 'Faltam bimestres neste ano letivo.' : 'Este ano letivo ainda não tem bimestres.'}</p>
       <button class="btn btn-p" data-acao="criar-bimestres">Criar ${faltam.length === 4 ? 'os 4 bimestres' : 'os que faltam'}</button></div>` : '';

  const cards = bims.map(b => {
    const fimPeriodo = b.fim_provas || b.fim_aulas;
    const atual = b.inicio && fimPeriodo && b.inicio <= hoje && hoje <= fimPeriodo;
    let corpo;
    if (b.inicio && b.fim_aulas) {
      corpo = `<dt>Aulas</dt><dd>${fmtData(b.inicio)} a ${fmtData(b.fim_aulas)}</dd>
        ${b.fim_provas ? `<dt>Provas até</dt><dd>${fmtData(b.fim_provas)}</dd>` : ''}
        <dt>Duração</dt><dd>cerca de ${semanasEntre(b.inicio, b.fim_aulas)} semanas${temValor(b.dias_letivos) ? ` · ${esc(b.dias_letivos)} dias letivos` : ''}</dd>`;
    } else {
      corpo = `<dt>Aulas</dt><dd class="vazio">Datas ainda não cadastradas</dd>`;
    }
    return `<article class="card-bim ${atual ? 'atual' : ''}">
      <div class="card-bim-topo"><h3>${esc(b.numero)}º bimestre</h3>${atual ? '<span class="selo">Em andamento</span>' : ''}</div>
      <dl>${corpo}</dl>
      <div><button class="btn btn-claro btn-p" data-acao="editar-bim" data-id="${esc(b.id)}">Editar datas</button></div>
    </article>`;
  }).join('');
  return aviso + `<div class="grade-bim">${cards}</div>`;
}

function htmlMaterias() {
  const mats = materiasDoAno();
  const grade = gradeDoAno();
  const linhas = mats.map(m => {
    const n = grade.filter(g => g.materia_id === m.id).length;
    return `<div class="lista-linha ${ativa(m) ? '' : 'inativa'}">
      <span class="pto" style="background:${esc(m.cor || '#b071ea')}"></span>
      <div class="corpo"><strong>${esc(m.nome)}</strong>
        <small>${n} ${n === 1 ? 'aula' : 'aulas'} por semana${temValor(m.media_minima) ? ' · média mínima ' + esc(num(m.media_minima)) : ''}</small></div>
      ${ativa(m) ? '' : '<span class="selo neutro">Inativa</span>'}
      <button class="btn btn-claro btn-p" data-acao="editar-materia" data-id="${esc(m.id)}">Editar</button>
    </div>`;
  }).join('');
  return `<div class="painel">
    <div class="painel-topo"><h2>Matérias</h2><button class="btn btn-p" data-acao="nova-materia">+ Nova matéria</button></div>
    ${mats.length ? `<div class="lista">${linhas}</div>` : '<p class="vazio">Nenhuma matéria cadastrada ainda. Comece pelo botão "Nova matéria".</p>'}
  </div>`;
}

function htmlGrade() {
  const mats = materiasDoAno().filter(ativa);
  if (!mats.length) {
    return `<div class="painel"><p class="vazio">Cadastre as matérias primeiro para marcar os dias de aula.</p>
      <p style="margin-top:12px"><button class="btn btn-p" data-aba="materias">Ir para Matérias</button></p></div>`;
  }
  const grade = gradeDoAno();
  const tem = (mid, d) => grade.some(g => g.materia_id === mid && Number(g.dia_semana) === d);
  const linhas = mats.map(m => {
    const total = DIAS.filter(d => tem(m.id, d.n)).length;
    return `<tr><th scope="row"><span class="chip-cor"><i style="background:${esc(m.cor || '#b071ea')}"></i>${esc(m.nome)}</span></th>
      ${DIAS.map(d => {
        const on = tem(m.id, d.n);
        const pend = Ano.pendentes.has(m.id + '|' + d.n);
        return `<td><button class="cel ${on ? 'on' : ''} ${pend ? 'pend' : ''}" data-acao="alternar-aula" data-mat="${esc(m.id)}" data-dia="${d.n}"
          aria-pressed="${on}" aria-label="${esc(m.nome)}, ${d.longo}">${on ? '✓' : ''}</button></td>`;
      }).join('')}
      <td class="total">${total}</td></tr>`;
  }).join('');
  const porDia = DIAS.map(d => mats.filter(m => tem(m.id, d.n)).length);
  return `<p class="dica" style="margin:0 0 12px">Toque nos dias em que cada matéria tem aula. Cada toque já fica salvo.</p>
  <div class="tabela-rolagem"><table class="tabela tabela-grade">
    <thead><tr><th scope="col">Matéria</th>${DIAS.map(d => `<th scope="col">${d.curto}</th>`).join('')}<th scope="col">Por semana</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><th scope="row">Matérias no dia</th>${porDia.map(n => `<td>${n}</td>`).join('')}<td>${porDia.reduce((a, b) => a + b, 0)}</td></tr></tfoot>
  </table></div>`;
}

function htmlMateriais() {
  const mats = materiasDoAno();
  const porId = Object.fromEntries(mats.map(m => [m.id, m]));
  const filtros = [['todos', 'Todos'], ['0', 'Ano todo'], ['1', '1º bim.'], ['2', '2º bim.'], ['3', '3º bim.'], ['4', '4º bim.']];
  let lista = materiaisDoAno();
  if (Ano.filtroBim !== 'todos') lista = lista.filter(x => String(Number(x.bimestre) || 0) === Ano.filtroBim);
  lista.sort((a, b) => porNome(porId[a.materia_id], porId[b.materia_id]) || Number(a.bimestre) - Number(b.bimestre));
  const totalPaginas = lista.reduce((s, x) => s + (Number(x.paginas_total) || 0), 0);

  const linhas = lista.map(x => {
    const m = porId[x.materia_id];
    return `<tr>
      <td><span class="chip-cor"><i style="background:${esc(m.cor || '#b071ea')}"></i>${esc(m.nome)}</span></td>
      <td>${esc(x.tipo)}</td><td>${esc(x.titulo)}</td>
      <td>${Number(x.bimestre) ? esc(x.bimestre) + 'º' : 'Ano todo'}</td>
      <td class="dir">${temValor(x.paginas_total) ? esc(x.paginas_total) : '—'}</td>
      <td class="dir"><button class="btn btn-claro btn-p" data-acao="editar-material" data-id="${esc(x.id)}">Editar</button></td></tr>`;
  }).join('');

  return `<div class="painel">
    <div class="painel-topo"><h2>Materiais didáticos</h2>
      <button class="btn btn-p" data-acao="novo-material" ${mats.length ? '' : 'disabled'}>+ Novo material</button></div>
    <div class="filtros" role="group" aria-label="Filtrar por bimestre">
      ${filtros.map(([v, r]) => `<button data-acao="filtro-bim" data-v="${v}" aria-pressed="${Ano.filtroBim === v}">${r}</button>`).join('')}
    </div>
    ${!mats.length ? '<p class="vazio" style="margin-top:14px">Cadastre as matérias primeiro.</p>'
      : lista.length ? `<div class="tabela-rolagem" style="margin-top:14px"><table class="tabela">
          <thead><tr><th>Matéria</th><th>Tipo</th><th>Título</th><th>Bimestre</th><th class="dir">Páginas</th><th></th></tr></thead>
          <tbody>${linhas}</tbody></table></div>
        <p class="dica" style="margin-top:12px">${lista.length} ${lista.length === 1 ? 'material' : 'materiais'} · ${totalPaginas} páginas no total</p>`
      : '<p class="vazio" style="margin-top:14px">Nenhum material neste filtro.</p>'}
  </div>`;
}

/* ---------- eventos ---------- */
function cliqueAno(ev) {
  const el = ev.target.closest('[data-acao],[data-aba]');
  if (!el || el.disabled) return;
  if (el.dataset.aba) { Ano.aba = el.dataset.aba; renderAno(); return; }
  const id = el.dataset.id;
  switch (el.dataset.acao) {
    case 'editar-ano':      return formAno(false);
    case 'novo-ano':        return formAno(true);
    case 'criar-bimestres': return criarBimestres(true);
    case 'editar-bim':      return formBimestre(id);
    case 'nova-materia':    return formMateria(null);
    case 'editar-materia':  return formMateria(id);
    case 'alternar-aula':   return alternarAula(el.dataset.mat, Number(el.dataset.dia));
    case 'filtro-bim':      Ano.filtroBim = el.dataset.v; return renderAno();
    case 'novo-material':   return formMaterial(null);
    case 'editar-material': return formMaterial(id);
  }
}

function mudancaAno(ev) {
  if (ev.target.id === 'sel-ano') {
    Ano.anoId = ev.target.value;
    localStorage.setItem('ce_ano', Ano.anoId);
    renderAno();
  }
}

/* ---------- ano letivo ---------- */
function formAno(novo) {
  const a = novo ? null : anoAtual();
  Dialogo.form({
    titulo: novo ? 'Novo ano letivo' : 'Editar ano letivo',
    campos: [
      { id: 'ano', rotulo: 'Ano', tipo: 'number', valor: a ? a.ano : new Date().getFullYear(), obrigatorio: true },
      { id: 'nome', rotulo: 'Nome', tipo: 'text', valor: a ? a.nome : '', placeholder: 'Ex.: Ano letivo 2026' },
      { id: 'media_minima', rotulo: 'Média mínima para passar', tipo: 'number', passo: '0.1',
        valor: a ? a.media_minima : 6, obrigatorio: true, ajuda: 'A nota que a escola exige para aprovação, por matéria.' }
    ],
    onSalvar: async (v) => {
      if (v.ano < 2000 || v.ano > 2100) throw new Error('Informe um ano válido.');
      if (v.media_minima < 0 || v.media_minima > 100) throw new Error('Informe uma média válida.');
      const dados = { ano: v.ano, nome: v.nome || `Ano letivo ${v.ano}`, media_minima: v.media_minima };
      if (a) {
        dados.id = a.id;
        await Dados.salvar('AnoLetivo', dados);
      } else {
        dados.ativo = 'SIM';
        const reg = await Dados.salvar('AnoLetivo', dados);
        Ano.anoId = reg.id;
        localStorage.setItem('ce_ano', reg.id);
        await criarBimestres(false);
        Ano.aba = 'bimestres';
      }
      renderAno();
      Toast.mostrar('Ano letivo salvo.');
    }
  });
}

async function criarBimestres(avisar) {
  const tem = new Set(bimestresDoAno().map(b => Number(b.numero)));
  const faltam = [1, 2, 3, 4].filter(n => !tem.has(n));
  try {
    await Promise.all(faltam.map(n => Dados.salvar('Bimestres', { ano_id: Ano.anoId, numero: n })));
    if (avisar) { renderAno(); Toast.mostrar('Bimestres criados.'); }
  } catch (e) {
    if (avisar) tratarErro(e); else throw e;
  }
}

/* ---------- bimestre ---------- */
function formBimestre(id) {
  const b = Ano.bimestres.find(x => x.id === id);
  if (!b) return;
  Dialogo.form({
    titulo: `${b.numero}º bimestre`,
    campos: [
      { id: 'inicio', rotulo: 'Início das aulas', tipo: 'date', valor: b.inicio, obrigatorio: true },
      { id: 'fim_aulas', rotulo: 'Fim das aulas', tipo: 'date', valor: b.fim_aulas, obrigatorio: true },
      { id: 'fim_provas', rotulo: 'Fim do período de provas', tipo: 'date', valor: b.fim_provas },
      { id: 'dias_letivos', rotulo: 'Dias letivos', tipo: 'number', valor: b.dias_letivos, ajuda: 'Quantos dias de aula o bimestre tem, se você souber.' }
    ],
    onSalvar: async (v) => {
      if (v.fim_aulas < v.inicio) throw new Error('O fim das aulas não pode ser antes do início.');
      if (v.fim_provas && v.fim_provas < v.fim_aulas) throw new Error('O fim das provas não pode ser antes do fim das aulas.');
      await Dados.salvar('Bimestres', { id: b.id, ...v });
      renderAno();
      Toast.mostrar('Datas salvas.');
    }
  });
}

/* ---------- matéria ---------- */
function formMateria(id) {
  const m = id ? Ano.materias.find(x => x.id === id) : null;
  const usadas = new Set(materiasDoAno().map(x => String(x.cor).toLowerCase()));
  const corInicial = m ? m.cor : (CORES_MATERIA.find(c => !usadas.has(c.toLowerCase())) || CORES_MATERIA[0]);
  const a = anoAtual();
  Dialogo.form({
    titulo: m ? 'Editar matéria' : 'Nova matéria',
    campos: [
      { id: 'nome', rotulo: 'Nome da matéria', tipo: 'text', valor: m ? m.nome : '', obrigatorio: true },
      { id: 'cor', rotulo: 'Cor', tipo: 'cor', valor: corInicial, cores: CORES_MATERIA, obrigatorio: true },
      { id: 'media_minima', rotulo: 'Média mínima desta matéria', tipo: 'number', passo: '0.1', valor: m ? m.media_minima : '',
        ajuda: `Deixe em branco para usar a média do ano (${num(a.media_minima)}).` },
      { id: 'ativa', rotulo: 'Situação', tipo: 'select', valor: m ? (ativa(m) ? 'SIM' : 'NAO') : 'SIM', obrigatorio: true,
        opcoes: [{ valor: 'SIM', rotulo: 'Ativa' }, { valor: 'NAO', rotulo: 'Inativa (some do cronograma)' }] }
    ],
    onSalvar: async (v) => {
      const repetida = materiasDoAno().some(x => x.id !== (m && m.id) && String(x.nome).toLowerCase() === v.nome.toLowerCase());
      if (repetida) throw new Error('Já existe uma matéria com esse nome.');
      const dados = { nome: v.nome, cor: v.cor, media_minima: v.media_minima, ativa: v.ativa };
      if (m) {
        dados.id = m.id;
        await Dados.salvar('Materias', dados);
      } else {
        dados.ano_id = Ano.anoId;
        await Dados.salvar('Materias', dados);
      }
      renderAno();
      Toast.mostrar('Matéria salva.');
    },
    onExcluir: m ? async () => {
      const g = Ano.grade.filter(x => x.materia_id === m.id);
      const t = Ano.materiais.filter(x => x.materia_id === m.id);
      await Promise.all([...g.map(x => Dados.excluir('Grade', x.id)), ...t.map(x => Dados.excluir('Materiais', x.id))]);
      await Dados.excluir('Materias', m.id);
      renderAno();
      Toast.mostrar('Matéria excluída, com seus dias de aula e materiais.');
    } : null
  });
}

/* ---------- grade semanal (salva a cada toque) ---------- */
async function alternarAula(materiaId, dia) {
  const chave = materiaId + '|' + dia;
  if (Ano.pendentes.has(chave)) return;
  Ano.pendentes.add(chave);
  Dados.tocar();
  const existente = Ano.grade.find(g => g.materia_id === materiaId && Number(g.dia_semana) === dia);
  try {
    if (existente) {
      Ano.grade = Ano.grade.filter(g => g !== existente);
      renderAno();
      try { await Api.excluir('Grade', existente.id); }
      catch (e) { Ano.grade.push(existente); throw e; }
    } else {
      const provisorio = { id: 'tmp-' + chave, materia_id: materiaId, dia_semana: dia };
      Ano.grade.push(provisorio);
      renderAno();
      try {
        const reg = await Api.salvar('Grade', { materia_id: materiaId, dia_semana: dia });
        Ano.grade[Ano.grade.indexOf(provisorio)] = reg;
      } catch (e) { Ano.grade = Ano.grade.filter(g => g !== provisorio); throw e; }
    }
  } catch (e) {
    tratarErro(e);
  } finally {
    Ano.pendentes.delete(chave);
    Dados.tocar();
    if (rotaAtual === 'ano') renderAno();
  }
}

/* ---------- material didático ---------- */
function formMaterial(id) {
  const x = id ? Ano.materiais.find(i => i.id === id) : null;
  const mats = materiasDoAno();
  Dialogo.form({
    titulo: x ? 'Editar material' : 'Novo material didático',
    campos: [
      { id: 'materia_id', rotulo: 'Matéria', tipo: 'select', valor: x ? x.materia_id : mats[0].id, obrigatorio: true,
        opcoes: mats.map(m => ({ valor: m.id, rotulo: m.nome })) },
      { id: 'tipo', rotulo: 'Tipo', tipo: 'select', valor: x ? x.tipo : 'Apostila', obrigatorio: true,
        opcoes: TIPOS_MATERIAL.map(t => ({ valor: t, rotulo: t })) },
      { id: 'titulo', rotulo: 'Título', tipo: 'text', valor: x ? x.titulo : '', obrigatorio: true, placeholder: 'Ex.: Apostila de Álgebra' },
      { id: 'bimestre', rotulo: 'Usado em qual bimestre?', tipo: 'select', valor: x ? String(Number(x.bimestre) || 0) : '0', obrigatorio: true,
        opcoes: [{ valor: '0', rotulo: 'Ano todo' }, { valor: '1', rotulo: '1º bimestre' }, { valor: '2', rotulo: '2º bimestre' },
                 { valor: '3', rotulo: '3º bimestre' }, { valor: '4', rotulo: '4º bimestre' }],
        ajuda: 'Algumas escolas usam um livro por bimestre.' },
      { id: 'paginas_total', rotulo: 'Total de páginas', tipo: 'number', valor: x ? x.paginas_total : '' }
    ],
    onSalvar: async (v) => {
      if (v.paginas_total !== '' && (v.paginas_total < 0 || !Number.isInteger(v.paginas_total))) throw new Error('O total de páginas precisa ser um número inteiro.');
      const dados = { materia_id: v.materia_id, tipo: v.tipo, titulo: v.titulo, bimestre: Number(v.bimestre), paginas_total: v.paginas_total };
      if (x) {
        dados.id = x.id;
        await Dados.salvar('Materiais', dados);
      } else {
        await Dados.salvar('Materiais', dados);
      }
      renderAno();
      Toast.mostrar('Material salvo.');
    },
    onExcluir: x ? async () => {
      await Dados.excluir('Materiais', x.id);
      renderAno();
      Toast.mostrar('Material excluído.');
    } : null
  });
}
