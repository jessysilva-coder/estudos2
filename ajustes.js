/* Configurações: conta, Agenda Google, relatório semanal para o responsável e mascote */

const Aj = { $tela: null, conta: '' };

function viewAjustes($tela) {
  Aj.$tela = $tela;
  $tela.onclick = cliqueAjustes;
  renderAjustes();                         // aparece na hora, com o que já está guardado
  const antes = JSON.stringify(Sessao.usuario()) + Aj.conta;
  Api.me().then(r => {                     // e confere com o servidor por baixo dos panos
    Sessao.atualizarUsuario(r.usuario);
    Aj.conta = r.conta_agenda || '';
    if (JSON.stringify(r.usuario) + Aj.conta !== antes) Dados._seguro(renderAjustes);
  }).catch(e => { if (e.message === 'SESSAO_INVALIDA') sessaoExpirada(); });
}
VIEWS.config = viewAjustes;

function renderAjustes() {
  if (rotaAtual !== 'config') return;
  const u = Sessao.usuario();
  const linha = (rot, v) => `<dt>${rot}</dt><dd>${v ? esc(v) : '<span class="vazio">Não informado</span>'}</dd>`;
  Aj.$tela.innerHTML = `
  <header><h1>Configurações</h1><p>Seus dados, a Agenda Google e o relatório semanal.</p></header>
  <div class="stack">
    <section class="painel">
      <h2>Minha conta</h2>
      <dl class="dados-lista" style="margin-top:14px">
        ${linha('Nome', u.nome)}${linha('E-mail', u.email)}${linha('Responsável', u.nome_responsavel)}${linha('E-mail do responsável', u.email_responsavel)}
      </dl>
      <p class="dica" style="margin-top:12px">Para mudar esses dados, peça a quem fez o seu cadastro.</p>
    </section>

    <section class="painel">
      <h2>Agenda Google</h2>
      <p class="dica">${u.calendar_id ? 'Sua agenda está conectada. Os estudos marcados na tela Agenda são enviados para ela.' : 'Conecte uma agenda para enviar os compromissos de estudo.'}</p>
      <div class="campo" style="margin-top:14px"><label for="ag-id">ID ou link da agenda</label>
        <div class="entrada"><input id="ag-id" value="${esc(u.calendar_id || '')}" placeholder="exemplo@group.calendar.google.com" autocomplete="off"></div></div>
      <div class="resumo-acoes" style="margin-top:12px">
        <button class="btn btn-p" data-acao="salvar-agenda">Testar e salvar</button>
        ${u.calendar_id ? '<button class="btn btn-claro btn-p" data-acao="desconectar">Desconectar</button>' : ''}
      </div>
      <details class="como-fazer"><summary>Como conectar, passo a passo</summary>
        <ol>
          <li>No Google Agenda, crie uma agenda só para os estudos (em "Outras agendas", clique em <strong>+</strong> e em "Criar nova agenda").</li>
          <li>Abra as configurações dessa agenda, vá em <strong>Compartilhar com pessoas específicas</strong> e adicione ${Aj.conta ? `<strong>${esc(Aj.conta)}</strong>` : 'a conta do sistema'} com a permissão <strong>Fazer alterações em eventos</strong>.</li>
          <li>Mais abaixo, em <strong>Integrar agenda</strong>, copie o <strong>ID da agenda</strong> e cole no campo acima.</li>
          <li>Clique em <strong>Testar e salvar</strong>.</li>
        </ol>
      </details>
    </section>

    <section class="painel">
      <h2>Relatório semanal</h2>
      ${u.email_responsavel
        ? `<p class="dica">Toda segunda-feira, de manhã, ${esc(u.nome_responsavel || 'o responsável')} recebe em <strong>${esc(u.email_responsavel)}</strong> um resumo da semana: horas estudadas, se a meta foi batida e quais matérias foram estudadas.</p>
           <div class="resumo-acoes" style="margin-top:12px"><button class="btn btn-claro btn-p" data-acao="email-teste">Enviar um relatório de teste agora</button></div>`
        : '<p class="dica">Ainda não há e-mail de responsável cadastrado. Peça a quem fez o seu cadastro para incluir.</p>'}
    </section>

    <section class="painel">
      <h2>Mascote</h2>
      <p class="dica">As quatro imagens que o sistema usa. Se aparecer um desenho provisório, a imagem ainda não está no repositório.</p>
      <div class="galeria">${['padrao', 'estudando', 'chateado', 'bravo'].map(e => `<figure>${Mascote.html(e, ROTULO_MASCOTE[e])}<figcaption>${ROTULO_MASCOTE[e]}</figcaption></figure>`).join('')}</div>
    </section>
  </div>`;
}

async function cliqueAjustes(ev) {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.disabled) return;
  const acao = el.dataset.acao;
  if (acao === 'salvar-agenda') return salvarAgenda(el, document.getElementById('ag-id').value.trim());
  if (acao === 'desconectar') {
    const ok = await Dialogo.confirmar({ titulo: 'Desconectar a agenda?', texto: 'Os compromissos já enviados continuam na Agenda Google. Você só deixa de enviar novos.', ok: 'Desconectar' });
    if (ok) salvarAgenda(el, '');
  }
  if (acao === 'email-teste') enviarRelatorioAgora(el);
}

/* Envia agora o relatório da semana (até hoje) ao responsável. Usada aqui e na tela inicial. */
async function enviarRelatorioAgora(btn) {
  const u = Sessao.usuario();
  if (!u.email_responsavel) { Toast.mostrar('Ainda não há e-mail de responsável cadastrado.', 'erro'); return; }
  const ok = await Dialogo.confirmar({
    titulo: 'Enviar o relatório agora?',
    texto: `O resumo da semana até hoje será enviado para ${u.nome_responsavel ? u.nome_responsavel + ' (' + u.email_responsavel + ')' : u.email_responsavel}.`,
    ok: 'Enviar agora'
  });
  if (!ok) return;
  const original = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const r = await Api.emailTeste();
    Toast.mostrar(`Relatório enviado para ${r.para}.`);
  } catch (e) {
    tratarErro(e);
  } finally {
    btn.disabled = false; btn.innerHTML = original;
  }
}

async function salvarAgenda(btn, valor) {
  btn.disabled = true; const antes = btn.textContent; btn.textContent = 'Testando...';
  try {
    const r = await Api.agendaConfig(valor);
    Sessao.atualizarUsuario(Object.assign({}, Sessao.usuario(), { calendar_id: r.calendar_id || '' }));
    Toast.mostrar(r.nome ? `Agenda conectada: ${r.nome}.` : 'Agenda desconectada.');
  } catch (e) {
    btn.disabled = false; btn.textContent = antes;
    tratarErro(e);
    return;
  }
  renderAjustes();
}
