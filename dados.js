/* Armazém de dados em memória.
   - Tudo é carregado em segundo plano assim que o aluno entra, então trocar de tela é instantâneo.
   - Ao abrir uma tela, ela aparece na hora com o que já está na memória; se os dados estiverem
     velhos (mais de TTL), são atualizados por baixo dos panos e a tela se redesenha sozinha.
   - Salvar/excluir atualizam a memória na hora (e o servidor em seguida). */
const Dados = {
  t: {},
  quando: {},          // tabela -> momento da última atualização
  voos: [],            // pedidos ao servidor em andamento
  versao: 0,           // sobe a cada alteração local: um pedido antigo nunca desfaz o que o aluno acabou de salvar
  geracao: 0,          // sobe ao trocar de aluno: respostas antigas são descartadas
  TTL: 20000,

  limpar() { this.t = {}; this.quando = {}; this.voos = []; this.versao++; this.geracao++; },
  tocar() { this.versao++; },

  /* Devolve a memória na hora. Só espera o servidor se a tabela nunca foi carregada (ou se `forcar`). */
  async carregar(tabelas, aoMudar, forcar) {
    const nunca = tabelas.some(n => !(n in this.quando));
    if (nunca || forcar) { await this._buscar(tabelas); return this.t; }
    const velho = tabelas.some(n => Date.now() - this.quando[n] > this.TTL);
    if (velho) this._buscar(tabelas).then(mudou => { if (mudou && aoMudar) this._seguro(aoMudar); }).catch(() => { /* sem rede: segue com o que tem */ });
    return this.t;
  },

  /* Um pedido só para o que faltar; se já há um pedido cobrindo tudo, aproveita. Devolve true se algo mudou. */
  _buscar(tabelas) {
    let voo = this.voos.find(v => tabelas.every(n => v.set.has(n)));
    if (voo) return voo.promise;
    voo = { set: new Set(tabelas) };
    const v0 = this.versao, g0 = this.geracao;
    voo.promise = Api.listarVarias(tabelas).then(r => {
      if (g0 !== this.geracao) return false;                       // outro aluno entrou no meio do caminho
      let mudou = false;
      tabelas.forEach(n => {
        const jaTinha = n in this.quando;
        if (jaTinha && this.versao !== v0) return;                 // houve alteração local: mantém a versão local
        const novo = r[n] || [];
        if (!jaTinha || JSON.stringify(novo) !== JSON.stringify(this.t[n])) { this.t[n] = novo; mudou = true; }
        this.quando[n] = Date.now();
      });
      return mudou;
    }).finally(() => { this.voos = this.voos.filter(x => x !== voo); });
    this.voos.push(voo);
    return voo.promise;
  },

  /* Só redesenha a tela se o aluno não estiver no meio de uma digitação ou de uma janela aberta */
  _seguro(fn) {
    if (document.querySelector('dialog[open]')) return;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#tela')) return;
    try { fn(); } catch (e) { /* a própria tela cuida dos seus erros */ }
  },

  async salvar(tabela, dados) {
    this.tocar();
    const reg = await Api.salvar(tabela, dados);
    const lista = this.t[tabela] || (this.t[tabela] = []);
    const i = lista.findIndex(x => x.id === reg.id);
    if (i >= 0) lista[i] = reg; else lista.push(reg);
    this.tocar();
    return reg;
  },

  async excluir(tabela, id) {
    this.tocar();
    await Api.excluir(tabela, id);
    this.t[tabela] = (this.t[tabela] || []).filter(x => x.id !== id);
    this.tocar();
  }
};

/* Tudo o que o motor do cronograma precisa */
const TABELAS_MOTOR = ['AnoLetivo', 'Bimestres', 'Materias', 'Grade', 'Metas', 'Regras', 'Provas', 'Trabalhos', 'Notas', 'Registros', 'Plano'];
const TABELAS_ANO = ['AnoLetivo', 'Bimestres', 'Materias', 'Grade', 'Materiais'];
/* O que se carrega em segundo plano ao entrar: o motor + os materiais didáticos */
const TABELAS_TUDO = TABELAS_MOTOR.concat(['Materiais']);
