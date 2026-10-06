/* Motor do cronograma. Só cálculos, sem tela. Datas sempre em texto AAAA-MM-DD. */

/* Regras editáveis (aba Regras da planilha). O que não estiver lá usa estes valores. */
const REGRAS_PADRAO = {
  revisar_dia: 'SIM',              // estudar hoje: revisar as matérias que tiveram aula hoje
  antecipar_modo: 'AMANHA',        // NAO | AMANHA | PROXIMO (próximo dia com aula)
  divisao_tempo: 'IGUAL',          // IGUAL | FOCO_NOTAS (mais tempo para quem está com nota baixa)
  arredondamento: 5,               // minutos: o tempo de cada matéria é múltiplo disto
  limite_prova_pct: 60,            // no máximo X% do tempo do dia vai para provas e trabalhos
  dias_prova: 5,                   // dias de preparação antes de cada prova
  tempo_prova_bimestral: 180,      // minutos de preparação sugeridos por tipo de prova
  tempo_prova_semestral: 360,
  tempo_prova_recuperacao: 240,
  tempo_prova_simulado: 120,
  tempo_prova_outra: 120,
  dias_trabalho: 7,                // dias de dedicação antes da entrega de um trabalho
  tempo_trabalho: 180,             // minutos sugeridos para um trabalho
  modelo_nota: 'SOMA',             // SOMA (avaliações somam pontos) | MEDIA (média ponderada)
  escala_notas: 10,                // nota máxima do bimestre
  inicio_plano: ''                 // AAAA-MM-DD: a partir de quando cobrar o cronograma
};
const TIPOS_PROVA = ['Bimestral', 'Semestral', 'Recuperação', 'Simulado', 'Outra'];
const ROTULO_ORIGEM = { prova: 'Prova', trabalho: 'Trabalho', revisar: 'Revisar', antecipar: 'Adiantar' };
const chaveTempoProva = (tipo) => 'tempo_prova_' + String(tipo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const Motor = (() => {
  const N = (v, padrao = 0) => {
    if (v === '' || v === null || v === undefined) return padrao;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : padrao;
  };
  const ehData = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const PRIO = { prova: 0, trabalho: 1, revisar: 2, antecipar: 3 };

  /* ---------- contexto ---------- */
  function lerRegras(linhas) {
    const r = Object.assign({}, REGRAS_PADRAO);
    const mapa = {};
    (linhas || []).forEach(l => { mapa[l.chave] = l.valor; });
    Object.keys(REGRAS_PADRAO).forEach(k => {
      const v = mapa[k];
      if (v === undefined || v === null || v === '') return;
      r[k] = typeof REGRAS_PADRAO[k] === 'number' ? N(v, REGRAS_PADRAO[k]) : String(v).trim();
    });
    // compatibilidade com a regra antiga da planilha (antecipar_amanha = SIM/NAO)
    if (!('antecipar_modo' in mapa) && String(mapa.antecipar_amanha || '').trim().toUpperCase() === 'NAO') r.antecipar_modo = 'NAO';
    r.arredondamento = Math.max(1, Math.round(r.arredondamento));
    ['revisar_dia', 'antecipar_modo', 'divisao_tempo', 'modelo_nota'].forEach(k => { r[k] = String(r[k]).toUpperCase(); });
    return r;
  }

  function ctx(T, hoje) {
    const ano = escolherAno(T.AnoLetivo || []);
    const materias = (T.Materias || []).filter(m => ano && m.ano_id === ano.id);
    const ativas = materias.filter(ativa);
    const ids = new Set(ativas.map(m => m.id));
    const doAno = (l) => (l || []).filter(x => ids.has(x.materia_id));
    const c = {
      hoje, ano, materias, ativas, ids,
      porId: Object.fromEntries(materias.map(m => [m.id, m])),
      regras: lerRegras(T.Regras),
      grade: doAno(T.Grade), provas: doAno(T.Provas), trabalhos: doAno(T.Trabalhos), notas: doAno(T.Notas),
      metas: T.Metas || [], registros: T.Registros || [], plano: T.Plano || [],
      bimestres: (T.Bimestres || []).filter(b => ano && b.ano_id === ano.id)
    };
    c.inicioPlano = inicioPlano(c);
    return c;
  }

  function inicioPlano(c) {
    if (ehData(c.regras.inicio_plano)) return c.regras.inicio_plano;
    const datas = c.metas.map(m => String(m.criado_em || '')).filter(ehData).sort();
    return datas[0] || null;
  }

  /* ---------- metas e grade ---------- */
  const metaLinha = (c, iso) => c.metas.find(x => Number(x.dia_semana) === diaSemana(iso));
  const metaDoDia = (c, iso) => { const m = metaLinha(c, iso); return m ? Math.max(0, N(m.meta_minutos, 0)) : 0; };
  const comAula = (c, iso) => { const w = diaSemana(iso); return new Set(c.grade.filter(g => Number(g.dia_semana) === w).map(g => g.materia_id)); };

  function diaAlvoAntecipar(c, iso) {
    const modo = c.regras.antecipar_modo;
    if (modo === 'NAO') return null;
    if (modo === 'PROXIMO') {
      for (let i = 1; i <= 7; i++) { const d = addDias(iso, i); if (comAula(c, d).size) return d; }
      return null;
    }
    return addDias(iso, 1);
  }

  const diasComMeta = (c, de, ate) => intervaloDias(de, ate).filter(d => metaDoDia(c, d) > 0);

  /* ---------- provas e trabalhos: quanto tempo reservar em cada dia ---------- */
  function cotasProva(c, p) {
    const total = N(p.minutos_preparo, 0);
    const m = new Map();
    if (!ehData(p.data) || total <= 0) return m;
    const n = Math.max(1, N(p.dias_antes, c.regras.dias_prova));
    let ini = addDias(p.data, -n);
    if (ehData(p.criado_em) && p.criado_em > ini) ini = p.criado_em;   // não "planeja" o passado de uma prova que ainda não existia
    const dias = diasComMeta(c, ini, addDias(p.data, -1));
    dias.forEach(d => m.set(d, total / dias.length));
    return m;
  }

  function lerChecklist(t) {
    try {
      const a = JSON.parse(t.checklist || '[]');
      return Array.isArray(a) ? a.filter(x => x && x.t).map(x => ({ t: String(x.t), f: x.f ? 1 : 0 })) : [];
    } catch (e) { return []; }
  }
  const trabalhoConcluido = (t) => String(t.status) === 'Concluído';
  function progressoTrabalho(t) {
    if (trabalhoConcluido(t)) return 1;
    const l = lerChecklist(t);
    return l.length ? l.filter(x => x.f).length / l.length : 0;
  }

  function cotasTrabalho(c, t) {
    const total = N(t.minutos_estimados, 0);
    const m = new Map();
    if (!ehData(t.data_entrega) || total <= 0) return m;
    let ini = addDias(t.data_entrega, -Math.max(1, c.regras.dias_trabalho));
    if (ehData(t.criado_em) && t.criado_em > ini) ini = t.criado_em;
    const dias = diasComMeta(c, ini, addDias(t.data_entrega, -1));
    const futuros = dias.filter(d => d >= c.hoje);
    dias.filter(d => d < c.hoje).forEach(d => m.set(d, total / dias.length));          // histórico do que estava previsto
    const prog = progressoTrabalho(t);
    if (futuros.length && prog < 1) futuros.forEach(d => m.set(d, total * (1 - prog) / futuros.length)); // o que falta, daqui para frente
    return m;
  }

  /* ---------- divisão do tempo ---------- */
  const paraPasso = (m, passo) => (m <= 0 ? 0 : Math.max(passo, Math.round(m / passo) * passo));

  /* Reparte `total` minutos em múltiplos de `passo`, proporcional ao peso. As sobras vão para quem tem a maior fração. */
  function distribuir(total, itens, passo) {
    const unidades = Math.floor(total / passo);
    const soma = itens.reduce((s, i) => s + i.peso, 0);
    const cotas = itens.map(i => {
      const q = unidades * i.peso / soma;
      const base = Math.floor(q + 1e-9);
      return { id: i.id, base, frac: q - base };
    });
    let resto = unidades - cotas.reduce((s, x) => s + x.base, 0);
    cotas.slice().sort((a, b) => b.frac - a.frac).forEach(x => { if (resto > 0) { x.base++; resto--; } });
    return new Map(cotas.map(x => [x.id, x.base * passo]));
  }

  function pesoFoco(c, mid) {
    const r = resultadoAno(c, mid);
    return r.status === 'abaixo' ? 1.5 : r.status === 'atencao' ? 1.25 : 1;
  }

  function planoDoDia(c, iso) {
    const disp = metaDoDia(c, iso);
    const vazio = { data: iso, disponivel: disp, itens: [], avisos: [], sobra: disp };
    if (disp <= 0 || (c.inicioPlano && iso < c.inicioPlano)) return Object.assign(vazio, { disponivel: disp, itens: [] });
    const passo = c.regras.arredondamento;
    const itens = new Map();
    const avisos = [];
    const add = (mid, origem, minutos, detalhe) => {
      if (!c.ids.has(mid)) return;
      let it = itens.get(mid);
      if (!it) { it = { materia_id: mid, minutos: 0, origens: [], detalhes: [], prio: 9 }; itens.set(mid, it); }
      it.minutos += minutos;
      if (!it.origens.includes(origem)) it.origens.push(origem);
      if (detalhe && !it.detalhes.includes(detalhe)) it.detalhes.push(detalhe);
      it.prio = Math.min(it.prio, PRIO[origem]);
    };

    // 1) provas e trabalhos têm prioridade, mas ocupam no máximo X% do dia
    const extras = [];
    c.provas.forEach(p => { const q = cotasProva(c, p).get(iso); if (q) extras.push({ mid: p.materia_id, origem: 'prova', q, detalhe: `${p.tipo} em ${fmtDataCurta(p.data)}` }); });
    c.trabalhos.forEach(t => { const q = cotasTrabalho(c, t).get(iso); if (q) extras.push({ mid: t.materia_id, origem: 'trabalho', q, detalhe: `${t.titulo} (entrega ${fmtDataCurta(t.data_entrega)})` }); });
    const somaE = extras.reduce((s, e) => s + e.q, 0);
    const limite = disp * c.regras.limite_prova_pct / 100;
    const fator = somaE > limite && somaE > 0 ? limite / somaE : 1;
    if (fator < 1) avisos.push('O tempo de provas e trabalhos não cabe todo neste dia e foi reduzido.');
    let usado = 0;
    extras.forEach(e => { const m = paraPasso(e.q * fator, passo); usado += m; add(e.mid, e.origem, m, e.detalhe); });

    // 2) o restante é dividido entre revisar (aulas de hoje) e adiantar (aulas de amanhã), sem repetir matéria
    const reg = new Map();
    const marca = (id, o) => { if (c.ids.has(id)) { if (!reg.has(id)) reg.set(id, []); if (!reg.get(id).includes(o)) reg.get(id).push(o); } };
    if (c.regras.revisar_dia === 'SIM') comAula(c, iso).forEach(id => marca(id, 'revisar'));
    const alvo = diaAlvoAntecipar(c, iso);
    if (alvo) comAula(c, alvo).forEach(id => marca(id, 'antecipar'));
    const restante = Math.max(0, disp - usado);
    if (reg.size && restante >= passo) {
      const nomes = [...reg.keys()].sort((a, b) => String(c.porId[a].nome).localeCompare(String(c.porId[b].nome), 'pt-BR'));
      const giro = ((diasEntre('2000-01-03', iso) % nomes.length) + nomes.length) % nomes.length;   // as "sobras" de 5 min rodam entre as matérias
      const ordem = nomes.slice(giro).concat(nomes.slice(0, giro));
      const lista = ordem.map(id => ({ id, peso: c.regras.divisao_tempo === 'FOCO_NOTAS' ? pesoFoco(c, id) : 1 }));
      const cotas = distribuir(restante, lista, passo);
      reg.forEach((origs, id) => origs.forEach((o, i) => add(id, o, i === 0 ? (cotas.get(id) || 0) : 0, '')));
    }

    const lista = [...itens.values()].filter(i => i.minutos > 0)
      .sort((a, b) => a.prio - b.prio || String(c.porId[a.materia_id].nome).localeCompare(String(c.porId[b.materia_id].nome), 'pt-BR'));
    const total = lista.reduce((s, i) => s + i.minutos, 0);
    return { data: iso, disponivel: disp, itens: lista, avisos, sobra: Math.max(0, disp - total) };
  }

  /* Horário de cada item: começa na hora inicial da meta do dia e vai emendando */
  function horarios(c, iso, itens) {
    const m = metaLinha(c, iso);
    const mm = /^(\d{1,2}):(\d{2})/.exec(String(m && m.hora_inicio || ''));
    let t = mm ? Number(mm[1]) * 60 + Number(mm[2]) : 14 * 60;
    const f = (x) => { x = Math.min(x, 23 * 60 + 59); return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
    return itens.map(it => { const ini = t; t += it.minutos; return Object.assign({}, it, { inicio: f(ini), fim: f(t) }); });
  }

  /* ---------- progresso ---------- */
  const registrosDoDia = (c, iso) => c.registros.filter(r => r.data === iso);
  const estudado = (c, iso, mid) => registrosDoDia(c, iso)
    .filter(r => r.materia_id === mid && !String(r.origem).startsWith('check')).reduce((s, r) => s + N(r.minutos), 0);
  const estudadoTotal = (c, iso) => registrosDoDia(c, iso).reduce((s, r) => s + N(r.minutos), 0);
  const linhaPlano = (c, iso, mid) => c.plano.find(p => p.data === iso && p.materia_id === mid);

  function progresso(c, iso, item) {
    const row = linhaPlano(c, iso, item.materia_id);
    const feito = !!row && String(row.concluido).trim().toUpperCase() === 'SIM';
    const est = estudado(c, iso, item.materia_id);
    return { estudado: est, feito, pct: feito ? 1 : Math.min(1, item.minutos ? est / item.minutos : 0), evento: row ? (row.evento_agenda_id || '') : '' };
  }

  function resumoDia(c, iso) {
    const plano = planoDoDia(c, iso);
    let total = 0, feito = 0, ok = 0;
    const itens = horarios(c, iso, plano.itens).map(it => {
      const p = progresso(c, iso, it);
      total += it.minutos; feito += it.minutos * p.pct; if (p.pct >= 1) ok++;
      return Object.assign({}, it, p);
    });
    return Object.assign({}, plano, {
      itens, total, feito, pct: total ? feito / total : null,
      tudoFeito: itens.length > 0 && ok === itens.length, estudadoTotal: estudadoTotal(c, iso)
    });
  }

  function atrasados(c, de, ate) {
    const out = [];
    const fim = ate < addDias(c.hoje, -1) ? ate : addDias(c.hoje, -1);
    const ini = c.inicioPlano && c.inicioPlano > de ? c.inicioPlano : de;
    intervaloDias(ini, fim).forEach(d => {
      resumoDia(c, d).itens.forEach(it => { if (it.pct < 1) out.push(Object.assign({ data: d }, it, { falta: Math.max(0, it.minutos - it.estudado) })); });
    });
    return out;
  }

  /* feliz | triste | andamento | livre | futuro  (usado no calendário do mascote) */
  function statusDia(c, iso) {
    if (iso > c.hoje) return 'futuro';
    const r = resumoDia(c, iso);
    if (!r.itens.length) return r.estudadoTotal > 0 ? 'feliz' : 'livre';
    if (r.tudoFeito) return 'feliz';
    return iso === c.hoje ? 'andamento' : 'triste';
  }

  /* ---------- estatísticas ---------- */
  function minutosPorDia(c) {
    const m = new Map();
    c.registros.forEach(r => { if (r.data) m.set(r.data, (m.get(r.data) || 0) + N(r.minutos)); });
    return m;
  }
  function minutosPorMateria(c, de, ate) {
    const m = new Map();
    c.registros.forEach(r => { if (r.data >= de && r.data <= ate) m.set(r.materia_id, (m.get(r.materia_id) || 0) + N(r.minutos)); });
    return m;
  }
  function sequencias(c) {
    const m = minutosPorDia(c);
    let atual = 0;
    let d = (m.get(c.hoje) || 0) > 0 ? c.hoje : addDias(c.hoje, -1);
    while ((m.get(d) || 0) > 0) { atual++; d = addDias(d, -1); }
    let maior = 0, cur = 0, prev = null;
    [...m.keys()].filter(k => m.get(k) > 0).sort().forEach(k => { cur = prev && diasEntre(prev, k) === 1 ? cur + 1 : 1; maior = Math.max(maior, cur); prev = k; });
    return { atual, maior };
  }

  /* ---------- bimestres e notas ---------- */
  function bimestreDaData(c, iso) {
    const b = c.bimestres.find(x => ehData(x.inicio) && iso >= x.inicio && iso <= (x.fim_provas || x.fim_aulas || x.inicio));
    return b ? Number(b.numero) : 0;
  }
  const bimestreAtual = (c) => bimestreDaData(c, c.hoje);

  function avaliacoes(c, mid, bim) {
    const out = [];
    c.notas.filter(n => n.materia_id === mid && n.nota !== '' && n.nota != null).forEach(n => out.push({
      fonte: 'Lançamento', tabela: 'Notas', id: n.id, titulo: n.descricao || n.tipo || 'Avaliação', tipo: n.tipo || '',
      bimestre: Number(n.bimestre) || 0, nota: N(n.nota), max: N(n.nota_max, 10) || 10, peso: N(n.peso, 1) || 1
    }));
    c.provas.filter(p => p.materia_id === mid && p.nota !== '' && p.nota != null).forEach(p => out.push({
      fonte: 'Prova', tabela: 'Provas', id: p.id, titulo: `Prova ${String(p.tipo || '').toLowerCase()}`, tipo: 'Prova', data: p.data,
      bimestre: Number(p.bimestre) || bimestreDaData(c, p.data), nota: N(p.nota), max: N(p.nota_max, 10) || 10, peso: 1
    }));
    c.trabalhos.filter(t => t.materia_id === mid && t.nota !== '' && t.nota != null).forEach(t => out.push({
      fonte: 'Trabalho', tabela: 'Trabalhos', id: t.id, titulo: t.titulo, tipo: 'Trabalho', data: t.data_entrega,
      bimestre: Number(t.bimestre) || bimestreDaData(c, t.data_entrega), nota: N(t.nota), max: N(t.nota_max, 10) || 10, peso: 1
    }));
    return bim ? out.filter(a => a.bimestre === bim) : out;
  }

  function minimaDa(c, mid) {
    const m = c.porId[mid];
    return m && m.media_minima !== '' && m.media_minima != null ? N(m.media_minima) : N(c.ano && c.ano.media_minima, 6);
  }

  function resultadoBimestre(c, mid, bim) {
    const av = avaliacoes(c, mid, bim);
    const escala = c.regras.escala_notas, minima = minimaDa(c, mid), modelo = c.regras.modelo_nota;
    const base = { n: av.length, av, minima, escala, modelo };
    if (!av.length) return Object.assign(base, { status: 'sem_notas', resultado: null, faltam: null, obtidos: 0, distribuidos: 0, restantes: escala, media: null });
    const obtidos = av.reduce((s, a) => s + a.nota, 0);
    const distribuidos = av.reduce((s, a) => s + a.max, 0);
    const pesoT = av.reduce((s, a) => s + a.peso, 0);
    const media = av.reduce((s, a) => s + (a.nota / a.max) * escala * a.peso, 0) / pesoT;
    const restantes = Math.max(0, escala - distribuidos);
    let resultado, faltam, status;
    if (modelo === 'SOMA') {
      resultado = obtidos; faltam = Math.max(0, minima - obtidos);
      status = obtidos >= minima ? 'ok' : (restantes + 1e-9 >= faltam ? 'atencao' : 'abaixo');
    } else {
      resultado = media; faltam = Math.max(0, minima - media);
      status = media >= minima ? 'ok' : 'abaixo';
    }
    return Object.assign(base, { status, resultado, faltam, obtidos, distribuidos, restantes, media });
  }

  function resultadoAno(c, mid) {
    const bims = [1, 2, 3, 4].map(b => Object.assign({ bim: b }, resultadoBimestre(c, mid, b))).filter(r => r.n > 0);
    const minima = minimaDa(c, mid);
    if (!bims.length) return { status: 'sem_notas', resultado: null, minima, bims };
    const resultado = bims.reduce((s, r) => s + r.resultado, 0) / bims.length;
    const status = bims.some(r => r.status === 'abaixo') ? 'abaixo' : bims.some(r => r.status === 'atencao') ? 'atencao' : 'ok';
    return { status, resultado, minima, bims };
  }

  /* nota de uma avaliação isolada está acima do mínimo? */
  function acimaDoMinimo(c, mid, nota, max) {
    return (N(nota) / (N(max, 10) || 10)) * c.regras.escala_notas >= minimaDa(c, mid) - 1e-9;
  }

  return {
    N, ehData, ctx, lerRegras, inicioPlano, metaDoDia, metaLinha, comAula, diaAlvoAntecipar,
    cotasProva, cotasTrabalho, lerChecklist, progressoTrabalho, trabalhoConcluido,
    distribuir, planoDoDia, horarios, progresso, resumoDia, atrasados, statusDia,
    estudado, estudadoTotal, linhaPlano, minutosPorDia, minutosPorMateria, sequencias,
    bimestreDaData, bimestreAtual, avaliacoes, minimaDa, resultadoBimestre, resultadoAno, acimaDoMinimo
  };
})();
