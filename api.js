/* Comunicação com o Apps Script via JSONP (evita o bloqueio de CORS do redirecionamento). */

const Sessao = {
  token: () => localStorage.getItem('ce_token') || '',
  usuario: () => { try { return JSON.parse(localStorage.getItem('ce_usuario')); } catch (e) { return null; } },
  salvar(token, usuario) {
    localStorage.setItem('ce_token', token);
    localStorage.setItem('ce_usuario', JSON.stringify(usuario));
  },
  atualizarUsuario: (u) => localStorage.setItem('ce_usuario', JSON.stringify(u)),
  limpar() {
    localStorage.removeItem('ce_token');
    localStorage.removeItem('ce_usuario');
  }
};

const Api = (() => {
  const TIMEOUT_MS = 25000;
  const ESPERA_RETRY_MS = 2000; // o Apps Script "acorda" devagar: uma nova tentativa automática resolve

  function configurada() {
    const url = window.APP_CONFIG.API_URL || '';
    return /^https:\/\/script\.google\.com\/.+\/exec$/.test(url);
  }

  const LEITURAS = ['login', 'me', 'list', 'list_many'];   // só estas podem ser repetidas sem risco de duplicar dados
  const LIMITE_URL = 7000;

  function chamar(action, params = {}) {
    return new Promise((resolve, reject) => {
      if (!configurada()) {
        reject(new Error('O endereço do Apps Script ainda não foi colocado em config.js.'));
        return;
      }
      const tentar = (n) => {
        const cb = '__ce' + Date.now() + Math.floor(Math.random() * 1e6);
        const q = new URLSearchParams(Object.assign({ action, callback: cb, token: Sessao.token() }, params));
        const s = document.createElement('script');
        let encerrado = false;
        let timer;

        const limpar = () => { clearTimeout(timer); delete window[cb]; s.remove(); };
        const falhou = () => {
          if (encerrado) return;
          encerrado = true; limpar();
          if (n < 2 && LEITURAS.includes(action)) setTimeout(() => tentar(n + 1), ESPERA_RETRY_MS);
          else reject(new Error('O servidor não respondeu. Confira sua conexão e tente de novo.'));
        };

        timer = setTimeout(falhou, TIMEOUT_MS);
        s.onerror = falhou;
        window[cb] = (r) => {
          if (encerrado) return;
          encerrado = true; limpar();
          if (r && r.ok) resolve(r);
          else reject(new Error((r && r.erro) || 'Erro inesperado.'));
        };
        const url = window.APP_CONFIG.API_URL + '?' + q.toString();
        if (url.length > LIMITE_URL) {
          encerrado = true; limpar();
          reject(new Error('Esse texto ficou grande demais para salvar. Encurte um pouco.'));
          return;
        }
        s.src = url;
        document.head.appendChild(s);
      };
      tentar(1);
    });
  }

  return {
    configurada,
    login: (email, senha) => chamar('login', { email, senha }),
    me: () => chamar('me'),
    listar: (tabela) => chamar('list', { tabela }).then(r => r.dados),
    salvar: (tabela, dados) => chamar('save', { tabela, dados: JSON.stringify(dados) }).then(r => r.registro),
    excluir: (tabela, id) => chamar('delete', { tabela, id }),
    listarVarias: (tabelas) => chamar('list_many', { tabelas: tabelas.join(',') }).then(r => r.dados),
    agendaConfig: (calendar_id) => chamar('agenda_config', { calendar_id }),
    agendaExportar: (data, itens) => chamar('agenda_exportar', { data, itens: JSON.stringify(itens) }),
    agendaRemover: (data, materia_id) => chamar('agenda_remover', { data, materia_id }),
    emailTeste: () => chamar('email_teste')
  };
})();
