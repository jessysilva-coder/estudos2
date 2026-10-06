/* Início: resumo do dia, o que pede atenção e as matérias de hoje e de amanhã */

async function viewInicio($tela) {
  await Dados.carregar(TABELAS_MOTOR, () => renderInicio($tela));
  if (rotaAtual !== 'inicio') return;
  $tela.onclick = (ev) => {
    const el = ev.target.closest('[data-acao="relatorio"]');
    if (el && !el.disabled) enviarRelatorioAgora(el);
  };
  renderInicio($tela);
}
VIEWS.inicio = viewInicio;

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function chipsMaterias(c, ids) {
  const lista = [...ids].map(id => c.porId[id]).filter(Boolean).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  if (!lista.length) return null;
  return `<div class="chips">${lista.map(m => `<span class="chip"><i style="background:${esc(m.cor || '#b071ea')}"></i>${esc(m.nome)}</span>`).join('')}</div>`;
}

function renderInicio($tela) {
  if (rotaAtual !== 'inicio') return;
  const u = Sessao.usuario();
  const c = ctxAgora();
  const nome = primeiroNome(u.nome);
  const dataTxt = fmtDataLonga(c.hoje);

  if (!c.ano || !c.ativas.length) {
    $tela.innerHTML = `
    <section class="boas-vindas"><div><h1>${saudacao()}, ${esc(nome)}!</h1><p>${esc(dataTxt)}. Vamos começar?</p></div>${Mascote.html('padrao', 'Mascote sorrindo')}</section>
    <section class="painel"><h2>Primeiro passo</h2><p class="dica" style="margin:6px 0 14px">Cadastre o ano letivo, as matérias e os dias de aula. Com isso o cronograma de estudos monta o resto.</p>
      <a class="btn" href="#/ano">Cadastrar ano letivo</a></section>`;
    return;
  }

  const r = Motor.resumoDia(c, c.hoje);
  const atr = Motor.atrasados(c, addDias(c.hoje, -14), addDias(c.hoje, -1));   // só os últimos 14 dias: dá para agir sobre isso
  let humor = 'padrao', frase = 'Veja o que tem para estudar hoje.';
  if (r.pct != null && r.pct >= 1) frase = 'Plano de hoje concluído. Que orgulho!';
  else if (atr.length >= 15) { humor = 'bravo'; frase = 'Tem bastante coisa atrasada. Vamos organizar isso?'; }
  else if (r.estudadoTotal > 0) { humor = 'estudando'; frase = 'Você já começou. Falta pouco!'; }
  else if (atr.length) { humor = 'chateado'; frase = 'Ficou algo para trás. Dá para recuperar hoje.'; }

  const prova = c.provas.filter(p => p.data >= c.hoje).sort((a, b) => a.data.localeCompare(b.data))[0];
  const trab = c.trabalhos.filter(t => !Motor.trabalhoConcluido(t)).sort((a, b) => a.data_entrega.localeCompare(b.data_entrega))[0];
  const linhas = [];
  if (atr.length) linhas.push(`<a class="atencao-linha alerta" href="#/plano"><strong>${atr.length} ${atr.length === 1 ? 'item atrasado' : 'itens atrasados'}</strong><span>Últimos 14 dias · ver o que ficou para trás</span></a>`);
  if (prova) linhas.push(`<a class="atencao-linha" href="#/provas"><strong>${esc(c.porId[prova.materia_id].nome)}: prova ${esc(String(prova.tipo).toLowerCase())}</strong><span>${esc(fmtDataCurta(prova.data))} · ${esc(quandoTexto(prova.data, c.hoje))}</span></a>`);
  if (trab) linhas.push(`<a class="atencao-linha" href="#/trabalhos"><strong>${esc(trab.titulo)}</strong><span>Entrega em ${esc(fmtDataCurta(trab.data_entrega))} · ${esc(quandoTexto(trab.data_entrega, c.hoje))}</span></a>`);

  const alvo = Motor.diaAlvoAntecipar(c, c.hoje);
  const hojeHtml = chipsMaterias(c, Motor.comAula(c, c.hoje)) || '<p class="vazio">Hoje não tem aula cadastrada.</p>';
  const amanhaHtml = alvo ? (chipsMaterias(c, Motor.comAula(c, alvo)) || '<p class="vazio">Sem aula nesse dia.</p>') : '<p class="vazio">O estudo antecipado está desligado em Metas e regras.</p>';

  const temEmail = !!u.email_responsavel;
  $tela.innerHTML = `
  <section class="boas-vindas">
    <div><h1>${saudacao()}, ${esc(nome)}!</h1><p>${esc(dataTxt)}. ${esc(frase)}</p></div>
    ${Mascote.html(humor, 'Mascote')}
  </section>
  <section class="painel relatorio-card">
    <div><h2>Relatório para o responsável</h2>
      <p class="dica">${temEmail ? `Toda segunda-feira o resumo da semana vai para ${esc(u.nome_responsavel || 'o responsável')} (${esc(u.email_responsavel)}). Para ver como fica, envie agora.`
        : 'Ainda não há e-mail de responsável cadastrado. Peça a quem fez o seu cadastro para incluir.'}</p></div>
    <button class="btn" data-acao="relatorio" ${temEmail ? '' : 'disabled'}>📧 Enviar relatório ao responsável agora</button>
  </section>
  <div class="duas-colunas">
    <section class="painel hoje-card">
      <div class="donut-caixa pequeno">${donut(r.pct, r.pct == null ? '—' : null)}</div>
      <div><h2>Hoje</h2>
        <p class="dica">${r.itens.length ? (r.pct >= 1 ? 'Tudo concluído.' : `Faltam ${esc(fmtMin(Math.max(0, r.total - r.feito)))} do plano.`) : 'Dia livre, sem plano de estudo.'}</p>
        <div class="resumo-acoes"><a class="btn btn-p" href="#/plano">Ver plano</a><a class="btn btn-claro btn-p" href="#/cronometro">⏱️ Cronômetro</a></div></div>
    </section>
    <section class="painel"><h2>Atenção</h2>
      ${linhas.length ? `<div class="atencao">${linhas.join('')}</div>` : '<p class="dica" style="margin-top:6px">Tudo em dia por aqui.</p>'}
    </section>
    <section class="painel"><h2>Revisar hoje</h2><p class="dica">Matérias que tiveram aula hoje.</p>${hojeHtml}</section>
    <section class="painel"><h2>Estudar com antecedência</h2><p class="dica">${alvo ? `Matérias da aula de ${esc(alvo === addDias(c.hoje, 1) ? 'amanhã' : NOMES_DIA[diaSemana(alvo)].toLowerCase())}.` : 'Desligado.'}</p>${amanhaHtml}</section>
  </div>`;
}
